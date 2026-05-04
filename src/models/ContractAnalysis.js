const { getSQL } = require('../config/db');

const CACHE_TTL_HOURS = 1;

async function findCached(address, language) {
  const sql = getSQL();
  if (!sql) return null;
  const rows = await sql`
    SELECT * FROM contract_analyses
    WHERE address = ${address}
      AND language = ${language}
      AND created_at > NOW() - INTERVAL '${CACHE_TTL_HOURS} hours'
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function saveCache(data) {
  const sql = getSQL();
  if (!sql) return;
  const {
    address, chain = 'avalanche', language = 'en',
    score, level, warnings = [], explanation = null,
    signals = {}, report_ipfs_url = null,
  } = data;

  await sql`
    INSERT INTO contract_analyses
      (address, chain, language, score, level, warnings, explanation, signals, report_ipfs_url)
    VALUES
      (${address}, ${chain}, ${language}, ${score}, ${level},
       ${warnings}, ${explanation}, ${JSON.stringify(signals)}, ${report_ipfs_url})
    ON CONFLICT (address, language)
    DO UPDATE SET
      score           = EXCLUDED.score,
      level           = EXCLUDED.level,
      warnings        = EXCLUDED.warnings,
      explanation     = EXCLUDED.explanation,
      signals         = EXCLUDED.signals,
      report_ipfs_url = EXCLUDED.report_ipfs_url,
      created_at      = NOW()
  `;
}

async function countDistinctAddresses() {
  const sql = getSQL();
  if (!sql) return 0;
  const rows = await sql`SELECT COUNT(DISTINCT address) AS total FROM contract_analyses`;
  return parseInt(rows[0]?.total ?? 0);
}

module.exports = { findCached, saveCache, countDistinctAddresses };
