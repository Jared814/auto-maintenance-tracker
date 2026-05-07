// Package admin provides HTTP handlers for database backup and restore
// operations. These endpoints are only available in SQLite mode and require
// an authenticated session.
package admin

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/jeg/auto-maintenance-tracker/internal/auth"
	appconfig "github.com/jeg/auto-maintenance-tracker/internal/config"
)

// sqliteMagic is the 16-byte header that every valid SQLite 3 database starts with.
var sqliteMagic = []byte("SQLite format 3\x00")

const maxUploadBytes = 50 * 1024 * 1024 // 50 MB

var cfg *appconfig.Config

// Init sets the package-level configuration. Call once from main.
func Init(c *appconfig.Config) {
	cfg = c
}

// -----------------------------------------------------------------------
// JSON helpers
// -----------------------------------------------------------------------

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("admin: writeJSON encode error: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// -----------------------------------------------------------------------
// GET /api/admin/database — download the SQLite database file
// -----------------------------------------------------------------------

// HandleDownloadDB streams the current SQLite file to the client as a binary
// attachment. Requires an authenticated session and SQLite mode.
func HandleDownloadDB(w http.ResponseWriter, r *http.Request) {
	accountID := auth.AccountIDFromContext(r.Context())
	if accountID == "" {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if !cfg.IsSQLite() {
		writeError(w, http.StatusBadRequest, "Only available in SQLite mode")
		return
	}

	dbPath := cfg.SqliteDBPath
	info, err := os.Stat(dbPath)
	if err != nil {
		if os.IsNotExist(err) {
			writeError(w, http.StatusNotFound, "Database file not found")
		} else {
			log.Printf("admin: stat db file: %v", err)
			writeError(w, http.StatusInternalServerError, "Failed to access database file")
		}
		return
	}

	f, err := os.Open(dbPath)
	if err != nil {
		log.Printf("admin: open db file: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to open database file")
		return
	}
	defer f.Close()

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", `attachment; filename="maintenance.db"`)
	w.Header().Set("Content-Length", fmt.Sprintf("%d", info.Size()))
	w.WriteHeader(http.StatusOK)

	if _, err := io.Copy(w, f); err != nil {
		// Headers already sent; log the error but can't change the response.
		log.Printf("admin: stream db file: %v", err)
	}
}

// -----------------------------------------------------------------------
// POST /api/admin/database — upload and replace the SQLite database file
// -----------------------------------------------------------------------

// HandleUploadDB accepts a multipart upload of a SQLite database file,
// validates the magic bytes, backs up the current file, and replaces it.
// Requires an authenticated session and SQLite mode.
func HandleUploadDB(w http.ResponseWriter, r *http.Request) {
	accountID := auth.AccountIDFromContext(r.Context())
	if accountID == "" {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if !cfg.IsSQLite() {
		writeError(w, http.StatusBadRequest, "Only available in SQLite mode")
		return
	}

	// Limit total body to prevent excessive memory use during parsing.
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes+1*1024*1024)

	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeError(w, http.StatusRequestEntityTooLarge, "File too large (max 50 MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "No file provided")
		return
	}
	defer file.Close()

	if header.Size > maxUploadBytes {
		writeError(w, http.StatusRequestEntityTooLarge, "File too large (max 50 MB)")
		return
	}

	// Read the entire file into memory so we can validate before writing.
	data, err := io.ReadAll(io.LimitReader(file, maxUploadBytes+1))
	if err != nil {
		log.Printf("admin: read uploaded file: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to read uploaded file")
		return
	}

	if int64(len(data)) > maxUploadBytes {
		writeError(w, http.StatusRequestEntityTooLarge, "File too large (max 50 MB)")
		return
	}

	// Validate SQLite magic bytes (first 16 bytes).
	if len(data) < 16 || !bytes.Equal(data[:16], sqliteMagic) {
		writeError(w, http.StatusBadRequest, "Invalid SQLite database file")
		return
	}

	dbPath := cfg.SqliteDBPath

	// Ensure parent directory exists.
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		log.Printf("admin: create db dir: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to prepare database directory")
		return
	}

	// Backup the existing database before replacing.
	if _, err := os.Stat(dbPath); err == nil {
		if err := copyFile(dbPath, dbPath+".bak"); err != nil {
			log.Printf("admin: backup db: %v", err)
			writeError(w, http.StatusInternalServerError, "Failed to back up existing database")
			return
		}
	}

	// Write the new database atomically via a temp file.
	tmpPath := dbPath + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0o644); err != nil {
		log.Printf("admin: write temp db: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to write database file")
		return
	}
	if err := os.Rename(tmpPath, dbPath); err != nil {
		log.Printf("admin: rename temp db: %v", err)
		_ = os.Remove(tmpPath)
		writeError(w, http.StatusInternalServerError, "Failed to replace database file")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Database replaced successfully. Restart the server to use the new data.",
	})
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("open src: %w", err)
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return fmt.Errorf("create dst: %w", err)
	}
	defer func() {
		if cerr := out.Close(); cerr != nil && err == nil {
			err = cerr
		}
	}()

	if _, err = io.Copy(out, in); err != nil {
		return fmt.Errorf("copy: %w", err)
	}
	return nil
}
