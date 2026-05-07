package db

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	gonanoid "github.com/jaevor/go-nanoid"
	"github.com/jmoiron/sqlx"
)

// newID returns a cryptographically random 21-character NanoID string.
func newID() string {
	gen, err := gonanoid.Standard(21)
	if err != nil {
		panic(fmt.Sprintf("newID: %v", err))
	}
	return gen()
}

// nowISO returns the current UTC time formatted as RFC3339.
func nowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}

// isNotFound returns true when err is sql.ErrNoRows.
func isNotFound(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}

// ---- Accounts -------------------------------------------------------------

// CreateAccount inserts a new account and returns it.
func CreateAccount(db *sqlx.DB, name, email, passwordHash string) (*Account, error) {
	id := newID()
	now := nowISO()
	q := db.Rebind(`INSERT INTO accounts (id, name, email, password_hash, created_at)
	                VALUES (?, ?, ?, ?, ?)
	                RETURNING id, name, email, password_hash, created_at`)
	var a Account
	if err := db.Get(&a, q, id, name, strings.ToLower(email), passwordHash, now); err != nil {
		return nil, fmt.Errorf("CreateAccount: %w", err)
	}
	return &a, nil
}

// GetAccountByEmail returns the account with the given email, or nil if not found.
func GetAccountByEmail(db *sqlx.DB, email string) (*Account, error) {
	var a Account
	q := db.Rebind(`SELECT id, name, email, password_hash, created_at
	                FROM accounts WHERE email = ? LIMIT 1`)
	if err := db.Get(&a, q, strings.ToLower(email)); err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("GetAccountByEmail: %w", err)
	}
	return &a, nil
}

// GetAccountById returns the account with the given ID, or nil if not found.
func GetAccountById(db *sqlx.DB, id string) (*Account, error) {
	var a Account
	q := db.Rebind(`SELECT id, name, email, password_hash, created_at
	                FROM accounts WHERE id = ? LIMIT 1`)
	if err := db.Get(&a, q, id); err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("GetAccountById: %w", err)
	}
	return &a, nil
}

// UpdateAccountName updates the name for the given account and returns it.
func UpdateAccountName(db *sqlx.DB, id, name string) (*Account, error) {
	q := db.Rebind(`UPDATE accounts SET name = ? WHERE id = ?
	                RETURNING id, name, email, password_hash, created_at`)
	var a Account
	if err := db.Get(&a, q, name, id); err != nil {
		return nil, fmt.Errorf("UpdateAccountName: %w", err)
	}
	return &a, nil
}

// ---- Seed -----------------------------------------------------------------

type seedType struct {
	name     string
	category string
	miles    *int64
	months   *int64
}

func int64Ptr(v int64) *int64 { return &v }

