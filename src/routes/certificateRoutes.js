const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');
const { authenticateInstitution } = require('../middleware/authMiddleware');

// Public route to view single certificate (for previewing/rendering)
router.get('/public/:certificate_id', certificateController.getCertificateById);

// Protected routes for institution
router.use(authenticateInstitution);

router.post('/', certificateController.createCertificate);
router.get('/', certificateController.getCertificates);
router.get('/stats/dashboard', certificateController.getDashboardStats);
router.get('/:certificate_id', certificateController.getCertificateById);
router.post('/:certificate_id/revoke', certificateController.revokeCertificate);

module.exports = router;
