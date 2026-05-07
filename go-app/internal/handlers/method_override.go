package handlers

import "net/http"

// MethodOverride reads the _method form field from a POST body and overrides
// r.Method so that chi routes to the correct handler (e.g. DELETE, PUT).
// It must be applied before the router dispatches the request.
func MethodOverride(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			// ParseForm is idempotent; safe to call here.
			if err := r.ParseForm(); err == nil {
				if m := r.FormValue("_method"); m != "" {
					r.Method = m
				}
			}
		}
		next.ServeHTTP(w, r)
	})
}