var seedTypes = []seedType{
	// ENGINE
	{name: "Oil & Filter Change", category: "engine", miles: int64Ptr(5000), months: int64Ptr(6)},
	{name: "Engine Air Filter", category: "engine", miles: int64Ptr(30000), months: int64Ptr(24)},
	{name: "PCV Valve", category: "engine", miles: int64Ptr(60000), months: int64Ptr(48)},
	{name: "Spark Plugs", category: "engine", miles: int64Ptr(60000), months: int64Ptr(48)},
	{name: "Coolant Flush", category: "engine", miles: int64Ptr(100000), months: int64Ptr(60)},
	{name: "Timing Belt Inspection", category: "engine", miles: int64Ptr(60000), months: int64Ptr(48)},
	// TRANSMISSION
	{name: "Transmission Fluid", category: "transmission", miles: int64Ptr(60000), months: int64Ptr(48)},
	{name: "Transfer Case Fluid", category: "transmission", miles: int64Ptr(60000), months: int64Ptr(48)},
	{name: "Differential Fluid", category: "transmission", miles: int64Ptr(60000), months: int64Ptr(48)},
	// BRAKES
	{name: "Brake Fluid", category: "brakes", miles: int64Ptr(45000), months: int64Ptr(36)},
	{name: "Brake Pads (Front)", category: "brakes", miles: int64Ptr(40000), months: nil},
	{name: "Brake Pads (Rear)", category: "brakes", miles: int64Ptr(50000), months: nil},
	{name: "Rotor Inspection", category: "brakes", miles: int64Ptr(40000), months: nil},
	// TIRES
	{name: "Tire Rotation", category: "tires", miles: int64Ptr(7500), months: int64Ptr(6)},
	{name: "Tire Pressure Check", category: "tires", miles: int64Ptr(3000), months: int64Ptr(3)},
	{name: "Wheel Alignment", category: "tires", miles: int64Ptr(30000), months: int64Ptr(24)},
	{name: "Wheel Balancing", category: "tires", miles: int64Ptr(15000), months: int64Ptr(12)},
	// FLUIDS
	{name: "Power Steering Fluid", category: "fluids", miles: int64Ptr(50000), months: int64Ptr(36)},
	{name: "Windshield Washer Fluid", category: "fluids", miles: nil, months: nil},
	// FILTERS
	{name: "Cabin Air Filter", category: "filters", miles: int64Ptr(20000), months: int64Ptr(12)},
	{name: "Fuel Filter", category: "filters", miles: int64Ptr(40000), months: int64Ptr(24)},
	// BELTS
	{name: "Serpentine Belt", category: "belts", miles: int64Ptr(80000), months: int64Ptr(60)},
	{name: "Timing Belt Replacement", category: "belts", miles: int64Ptr(100000), months: int64Ptr(84)},
	// ELECTRICAL
	{name: "Battery", category: "electrical", miles: nil, months: int64Ptr(48)},
	{name: "Wiper Blades", category: "electrical", miles: nil, months: int64Ptr(12)},
}

