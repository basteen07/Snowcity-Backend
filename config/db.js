const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const isTrue = (v) => ['1', 'true', 'yes', 'on'].includes(String(v || '').toLowerCase());

function needsSsl() {
  // Honor explicit flags or auto-enable for common managed hosts
  if ((process.env.PGSSLMODE && process.env.PGSSLMODE !== 'disable') || isTrue(process.env.PGSSL)) return true;
  const url = process.env.DATABASE_URL || '';
  return /render\.com|neon\.tech|supabase\.co|amazonaws\.com|azure|herokuapp\.com/i.test(url);
}

function getPgConfig() {
  const ssl = needsSsl() ? { rejectUnauthorized: false } : false;

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl,
      application_name: 'snowcity-backend',
      max: Number(process.env.PGPOOL_MAX || 20),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT || 30000),
    };
  }

  return {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'snowcity',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    ssl,
    application_name: 'snowcity-backend',
    max: Number(process.env.PGPOOL_MAX || 20),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT || 30000),
  };
}

function safeParseDbUrl(dbUrl) {
  try {
    const u = new URL(dbUrl);
    const db = u.pathname?.replace(/^\/+/, '');
    return {
      host: u.hostname || undefined,
      port: u.port ? Number(u.port) : undefined,
      database: db || undefined,
      user: u.username ? decodeURIComponent(u.username) : undefined,
    };
  } catch {
    return {};
  }
}

const pgConfig = getPgConfig();
const pool = new Pool(pgConfig);

// Build connection info for logging (no secrets)
const connInfo = (() => {
  if (process.env.DATABASE_URL) {
    const p = safeParseDbUrl(process.env.DATABASE_URL);
    return {
      host: p.host,
      port: p.port,
      database: p.database,
      user: p.user,
      ssl: !!pgConfig.ssl,
      poolMax: pgConfig.max,
    };
  }
  return {
    host: pgConfig.host,
    port: pgConfig.port,
    database: pgConfig.database,
    user: pgConfig.user,
    ssl: !!pgConfig.ssl,
    poolMax: pgConfig.max,
  };
})();

let hasLoggedConnected = false;

pool.on('connect', async (client) => {
  try {
    await client.query("SET TIME ZONE 'UTC'");
  } catch (err) {
    logger.warn('Unable to set timezone to UTC', { err: err.message });
  }
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS citext');
  } catch (err) {
    // On managed DBs (Render/Neon/etc.) this may require superuser; warn and continue.
    logger.warn('CITEXT extension enable failed (non-fatal)', { err: err.message });
  }

  // Log a one-time "connected" message with server details
  if (!hasLoggedConnected) {
    hasLoggedConnected = true;
    try {
      const { rows } = await client.query(
        "select current_database() as db, current_user as user_name, current_setting('TimeZone') as tz"
      );
      const r = rows?.[0] || {};
      logger.info('PostgreSQL connected', {
        host: connInfo.host,
        port: connInfo.port,
        database: r.db || connInfo.database,
        user: r.user_name || connInfo.user,
        ssl: connInfo.ssl,
        poolMax: connInfo.poolMax,
        timezone: r.tz || 'UTC',
      });
    } catch (e) {
      // Fallback log if the metadata query fails
      logger.info('PostgreSQL connected', {
        host: connInfo.host,
        port: connInfo.port,
        database: connInfo.database,
        user: connInfo.user,
        ssl: connInfo.ssl,
        poolMax: connInfo.poolMax,
      });
    }
  }
});

pool.on('error', (err) => {
  logger.error('Unexpected PG pool error', { err });
});

const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug('executed query', { text: String(text).split('\n')[0].slice(0, 120), duration, rows: res.rowCount });
  return res;
};

const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Accept absolute or relative paths
const runSqlFile = async (filePath) => {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
  const sql = fs.readFileSync(fullPath, 'utf-8');
  return query(sql);
};

module.exports = {
  pool,
  query,
  withTransaction,
  runSqlFile,
};