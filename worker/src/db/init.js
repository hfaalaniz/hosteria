let initialized = false;

export async function initDB(DB) {
  if (initialized) return;
  initialized = true;
  // Schema is applied via wrangler d1 execute schema.sql + schema_multitenant.sql
  // This function is kept as a no-op to avoid breaking the middleware chain
}