// SeedMaintenanceTypes inserts the 25 default maintenance types if none exist yet.
func SeedMaintenanceTypes(db *sqlx.DB) error {
	var count int
	q := db.Rebind(`SELECT COUNT(*) FROM maintenance_types WHERE is_default = ?`)
	if err := db.Get(&count, q, true); err != nil {
		return fmt.Errorf("SeedMaintenanceTypes: check existing: %w", err)
	}
	if count > 0 {
		return nil
	}

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("SeedMaintenanceTypes: begin tx: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck

	ins := db.Rebind(`INSERT INTO maintenance_types
		(id, name, category, default_interval_miles, default_interval_months, is_default, account_id)
		VALUES (?, ?, ?, ?, ?, ?, NULL)`)

	for _, t := range seedTypes {
		var miles, months interface{}
		if t.miles != nil {
			miles = *t.miles
		}
		if t.months != nil {
			months = *t.months
		}
		if _, err := tx.Exec(ins, newID(), t.name, t.category, miles, months, true); err != nil {
			return fmt.Errorf("SeedMaintenanceTypes: insert %q: %w", t.name, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("SeedMaintenanceTypes: commit: %w", err)
	}
	return nil
}

// ---- Vehicles -------------------------------------------------------------

// CreateVehicle inserts a new vehicle. The v parameter should have all fields
// set except ID, CreatedAt, and UpdatedAt (which are set automatically).
func CreateVehicle(db *sqlx.DB, v Vehicle) (*Vehicle, error) {
	id := newID()
	now := nowISO()
	q := db.Rebind(`INSERT INTO vehicles
		(id, account_id, name, make, model, year, vin, license_plate, units, current_mileage,
		 qr_slug, qr_pin_hash, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		RETURNING id, account_id, name, make, model, year, vin, license_plate, units,
		          current_mileage, qr_slug, qr_pin_hash, created_at, updated_at`)
	var out Vehicle
	err := db.Get(&out, q,
		id, v.AccountID, v.Name, v.Make, v.Model, v.Year, v.VIN, v.LicensePlate,
		v.Units, v.CurrentMileage, v.QRSlug, v.QRPinHash, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("CreateVehicle: %w", err)
	}
	return &out, nil
}

// GetVehiclesByAccountId returns all vehicles belonging to the given account.
func GetVehiclesByAccountId(db *sqlx.DB, accountId string) ([]Vehicle, error) {
	q := db.Rebind(`SELECT id, account_id, name, make, model, year, vin, license_plate, units,
		current_mileage, qr_slug, qr_pin_hash, created_at, updated_at
		FROM vehicles WHERE account_id = ?`)
	var out []Vehicle
	if err := db.Select(&out, q, accountId); err != nil {
		return nil, fmt.Errorf("GetVehiclesByAccountId: %w", err)
	}
	return out, nil
}

// GetVehicleById returns the vehicle with the given id owned by accountId,
// or nil, nil if not found.
func GetVehicleById(db *sqlx.DB, id, accountId string) (*Vehicle, error) {
	q := db.Rebind(`SELECT id, account_id, name, make, model, year, vin, license_plate, units,
		current_mileage, qr_slug, qr_pin_hash, created_at, updated_at
		FROM vehicles WHERE id = ? AND account_id = ? LIMIT 1`)
	var v Vehicle
	if err := db.Get(&v, q, id, accountId); err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("GetVehicleById: %w", err)
	}
	return &v, nil
}

// GetVehicleByQrSlug returns the vehicle with the given QR slug, or nil if not found.
func GetVehicleByQrSlug(db *sqlx.DB, slug string) (*Vehicle, error) {
	q := db.Rebind(`SELECT id, account_id, name, make, model, year, vin, license_plate, units,
		current_mileage, qr_slug, qr_pin_hash, created_at, updated_at
		FROM vehicles WHERE qr_slug = ? LIMIT 1`)
	var v Vehicle
	if err := db.Get(&v, q, slug); err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("GetVehicleByQrSlug: %w", err)
	}
	return &v, nil
}

// UpdateVehicle applies the given key/value pairs to the vehicle and returns the updated row.
// updated_at is always set to now. Only the columns present in updates are changed.
func UpdateVehicle(db *sqlx.DB, id, accountId string, updates map[string]any) (*Vehicle, error) {
	if len(updates) == 0 {
		return GetVehicleById(db, id, accountId)
	}
	now := nowISO()
	updates["updated_at"] = now

	setClauses := make([]string, 0, len(updates))
	args := make([]any, 0, len(updates)+2)
	for col, val := range updates {
		setClauses = append(setClauses, col+" = ?")
		args = append(args, val)
	}
	args = append(args, id, accountId)

	q := db.Rebind(fmt.Sprintf(
		`UPDATE vehicles SET %s WHERE id = ? AND account_id = ?
		 RETURNING id, account_id, name, make, model, year, vin, license_plate, units,
		           current_mileage, qr_slug, qr_pin_hash, created_at, updated_at`,
		strings.Join(setClauses, ", "),
	))
	var v Vehicle
	if err := db.Get(&v, q, args...); err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("UpdateVehicle: %w", err)
	}
	return &v, nil
}

// DeleteVehicle removes the vehicle owned by accountId.
func DeleteVehicle(db *sqlx.DB, id, accountId string) error {
	q := db.Rebind(`DELETE FROM vehicles WHERE id = ? AND account_id = ?`)
	if _, err := db.Exec(q, id, accountId); err != nil {
		return fmt.Errorf("DeleteVehicle: %w", err)
	}
	return nil
}

// ---- Maintenance Types ----------------------------------------------------

// applyOverrides merges per-account interval overrides into the type slice.
func applyOverrides(types []MaintenanceType, overrides map[string]AccountTypeOverride) []MaintenanceType {
	out := make([]MaintenanceType, len(types))
	for i, t := range types {
		o, ok := overrides[t.ID]
		if !ok {
			out[i] = t
			continue
		}
		if o.IntervalMiles.Valid {
			t.DefaultIntervalMiles = o.IntervalMiles
		}
		if o.IntervalMonths.Valid {
			t.DefaultIntervalMonths = o.IntervalMonths
		}
		out[i] = t
	}
	return out
}

