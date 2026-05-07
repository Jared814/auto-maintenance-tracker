package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jeg/auto-maintenance-tracker/internal/auth"
	"github.com/jeg/auto-maintenance-tracker/internal/db"
)

// RegisterSettingsRoutes mounts settings and maintenance-type management routes.
// The router must already have auth.RequireAuth applied.
func RegisterSettingsRoutes(r chi.Router) {
	r.Get("/settings", getSettings)
	r.Get("/settings/maintenance-types", listMaintenanceTypes)
	r.Post("/settings/maintenance-types", createCustomType)
	r.Post("/settings/maintenance-types/{id}/toggle", toggleMaintenanceType)
	r.Post("/settings/maintenance-types/{id}/override", overrideMaintenanceType)
	r.Delete("/settings/maintenance-types/{id}", deleteCustomType)
}

// getSettings renders the account settings page.
func getSettings(w http.ResponseWriter, r *http.Request) {
	pd, err := pageData(w, r)
	if err != nil {
		log.Printf("getSettings: pageData: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	account, err := db.GetAccountById(sqlDB, accountID)
	if err != nil || account == nil {
		log.Printf("getSettings: GetAccountById: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	render(w, "settings/index.html", SettingsData{
		PageData: pd,
		Account:  *account,
		IsSQLite: cfg.IsSQLite(),
	})
}

// listMaintenanceTypes renders the maintenance types settings page.
func listMaintenanceTypes(w http.ResponseWriter, r *http.Request) {
	pd, err := pageData(w, r)
	if err != nil {
		log.Printf("listMaintenanceTypes: pageData: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())

	allTypes, err := db.GetMaintenanceTypesAll(sqlDB, accountID)
	if err != nil {
		log.Printf("listMaintenanceTypes: GetMaintenanceTypesAll: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	disabledIDs, err := db.GetDisabledTypeIds(sqlDB, accountID)
	if err != nil {
		log.Printf("listMaintenanceTypes: GetDisabledTypeIds: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	overrides, err := db.GetTypeOverrides(sqlDB, accountID)
	if err != nil {
		log.Printf("listMaintenanceTypes: GetTypeOverrides: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	var defaultTypes, customTypes []db.MaintenanceType
	for _, t := range allTypes {
		if t.IsDefault {
			defaultTypes = append(defaultTypes, t)
		} else {
			customTypes = append(customTypes, t)
		}
	}

	render(w, "settings/maintenance-types.html", MaintenanceTypesData{
		PageData:     pd,
		DefaultTypes: defaultTypes,
		CustomTypes:  customTypes,
		DisabledIDs:  disabledIDs,
		Overrides:    overrides,
	})
}

// toggleMaintenanceType handles POST /settings/maintenance-types/{id}/toggle.
// Enables or disables a default maintenance type for the account.
// Returns an HTMX partial with the updated toggle row HTML.
func toggleMaintenanceType(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		renderError(w, http.StatusBadRequest, "Bad Request")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	typeID := chi.URLParam(r, "id")

	disabledIDs, err := db.GetDisabledTypeIds(sqlDB, accountID)
	if err != nil {
		log.Printf("toggleMaintenanceType: GetDisabledTypeIds: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	disabledSet := make(map[string]bool, len(disabledIDs))
	for _, id := range disabledIDs {
		disabledSet[id] = true
	}

	currentlyDisabled := disabledSet[typeID]
	if currentlyDisabled {
		if err := db.EnableMaintenanceType(sqlDB, accountID, typeID); err != nil {
			log.Printf("toggleMaintenanceType: EnableMaintenanceType: %v", err)
			renderError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
	} else {
		if err := db.DisableMaintenanceType(sqlDB, accountID, typeID); err != nil {
			log.Printf("toggleMaintenanceType: DisableMaintenanceType: %v", err)
			renderError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
	}

	// Respond with HTMX partial: a single checkbox-like toggle button.
	nowEnabled := currentlyDisabled // was disabled, now enabled
	label := "Enabled"
	if !nowEnabled {
		label = "Disabled"
	}
	checkedAttr := ""
	if nowEnabled {
		checkedAttr = `checked`
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w,
		`<form hx-post="/settings/maintenance-types/%s/toggle" hx-swap="outerHTML" hx-target="closest form">
			<button type="submit" class="toggle-btn %s" %s>%s</button>
		</form>`,
		typeID,
		func() string {
			if nowEnabled {
				return "toggle-enabled"
			}
			return "toggle-disabled"
		}(),
		checkedAttr,
		label,
	)
}

// overrideMaintenanceType handles POST /settings/maintenance-types/{id}/override.
// Upserts interval overrides and returns an HTMX partial with the updated row.
func overrideMaintenanceType(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		renderError(w, http.StatusBadRequest, "Bad Request")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())
	typeID := chi.URLParam(r, "id")

	var miles, months *int64

	if v := strings.TrimSpace(r.FormValue("interval_miles")); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			miles = &n
		}
	}
	if v := strings.TrimSpace(r.FormValue("interval_months")); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			months = &n
		}
	}

	if err := db.UpsertTypeOverride(sqlDB, accountID, typeID, miles, months); err != nil {
		log.Printf("overrideMaintenanceType: UpsertTypeOverride: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	// Return a minimal HTMX partial confirming the override values.
	milesStr := "—"
	if miles != nil {
		milesStr = strconv.FormatInt(*miles, 10)
	}
	monthsStr := "—"
	if months != nil {
		monthsStr = strconv.FormatInt(*months, 10)
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w,
		`<div class="override-row" id="override-%s">
			<form hx-post="/settings/maintenance-types/%s/override" hx-swap="outerHTML" hx-target="closest div">
				<input type="number" name="interval_miles" value="%s" placeholder="miles" class="override-input">
				<input type="number" name="interval_months" value="%s" placeholder="months" class="override-input">
				<button type="submit" class="btn-save">Save</button>
			</form>
			<span class="override-display">%s mi / %s mo</span>
		</div>`,
		typeID, typeID,
		func() string {
			if miles != nil {
				return strconv.FormatInt(*miles, 10)
			}
			return ""
		}(),
		func() string {
			if months != nil {
				return strconv.FormatInt(*months, 10)
			}
			return ""
		}(),
		milesStr, monthsStr,
	)
}

// createCustomType handles POST /settings/maintenance-types.
func createCustomType(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		renderError(w, http.StatusBadRequest, "Bad Request")
		return
	}

	accountID := auth.AccountIDFromContext(r.Context())

	name := strings.TrimSpace(r.FormValue("name"))
	category := strings.TrimSpace(r.FormValue("category"))

	if name == "" || category == "" {
		// Re-render full page with error flash.
		setFlash(w, "Name and category are required.")
		http.Redirect(w, r, "/settings/maintenance-types", http.StatusSeeOther)
		return
	}

	var miles, months *int64
	if v := strings.TrimSpace(r.FormValue("interval_miles")); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			miles = &n
		}
	}
	if v := strings.TrimSpace(r.FormValue("interval_months")); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			months = &n
		}
	}

	if _, err := db.CreateMaintenanceType(sqlDB, name, category, accountID, miles, months); err != nil {
		log.Printf("createCustomType: CreateMaintenanceType: %v", err)
		setFlash(w, "Failed to create maintenance type.")
		http.Redirect(w, r, "/settings/maintenance-types", http.StatusSeeOther)
		return
	}

	setFlash(w, "Maintenance type created.")
	http.Redirect(w, r, "/settings/maintenance-types", http.StatusSeeOther)
}

// deleteCustomType handles DELETE /settings/maintenance-types/{id}.
func deleteCustomType(w http.ResponseWriter, r *http.Request) {
	accountID := auth.AccountIDFromContext(r.Context())
	typeID := chi.URLParam(r, "id")

	if err := db.DeleteMaintenanceType(sqlDB, typeID, accountID); err != nil {
		log.Printf("deleteCustomType: DeleteMaintenanceType: %v", err)
		renderError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	// HTMX row removal: return 200 with empty body.
	if r.Header.Get("HX-Request") == "true" {
		w.WriteHeader(http.StatusOK)
		return
	}

	setFlash(w, "Maintenance type deleted.")
	http.Redirect(w, r, "/settings/maintenance-types", http.StatusSeeOther)
}
