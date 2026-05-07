package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jeg/auto-maintenance-tracker/internal/db"
	"golang.org/x/crypto/bcrypt"
)

// RegisterPublicRoutes mounts the public (unauthenticated) QR vehicle routes.
// Call this outside the auth middleware group.
func RegisterPublicRoutes(r chi.Router) {
	r.Get("/v/{qrSlug}", publicVehiclePage)
	r.Post("/v/{qrSlug}/verify-pin", publicVerifyPin)
	r.Post("/v/{qrSlug}/log", publicCreateLog)
	r.Post("/v/{qrSlug}/fuel", publicCreateFuel)
}

// pinCookieName returns the cookie name used to mark a verified PIN for a slug.
func pinCookieName(slug string) string {
	return "pin_" + slug
}

// isPinVerified checks whether the request carries a valid PIN cookie for slug.
func isPinVerified(r *http.Request, slug string) bool {
	c, err := r.Cookie(pinCookieName(slug))
	return err == nil && c.Value == "1"
}

// publicVehiclePage handles GET /v/{qrSlug}.
// No authentication required. Checks for a PIN cookie to set PinVerified.
func publicVehiclePage(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "qrSlug")

	vehicle, types, logs, err := db.GetPublicVehicleData(sqlDB, slug)
	if err != nil {
		log.Printf("publicVehiclePage: GetPublicVehicleData: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if vehicle == nil {
		renderError(w, http.StatusNotFound, "Vehicle not found")
		return
	}

	items := buildStatusItems(vehicle, types, logs)

	render(w, "public/vehicle.html", PublicVehicleData{
		Vehicle:     *vehicle,
		StatusItems: items,
		PinVerified: isPinVerified(r, slug),
	})
}

