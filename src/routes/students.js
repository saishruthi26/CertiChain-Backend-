const router = require('express').Router();
const { createStudent, getStudents, getStudent } = require('../controllers/studentController');
const auth = require('../middleware/auth');
router.post('/', auth, createStudent);
router.get('/', auth, getStudents);
router.get('/:id', auth, getStudent);
module.exports = router;
