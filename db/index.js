const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Always load backend/.env regardless of CWD
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const logger = require('../config/logger');
const { pool, runSqlFile, withTransaction } = require('../config/db');

const BASE_DIR = path.resolve(__dirname);
const MIGRATIONS_DIR = path.join(BASE_DIR, 'migrations');
const SEEDS_DIR = path.join(BASE_DIR, 'seeds');

function listSqlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

async function migrate() {
  const files = listSqlFiles(MIGRATIONS_DIR);
  if (!files.length) {
    logger.info('No migrations found.');
    return;
  }
  logger.info(`Running ${files.length} migration(s)...`);
  for (const file of files) {
    const full = path.join(MIGRATIONS_DIR, file);
    logger.info(`Applying migration: ${full}`);
    await runSqlFile(full);
  }
  logger.info('Migrations completed.');
}

async function seedSqlFiles() {
  const files = listSqlFiles(SEEDS_DIR);
  if (!files.length) {
    logger.info('No seed SQL files found.');
    return;
  }
  logger.info(`Running ${files.length} seed SQL file(s)...`);
  for (const file of files) {
    const full = path.join(SEEDS_DIR, file);
    logger.info(`Seeding: ${full}`);
    await runSqlFile(full);
  }
  logger.info('Seed SQL files completed.');
}

async function seedAdminUser() {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@snowcity.com';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
  const ADMIN_NAME = process.env.ADMIN_NAME || 'Super Admin';
  const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

  return withTransaction(async (client) => {
    // Ensure admin role exists
    const roleRes = await client.query(
      `INSERT INTO roles (role_name, description)
       VALUES ('admin', 'Admin role')
       ON CONFLICT (role_name) DO UPDATE SET role_name = EXCLUDED.role_name
       RETURNING role_id`
    );
    const adminRoleId = roleRes.rows[0].role_id;

    // Create or fetch admin user
    const hash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
    const userRes = await client.query(
      `INSERT INTO users (name, email, password_hash, otp_verified)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING user_id, email`,
      [ADMIN_NAME, ADMIN_EMAIL, hash]
    );
    const userId = userRes.rows[0].user_id;

    // Assign admin role
    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId, adminRoleId]
    );

    logger.info(`Admin ensured: ${ADMIN_EMAIL} (user_id=${userId})`);
    return { userId, email: ADMIN_EMAIL };
  });
}

async function seedRootUser() {
  const ROOT_ADMIN_EMAIL = process.env.ROOT_ADMIN_EMAIL || 'root@snowcity.com';
  const ROOT_ADMIN_PASSWORD = process.env.ROOT_ADMIN_PASSWORD || 'Root@123';
  const ROOT_ADMIN_NAME = process.env.ROOT_ADMIN_NAME || 'Root Admin';
  const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

  return withTransaction(async (client) => {
    // Ensure root role exists
    const roleRes = await client.query(
      `INSERT INTO roles (role_name, description)
       VALUES ('root', 'Root admin role')
       ON CONFLICT (role_name) DO UPDATE SET role_name = EXCLUDED.role_name
       RETURNING role_id`
    );
    const rootRoleId = roleRes.rows[0].role_id;

    // Create or fetch root user
    const hash = await bcrypt.hash(ROOT_ADMIN_PASSWORD, SALT_ROUNDS);
    const userRes = await client.query(
      `INSERT INTO users (name, email, password_hash, otp_verified)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING user_id, email`,
      [ROOT_ADMIN_NAME, ROOT_ADMIN_EMAIL, hash]
    );
    const userId = userRes.rows[0].user_id;

    // Assign root role
    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId, rootRoleId]
    );

    // Grant all permissions to root (idempotent)
    await client.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT $1, p.permission_id
       FROM permissions p
       ON CONFLICT (role_id, permission_id) DO NOTHING`,
      [rootRoleId]
    );

    logger.info(`Root admin ensured: ${ROOT_ADMIN_EMAIL} (user_id=${userId})`);
    return { userId, email: ROOT_ADMIN_EMAIL };
  });
}

async function rebuild() {
  await migrate();
  await seedSqlFiles();
  await seedRootUser();
  await seedAdminUser();
}

async function main() {
  const cmd = (process.argv[2] || '').toLowerCase();
  try {
    switch (cmd) {
      case 'migrate':
        await migrate();
        break;
      case 'seed':
        await seedSqlFiles();
        await seedRootUser();
        await seedAdminUser();
        break;
      case 'rebuild':
      case 'reset':
        await rebuild();
        break;
      case 'schema':
        await runSqlFile(path.join(BASE_DIR, 'sql', 'schema.sql'));
        break;
      default:
        console.log('Usage: node backend/db/index.js [migrate|seed|rebuild|schema]');
        break;
    }
  } catch (err) {
    logger.error('DB task failed', { err: err.message, stack: err.stack });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  migrate,
  seedSqlFiles,
  seedAdminUser,
  seedRootUser,
  rebuild,
};