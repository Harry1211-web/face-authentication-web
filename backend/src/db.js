import pg from "pg";

const { Pool } = pg;

let pool;

export async function initDb() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is missing");
  }

  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      face_descriptor TEXT NOT NULL,
      failed_attempts INT DEFAULT 0,
      lock_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INT DEFAULT 0;
  `);

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS lock_until TIMESTAMPTZ;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_ci_unique
    ON users ((lower(email)));
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique_not_empty
    ON users (phone)
    WHERE phone IS NOT NULL AND btrim(phone) <> '';
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS liveness_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      active_score DOUBLE PRECISION NOT NULL,
      passive_score DOUBLE PRECISION NOT NULL,
      result BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  return pool;
}

export function getDb() {
  if (!pool) {
    throw new Error("Database not initialized. Call initDb first.");
  }
  return pool;
}
