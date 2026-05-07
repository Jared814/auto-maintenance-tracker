package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	gonanoid "github.com/jaevor/go-nanoid"
	"github.com/jeg/auto-maintenance-tracker/internal/auth"
	"github.com/jeg/auto-maintenance-tracker/internal/db"
	"golang.org/x/crypto/bcrypt"
)

// RegisterVehicleRoutes mounts all vehicle CRUD routes.
// The router must already have auth.RequireAuth applied.
func RegisterVehicleRoutes(r chi.Router) {
	r.Get("/vehicles", listVehicles)
	r.Get("/vehicles/new", newVehicleForm)
	r.Post("/vehicles", createVehicle)

	r.Get("/vehicles/{id}", vehicleDetail)
	r.Get("/vehicles/{id}/edit", editVehicleForm)
	r.Post("/vehicles/{id}", vehiclePostDispatch)
	r.Delete("/vehicles/{id}", deleteVehicle)
}

// vehiclePostDispatch routes POST /vehicles/{id} through the _method override.
func vehiclePostDispatch(w http.ResponseWriter, r *http.Request) {
	method := r.FormValue("_method")
	switch strings.ToUpper(method) {
	case "PUT":
		updateVehicle(w, r)
	case "DELETE":
		deleteVehicle(w, r)
	default:
		renderError(w, http.StatusMethodNotAllowed, "Method Not Allowed")
	}
}

