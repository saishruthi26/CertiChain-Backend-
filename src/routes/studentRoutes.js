const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticateInstitution } = require('../middleware/authMiddleware');

router.use(authenticateInstitution);

router.post('/', studentController.createStudent);
router.get('/', studentController.getStudents);
router.get('/:id', studentController.getStudentById);

module.exports = router;
