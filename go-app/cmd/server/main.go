package main

import (
	"context"
	"database/sql"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/jeg/auto-maintenance-tracker/internal/admin"
	"github.com/jeg/auto-maintenance-tracker/internal/auth"
	"github.com/jeg/auto-maintenance-tracker/internal/config"
	"github.com/jeg/auto-maintenance-tracker/internal/db"
	"github.com/jeg/auto-maintenance-tracker/internal/handlers"
	"github.com/jeg/auto-maintenance-tracker/internal/r2"
)

func main() {
	// 1. Load config (godotenv called inside config.Load).
	cfg := config.Load()

	// 3. Connect to the database.
	sqlDB, err := db.Connect(cfg)
	if err != nil {
		log.Fatalf("db.Connect: %v", err)
	}

	// 4. Run migrations.
	if err := db.RunMigrations(sqlDB, cfg); err != nil {
		log.Fatalf("db.RunMigrations: %v", err)
	}

	// 5. Seed default maintenance types.
	if err := db.SeedMaintenanceTypes(sqlDB); err != nil {
		log.Fatalf("db.SeedMaintenanceTypes: %v", err)
	}

	// 6. Parse all templates from disk.
	tmpl := loadTemplates()

	// 7. Initialise auth (session store, template ref, db ref).
	auth.Init(cfg, tmpl, sqlDB)

	// 8. Initialise route handlers.
	handlers.Init(tmpl, sqlDB, cfg)

	// 9. Initialise R2 (optional — continues without R2 if config is absent).
	r2Client, r2Err := r2.NewClient(cfg)
	if r2Err != nil {
		log.Printf("r2.NewClient: %v — receipt uploads will be unavailable", r2Err)
	}
	r2.Init(r2Client, sqlDB)

	// 10. Initialise admin.
	admin.Init(cfg)

	// 11. Build router.
	r := chi.NewRouter()

	// Global middleware.
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(handlers.MethodOverride)

	// Health check (no auth).
	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	// Root redirect.
	r.Get("/", func(w http.ResponseWriter, req *http.Request) {
		http.Redirect(w, req, "/dashboard", http.StatusFound)
	})

	// Auth routes (unauthenticated).
	r.Get("/login", auth.GetLogin)
	r.Post("/login", auth.PostLogin)
	r.Get("/register", auth.GetRegister)
	r.Post("/register", auth.PostRegister)

	// Public QR routes (no auth middleware).
	handlers.RegisterPublicRoutes(r)

	// Authenticated route group.
	r.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth)

		r.Post("/logout", auth.PostLogout)

		handlers.RegisterDashboardRoutes(r)
		handlers.RegisterVehicleRoutes(r)
		handlers.RegisterMaintenanceRoutes(r)
		handlers.RegisterFuelRoutes(r)
		handlers.RegisterSettingsRoutes(r)

		// R2 receipt API.
		r.Post("/api/receipts/upload-url", r2.HandleGenerateUploadURL)
		r.Post("/api/receipts", r2.HandleSaveReceipt)
		r.Delete("/api/receipts/{id}", r2.HandleDeleteReceipt)

		// Admin DB backup.
		r.Get("/api/admin/database", admin.HandleDownloadDB)
		r.Post("/api/admin/database", admin.HandleUploadDB)
	})

	// 12. Start HTTP server with graceful shutdown.
	addr := ":" + cfg.Port
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Listen for shutdown signals in a background goroutine.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-quit
		log.Println("shutdown signal received — draining connections…")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(ctx); err != nil {
			log.Printf("server shutdown error: %v", err)
		}
	}()

	log.Printf("server listening on %s (env=%s, sqlite=%v)", addr, cfg.AppEnv, cfg.IsSQLite())
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("ListenAndServe: %v", err)
	}
	log.Println("server stopped")
}

// loadTemplates parses all HTML templates from the templates/ directory.
// Subdirectory globs are attempted one at a time so that a missing directory
// is a fatal error only if the glob matches no files at all.
func loadTemplates() *template.Template {
	funcMap := template.FuncMap{
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
			// Try RFC3339 first, then date-only.
			for _, layout := range []string{time.RFC3339, "2006-01-02"} {
				t, err := time.Parse(layout, s)
				if err == nil {
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

	// Start with the top-level templates.
	tmpl, err := template.New("").Funcs(funcMap).ParseGlob("templates/*.html")
	if err != nil {
		log.Fatalf("parse templates/*.html: %v", err)
	}

	// Parse each subdirectory. Missing subdirectory → fatal; empty → skip.
	subDirs := []string{
		"templates/vehicles/*.html",
		"templates/maintenance/*.html",
		"templates/fuel/*.html",
		"templates/settings/*.html",
		"templates/public/*.html",
	}
	for _, pattern := range subDirs {
		t, err := tmpl.ParseGlob(pattern)
		if err != nil {
			// ParseGlob returns an error when the glob matches nothing. That is
			// acceptable for optional subdirectories; log a warning and continue.
			log.Printf("warning: parsing %q: %v", pattern, err)
			continue
		}
		tmpl = t
	}

	return tmpl
}