// publicVerifyPin handles POST /v/{qrSlug}/verify-pin.
// Compares the submitted PIN against the vehicle's bcrypt hash.
// On success, sets a 30-day httpOnly cookie and redirects to the vehicle page.
func publicVerifyPin(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		renderError(w, http.StatusBadRequest, "Bad Request")
		return
	}

	slug := chi.URLParam(r, "qrSlug")

	vehicle, err := db.GetVehicleByQrSlug(sqlDB, slug)
	if err != nil {
		log.Printf("publicVerifyPin: GetVehicleByQrSlug: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if vehicle == nil {
		renderError(w, http.StatusNotFound, "Vehicle not found")
		return
	}

	pin := r.FormValue("pin")
	if err := bcrypt.CompareHashAndPassword([]byte(vehicle.QRPinHash), []byte(pin)); err != nil {
		// Wrong PIN — re-render page with an error indicator via flash.
		// We can't use the pageData flash (no account), so pass a query param.
		http.Redirect(w, r, "/v/"+slug+"?error=invalid_pin", http.StatusSeeOther)
		return
	}

	// Set the verified PIN cookie (30 days, httpOnly, scoped to this slug path).
	http.SetCookie(w, &http.Cookie{
		Name:     pinCookieName(slug),
		Value:    "1",
		Path:     "/v/" + slug,
		MaxAge:   int((30 * 24 * time.Hour).Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	http.Redirect(w, r, "/v/"+slug, http.StatusSeeOther)
}

// publicCreateLog handles POST /v/{qrSlug}/log.
// Requires a valid PIN cookie. Creates a maintenance log entry.
func publicCreateLog(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		renderError(w, http.StatusBadRequest, "Bad Request")
		return
	}

	slug := chi.URLParam(r, "qrSlug")

	if !isPinVerified(r, slug) {
		http.Redirect(w, r, "/v/"+slug, http.StatusSeeOther)
		return
	}

	vehicle, err := db.GetVehicleByQrSlug(sqlDB, slug)
	if err != nil {
		log.Printf("publicCreateLog: GetVehicleByQrSlug: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if vehicle == nil {
		renderError(w, http.StatusNotFound, "Vehicle not found")
		return
	}

	typeID := r.FormValue("maintenance_type_id")
	servicedAt := r.FormValue("serviced_at")
	mileageStr := r.FormValue("mileage_at_service")

	if typeID == "" || servicedAt == "" || mileageStr == "" {
		http.Redirect(w, r, "/v/"+slug+"?error=missing_fields", http.StatusSeeOther)
		return
	}

	mileage, err := strconv.ParseInt(mileageStr, 10, 64)
	if err != nil {
		http.Redirect(w, r, "/v/"+slug+"?error=invalid_mileage", http.StatusSeeOther)
		return
	}

	var nextDueMileage sql.NullInt64
	if v := r.FormValue("next_due_mileage"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			nextDueMileage = sql.NullInt64{Int64: n, Valid: true}
		}
	}

	nextDueDate := r.FormValue("next_due_date")
	shop := strings.TrimSpace(r.FormValue("shop"))
	notes := strings.TrimSpace(r.FormValue("notes"))

	entry := db.MaintenanceLog{
		VehicleID:         vehicle.ID,
		MaintenanceTypeID: typeID,
		ServicedAt:        servicedAt,
		MileageAtService:  mileage,
		NextDueMileage:    nextDueMileage,
		NextDueDate:       sql.NullString{String: nextDueDate, Valid: nextDueDate != ""},
		Shop:              sql.NullString{String: shop, Valid: shop != ""},
		Notes:             sql.NullString{String: notes, Valid: notes != ""},
	}

	if _, err := db.CreateMaintenanceLog(sqlDB, entry); err != nil {
		log.Printf("publicCreateLog: CreateMaintenanceLog: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	http.Redirect(w, r, "/v/"+slug, http.StatusSeeOther)
}

// publicCreateFuel handles POST /v/{qrSlug}/fuel.
// Requires a valid PIN cookie. Creates a fuel log entry.
func publicCreateFuel(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		renderError(w, http.StatusBadRequest, "Bad Request")
		return
	}

	slug := chi.URLParam(r, "qrSlug")

	if !isPinVerified(r, slug) {
		http.Redirect(w, r, "/v/"+slug, http.StatusSeeOther)
		return
	}

	vehicle, err := db.GetVehicleByQrSlug(sqlDB, slug)
	if err != nil {
		log.Printf("publicCreateFuel: GetVehicleByQrSlug: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if vehicle == nil {
		renderError(w, http.StatusNotFound, "Vehicle not found")
		return
	}

	filledAt := r.FormValue("filled_at")
	mileageStr := r.FormValue("mileage")
	quantityStr := r.FormValue("fuel_quantity")

	if filledAt == "" || mileageStr == "" || quantityStr == "" {
		http.Redirect(w, r, "/v/"+slug+"?error=missing_fields", http.StatusSeeOther)
		return
	}

	mileage, err := strconv.ParseInt(mileageStr, 10, 64)
	if err != nil {
		http.Redirect(w, r, "/v/"+slug+"?error=invalid_mileage", http.StatusSeeOther)
		return
	}

	quantity, err := strconv.ParseFloat(quantityStr, 64)
	if err != nil || quantity <= 0 {
		http.Redirect(w, r, "/v/"+slug+"?error=invalid_quantity", http.StatusSeeOther)
		return
	}

	fuelUnit := r.FormValue("fuel_unit")
	if fuelUnit == "" {
		fuelUnit = "gallons"
	}

	pricePerUnit := strings.TrimSpace(r.FormValue("price_per_unit"))
	notes := strings.TrimSpace(r.FormValue("notes"))

	entry := db.FuelLog{
		VehicleID:    vehicle.ID,
		FilledAt:     filledAt,
		Mileage:      mileage,
		FuelQuantity: quantity,
		FuelUnit:     fuelUnit,
		PricePerUnit: sql.NullString{String: pricePerUnit, Valid: pricePerUnit != ""},
		Notes:        sql.NullString{String: notes, Valid: notes != ""},
	}

	if _, err := db.CreateFuelLog(sqlDB, entry); err != nil {
		log.Printf("publicCreateFuel: CreateFuelLog: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	http.Redirect(w, r, "/v/"+slug, http.StatusSeeOther)
}
