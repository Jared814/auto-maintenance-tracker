// Package handlers contains all HTTP request handlers for the auto maintenance tracker.
package handlers

import (
	"database/sql"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"time"

	"github.com/jeg/auto-maintenance-tracker/internal/auth"
	"github.com/jeg/auto-maintenance-tracker/internal/config"
	"github.com/jeg/auto-maintenance-tracker/internal/db"
	"github.com/jmoiron/sqlx"
)

// Package-level singletons set by Init.
var sqlDB *sqlx.DB
var cfg *config.Config

// Init wires up the shared state used by all handlers.
// Call once from main before registering routes.
func Init(_ *template.Template, database *sqlx.DB, c *config.Config) {
	sqlDB = database
	cfg = c
}

// standaloneTemplates are full HTML pages that do not use base.html inheritance.
var standaloneTemplates = map[string]bool{
	"login.html":          true,
	"register.html":       true,
	"public/vehicle.html": true,
}

// buildFuncMap returns the template function map used by all page templates.
func buildFuncMap() template.FuncMap {
	return template.FuncMap{
		"nullStr": func(s sql.NullString) string {
			if s.Valid {
				return s.String
			}
			return ""
		},
		"nullInt": func(n sql.NullInt64) string {
			if n.Valid {
				return fmt.Sprintf("%d", n.Int64)
			}
			return ""
		},
		"statusClass": db.StatusBadgeClass,
		"statusLabel": db.StatusLabel,
		"formatDate": func(s string) string {
			for _, layout := range []string{time.RFC3339, "2006-01-02"} {
				if t, err := time.Parse(layout, s); err == nil {
					return t.Format("Jan 2, 2006")
				}
			}
			return s
		},
		"seq": func(n int) []int {
			s := make([]int, n)
			for i := range s {
				s[i] = i
			}
			return s
		},
	}
}

// ---- Template data structs -------------------------------------------------

// PageData carries data common to every authenticated page.
type PageData struct {
	AccountID   string
	AccountName string
	Flash       string
}

// DashboardData is passed to dashboard.html.
type DashboardData struct {
	PageData
	Vehicles []VehicleWithStatus
}

// VehicleWithStatus pairs a vehicle with its aggregated maintenance counts.
type VehicleWithStatus struct {
	Vehicle      db.Vehicle
	OverdueCount int
	DueSoonCount int
	TotalTypes   int
}

// VehiclesData is passed to vehicles/list.html.
type VehiclesData struct {
	PageData
	Vehicles []db.Vehicle
}

// VehicleDetailData is passed to vehicles/detail.html.
type VehicleDetailData struct {
	PageData
	Vehicle     db.Vehicle
	StatusItems []MaintenanceStatusItem
}

// MaintenanceStatusItem pairs a type with its latest log and computed status.
type MaintenanceStatusItem struct {
	Type   db.MaintenanceType
	Log    *db.MaintenanceLog
	Status db.MaintenanceStatusResult
}

// NewVehicleData is passed to vehicles/new.html.
type NewVehicleData struct {
	PageData
	Error string
}

// EditVehicleData is passed to vehicles/edit.html.
type EditVehicleData struct {
	PageData
	Vehicle db.Vehicle
	Error   string
}

// MaintenanceListData is passed to maintenance/list.html.
type MaintenanceListData struct {
	PageData
	Vehicle db.Vehicle
	Logs    []db.MaintenanceLog
	Types   map[string]db.MaintenanceType
}

// NewLogData is passed to maintenance/new.html.
type NewLogData struct {
	PageData
	Vehicle db.Vehicle
	Types   []db.MaintenanceType
	Error   string
}

// LogDetailData is passed to maintenance/detail.html.
type LogDetailData struct {
	PageData
	Vehicle  db.Vehicle
	Log      db.MaintenanceLog
	Type     db.MaintenanceType
	Receipts []db.Receipt
}

