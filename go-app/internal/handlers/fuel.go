package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jeg/auto-maintenance-tracker/internal/auth"
	"github.com/jeg/auto-maintenance-tracker/internal/db"
)

// RegisterFuelRoutes mounts fuel log routes.
// The router must already have auth.RequireAuth applied.
func RegisterFuelRoutes(r chi.Router) {
	r.Get("/vehicles/{id}/fuel", listFuelLogs)
	r.Post("/vehicles/{id}/fuel", createFuelLog)
	r.Delete("/vehicles/{id}/fuel/{logId}", deleteFuelLog)
}

// listFuelLogs renders the fuel log list with an inline add form.
func listFuelLogs(w http.ResponseWriter, r *http.Request) {
	pd, err := pageData(w, r)
	if err != nil {
		log.Printf("listFuelLogs: pageData: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	vehicleID := chi.URLParam(r, "id")

	vehicle := requireVehicleOwnership(w, r, vehicleID, accountID)
	if vehicle == nil {
		return
	}

	fuelLogs, err := db.GetFuelLogsByVehicleId(sqlDB, vehicleID)
	if err != nil {
		log.Printf("listFuelLogs: GetFuelLogsByVehicleId: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	render(w, "fuel/list.html", FuelListData{
		PageData: pd,
		Vehicle:  *vehicle,
		FuelLogs: fuelLogs,
	})
}

// createFuelLog handles POST /vehicles/{id}/fuel.
func createFuelLog(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		renderError(w, http.StatusBadRequest, "Bad Request")
		return
	}

	pd, err := pageData(w, r)
	if err != nil {
		log.Printf("createFuelLog: pageData: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	vehicleID := chi.URLParam(r, "id")

	vehicle := requireVehicleOwnership(w, r, vehicleID, accountID)
	if vehicle == nil {
		return
	}

	rerender := func(errMsg string) {
		fuelLogs, _ := db.GetFuelLogsByVehicleId(sqlDB, vehicleID)
		render(w, "fuel/list.html", FuelListData{
			PageData: pd,
			Vehicle:  *vehicle,
			FuelLogs: fuelLogs,
			Error:    errMsg,
		})
	}

	filledAt := r.FormValue("filled_at")
	if filledAt == "" {
		rerender("Fill date is required.")
		return
	}

	mileageStr := r.FormValue("mileage")
	mileage, err := strconv.ParseInt(mileageStr, 10, 64)
	if mileageStr == "" || err != nil {
		rerender("Mileage is required.")
		return
	}

	quantityStr := r.FormValue("fuel_quantity")
	quantity, err := strconv.ParseFloat(quantityStr, 64)
	if quantityStr == "" || err != nil || quantity <= 0 {
		rerender("Fuel quantity is required.")
		return
	}

	fuelUnit := r.FormValue("fuel_unit")
	if fuelUnit == "" {
		fuelUnit = "gallons"
	}

	pricePerUnit := strings.TrimSpace(r.FormValue("price_per_unit"))
	notes := strings.TrimSpace(r.FormValue("notes"))

	entry := db.FuelLog{
		VehicleID:    vehicleID,
		FilledAt:     filledAt,
		Mileage:      mileage,
		FuelQuantity: quantity,
		FuelUnit:     fuelUnit,
		PricePerUnit: sql.NullString{String: pricePerUnit, Valid: pricePerUnit != ""},
		Notes:        sql.NullString{String: notes, Valid: notes != ""},
	}

	if _, err := db.CreateFuelLog(sqlDB, entry); err != nil {
		log.Printf("createFuelLog: CreateFuelLog: %v", err)
		rerender("Failed to save fuel log. Please try again.")
		return
	}

	setFlash(w, "Fuel log added.")
	http.Redirect(w, r, "/vehicles/"+vehicleID+"/fuel", http.StatusSeeOther)
}

// deleteFuelLog handles DELETE /vehicles/{id}/fuel/{logId}.
func deleteFuelLog(w http.ResponseWriter, r *http.Request) {
	accountID := auth.AccountIDFromContext(r.Context())
	vehicleID := chi.URLParam(r, "id")
	logID := chi.URLParam(r, "logId")

	vehicle := requireVehicleOwnership(w, r, vehicleID, accountID)
	if vehicle == nil {
		return
	}

	if err := db.DeleteFuelLog(sqlDB, logID); err != nil {
		log.Printf("deleteFuelLog: DeleteFuelLog: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	// HTMX row removal: return 200 with empty body.
	if r.Header.Get("HX-Request") == "true" {
		w.WriteHeader(http.StatusOK)
		return
	}

	setFlash(w, "Fuel log deleted.")
	http.Redirect(w, r, "/vehicles/"+vehicleID+"/fuel", http.StatusSeeOther)
}
