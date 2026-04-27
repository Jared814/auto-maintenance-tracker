export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    const { initDb } = await import('./lib/db');
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await initDb();
        return;
      } catch (err) {
        if (attempt === maxAttempts) throw err;
        console.warn(`[Database] Init attempt ${attempt} failed, retrying in 10s...`, err);
        await new Promise((resolve) => setTimeout(resolve, 10_000));
      }
    }
  }
}
