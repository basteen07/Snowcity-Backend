const { pool } = require('../config/db');

async function createMedia({ url_path, relative_path, filename, size, mimetype, folder = null }) {
  const { rows } = await pool.query(
    `INSERT INTO media_files (url_path, relative_path, filename, size, mimetype, folder)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [url_path, relative_path, filename, size, mimetype, folder]
  );
  return rows[0] || null;
}

async function getMediaById(media_id) {
  const { rows } = await pool.query(`SELECT * FROM media_files WHERE media_id = $1`, [media_id]);
  return rows[0] || null;
}

module.exports = {
  createMedia,
  getMediaById,
};
