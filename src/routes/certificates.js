const router = require('express').Router();
const { createCertificate, getCertificates, getCertificate, revokeCertificate } = require('../controllers/certificateController');
const auth = require('../middleware/auth');
router.post('/', auth, createCertificate);
router.get('/', auth, getCertificates);
router.get('/:id', auth, getCertificate);
router.post('/:id/revoke', auth, revokeCertificate);
module.exports = router;
