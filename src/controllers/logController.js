const db = require('../config/db');

/**
 * Get verification logs for logged-in institution
 * GET /api/verification-logs
 */
async function getVerificationLogs(req, res, next) {
  try {
    const institution_id = req.institution.id;
    const { limit = 50, offset = 0, search } = req.query;

    let queryText = `
      SELECT 
        vl.id,
        vl.certificate_id,
        vl.verification_result,
        vl.integrity_result,
        vl.verified_at,
        vl.ip_address,
        vl.user_agent,
        s.student_name,
        s.course,
        c.certificate_type
      FROM verification_logs vl
      LEFT JOIN certificates c ON vl.certificate_id = c.certificate_id
      LEFT JOIN students s ON c.student_id = s.id
      WHERE c.institution_id = $1
    `;
    let queryParams = [institution_id];
    let paramIndex = 2;

    if (search) {
      queryText += ` AND (vl.certificate_id ILIKE $${paramIndex} OR s.student_name ILIKE $${paramIndex} OR vl.verification_result ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    queryText += ` ORDER BY vl.verified_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await db.query(queryText, queryParams);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      logs: result.rows
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getVerificationLogs
};
