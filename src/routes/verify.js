const express = require('express');
const pool = require('../db/pool');
const { verifyCertificateIntegrity } = require('../services/hashService');

const router = express.Router();

router.get('/:certificateId', async (req, res) => {
  try {
    const certId = req.params.certificateId;
    
    const result = await pool.query(
      `SELECT c.certificate_id, c.course, c.issue_date, c.certificate_type, c.status, 
              c.certificate_hash, s.name as student_name, s.student_id as student_roll, 
              s.department, s.graduation_year, i.name as institution_name, c.id as db_id
       FROM certificates c
       JOIN students s ON c.student_id = s.id
       JOIN institutions i ON c.institution_id = i.id
       WHERE c.certificate_id = $1`,
      [certId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Certificate not found',
        data: { verification_result: 'NOT_FOUND' }
      });
    }

    const cert = result.rows[0];

    const certDataForHash = {
      certificate_id: cert.certificate_id,
      student_roll: cert.student_roll,
      student_name: cert.student_name,
      course: cert.course,
      institution_name: cert.institution_name,
      issue_date: cert.issue_date.toISOString().split('T')[0],
      certificate_type: cert.certificate_type
    };

    const isIntegrityVerified = verifyCertificateIntegrity(certDataForHash, cert.certificate_hash);
    const integrity_result = isIntegrityVerified ? 'VERIFIED' : 'FAILED';
    const verification_result = cert.status;

    // Log verification
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    await pool.query(
      `INSERT INTO verification_logs (certificate_id, verified_by_ip, user_agent, is_successful)
       VALUES ($1, $2, $3, $4)`,
      [cert.db_id, ipAddress, userAgent, isIntegrityVerified && cert.status === 'VALID']
    );

    res.json({
      success: true,
      data: {
        certificate_id: cert.certificate_id,
        student_name: cert.student_name,
        course: cert.course,
        department: cert.department,
        graduation_year: cert.graduation_year,
        institution_name: cert.institution_name,
        issue_date: cert.issue_date,
        certificate_type: cert.certificate_type,
        status: cert.status,
        verification_result,
        integrity_result,
        verified_at: new Date()
      }
    });

  } catch (error) {
    console.error('Verify certificate error:', error);
    res.status(500).json({ success: false, message: 'Server error during verification' });
  }
});

module.exports = router;
