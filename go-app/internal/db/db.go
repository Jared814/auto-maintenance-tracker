// Package db provides database connection, migration, and query functions
// for the auto-maintenance tracker. Supports both SQLite (default) and PostgreSQL.
package db

import (
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jeg/auto-maintenance-tracker/internal/config"
	"github.com/jmoiron/sqlx"

	_ "github.com/jackc/pgx/v5/stdlib" // pgx driver registered as "pgx"
	_ "modernc.org/sqlite"             // sqlite driver registered as "sqlite"
)

//go:embed migrations/postgres/*.sql
var postgresMigrations embed.FS

//go:embed migrations/sqlite/*.sql
var sqliteMigrations embed.FS

// Connect opens and returns a *sqlx.DB for the given config.
// It creates the SQLite parent directory if needed.
func Connect(cfg *config.Config) (*sqlx.DB, error) {
	if cfg.IsSQLite() {
		dir := filepath.Dir(cfg.SqliteDBPath)
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("db: create sqlite dir %q: %w", dir, err)
		}
		dsn := cfg.SqliteDBPath + "?_foreign_keys=on"
		sqlDB, err := sql.Open("sqlite", dsn)
		if err != nil {
			return nil, fmt.Errorf("db: open sqlite: %w", err)
		}
		// SQLite performs best with a single writer connection.
		sqlDB.SetMaxOpenConns(1)
		return sqlx.NewDb(sqlDB, "sqlite"), nil
	}

	sqlDB, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("db: open postgres: %w", err)
	}
	sqlDB.SetMaxOpenConns(5)
	return sqlx.NewDb(sqlDB, "pgx"), nil
}

// RunMigrations applies any unapplied SQL migration files embedded in the binary.
// It tracks applied migrations in a "schema_migrations" table so each file is
// applied exactly once, in filename order.
func RunMigrations(db *sqlx.DB, cfg *config.Config) error {
	var migrationsFS embed.FS
	var migrationsDir string

	if cfg.IsSQLite() {
		migrationsFS = sqliteMigrations
		migrationsDir = "migrations/sqlite"
	} else {
		migrationsFS = postgresMigrations
		migrationsDir = "migrations/postgres"
	}

	// Ensure the tracking table exists.
	createTable := `CREATE TABLE IF NOT EXISTS schema_migrations (
		version TEXT PRIMARY KEY NOT NULL,
		applied_at TEXT NOT NULL
	)`
	if _, err := db.Exec(createTable); err != nil {
		return fmt.Errorf("db: create schema_migrations: %w", err)
	}

	// Load already-applied versions.
	applied := map[string]bool{}
	rows, err := db.Query(`SELECT version FROM schema_migrations`)
	if err != nil {
		return fmt.Errorf("db: query schema_migrations: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return fmt.Errorf("db: scan schema_migrations: %w", err)
		}
		applied[v] = true
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("db: schema_migrations rows: %w", err)
	}

	// Read migration files.
	entries, err := fs.ReadDir(migrationsFS, migrationsDir)
	if err != nil {
		return fmt.Errorf("db: read embedded migrations dir: %w", err)
	}
	// Sort by filename to guarantee order.
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		version := e.Name()
		if applied[version] {
			continue
		}

		data, err := migrationsFS.ReadFile(migrationsDir + "/" + version)
		if err != nil {
			return fmt.Errorf("db: read migration %s: %w", version, err)
		}

		// Execute the whole file as a single statement block. Postgres and
		// modern SQLite both handle multi-statement strings via Exec.
		sqlContent := string(data)
		if _, err := db.Exec(sqlContent); err != nil {
			return fmt.Errorf("db: apply migration %s: %w", version, err)
		}

		recordQ := db.Rebind(`INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`)
		if _, err := db.Exec(recordQ, version, nowISO()); err != nil {
			return fmt.Errorf("db: record migration %s: %w", version, err)
		}
	}

	return nil
}
