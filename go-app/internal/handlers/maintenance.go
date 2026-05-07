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
	"github.com/jeg/auto-maintenance-tracker/internal/r2"
)

// RegisterMaintenanceRoutes mounts all maintenance log routes.
// The router must already have auth.RequireAuth applied.
func RegisterMaintenanceRoutes(r chi.Router) {
	r.Get("/vehicles/{id}/maintenance", listMaintenanceLogs)
	r.Get("/vehicles/{id}/maintenance/new", newLogForm)
	r.Post("/vehicles/{id}/maintenance", createMaintenanceLog)

	r.Get("/vehicles/{id}/maintenance/{logId}", logDetail)
	r.Get("/vehicles/{id}/maintenance/{logId}/edit", editLogForm)
	r.Post("/vehicles/{id}/maintenance/{logId}/edit", updateMaintenanceLog)
	r.Delete("/vehicles/{id}/maintenance/{logId}", deleteMaintenanceLog)
	r.Post("/vehicles/{id}/maintenance/{logId}", maintenanceLogPostDispatch)

	// Receipt sub-routes.
	r.Post("/vehicles/{vehicleId}/maintenance/{logId}/receipts", saveReceipt)
	r.Delete("/vehicles/{vehicleId}/maintenance/{logId}/receipts/{receiptId}", deleteReceipt)
}

// maintenanceLogPostDispatch routes POST /vehicles/{id}/maintenance/{logId}
// through the _method override.
func maintenanceLogPostDispatch(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		renderError(w, http.StatusBadRequest, "Bad Request")
		return
	}
	switch strings.ToUpper(r.FormValue("_method")) {
	case "DELETE":
		deleteMaintenanceLog(w, r)
	default:
		renderError(w, http.StatusMethodNotAllowed, "Method Not Allowed")
	}
}

