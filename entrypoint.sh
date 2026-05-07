#!/bin/sh
# Fix Railway volume ownership — volumes are mounted as root, but the app
# runs as nextjs (uid 1001). chown before exec so better-sqlite3 can write.
chown -R nextjs:nodejs /app/data 2>/dev/null || true
exec gosu nextjs node --max-old-space-size=384 server.js