// GetMaintenanceTypes returns all enabled maintenance types for an account
// (defaults + custom), with per-account overrides applied, excluding disabled ones.
func GetMaintenanceTypes(db *sqlx.DB, accountId string) ([]MaintenanceType, error) {
	disabledIds, err := GetDisabledTypeIds(db, accountId)
	if err != nil {
		return nil, err
	}
	overrides, err := GetTypeOverrides(db, accountId)
	if err != nil {
		return nil, err
	}

	// Fetch default types (account_id IS NULL).
	defaultQ := `SELECT id, name, category, default_interval_miles, default_interval_months,
		is_default, account_id FROM maintenance_types WHERE account_id IS NULL`
	var defaults []MaintenanceType
	if err := db.Select(&defaults, defaultQ); err != nil {
		return nil, fmt.Errorf("GetMaintenanceTypes: defaults: %w", err)
	}

	// Fetch custom types for this account.
	customQ := db.Rebind(`SELECT id, name, category, default_interval_miles, default_interval_months,
		is_default, account_id FROM maintenance_types WHERE account_id = ?`)
	var custom []MaintenanceType
	if err := db.Select(&custom, customQ, accountId); err != nil {
		return nil, fmt.Errorf("GetMaintenanceTypes: custom: %w", err)
	}

	// Merge, filter disabled.
	disabledSet := make(map[string]bool, len(disabledIds))
	for _, id := range disabledIds {
		disabledSet[id] = true
	}
	all := append(defaults, custom...)
	filtered := all[:0]
	for _, t := range all {
		if !disabledSet[t.ID] {
			filtered = append(filtered, t)
		}
	}

	return applyOverrides(filtered, overrides), nil
}

// GetMaintenanceTypesAll returns all types (defaults + custom) with overrides, including disabled.
func GetMaintenanceTypesAll(db *sqlx.DB, accountId string) ([]MaintenanceType, error) {
	q := db.Rebind(`SELECT id, name, category, default_interval_miles, default_interval_months,
		is_default, account_id
		FROM maintenance_types
		WHERE account_id IS NULL OR account_id = ?`)
	var types []MaintenanceType
	if err := db.Select(&types, q, accountId); err != nil {
		return nil, fmt.Errorf("GetMaintenanceTypesAll: %w", err)
	}
	overrides, err := GetTypeOverrides(db, accountId)
	if err != nil {
		return nil, err
	}
	return applyOverrides(types, overrides), nil
}

// GetDisabledTypeIds returns the IDs of maintenance types the account has disabled.
func GetDisabledTypeIds(db *sqlx.DB, accountId string) ([]string, error) {
	q := db.Rebind(`SELECT type_id FROM account_disabled_types WHERE account_id = ?`)
	var ids []string
	if err := db.Select(&ids, q, accountId); err != nil {
		return nil, fmt.Errorf("GetDisabledTypeIds: %w", err)
	}
	return ids, nil
}

// GetTypeOverrides returns a map of typeId -> AccountTypeOverride for the account.
func GetTypeOverrides(db *sqlx.DB, accountId string) (map[string]AccountTypeOverride, error) {
	q := db.Rebind(`SELECT account_id, type_id, interval_miles, interval_months
		FROM account_type_overrides WHERE account_id = ?`)
	var rows []AccountTypeOverride
	if err := db.Select(&rows, q, accountId); err != nil {
		return nil, fmt.Errorf("GetTypeOverrides: %w", err)
	}
	m := make(map[string]AccountTypeOverride, len(rows))
	for _, r := range rows {
		m[r.TypeID] = r
	}
	return m, nil
}

// UpsertTypeOverride creates or updates an interval override for the account/type pair.
func UpsertTypeOverride(db *sqlx.DB, accountId, typeId string, miles, months *int64) error {
	var milesVal, monthsVal interface{}
	if miles != nil {
		milesVal = *miles
	}
	if months != nil {
		monthsVal = *months
	}
	q := db.Rebind(`INSERT INTO account_type_overrides (account_id, type_id, interval_miles, interval_months)
		VALUES (?, ?, ?, ?)
		ON CONFLICT (account_id, type_id) DO UPDATE SET
		  interval_miles  = excluded.interval_miles,
		  interval_months = excluded.interval_months`)
	if _, err := db.Exec(q, accountId, typeId, milesVal, monthsVal); err != nil {
		return fmt.Errorf("UpsertTypeOverride: %w", err)
	}
	return nil
}

