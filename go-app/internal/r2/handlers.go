package r2

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jeg/auto-maintenance-tracker/internal/auth"
	"github.com/jeg/auto-maintenance-tracker/internal/db"
	"github.com/jmoiron/sqlx"
)

var client *Client
var sqlDB *sqlx.DB

// Init sets the package-level R2 client and database handle.
// Call once from main before registering routes.
func Init(c *Client, database *sqlx.DB) {
	client = c
	sqlDB = database
}

// DeleteObjectFromR2 is a package-level helper that calls the shared client's
// DeleteObject. Safe to call even when R2 is not configured (no-op).
func DeleteObjectFromR2(ctx context.Context, r2Key string) error {
	if client == nil || !client.IsConfigured() || r2Key == "" {
		return nil
	}
	return client.DeleteObject(ctx, r2Key)
}

// -----------------------------------------------------------------------
// JSON helpers
// -----------------------------------------------------------------------

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("r2: writeJSON encode error: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// -----------------------------------------------------------------------
// POST /api/receipts/upload-url
// -----------------------------------------------------------------------

type uploadURLRequest struct {
	VehicleID string `json:"vehicleId"`
	LogID     string `json:"logId"`
	Filename  string `json:"filename"`
}

type uploadURLResponse struct {
	UploadURL string `json:"uploadURL"`
	PublicURL string `json:"publicURL"`
	R2Key     string `json:"r2Key"`
}

// HandleGenerateUploadURL issues a presigned PUT URL for a receipt image.
// The client uploads directly to R2, then calls HandleSaveReceipt.
func HandleGenerateUploadURL(w http.ResponseWriter, r *http.Request) {
	accountID := auth.AccountIDFromContext(r.Context())
	if accountID == "" {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if !client.IsConfigured() {
		writeError(w, http.StatusServiceUnavailable, "R2 storage is not configured")
		return
	}

	var req uploadURLRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}

	if req.VehicleID == "" || req.LogID == "" || req.Filename == "" {
		writeError(w, http.StatusBadRequest, "vehicleId, logId, and filename are required")
		return
	}

	uploadURL, publicURL, r2Key, err := client.GenerateUploadURL(
		r.Context(), accountID, req.VehicleID, req.LogID, req.Filename,
	)
	if err != nil {
		log.Printf("r2: GenerateUploadURL error: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to generate upload URL")
		return
	}

	writeJSON(w, http.StatusOK, uploadURLResponse{
		UploadURL: uploadURL,
		PublicURL: publicURL,
		R2Key:     r2Key,
	})
}

// -----------------------------------------------------------------------
// POST /api/receipts
// -----------------------------------------------------------------------

type saveReceiptRequest struct {
	MaintenanceLogID string `json:"maintenanceLogId"`
	R2Key            string `json:"r2Key"`
	R2URL            string `json:"r2URL"`
	FileName         string `json:"fileName"`
	FileType         string `json:"fileType"`
}

// HandleSaveReceipt persists a receipt record after the client has
// successfully uploaded the file to R2.
func HandleSaveReceipt(w http.ResponseWriter, r *http.Request) {
	accountID := auth.AccountIDFromContext(r.Context())
	if accountID == "" {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req saveReceiptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}

	if req.MaintenanceLogID == "" || req.R2Key == "" || req.R2URL == "" {
		writeError(w, http.StatusBadRequest, "maintenanceLogId, r2Key, and r2URL are required")
		return
	}

	// Optional nullable fields.
	var fileName, fileType *string
	if req.FileName != "" {
		fileName = &req.FileName
	}
	if req.FileType != "" {
		fileType = &req.FileType
	}

	receipt, err := db.CreateReceipt(sqlDB, req.MaintenanceLogID, req.R2Key, req.R2URL, fileName, fileType)
	if err != nil {
		log.Printf("r2: CreateReceipt error: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to save receipt")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"receipt": receipt})
}

// -----------------------------------------------------------------------
// DELETE /api/receipts/{id}
// -----------------------------------------------------------------------

// HandleDeleteReceipt deletes a receipt from the database and best-effort
// removes the object from R2.
func HandleDeleteReceipt(w http.ResponseWriter, r *http.Request) {
	accountID := auth.AccountIDFromContext(r.Context())
	if accountID == "" {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		// Fallback: parse from URL path manually (last path segment).
		parts := strings.Split(strings.TrimRight(r.URL.Path, "/"), "/")
		id = parts[len(parts)-1]
	}
	if id == "" {
		writeError(w, http.StatusBadRequest, "Receipt ID is required")
		return
	}

	receipt, err := db.GetReceiptById(sqlDB, id)
	if err != nil {
		log.Printf("r2: GetReceiptById error: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to fetch receipt")
		return
	}
	if receipt == nil {
		writeError(w, http.StatusNotFound, "Receipt not found")
		return
	}

	// Best-effort R2 deletion before removing the DB row.
	if client.IsConfigured() && receipt.R2Key != "" {
		if err := client.DeleteObject(r.Context(), receipt.R2Key); err != nil {
			log.Printf("r2: DeleteObject (best-effort) error for key %q: %v", receipt.R2Key, err)
		}
	}

	if _, err := db.DeleteReceipt(sqlDB, id); err != nil {
		log.Printf("r2: DeleteReceipt DB error: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to delete receipt")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Receipt deleted"})
}