// listVehicles renders the vehicles list page.
func listVehicles(w http.ResponseWriter, r *http.Request) {
	pd, err := pageData(w, r)
	if err != nil {
		log.Printf("listVehicles: pageData: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	vehicles, err := db.GetVehiclesByAccountId(sqlDB, accountID)
	if err != nil {
		log.Printf("listVehicles: GetVehiclesByAccountId: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	render(w, "vehicles/list.html", VehiclesData{PageData: pd, Vehicles: vehicles})
}

// newVehicleForm renders the create-vehicle form.
func newVehicleForm(w http.ResponseWriter, r *http.Request) {
	pd, err := pageData(w, r)
	if err != nil {
		log.Printf("newVehicleForm: pageData: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	render(w, "vehicles/new.html", NewVehicleData{PageData: pd})
}

// slugAlphabet is the character set for QR slugs.
const slugAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789"

// generateQRSlug returns a 10-character slug using the slug alphabet.
func generateQRSlug() (string, error) {
	gen, err := gonanoid.Custom(slugAlphabet, 10)
	if err != nil {
		return "", err
	}
	return gen(), nil
}

// createVehicle handles POST /vehicles.
func createVehicle(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		renderError(w, http.StatusBadRequest, "Bad Request")
		return
	}

	pd, err := pageData(w, r)
	if err != nil {
		log.Printf("createVehicle: pageData: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())

	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		render(w, "vehicles/new.html", NewVehicleData{PageData: pd, Error: "Vehicle name is required."})
		return
	}

	qrPin := r.FormValue("qr_pin")
	if qrPin == "" {
		render(w, "vehicles/new.html", NewVehicleData{PageData: pd, Error: "A QR PIN is required."})
		return
	}

	pinHash, err := bcrypt.GenerateFromPassword([]byte(qrPin), 10)
	if err != nil {
		log.Printf("createVehicle: bcrypt: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	// Generate QR slug; retry once on collision.
	slug, err := generateQRSlug()
	if err != nil {
		log.Printf("createVehicle: generateQRSlug: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	units := r.FormValue("units")
	if units == "" {
		units = "miles"
	}

	makeStr := strings.TrimSpace(r.FormValue("make"))
	modelStr := strings.TrimSpace(r.FormValue("model"))
	vinStr := strings.TrimSpace(r.FormValue("vin"))
	plateStr := strings.TrimSpace(r.FormValue("license_plate"))
	yearStr := strings.TrimSpace(r.FormValue("year"))
	mileageStr := strings.TrimSpace(r.FormValue("current_mileage"))

	var year sql.NullInt64
	if yearStr != "" {
		if v, err := strconv.ParseInt(yearStr, 10, 64); err == nil {
			year = sql.NullInt64{Int64: v, Valid: true}
		}
	}

	var currentMileage sql.NullInt64
	if mileageStr != "" {
		if v, err := strconv.ParseInt(mileageStr, 10, 64); err == nil {
			currentMileage = sql.NullInt64{Int64: v, Valid: true}
		}
	}

	v := db.Vehicle{
		AccountID:      accountID,
		Name:           name,
		Make:           sql.NullString{String: makeStr, Valid: makeStr != ""},
		Model:          sql.NullString{String: modelStr, Valid: modelStr != ""},
		Year:           year,
		VIN:            sql.NullString{String: vinStr, Valid: vinStr != ""},
		LicensePlate:   sql.NullString{String: plateStr, Valid: plateStr != ""},
		Units:          units,
		CurrentMileage: currentMileage,
		QRSlug:         slug,
		QRPinHash:      string(pinHash),
	}

	created, err := db.CreateVehicle(sqlDB, v)
	if err != nil {
		// If slug collided, retry once.
		if strings.Contains(err.Error(), "UNIQUE") || strings.Contains(err.Error(), "unique") {
			slug2, e2 := generateQRSlug()
			if e2 == nil {
				v.QRSlug = slug2
				created, err = db.CreateVehicle(sqlDB, v)
			}
		}
		if err != nil {
			log.Printf("createVehicle: CreateVehicle: %v", err)
			render(w, "vehicles/new.html", NewVehicleData{PageData: pd, Error: "Failed to create vehicle. Please try again."})
			return
		}
	}

	setFlash(w, "Vehicle created successfully.")
	http.Redirect(w, r, "/vehicles/"+created.ID, http.StatusSeeOther)
}

// vehicleDetail renders the vehicle detail page with maintenance status for all types.
func vehicleDetail(w http.ResponseWriter, r *http.Request) {
	pd, err := pageData(w, r)
	if err != nil {
		log.Printf("vehicleDetail: pageData: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	id := chi.URLParam(r, "id")

	vehicle, err := db.GetVehicleById(sqlDB, id, accountID)
	if err != nil {
		log.Printf("vehicleDetail: GetVehicleById: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if vehicle == nil {
		renderError(w, http.StatusNotFound, "Vehicle not found")
		return
	}

	types, err := db.GetMaintenanceTypes(sqlDB, accountID)
	if err != nil {
		log.Printf("vehicleDetail: GetMaintenanceTypes: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	logs, err := db.GetMaintenanceLogsByVehicleId(sqlDB, vehicle.ID)
	if err != nil {
		log.Printf("vehicleDetail: GetMaintenanceLogsByVehicleId: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	items := buildStatusItems(vehicle, types, logs)

	render(w, "vehicles/detail.html", VehicleDetailData{
		PageData:    pd,
		Vehicle:     *vehicle,
		StatusItems: items,
	})
}

// editVehicleForm renders the edit vehicle form.
func editVehicleForm(w http.ResponseWriter, r *http.Request) {
	pd, err := pageData(w, r)
	if err != nil {
		log.Printf("editVehicleForm: pageData: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	id := chi.URLParam(r, "id")

	vehicle, err := db.GetVehicleById(sqlDB, id, accountID)
	if err != nil {
		log.Printf("editVehicleForm: GetVehicleById: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if vehicle == nil {
		renderError(w, http.StatusNotFound, "Vehicle not found")
		return
	}

	render(w, "vehicles/edit.html", EditVehicleData{PageData: pd, Vehicle: *vehicle})
}

// updateVehicle handles PUT /vehicles/{id} (via _method override).
func updateVehicle(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		renderError(w, http.StatusBadRequest, "Bad Request")
		return
	}

	pd, err := pageData(w, r)
	if err != nil {
		log.Printf("updateVehicle: pageData: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	id := chi.URLParam(r, "id")

	vehicle, err := db.GetVehicleById(sqlDB, id, accountID)
	if err != nil {
		log.Printf("updateVehicle: GetVehicleById: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if vehicle == nil {
		renderError(w, http.StatusNotFound, "Vehicle not found")
		return
	}

	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		render(w, "vehicles/edit.html", EditVehicleData{PageData: pd, Vehicle: *vehicle, Error: "Vehicle name is required."})
		return
	}

	updates := map[string]any{
		"name": name,
	}

	makeStr := strings.TrimSpace(r.FormValue("make"))
	updates["make"] = sql.NullString{String: makeStr, Valid: makeStr != ""}

	modelStr := strings.TrimSpace(r.FormValue("model"))
	updates["model"] = sql.NullString{String: modelStr, Valid: modelStr != ""}

	vinStr := strings.TrimSpace(r.FormValue("vin"))
	updates["vin"] = sql.NullString{String: vinStr, Valid: vinStr != ""}

	plateStr := strings.TrimSpace(r.FormValue("license_plate"))
	updates["license_plate"] = sql.NullString{String: plateStr, Valid: plateStr != ""}

	yearStr := strings.TrimSpace(r.FormValue("year"))
	if yearStr != "" {
		if v, err := strconv.ParseInt(yearStr, 10, 64); err == nil {
			updates["year"] = sql.NullInt64{Int64: v, Valid: true}
		} else {
			updates["year"] = sql.NullInt64{}
		}
	} else {
		updates["year"] = sql.NullInt64{}
	}

	mileageStr := strings.TrimSpace(r.FormValue("current_mileage"))
	if mileageStr != "" {
		if v, err := strconv.ParseInt(mileageStr, 10, 64); err == nil {
			updates["current_mileage"] = sql.NullInt64{Int64: v, Valid: true}
		} else {
			updates["current_mileage"] = sql.NullInt64{}
		}
	} else {
		updates["current_mileage"] = sql.NullInt64{}
	}

	units := r.FormValue("units")
	if units != "" {
		updates["units"] = units
	}

	// Optional new QR PIN update.
	if newPin := r.FormValue("qr_pin"); newPin != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(newPin), 10)
		if err == nil {
			updates["qr_pin_hash"] = string(hash)
		}
	}

	updated, err := db.UpdateVehicle(sqlDB, id, accountID, updates)
	if err != nil {
		log.Printf("updateVehicle: UpdateVehicle: %v", err)
		render(w, "vehicles/edit.html", EditVehicleData{PageData: pd, Vehicle: *vehicle, Error: "Failed to update vehicle."})
		return
	}
	if updated == nil {
		renderError(w, http.StatusNotFound, "Vehicle not found")
		return
	}

	setFlash(w, "Vehicle updated successfully.")
	http.Redirect(w, r, "/vehicles/"+id, http.StatusSeeOther)
}

// deleteVehicle handles DELETE /vehicles/{id}.
func deleteVehicle(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		renderError(w, http.StatusBadRequest, "Bad Request")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	id := chi.URLParam(r, "id")

	if err := db.DeleteVehicle(sqlDB, id, accountID); err != nil {
		log.Printf("deleteVehicle: DeleteVehicle: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	// HTMX requests get an empty 200; regular form submissions redirect.
	if r.Header.Get("HX-Request") == "true" {
		w.WriteHeader(http.StatusOK)
		return
	}

	setFlash(w, "Vehicle deleted.")
	http.Redirect(w, r, "/vehicles", http.StatusSeeOther)
}
