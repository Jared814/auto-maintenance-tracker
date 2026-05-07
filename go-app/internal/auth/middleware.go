package auth

import (
	"context"
	"net/http"
)

type contextKey string

// AccountIDContextKey is the key used to store accountID in request context.
const AccountIDContextKey contextKey = "accountID"

// RequireAuth is middleware that redirects unauthenticated requests to /login.
// If the session contains a valid accountID it is injected into the request
// context before calling the next handler.
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		accountID := GetAccountID(r)
		if accountID == "" {
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}
		ctx := context.WithValue(r.Context(), AccountIDContextKey, accountID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// LoadSession reads the session and, if an accountID is present, injects it
// into the request context. Unlike RequireAuth it does not redirect on missing
// session — suitable for public routes that optionally use session data.
func LoadSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		accountID := GetAccountID(r)
		if accountID != "" {
			ctx := context.WithValue(r.Context(), AccountIDContextKey, accountID)
			r = r.WithContext(ctx)
		}
		next.ServeHTTP(w, r)
	})
}

// AccountIDFromContext retrieves the accountID injected by RequireAuth or
// LoadSession. Returns an empty string if not present.
func AccountIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(AccountIDContextKey).(string)
	return v
}
