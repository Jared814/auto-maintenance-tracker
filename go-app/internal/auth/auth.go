// Package auth provides session management, rate limiting, and HTTP handlers
// for login, registration, and logout.
package auth

import (
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/sessions"
	"github.com/jeg/auto-maintenance-tracker/internal/config"
)

const sessionName = "session"
const accountIDKey = "accountID"

var store *sessions.CookieStore

// -----------------------------------------------------------------------
// Session store initialisation
// -----------------------------------------------------------------------

// initStore configures the gorilla/sessions CookieStore.
// Called by Init so that both the store and the template/DB vars are set
// in a single call from main.
func initStore(cfg *config.Config) {
	store = sessions.NewCookieStore([]byte(cfg.AuthSecret))
	store.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   7 * 24 * 3600, // 7 days
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   cfg.NodeEnv == "production",
	}
}

// -----------------------------------------------------------------------
// Session helpers
// -----------------------------------------------------------------------

// GetAccountID returns the accountID stored in the session cookie, or an
// empty string if the session is absent or the value is not set.
func GetAccountID(r *http.Request) string {
	sess, err := store.Get(r, sessionName)
	if err != nil {
		return ""
	}
	v, ok := sess.Values[accountIDKey]
	if !ok {
		return ""
	}
	id, _ := v.(string)
	return id
}

// SetAccountID writes accountID into the session cookie and flushes it to
// the response writer.
func SetAccountID(w http.ResponseWriter, r *http.Request, accountID string) error {
	sess, err := store.Get(r, sessionName)
	if err != nil {
		// If the existing cookie is invalid (e.g. rotated secret), create a
		// fresh session rather than bubbling the error up.
		sess = sessions.NewSession(store, sessionName)
		sess.Options = store.Options
	}
	sess.Values[accountIDKey] = accountID
	return store.Save(r, w, sess)
}

// ClearSession invalidates the session by setting MaxAge to -1.
func ClearSession(w http.ResponseWriter, r *http.Request) error {
	sess, err := store.Get(r, sessionName)
	if err != nil {
		// Nothing meaningful to clear; write an expired cookie anyway.
		sess = sessions.NewSession(store, sessionName)
		sess.Options = store.Options
	}
	sess.Options.MaxAge = -1
	return store.Save(r, w, sess)
}

// -----------------------------------------------------------------------
// Rate limiting
// -----------------------------------------------------------------------

type attemptInfo struct {
	count       int
	lastAttempt time.Time
}

var (
	loginAttempts   = make(map[string]*attemptInfo)
	loginAttemptsMu sync.Mutex
)

const maxAttempts = 5
const lockoutDuration = 15 * time.Minute

func init() {
	go func() {
		ticker := time.NewTicker(lockoutDuration)
		defer ticker.Stop()
		for range ticker.C {
			pruneOldAttempts()
		}
	}()
}

// pruneOldAttempts removes entries whose lockout window has expired.
func pruneOldAttempts() {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	cutoff := time.Now().Add(-lockoutDuration)
	for ip, info := range loginAttempts {
		if info.lastAttempt.Before(cutoff) {
			delete(loginAttempts, ip)
		}
	}
}

// IsRateLimited returns true when the IP has exceeded maxAttempts within the
// lockout window.
func IsRateLimited(ip string) bool {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	info, ok := loginAttempts[ip]
	if !ok {
		return false
	}
	if time.Since(info.lastAttempt) > lockoutDuration {
		delete(loginAttempts, ip)
		return false
	}
	return info.count >= maxAttempts
}

// RecordFailedAttempt increments the failed-login counter for ip.
func RecordFailedAttempt(ip string) {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	info, ok := loginAttempts[ip]
	if !ok || time.Since(info.lastAttempt) > lockoutDuration {
		loginAttempts[ip] = &attemptInfo{count: 1, lastAttempt: time.Now()}
		return
	}
	info.count++
	info.lastAttempt = time.Now()
}

// ClearAttempts resets the failed-login counter for ip (called on success).
func ClearAttempts(ip string) {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	delete(loginAttempts, ip)
}

// -----------------------------------------------------------------------
// clientIP extracts the real IP address from the request.
// -----------------------------------------------------------------------

func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		// X-Forwarded-For may be a comma-separated list; take the first.
		for i := 0; i < len(fwd); i++ {
			if fwd[i] == ',' {
				return fwd[:i]
			}
		}
		return fwd
	}
	// Strip port from RemoteAddr.
	addr := r.RemoteAddr
	for i := len(addr) - 1; i >= 0; i-- {
		if addr[i] == ':' {
			return addr[:i]
		}
	}
	return addr
}