// DisableMaintenanceType adds an account_disabled_types record (INSERT OR IGNORE).
func DisableMaintenanceType(db *sqlx.DB, accountId, typeId string) error {
	q := db.Rebind(`INSERT INTO account_disabled_types (account_id, type_id)
		VALUES (?, ?) ON CONFLICT DO NOTHING`)
	if _, err := db.Exec(q, accountId, typeId); err != nil {
		return fmt.Errorf("DisableMaintenanceType: %w", err)
	}
	return nil
}

// EnableMaintenanceType removes an account_disabled_types record.
func EnableMaintenanceType(db *sqlx.DB, accountId, typeId string) error {
	q := db.Rebind(`DELETE FROM account_disabled_types WHERE account_id = ? AND type_id = ?`)
	if _, err := db.Exec(q, accountId, typeId); err != nil {
		return fmt.Errorf("EnableMaintenanceType: %w", err)
	}
	return nil
}

// CreateMaintenanceType inserts a custom (non-default) maintenance type.
func CreateMaintenanceType(db *sqlx.DB, name, category, accountId string, miles, months *int64) (*MaintenanceType, error) {
	id := newID()
	var milesVal, monthsVal interface{}
	if miles != nil {
		milesVal = *miles
	}
	if months != nil {
		monthsVal = *months
	}
	q := db.Rebind(`INSERT INTO maintenance_types
		(id, name, category, default_interval_miles, default_interval_months, is_default, account_id)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		RETURNING id, name, category, default_interval_miles, default_interval_months, is_default, account_id`)
	var t MaintenanceType
	if err := db.Get(&t, q, id, name, category, milesVal, monthsVal, false, accountId); err != nil {
		return nil, fmt.Errorf("CreateMaintenanceType: %w", err)
	}
	return &t, nil
}

// UpdateMaintenanceType applies updates to a custom type owned by accountId.
func UpdateMaintenanceType(db *sqlx.DB, id, accountId string, updates map[string]any) (*MaintenanceType, error) {
	if len(updates) == 0 {
		q := db.Rebind(`SELECT id, name, category, default_interval_miles, default_interval_months,
			is_default, account_id FROM maintenance_types WHERE id = ? AND account_id = ? LIMIT 1`)
		var t MaintenanceType
		if err := db.Get(&t, q, id, accountId); err != nil {
			if isNotFound(err) {
				return nil, nil
			}
			return nil, fmt.Errorf("UpdateMaintenanceType: %w", err)
		}
		return &t, nil
	}

	setClauses := make([]string, 0, len(updates))
	args := make([]any, 0, len(updates)+2)
	for col, val := range updates {
		setClauses = append(setClauses, col+" = ?")
		args = append(args, val)
	}
	args = append(args, id, accountId)

	q := db.Rebind(fmt.Sprintf(
		`UPDATE maintenance_types SET %s WHERE id = ? AND account_id = ?
		 RETURNING id, name, category, default_interval_miles, default_interval_months, is_default, account_id`,
		strings.Join(setClauses, ", "),
	))
	var t MaintenanceType
	if err := db.Get(&t, q, args...); err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("UpdateMaintenanceType: %w", err)
	}
	return &t, nil
}

// DeleteMaintenanceType removes a custom type owned by accountId.
func DeleteMaintenanceType(db *sqlx.DB, id, accountId string) error {
	q := db.Rebind(`DELETE FROM maintenance_types WHERE id = ? AND account_id = ?`)
	if _, err := db.Exec(q, id, accountId); err != nil {
		return fmt.Errorf("DeleteMaintenanceType: %w", err)
	}
	return nil
}

// ---- Maintenance Logs -----------------------------------------------------

