const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');

// Public verification routes (No login required)
router.get('/:certificate_id', verificationController.verifyCertificate);
router.post('/', verificationController.verifyCertificate);

module.exports = router;
