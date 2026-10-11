const router = require('express').Router();
const { verifyCertificate } = require('../controllers/verificationController');
router.get('/:certificateId', verifyCertificate);
module.exports = router;