// CreateMaintenanceLog inserts a new maintenance log entry.
func CreateMaintenanceLog(db *sqlx.DB, log MaintenanceLog) (*MaintenanceLog, error) {
	id := newID()
	now := nowISO()
	q := db.Rebind(`INSERT INTO maintenance_logs
		(id, vehicle_id, maintenance_type_id, serviced_at, mileage_at_service,
		 next_due_mileage, next_due_date, price_paid, shop, notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		RETURNING id, vehicle_id, maintenance_type_id, serviced_at, mileage_at_service,
		          next_due_mileage, next_due_date, price_paid, shop, notes, created_at, updated_at`)
	var out MaintenanceLog
	err := db.Get(&out, q,
		id, log.VehicleID, log.MaintenanceTypeID, log.ServicedAt, log.MileageAtService,
		log.NextDueMileage, log.NextDueDate, log.PricePaid, log.Shop, log.Notes, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("CreateMaintenanceLog: %w", err)
	}
	return &out, nil
}

// GetMaintenanceLogsByVehicleId returns all logs for a vehicle, newest first.
func GetMaintenanceLogsByVehicleId(db *sqlx.DB, vehicleId string) ([]MaintenanceLog, error) {
	q := db.Rebind(`SELECT id, vehicle_id, maintenance_type_id, serviced_at, mileage_at_service,
		next_due_mileage, next_due_date, price_paid, shop, notes, created_at, updated_at
		FROM maintenance_logs WHERE vehicle_id = ?
		ORDER BY serviced_at DESC`)
	var logs []MaintenanceLog
	if err := db.Select(&logs, q, vehicleId); err != nil {
		return nil, fmt.Errorf("GetMaintenanceLogsByVehicleId: %w", err)
	}
	return logs, nil
}

// GetMaintenanceLogById returns a single log by ID, or nil if not found.
func GetMaintenanceLogById(db *sqlx.DB, id string) (*MaintenanceLog, error) {
	q := db.Rebind(`SELECT id, vehicle_id, maintenance_type_id, serviced_at, mileage_at_service,
		next_due_mileage, next_due_date, price_paid, shop, notes, created_at, updated_at
		FROM maintenance_logs WHERE id = ? LIMIT 1`)
	var log MaintenanceLog
	if err := db.Get(&log, q, id); err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("GetMaintenanceLogById: %w", err)
	}
	return &log, nil
}

// GetLatestLogByType returns the most recent log for a vehicle/type pair, or nil.
func GetLatestLogByType(db *sqlx.DB, vehicleId, typeId string) (*MaintenanceLog, error) {
	q := db.Rebind(`SELECT id, vehicle_id, maintenance_type_id, serviced_at, mileage_at_service,
		next_due_mileage, next_due_date, price_paid, shop, notes, created_at, updated_at
		FROM maintenance_logs
		WHERE vehicle_id = ? AND maintenance_type_id = ?
		ORDER BY serviced_at DESC LIMIT 1`)
	var log MaintenanceLog
	if err := db.Get(&log, q, vehicleId, typeId); err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("GetLatestLogByType: %w", err)
	}
	return &log, nil
}

// UpdateMaintenanceLog applies updates to a log entry.
func UpdateMaintenanceLog(db *sqlx.DB, id string, updates map[string]any) (*MaintenanceLog, error) {
	now := nowISO()
	updates["updated_at"] = now

	setClauses := make([]string, 0, len(updates))
	args := make([]any, 0, len(updates)+1)
	for col, val := range updates {
		setClauses = append(setClauses, col+" = ?")
		args = append(args, val)
	}
	args = append(args, id)

	q := db.Rebind(fmt.Sprintf(
		`UPDATE maintenance_logs SET %s WHERE id = ?
		 RETURNING id, vehicle_id, maintenance_type_id, serviced_at, mileage_at_service,
		           next_due_mileage, next_due_date, price_paid, shop, notes, created_at, updated_at`,
		strings.Join(setClauses, ", "),
	))
	var log MaintenanceLog
	if err := db.Get(&log, q, args...); err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("UpdateMaintenanceLog: %w", err)
	}
	return &log, nil
}

