const db = require('../config/db');

module.exports = {
  pool: db.pool,
  query: db.query
};
