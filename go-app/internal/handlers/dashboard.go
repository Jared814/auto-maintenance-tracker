package handlers

import (
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jeg/auto-maintenance-tracker/internal/auth"
	"github.com/jeg/auto-maintenance-tracker/internal/db"
)

// RegisterDashboardRoutes mounts dashboard routes on the provided router.
// The router is expected to already have auth.RequireAuth applied.
func RegisterDashboardRoutes(r chi.Router) {
	r.Get("/dashboard", getDashboard)
}

// getDashboard renders the main dashboard with per-vehicle maintenance summaries.
func getDashboard(w http.ResponseWriter, r *http.Request) {
	pd, err := pageData(w, r)
	if err != nil {
		log.Printf("dashboard: pageData: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	vehicles, err := db.GetVehiclesByAccountId(sqlDB, accountID)
	if err != nil {
		log.Printf("dashboard: GetVehiclesByAccountId: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	// Collect vehicle IDs for a batched latest-log query.
	vehicleIDs := make([]string, len(vehicles))
	for i, v := range vehicles {
		vehicleIDs[i] = v.ID
	}

	latestLogs, err := db.GetLatestLogsByVehicleIds(sqlDB, vehicleIDs)
	if err != nil {
		log.Printf("dashboard: GetLatestLogsByVehicleIds: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	// Load maintenance types once (shared across all vehicles for the account).
	types, err := db.GetMaintenanceTypes(sqlDB, accountID)
	if err != nil {
		log.Printf("dashboard: GetMaintenanceTypes: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	vehiclesWithStatus := make([]VehicleWithStatus, 0, len(vehicles))
	for _, v := range vehicles {
		v := v
		var currentMileage *int64
		if v.CurrentMileage.Valid {
			m := v.CurrentMileage.Int64
			currentMileage = &m
		}

		// latestServicedAt maps typeId -> most-recent serviced_at string for this vehicle.
		latestServicedAt := latestLogs[v.ID]

		overdue := 0
		dueSoon := 0

		for _, t := range types {
			t := t
			// Reconstruct a synthetic log stub if we have a latest serviced_at.
			var latestLog *db.MaintenanceLog
			if sa, ok := latestServicedAt[t.ID]; ok && sa != "" {
				latestLog = &db.MaintenanceLog{
					VehicleID:         v.ID,
					MaintenanceTypeID: t.ID,
					ServicedAt:        sa,
				}
			}

			result := db.CalculateMaintenanceStatus(latestLog, &t, currentMileage)
			switch result.Status {
			case db.StatusOverdue:
				overdue++
			case db.StatusDueSoon:
				dueSoon++
			}
		}

		vehiclesWithStatus = append(vehiclesWithStatus, VehicleWithStatus{
			Vehicle:      v,
			OverdueCount: overdue,
			DueSoonCount: dueSoon,
			TotalTypes:   len(types),
		})
	}

	render(w, "dashboard.html", DashboardData{
		PageData: pd,
		Vehicles: vehiclesWithStatus,
	})
}