// EditLogData is passed to maintenance/edit.html.
type EditLogData struct {
	PageData
	Vehicle db.Vehicle
	Log     db.MaintenanceLog
	Types   []db.MaintenanceType
	Error   string
}

// FuelListData is passed to fuel/list.html.
type FuelListData struct {
	PageData
	Vehicle  db.Vehicle
	FuelLogs []db.FuelLog
	Error    string
}

// SettingsData is passed to settings/index.html.
type SettingsData struct {
	PageData
	Account  db.Account
	IsSQLite bool
}

// MaintenanceTypesData is passed to settings/maintenance-types.html.
type MaintenanceTypesData struct {
	PageData
	DefaultTypes []db.MaintenanceType
	CustomTypes  []db.MaintenanceType
	DisabledIDs  []string
	Overrides    map[string]db.AccountTypeOverride
}

// PublicVehicleData is passed to public/vehicle.html.
type PublicVehicleData struct {
	Vehicle     db.Vehicle
	StatusItems []MaintenanceStatusItem
	PinVerified bool
}

// ---- Shared helpers --------------------------------------------------------

// pageData builds a PageData by loading the account from DB and reading/clearing
// any pending flash cookie.
func pageData(w http.ResponseWriter, r *http.Request) (PageData, error) {
	accountID := auth.AccountIDFromContext(r.Context())
	pd := PageData{AccountID: accountID}

	if accountID != "" {
		account, err := db.GetAccountById(sqlDB, accountID)
		if err != nil {
			return pd, err
		}
		if account != nil {
			pd.AccountName = account.Name
		}
	}

	// Read and immediately clear the flash cookie.
	if c, err := r.Cookie("flash"); err == nil {
		pd.Flash = c.Value
		http.SetCookie(w, &http.Cookie{
			Name:     "flash",
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			HttpOnly: true,
		})
	}

	return pd, nil
}

// setFlash sets a short-lived flash cookie before a redirect.
func setFlash(w http.ResponseWriter, msg string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "flash",
		Value:    msg,
		Path:     "/",
		MaxAge:   30,
		HttpOnly: true,
	})
}

// render parses the required template files fresh per-request (gives each page
// its own isolated block scope so {{define "content"}} overrides work correctly)
// and executes the named template.
func render(w http.ResponseWriter, name string, data any) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	files := []string{"templates/" + name}
	if !standaloneTemplates[name] {
		files = append([]string{"templates/base.html"}, files...)
	}

	t, err := template.New("").Funcs(buildFuncMap()).ParseFiles(files...)
	if err != nil {
		log.Printf("render parse %q: %v", name, err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	if err := t.ExecuteTemplate(w, name, data); err != nil {
		log.Printf("render execute %q: %v", name, err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

// renderError sends a plain-text error page.
func renderError(w http.ResponseWriter, status int, msg string) {
	http.Error(w, msg, status)
}

// buildStatusItems computes a MaintenanceStatusItem slice for a vehicle.
// It loads all enabled types and finds the latest log for each.
func buildStatusItems(vehicle *db.Vehicle, types []db.MaintenanceType, logs []db.MaintenanceLog) []MaintenanceStatusItem {
	// Index latest log per type.
	latestByType := make(map[string]*db.MaintenanceLog, len(types))
	for i := range logs {
		l := &logs[i]
		existing := latestByType[l.MaintenanceTypeID]
		if existing == nil || l.ServicedAt > existing.ServicedAt {
			latestByType[l.MaintenanceTypeID] = l
		}
	}

	var currentMileage *int64
	if vehicle.CurrentMileage.Valid {
		v := vehicle.CurrentMileage.Int64
		currentMileage = &v
	}

	items := make([]MaintenanceStatusItem, 0, len(types))
	for _, t := range types {
		t := t // capture
		log := latestByType[t.ID]
		status := db.CalculateMaintenanceStatus(log, &t, currentMileage)
		items = append(items, MaintenanceStatusItem{
			Type:   t,
			Log:    log,
			Status: status,
		})
	}
	return items
}
