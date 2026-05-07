package db

import "database/sql"

// ---- Domain models --------------------------------------------------------

// Account represents a family account row.
type Account struct {
	ID           string `db:"id"`
	Name         string `db:"name"`
	Email        string `db:"email"`
	PasswordHash string `db:"password_hash"`
	CreatedAt    string `db:"created_at"`
}

// Vehicle represents a vehicle row.
type Vehicle struct {
	ID             string         `db:"id"`
	AccountID      string         `db:"account_id"`
	Name           string         `db:"name"`
	Make           sql.NullString `db:"make"`
	Model          sql.NullString `db:"model"`
	Year           sql.NullInt64  `db:"year"`
	VIN            sql.NullString `db:"vin"`
	LicensePlate   sql.NullString `db:"license_plate"`
	Units          string         `db:"units"`
	CurrentMileage sql.NullInt64  `db:"current_mileage"`
	QRSlug         string         `db:"qr_slug"`
	QRPinHash      string         `db:"qr_pin_hash"`
	CreatedAt      string         `db:"created_at"`
	UpdatedAt      string         `db:"updated_at"`
}

// MaintenanceType represents a maintenance type row (default or custom).
type MaintenanceType struct {
	ID                    string         `db:"id"`
	Name                  string         `db:"name"`
	Category              string         `db:"category"`
	DefaultIntervalMiles  sql.NullInt64  `db:"default_interval_miles"`
	DefaultIntervalMonths sql.NullInt64  `db:"default_interval_months"`
	IsDefault             bool           `db:"is_default"`
	AccountID             sql.NullString `db:"account_id"`
}

// MaintenanceLog represents a maintenance log row.
type MaintenanceLog struct {
	ID                string         `db:"id"`
	VehicleID         string         `db:"vehicle_id"`
	MaintenanceTypeID string         `db:"maintenance_type_id"`
	ServicedAt        string         `db:"serviced_at"`
	MileageAtService  int64          `db:"mileage_at_service"`
	NextDueMileage    sql.NullInt64  `db:"next_due_mileage"`
	NextDueDate       sql.NullString `db:"next_due_date"`
	PricePaid         sql.NullString `db:"price_paid"`
	Shop              sql.NullString `db:"shop"`
	Notes             sql.NullString `db:"notes"`
	CreatedAt         string         `db:"created_at"`
	UpdatedAt         string         `db:"updated_at"`
}

// FuelLog represents a fuel log row.
type FuelLog struct {
	ID           string         `db:"id"`
	VehicleID    string         `db:"vehicle_id"`
	FilledAt     string         `db:"filled_at"`
	Mileage      int64          `db:"mileage"`
	FuelQuantity float64        `db:"fuel_quantity"`
	FuelUnit     string         `db:"fuel_unit"`
	PricePerUnit sql.NullString `db:"price_per_unit"`
	Notes        sql.NullString `db:"notes"`
	CreatedAt    string         `db:"created_at"`
}

// AccountTypeOverride holds per-account interval overrides for a maintenance type.
type AccountTypeOverride struct {
	AccountID      string        `db:"account_id"`
	TypeID         string        `db:"type_id"`
	IntervalMiles  sql.NullInt64 `db:"interval_miles"`
	IntervalMonths sql.NullInt64 `db:"interval_months"`
}

// AccountDisabledType marks a default maintenance type as disabled for an account.
type AccountDisabledType struct {
	AccountID string `db:"account_id"`
	TypeID    string `db:"type_id"`
}

// Receipt represents a stored receipt (R2 object) row.
type Receipt struct {
	ID               string         `db:"id"`
	MaintenanceLogID string         `db:"maintenance_log_id"`
	R2Key            string         `db:"r2_key"`
	R2URL            string         `db:"r2_url"`
	FileName         sql.NullString `db:"file_name"`
	FileType         sql.NullString `db:"file_type"`
	UploadedAt       string         `db:"uploaded_at"`
}

// ---- Maintenance status ---------------------------------------------------

// MaintenanceStatus is the computed health status of a maintenance item.
type MaintenanceStatus string

const (
	StatusOK            MaintenanceStatus = "OK"
	StatusDueSoon       MaintenanceStatus = "DUE_SOON"
	StatusOverdue       MaintenanceStatus = "OVERDUE"
	StatusNeverServiced MaintenanceStatus = "NEVER_SERVICED"
	StatusUnknown       MaintenanceStatus = "UNKNOWN"
)

// MaintenanceStatusResult carries the computed status plus supporting detail.
type MaintenanceStatusResult struct {
	Status             MaintenanceStatus
	LastServiceDate    string
	LastServiceMileage int64
	NextDueMileage     *int64
	NextDueDate        *string
}
