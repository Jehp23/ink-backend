const { neon } = require('@neondatabase/serverless');

let sql = null;

const connectDB = async () => {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL not set — cache disabled');
    return;
  }
  sql = neon(process.env.DATABASE_URL);
  await sql`
    CREATE TABLE IF NOT EXISTS contract_analyses (
      id          SERIAL PRIMARY KEY,
      address     VARCHAR(42)  NOT NULL,
      chain       VARCHAR(20)  NOT NULL DEFAULT 'avalanche',
      language    VARCHAR(5)   NOT NULL DEFAULT 'en',
      score       INTEGER      NOT NULL,
      level       VARCHAR(10)  NOT NULL,
      warnings    TEXT[]       NOT NULL DEFAULT '{}',
      explanation TEXT,
      signals     JSONB        NOT NULL DEFAULT '{}',
      report_ipfs_url TEXT,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      UNIQUE (address, language)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_ca_address ON contract_analyses (address)
  `;
  console.log('🟢 Neon (PostgreSQL) connected');
};

const getSQL = () => sql;

module.exports = { connectDB, getSQL };