// requireVehicleOwnership fetches a vehicle, returning nil (and writing 404)
// if not found or not owned by accountID.
func requireVehicleOwnership(w http.ResponseWriter, r *http.Request, vehicleID, accountID string) *db.Vehicle {
	vehicle, err := db.GetVehicleById(sqlDB, vehicleID, accountID)
	if err != nil {
		log.Printf("requireVehicleOwnership: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return nil
	}
	if vehicle == nil {
		renderError(w, http.StatusNotFound, "Vehicle not found")
		return nil
	}
	return vehicle
}

// listMaintenanceLogs renders the log list for a vehicle.
func listMaintenanceLogs(w http.ResponseWriter, r *http.Request) {
	pd, err := pageData(w, r)
	if err != nil {
		log.Printf("listMaintenanceLogs: pageData: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	vehicleID := chi.URLParam(r, "id")

	vehicle := requireVehicleOwnership(w, r, vehicleID, accountID)
	if vehicle == nil {
		return
	}

	logs, err := db.GetMaintenanceLogsByVehicleId(sqlDB, vehicleID)
	if err != nil {
		log.Printf("listMaintenanceLogs: GetMaintenanceLogsByVehicleId: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	// Build a type map for display.
	types, err := db.GetMaintenanceTypesAll(sqlDB, accountID)
	if err != nil {
		log.Printf("listMaintenanceLogs: GetMaintenanceTypesAll: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	typeMap := make(map[string]db.MaintenanceType, len(types))
	for _, t := range types {
		typeMap[t.ID] = t
	}

	render(w, "maintenance/list.html", MaintenanceListData{
		PageData: pd,
		Vehicle:  *vehicle,
		Logs:     logs,
		Types:    typeMap,
	})
}

// newLogForm renders the create maintenance log form.
func newLogForm(w http.ResponseWriter, r *http.Request) {
	pd, err := pageData(w, r)
	if err != nil {
		log.Printf("newLogForm: pageData: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	vehicleID := chi.URLParam(r, "id")

	vehicle := requireVehicleOwnership(w, r, vehicleID, accountID)
	if vehicle == nil {
		return
	}

	types, err := db.GetMaintenanceTypes(sqlDB, accountID)
	if err != nil {
		log.Printf("newLogForm: GetMaintenanceTypes: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	render(w, "maintenance/new.html", NewLogData{
		PageData: pd,
		Vehicle:  *vehicle,
		Types:    types,
	})
}

// createMaintenanceLog handles POST /vehicles/{id}/maintenance.
func createMaintenanceLog(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		renderError(w, http.StatusBadRequest, "Bad Request")
		return
	}

	pd, err := pageData(w, r)
	if err != nil {
		log.Printf("createMaintenanceLog: pageData: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	vehicleID := chi.URLParam(r, "id")

	vehicle := requireVehicleOwnership(w, r, vehicleID, accountID)
	if vehicle == nil {
		return
	}

	types, err := db.GetMaintenanceTypes(sqlDB, accountID)
	if err != nil {
		log.Printf("createMaintenanceLog: GetMaintenanceTypes: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	typeID := r.FormValue("maintenance_type_id")
	if typeID == "" {
		render(w, "maintenance/new.html", NewLogData{PageData: pd, Vehicle: *vehicle, Types: types, Error: "Maintenance type is required."})
		return
	}

	servicedAt := r.FormValue("serviced_at")
	if servicedAt == "" {
		render(w, "maintenance/new.html", NewLogData{PageData: pd, Vehicle: *vehicle, Types: types, Error: "Service date is required."})
		return
	}

	mileageStr := r.FormValue("mileage_at_service")
	mileage, mileageErr := strconv.ParseInt(mileageStr, 10, 64)
	if mileageStr == "" || mileageErr != nil {
		render(w, "maintenance/new.html", NewLogData{PageData: pd, Vehicle: *vehicle, Types: types, Error: "Mileage at service is required."})
		return
	}

	var nextDueMileage sql.NullInt64
	if v := r.FormValue("next_due_mileage"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			nextDueMileage = sql.NullInt64{Int64: n, Valid: true}
		}
	}

	nextDueDate := r.FormValue("next_due_date")
	pricePaid := strings.TrimSpace(r.FormValue("price_paid"))
	shop := strings.TrimSpace(r.FormValue("shop"))
	notes := strings.TrimSpace(r.FormValue("notes"))

	entry := db.MaintenanceLog{
		VehicleID:         vehicleID,
		MaintenanceTypeID: typeID,
		ServicedAt:        servicedAt,
		MileageAtService:  mileage,
		NextDueMileage:    nextDueMileage,
		NextDueDate:       sql.NullString{String: nextDueDate, Valid: nextDueDate != ""},
		PricePaid:         sql.NullString{String: pricePaid, Valid: pricePaid != ""},
		Shop:              sql.NullString{String: shop, Valid: shop != ""},
		Notes:             sql.NullString{String: notes, Valid: notes != ""},
	}

	created, err := db.CreateMaintenanceLog(sqlDB, entry)
	if err != nil {
		log.Printf("createMaintenanceLog: CreateMaintenanceLog: %v", err)
		render(w, "maintenance/new.html", NewLogData{PageData: pd, Vehicle: *vehicle, Types: types, Error: "Failed to save log. Please try again."})
		return
	}

	setFlash(w, "Maintenance log created.")
	http.Redirect(w, r, "/vehicles/"+vehicleID+"/maintenance/"+created.ID, http.StatusSeeOther)
}

// logDetail renders a single maintenance log with its receipts.
func logDetail(w http.ResponseWriter, r *http.Request) {
	pd, err := pageData(w, r)
	if err != nil {
		log.Printf("logDetail: pageData: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	vehicleID := chi.URLParam(r, "id")
	logID := chi.URLParam(r, "logId")

	vehicle := requireVehicleOwnership(w, r, vehicleID, accountID)
	if vehicle == nil {
		return
	}

	entry, err := db.GetMaintenanceLogById(sqlDB, logID)
	if err != nil {
		log.Printf("logDetail: GetMaintenanceLogById: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if entry == nil || entry.VehicleID != vehicleID {
		renderError(w, http.StatusNotFound, "Log not found")
		return
	}

	// Look up the type for display.
	allTypes, err := db.GetMaintenanceTypesAll(sqlDB, accountID)
	if err != nil {
		log.Printf("logDetail: GetMaintenanceTypesAll: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	var mtype db.MaintenanceType
	for _, t := range allTypes {
		if t.ID == entry.MaintenanceTypeID {
			mtype = t
			break
		}
	}

	receipts, err := db.GetReceiptsByLogId(sqlDB, logID)
	if err != nil {
		log.Printf("logDetail: GetReceiptsByLogId: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	render(w, "maintenance/detail.html", LogDetailData{
		PageData: pd,
		Vehicle:  *vehicle,
		Log:      *entry,
		Type:     mtype,
		Receipts: receipts,
	})
}

// editLogForm renders the edit maintenance log form.
func editLogForm(w http.ResponseWriter, r *http.Request) {
	pd, err := pageData(w, r)
	if err != nil {
		log.Printf("editLogForm: pageData: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	vehicleID := chi.URLParam(r, "id")
	logID := chi.URLParam(r, "logId")

	vehicle := requireVehicleOwnership(w, r, vehicleID, accountID)
	if vehicle == nil {
		return
	}

	entry, err := db.GetMaintenanceLogById(sqlDB, logID)
	if err != nil {
		log.Printf("editLogForm: GetMaintenanceLogById: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if entry == nil || entry.VehicleID != vehicleID {
		renderError(w, http.StatusNotFound, "Log not found")
		return
	}

	types, err := db.GetMaintenanceTypes(sqlDB, accountID)
	if err != nil {
		log.Printf("editLogForm: GetMaintenanceTypes: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	render(w, "maintenance/edit.html", EditLogData{
		PageData: pd,
		Vehicle:  *vehicle,
		Log:      *entry,
		Types:    types,
	})
}

// updateMaintenanceLog handles POST /vehicles/{id}/maintenance/{logId}/edit.
func updateMaintenanceLog(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		renderError(w, http.StatusBadRequest, "Bad Request")
		return
	}

	pd, err := pageData(w, r)
	if err != nil {
		log.Printf("updateMaintenanceLog: pageData: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	vehicleID := chi.URLParam(r, "id")
	logID := chi.URLParam(r, "logId")

	vehicle := requireVehicleOwnership(w, r, vehicleID, accountID)
	if vehicle == nil {
		return
	}

	entry, err := db.GetMaintenanceLogById(sqlDB, logID)
	if err != nil {
		log.Printf("updateMaintenanceLog: GetMaintenanceLogById: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if entry == nil || entry.VehicleID != vehicleID {
		renderError(w, http.StatusNotFound, "Log not found")
		return
	}

	types, err := db.GetMaintenanceTypes(sqlDB, accountID)
	if err != nil {
		log.Printf("updateMaintenanceLog: GetMaintenanceTypes: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	servicedAt := r.FormValue("serviced_at")
	if servicedAt == "" {
		render(w, "maintenance/edit.html", EditLogData{PageData: pd, Vehicle: *vehicle, Log: *entry, Types: types, Error: "Service date is required."})
		return
	}

	mileageStr := r.FormValue("mileage_at_service")
	mileage, mileageErr := strconv.ParseInt(mileageStr, 10, 64)
	if mileageStr == "" || mileageErr != nil {
		render(w, "maintenance/edit.html", EditLogData{PageData: pd, Vehicle: *vehicle, Log: *entry, Types: types, Error: "Mileage at service is required."})
		return
	}

	updates := map[string]any{
		"maintenance_type_id": r.FormValue("maintenance_type_id"),
		"serviced_at":         servicedAt,
		"mileage_at_service":  mileage,
	}

	if v := r.FormValue("next_due_mileage"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			updates["next_due_mileage"] = sql.NullInt64{Int64: n, Valid: true}
		} else {
			updates["next_due_mileage"] = sql.NullInt64{}
		}
	} else {
		updates["next_due_mileage"] = sql.NullInt64{}
	}

	ndd := r.FormValue("next_due_date")
	updates["next_due_date"] = sql.NullString{String: ndd, Valid: ndd != ""}

	pp := strings.TrimSpace(r.FormValue("price_paid"))
	updates["price_paid"] = sql.NullString{String: pp, Valid: pp != ""}

	shop := strings.TrimSpace(r.FormValue("shop"))
	updates["shop"] = sql.NullString{String: shop, Valid: shop != ""}

	notes := strings.TrimSpace(r.FormValue("notes"))
	updates["notes"] = sql.NullString{String: notes, Valid: notes != ""}

	updated, err := db.UpdateMaintenanceLog(sqlDB, logID, updates)
	if err != nil {
		log.Printf("updateMaintenanceLog: UpdateMaintenanceLog: %v", err)
		render(w, "maintenance/edit.html", EditLogData{PageData: pd, Vehicle: *vehicle, Log: *entry, Types: types, Error: "Failed to update log."})
		return
	}
	if updated == nil {
		renderError(w, http.StatusNotFound, "Log not found")
		return
	}

	setFlash(w, "Maintenance log updated.")
	http.Redirect(w, r, "/vehicles/"+vehicleID+"/maintenance/"+logID, http.StatusSeeOther)
}

// deleteMaintenanceLog handles DELETE /vehicles/{id}/maintenance/{logId}.
func deleteMaintenanceLog(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		renderError(w, http.StatusBadRequest, "Bad Request")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	vehicleID := chi.URLParam(r, "id")
	logID := chi.URLParam(r, "logId")

	vehicle := requireVehicleOwnership(w, r, vehicleID, accountID)
	if vehicle == nil {
		return
	}

	entry, err := db.GetMaintenanceLogById(sqlDB, logID)
	if err != nil {
		log.Printf("deleteMaintenanceLog: GetMaintenanceLogById: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if entry == nil || entry.VehicleID != vehicleID {
		renderError(w, http.StatusNotFound, "Log not found")
		return
	}

	if err := db.DeleteMaintenanceLog(sqlDB, logID); err != nil {
		log.Printf("deleteMaintenanceLog: DeleteMaintenanceLog: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	// HTMX row removal: return 200 with empty body.
	if r.Header.Get("HX-Request") == "true" {
		w.WriteHeader(http.StatusOK)
		return
	}

	setFlash(w, "Maintenance log deleted.")
	http.Redirect(w, r, "/vehicles/"+vehicleID+"/maintenance", http.StatusSeeOther)
}

// saveReceipt handles POST /vehicles/{vehicleId}/maintenance/{logId}/receipts.
// The client has already uploaded the file to R2; this just persists the DB row.
func saveReceipt(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		renderError(w, http.StatusBadRequest, "Bad Request")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	vehicleID := chi.URLParam(r, "vehicleId")
	logID := chi.URLParam(r, "logId")

	vehicle := requireVehicleOwnership(w, r, vehicleID, accountID)
	if vehicle == nil {
		return
	}

	entry, err := db.GetMaintenanceLogById(sqlDB, logID)
	if err != nil {
		log.Printf("saveReceipt: GetMaintenanceLogById: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if entry == nil || entry.VehicleID != vehicleID {
		renderError(w, http.StatusNotFound, "Log not found")
		return
	}

	r2Key := strings.TrimSpace(r.FormValue("r2Key"))
	r2URL := strings.TrimSpace(r.FormValue("r2URL"))
	if r2Key == "" || r2URL == "" {
		renderError(w, http.StatusBadRequest, "r2Key and r2URL are required")
		return
	}

	fileName := strings.TrimSpace(r.FormValue("fileName"))
	fileType := strings.TrimSpace(r.FormValue("fileType"))

	var fileNamePtr, fileTypePtr *string
	if fileName != "" {
		fileNamePtr = &fileName
	}
	if fileType != "" {
		fileTypePtr = &fileType
	}

	if _, err := db.CreateReceipt(sqlDB, logID, r2Key, r2URL, fileNamePtr, fileTypePtr); err != nil {
		log.Printf("saveReceipt: CreateReceipt: %v", err)
		renderError(w, http.StatusInternalServerError, "Failed to save receipt")
		return
	}

	http.Redirect(w, r, "/vehicles/"+vehicleID+"/maintenance/"+logID, http.StatusSeeOther)
}

// deleteReceipt handles DELETE /vehicles/{vehicleId}/maintenance/{logId}/receipts/{receiptId}.
func deleteReceipt(w http.ResponseWriter, r *http.Request) {
	accountID := auth.AccountIDFromContext(r.Context())
	vehicleID := chi.URLParam(r, "vehicleId")
	logID := chi.URLParam(r, "logId")
	receiptID := chi.URLParam(r, "receiptId")

	vehicle := requireVehicleOwnership(w, r, vehicleID, accountID)
	if vehicle == nil {
		return
	}

	entry, err := db.GetMaintenanceLogById(sqlDB, logID)
	if err != nil {
		log.Printf("deleteReceipt: GetMaintenanceLogById: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if entry == nil || entry.VehicleID != vehicleID {
		renderError(w, http.StatusNotFound, "Log not found")
		return
	}

	receipt, err := db.DeleteReceipt(sqlDB, receiptID)
	if err != nil {
		log.Printf("deleteReceipt: DeleteReceipt: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	// Best-effort R2 cleanup using the r2 package client.
	if receipt != nil && receipt.R2Key != "" {
		_ = r2.DeleteObjectFromR2(r.Context(), receipt.R2Key)
	}

	// HTMX row removal: return 200 with empty body.
	if r.Header.Get("HX-Request") == "true" {
		w.WriteHeader(http.StatusOK)
		return
	}

	http.Redirect(w, r, "/vehicles/"+vehicleID+"/maintenance/"+logID, http.StatusSeeOther)
}
