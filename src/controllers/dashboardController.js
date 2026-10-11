const db = require('../db');

exports.getStats = async (req, res, next) => {
  try {
    const instId = req.institution.id;

    const [totalCert, validCert, revokedCert, totalVerifications, recentCerts, recentLogs] = await Promise.all([
      db.query('SELECT COUNT(*) FROM certificates WHERE institution_id = $1', [instId]),
      db.query('SELECT COUNT(*) FROM certificates WHERE institution_id = $1 AND status = $2', [instId, 'VALID']),
      db.query('SELECT COUNT(*) FROM certificates WHERE institution_id = $1 AND status = $2', [instId, 'REVOKED']),
      db.query(`SELECT COUNT(*) FROM verification_logs v JOIN certificates c ON v.certificate_id = c.certificate_id WHERE c.institution_id = $1`, [instId]),
      db.query(`SELECT c.certificate_id, c.course, c.certificate_type, c.status, c.created_at, s.full_name as student_name FROM certificates c JOIN students s ON c.student_id = s.id WHERE c.institution_id = $1 ORDER BY c.created_at DESC LIMIT 5`, [instId]),
      db.query(`SELECT v.* FROM verification_logs v JOIN certificates c ON v.certificate_id = c.certificate_id WHERE c.institution_id = $1 ORDER BY v.verified_at DESC LIMIT 5`, [instId])
    ]);

    res.json({
      success: true,
      data: {
        totalCertificates: parseInt(totalCert.rows[0].count, 10),
        validCertificates: parseInt(validCert.rows[0].count, 10),
        revokedCertificates: parseInt(revokedCert.rows[0].count, 10),
        totalVerifications: parseInt(totalVerifications.rows[0].count, 10),
        recentCertificates: recentCerts.rows,
        recentLogs: recentLogs.rows
      }
    });
  } catch (error) {
    next(error);
  }
};
