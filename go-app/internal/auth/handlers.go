package auth

import (
	"html/template"
	"net/http"
	"regexp"
	"strings"

	"github.com/jeg/auto-maintenance-tracker/internal/config"
	"github.com/jeg/auto-maintenance-tracker/internal/db"
	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"
)

var tmpl *template.Template
var sqlDB *sqlx.DB

// emailRE is a basic but practical email format check.
var emailRE = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)

// -----------------------------------------------------------------------
// Template data structs
// -----------------------------------------------------------------------

// LoginData is passed to the login.html template.
type LoginData struct {
	Error string
	Email string // repopulate the email field on error
}

// RegisterData is passed to the register.html template.
type RegisterData struct {
	Error string
	Name  string
	Email string
}

// -----------------------------------------------------------------------
// Package initialisation
// -----------------------------------------------------------------------

// Init configures the auth package. Call once from main before registering
// routes. It sets up the cookie store, stores the template set and DB handle.
func Init(cfg *config.Config, t *template.Template, database *sqlx.DB) {
	initStore(cfg)
	tmpl = t
	sqlDB = database
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

func renderTemplate(w http.ResponseWriter, name string, data any) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := tmpl.ExecuteTemplate(w, name, data); err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

// -----------------------------------------------------------------------
// Login
// -----------------------------------------------------------------------

// GetLogin renders the login page.
func GetLogin(w http.ResponseWriter, r *http.Request) {
	// If already logged in, skip to dashboard.
	if GetAccountID(r) != "" {
		http.Redirect(w, r, "/dashboard", http.StatusSeeOther)
		return
	}
	renderTemplate(w, "login.html", LoginData{})
}

// PostLogin validates credentials, applies rate limiting, and creates a session.
func PostLogin(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	ip := clientIP(r)

	if IsRateLimited(ip) {
		renderTemplate(w, "login.html", LoginData{
			Error: "Too many failed attempts. Please wait 15 minutes before trying again.",
			Email: r.FormValue("email"),
		})
		return
	}

	email := strings.TrimSpace(strings.ToLower(r.FormValue("email")))
	password := r.FormValue("password")

	if email == "" || password == "" {
		renderTemplate(w, "login.html", LoginData{
			Error: "Email and password are required.",
			Email: email,
		})
		return
	}

	account, err := db.GetAccountByEmail(sqlDB, email)
	if err != nil {
		renderTemplate(w, "login.html", LoginData{
			Error: "An error occurred. Please try again.",
			Email: email,
		})
		return
	}

	if account == nil {
		RecordFailedAttempt(ip)
		renderTemplate(w, "login.html", LoginData{
			Error: "Invalid email or password.",
			Email: email,
		})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(account.PasswordHash), []byte(password)); err != nil {
		RecordFailedAttempt(ip)
		renderTemplate(w, "login.html", LoginData{
			Error: "Invalid email or password.",
			Email: email,
		})
		return
	}

	// Credentials valid — clear rate limit and create session.
	ClearAttempts(ip)
	if err := SetAccountID(w, r, account.ID); err != nil {
		http.Error(w, "Failed to create session", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/dashboard", http.StatusSeeOther)
}

// -----------------------------------------------------------------------
// Register
// -----------------------------------------------------------------------

// GetRegister renders the registration page.
func GetRegister(w http.ResponseWriter, r *http.Request) {
	if GetAccountID(r) != "" {
		http.Redirect(w, r, "/dashboard", http.StatusSeeOther)
		return
	}
	renderTemplate(w, "register.html", RegisterData{})
}

// PostRegister validates input, hashes the password, creates the account, and
// redirects to /dashboard on success.
func PostRegister(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(r.FormValue("name"))
	email := strings.TrimSpace(strings.ToLower(r.FormValue("email")))
	password := r.FormValue("password")

	// Validation
	if name == "" {
		renderTemplate(w, "register.html", RegisterData{
			Error: "Name is required.",
			Name:  name,
			Email: email,
		})
		return
	}
	if !emailRE.MatchString(email) {
		renderTemplate(w, "register.html", RegisterData{
			Error: "Please enter a valid email address.",
			Name:  name,
			Email: email,
		})
		return
	}
	if len(password) < 8 {
		renderTemplate(w, "register.html", RegisterData{
			Error: "Password must be at least 8 characters.",
			Name:  name,
			Email: email,
		})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	account, err := db.CreateAccount(sqlDB, name, email, string(hash))
	if err != nil {
		// Detect unique-constraint violation (email already registered).
		if isDuplicateEmail(err) {
			renderTemplate(w, "register.html", RegisterData{
				Error: "An account with that email already exists.",
				Name:  name,
				Email: email,
			})
			return
		}
		renderTemplate(w, "register.html", RegisterData{
			Error: "An error occurred. Please try again.",
			Name:  name,
			Email: email,
		})
		return
	}

	if err := SetAccountID(w, r, account.ID); err != nil {
		http.Error(w, "Failed to create session", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/dashboard", http.StatusSeeOther)
}

// -----------------------------------------------------------------------
// Logout
// -----------------------------------------------------------------------

// PostLogout clears the session and redirects to /login.
func PostLogout(w http.ResponseWriter, r *http.Request) {
	_ = ClearSession(w, r)
	http.Redirect(w, r, "/login", http.StatusSeeOther)
}

// -----------------------------------------------------------------------
// Error detection helpers
// -----------------------------------------------------------------------

// isDuplicateEmail returns true when err indicates a UNIQUE constraint
// violation on the email column. Works for both SQLite and Postgres.
func isDuplicateEmail(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	// SQLite: "UNIQUE constraint failed: accounts.email"
	// Postgres: `duplicate key value violates unique constraint "accounts_email_key"`
	return strings.Contains(msg, "UNIQUE constraint failed: accounts.email") ||
		strings.Contains(msg, "unique constraint") && strings.Contains(msg, "email") ||
		strings.Contains(msg, "duplicate key") && strings.Contains(msg, "email")
}
