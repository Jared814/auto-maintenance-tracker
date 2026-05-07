package config

import (
	"os"

	"github.com/joho/godotenv"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	// DatabaseURL is the Postgres connection string. Empty means SQLite mode.
	DatabaseURL string
	// SqliteDBPath is the path to the SQLite database file (default: ./data/maintenance.db).
	SqliteDBPath string
	// AuthSecret is the session encryption key (minimum 32 characters).
	AuthSecret string
	// AuthTrustHost trusts the X-Forwarded-Host header when set.
	AuthTrustHost bool
	// Port is the HTTP server listen port (default: "3000").
	Port string
	// CloudflareR2AccountID is the Cloudflare account ID for R2 storage.
	CloudflareR2AccountID string
	// CloudflareR2AccessKeyID is the R2 access key ID.
	CloudflareR2AccessKeyID string
	// CloudflareR2SecretAccessKey is the R2 secret access key.
	CloudflareR2SecretAccessKey string
	// CloudflareR2BucketName is the R2 bucket name.
	CloudflareR2BucketName string
	// CloudflareR2PublicURL is the public base URL for R2 objects.
	CloudflareR2PublicURL string
	// NodeEnv is the runtime environment ("development", "production", etc.).
	NodeEnv string
}

// Load reads configuration from a .env file (if present) and environment variables.
// Environment variables always take precedence over .env file values.
func Load() *Config {
	// Ignore error — .env file is optional.
	_ = godotenv.Load()

	return &Config{
		DatabaseURL:                 os.Getenv("DATABASE_URL"),
		SqliteDBPath:                getEnv("SQLITE_DB_PATH", "./data/maintenance.db"),
		AuthSecret:                  getEnv("AUTH_SECRET", "change-me-in-production-must-be-32chars"),
		AuthTrustHost:               os.Getenv("AUTH_TRUST_HOST") == "true" || os.Getenv("AUTH_TRUST_HOST") == "1",
		Port:                        getEnv("PORT", "3000"),
		CloudflareR2AccountID:       os.Getenv("CLOUDFLARE_R2_ACCOUNT_ID"),
		CloudflareR2AccessKeyID:     os.Getenv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
		CloudflareR2SecretAccessKey: os.Getenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
		CloudflareR2BucketName:      os.Getenv("CLOUDFLARE_R2_BUCKET_NAME"),
		CloudflareR2PublicURL:       os.Getenv("CLOUDFLARE_R2_PUBLIC_URL"),
		NodeEnv:                     getEnv("NODE_ENV", "development"),
	}
}

// IsSQLite reports whether the app is configured to use SQLite (no DATABASE_URL set).
func (c *Config) IsSQLite() bool {
	return c.DatabaseURL == ""
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