// DeleteMaintenanceLog removes a log entry by ID.
func DeleteMaintenanceLog(db *sqlx.DB, id string) error {
	q := db.Rebind(`DELETE FROM maintenance_logs WHERE id = ?`)
	if _, err := db.Exec(q, id); err != nil {
		return fmt.Errorf("DeleteMaintenanceLog: %w", err)
	}
	return nil
}

// ---- Receipts ------------------------------------------------------------

// CreateReceipt inserts a new receipt row.
func CreateReceipt(db *sqlx.DB, logId, r2Key, r2URL string, fileName, fileType *string) (*Receipt, error) {
	id := newID()
	now := nowISO()
	var fileNameVal, fileTypeVal interface{}
	if fileName != nil {
		fileNameVal = *fileName
	}
	if fileType != nil {
		fileTypeVal = *fileType
	}
	q := db.Rebind(`INSERT INTO receipts (id, maintenance_log_id, r2_key, r2_url, file_name, file_type, uploaded_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		RETURNING id, maintenance_log_id, r2_key, r2_url, file_name, file_type, uploaded_at`)
	var r Receipt
	if err := db.Get(&r, q, id, logId, r2Key, r2URL, fileNameVal, fileTypeVal, now); err != nil {
		return nil, fmt.Errorf("CreateReceipt: %w", err)
	}
	return &r, nil
}

// GetReceiptsByLogId returns all receipts for a maintenance log.
func GetReceiptsByLogId(db *sqlx.DB, logId string) ([]Receipt, error) {
	q := db.Rebind(`SELECT id, maintenance_log_id, r2_key, r2_url, file_name, file_type, uploaded_at
		FROM receipts WHERE maintenance_log_id = ?`)
	var receipts []Receipt
	if err := db.Select(&receipts, q, logId); err != nil {
		return nil, fmt.Errorf("GetReceiptsByLogId: %w", err)
	}
	return receipts, nil
}

// GetReceiptById returns a receipt by ID, or nil if not found.
func GetReceiptById(db *sqlx.DB, id string) (*Receipt, error) {
	q := db.Rebind(`SELECT id, maintenance_log_id, r2_key, r2_url, file_name, file_type, uploaded_at
		FROM receipts WHERE id = ? LIMIT 1`)
	var r Receipt
	if err := db.Get(&r, q, id); err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("GetReceiptById: %w", err)
	}
	return &r, nil
}

// DeleteReceipt fetches the receipt, deletes it, and returns the deleted receipt.
func DeleteReceipt(db *sqlx.DB, id string) (*Receipt, error) {
	r, err := GetReceiptById(db, id)
	if err != nil {
		return nil, err
	}
	if r == nil {
		return nil, nil
	}
	q := db.Rebind(`DELETE FROM receipts WHERE id = ?`)
	if _, err := db.Exec(q, id); err != nil {
		return nil, fmt.Errorf("DeleteReceipt: %w", err)
	}
	return r, nil
}

// ---- Fuel Logs -----------------------------------------------------------

// CreateFuelLog inserts a new fuel log entry.
func CreateFuelLog(db *sqlx.DB, log FuelLog) (*FuelLog, error) {
	id := newID()
	now := nowISO()
	q := db.Rebind(`INSERT INTO fuel_logs
		(id, vehicle_id, filled_at, mileage, fuel_quantity, fuel_unit, price_per_unit, notes, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		RETURNING id, vehicle_id, filled_at, mileage, fuel_quantity, fuel_unit, price_per_unit, notes, created_at`)
	var out FuelLog
	err := db.Get(&out, q,
		id, log.VehicleID, log.FilledAt, log.Mileage, log.FuelQuantity,
		log.FuelUnit, log.PricePerUnit, log.Notes, now,
	)
	if err != nil {
		return nil, fmt.Errorf("CreateFuelLog: %w", err)
	}
	return &out, nil
}

