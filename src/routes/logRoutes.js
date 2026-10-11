const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const { authenticateInstitution } = require('../middleware/authMiddleware');

router.use(authenticateInstitution);

router.get('/', logController.getVerificationLogs);

module.exports = router;
