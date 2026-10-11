const express = require('express');
const pool = require('../db/pool');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.id, v.verified_at, v.verified_by_ip, v.user_agent, v.is_successful,
              c.certificate_id, c.course, s.name as student_name
       FROM verification_logs v
       JOIN certificates c ON v.certificate_id = c.id
       JOIN students s ON c.student_id = s.id
       WHERE c.institution_id = $1
       ORDER BY v.verified_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get verification logs error:', error);
    res.status(500).json({ success: false, message: 'Server error getting verification logs' });
  }
});

module.exports = router;