// GetFuelLogsByVehicleId returns all fuel logs for a vehicle, newest first.
func GetFuelLogsByVehicleId(db *sqlx.DB, vehicleId string) ([]FuelLog, error) {
	q := db.Rebind(`SELECT id, vehicle_id, filled_at, mileage, fuel_quantity, fuel_unit,
		price_per_unit, notes, created_at
		FROM fuel_logs WHERE vehicle_id = ? ORDER BY filled_at DESC`)
	var logs []FuelLog
	if err := db.Select(&logs, q, vehicleId); err != nil {
		return nil, fmt.Errorf("GetFuelLogsByVehicleId: %w", err)
	}
	return logs, nil
}

// GetFuelLogById returns a single fuel log by ID, or nil if not found.
func GetFuelLogById(db *sqlx.DB, id string) (*FuelLog, error) {
	q := db.Rebind(`SELECT id, vehicle_id, filled_at, mileage, fuel_quantity, fuel_unit,
		price_per_unit, notes, created_at
		FROM fuel_logs WHERE id = ? LIMIT 1`)
	var log FuelLog
	if err := db.Get(&log, q, id); err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("GetFuelLogById: %w", err)
	}
	return &log, nil
}

// DeleteFuelLog removes a fuel log by ID.
func DeleteFuelLog(db *sqlx.DB, id string) error {
	q := db.Rebind(`DELETE FROM fuel_logs WHERE id = ?`)
	if _, err := db.Exec(q, id); err != nil {
		return fmt.Errorf("DeleteFuelLog: %w", err)
	}
	return nil
}

// ---- Public / QR ----------------------------------------------------------

// GetPublicVehicleData returns the vehicle, its enabled maintenance types (with overrides),
// and its maintenance logs — all needed to render the public QR page.
func GetPublicVehicleData(db *sqlx.DB, qrSlug string) (*Vehicle, []MaintenanceType, []MaintenanceLog, error) {
	vehicle, err := GetVehicleByQrSlug(db, qrSlug)
	if err != nil {
		return nil, nil, nil, err
	}
	if vehicle == nil {
		return nil, nil, nil, nil
	}

	types, err := GetMaintenanceTypes(db, vehicle.AccountID)
	if err != nil {
		return nil, nil, nil, err
	}

	logs, err := GetMaintenanceLogsByVehicleId(db, vehicle.ID)
	if err != nil {
		return nil, nil, nil, err
	}

	return vehicle, types, logs, nil
}

// GetLatestLogsByVehicleIds returns a map of vehicleId -> typeId -> latest serviced_at.
// This is used to compute maintenance statuses for a fleet dashboard.
func GetLatestLogsByVehicleIds(db *sqlx.DB, vehicleIds []string) (map[string]map[string]string, error) {
	if len(vehicleIds) == 0 {
		return map[string]map[string]string{}, nil
	}

	// Build the IN clause placeholders.
	placeholders := make([]string, len(vehicleIds))
	args := make([]interface{}, len(vehicleIds))
	for i, id := range vehicleIds {
		placeholders[i] = "?"
		args[i] = id
	}

	q := db.Rebind(fmt.Sprintf(
		`SELECT vehicle_id, maintenance_type_id, serviced_at
		 FROM maintenance_logs
		 WHERE vehicle_id IN (%s)`,
		strings.Join(placeholders, ", "),
	))

	rows, err := db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("GetLatestLogsByVehicleIds: %w", err)
	}
	defer rows.Close()

	result := make(map[string]map[string]string)
	for rows.Next() {
		var vehicleId, typeId, servicedAt string
		if err := rows.Scan(&vehicleId, &typeId, &servicedAt); err != nil {
			return nil, fmt.Errorf("GetLatestLogsByVehicleIds scan: %w", err)
		}
		if _, ok := result[vehicleId]; !ok {
			result[vehicleId] = make(map[string]string)
		}
		existing := result[vehicleId][typeId]
		if existing == "" || servicedAt > existing {
			result[vehicleId][typeId] = servicedAt
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("GetLatestLogsByVehicleIds rows: %w", err)
	}
	return result, nil
}
