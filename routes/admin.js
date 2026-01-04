const express = require('express');
const router = express.Router();
const { loginDoctor } = require('../controllers/adminController');
const { getAllProfiles, getProfileById, updateProfileById, getBreathingSessionsByUserId, generateUserReportPDF, generateUserReportPDFsingle } = require('../controllers/adminController');
const authenticate = require('../middleware/authMiddleware');

router.post('/login', loginDoctor); // POST /api/admin/login → verify password
router.get('/profiles', authenticate, getAllProfiles); // GET all profiles
router.get('/profiles/:uid', authenticate, getProfileById); // GET one profile
router.put('/profiles/:uid', authenticate, updateProfileById); // UPDATE one profile
router.get('/breathing-sessions/:uid', authenticate, getBreathingSessionsByUserId); // GET breathing sessions for a user
router.post('/generate-report', authenticate, generateUserReportPDF); // POST generate PDF report
router.post('/generate-report-single/:uid', authenticate, generateUserReportPDFsingle); // POST generate PDF report for single session

module.exports = router;
    