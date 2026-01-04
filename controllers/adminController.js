require('dotenv').config();
const jwt = require('jsonwebtoken');
const { admin } = require('../firebase/firebaseAdmin');
const PDFDocument = require('pdfkit');

// Admin login
const loginDoctor = (req, res) => {
  const { password } = req.body;

  if (password === process.env.DOCTOR_PASSWORD) {
    const token = jwt.sign({ isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return res.status(200).json({ message: 'Access granted', token });
  } else {
    return res.status(401).json({ error: 'Wrong password' });
  }
};

// Fetch all profiles
const getAllProfiles = async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('profiles').get();
    const users = snapshot.docs.map(doc => {
      return {
      uid: doc.id,
      ...doc.data()
      };
    });

    return res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return res.status(500).json({ message: 'Failed to fetch profiles' });
  }
};

// Fetch profile by UID
const getProfileById = async (req, res) => {
  const { uid } = req.params;

  try {
    const docRef = admin.firestore().collection('profiles').doc(uid);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    return res.status(200).json(doc.data());
  } catch (error) {
    console.error('Error fetching profile by ID:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const updateProfileById = async (req, res) => {
  try {
    const { uid } = req.params;
    const profileData = req.body;

    // Add timestamp
    profileData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await admin.firestore().collection('profiles').doc(uid).update(profileData);

    return res.status(200).json({
      message: 'Profile updated successfully',
      uid
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(400).json({ error: error.message });
  }
};

// Get breathing sessions for a specific user
const getBreathingSessionsByUserId = async (req, res) => {
  try {
    const { uid } = req.params;

    // Query Firestore to get all breathing sessions for this user
    const sessionsSnapshot = await admin.firestore()
      .collection('breathingSessions')
      .where('uid', '==', uid)
      .orderBy('timestamp', 'asc')
      .get();

    if (sessionsSnapshot.empty) {
      return res.status(200).json({ sessions: [] });
    }

    // Convert to array of session data
    const sessions = [];
    sessionsSnapshot.forEach(doc => {
      sessions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return res.status(200).json({
      sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('Get breathing sessions error:', error);
    return res.status(500).json({ error: 'Failed to retrieve breathing sessions' });
  }
};

// Generate PDF report with user data
const generateUserReportPDF = async (req, res) => {
  try {
    const { includePersonalInfo, includeTobaccoInfo, includeBreathingProgress } = req.body;

    // Fetch all profiles
    const profilesSnapshot = await admin.firestore().collection('profiles').get();
    const profiles = [];
    profilesSnapshot.forEach(doc => {
      profiles.push({
        uid: doc.id,
        ...doc.data()
      });
    });

    // Create PDF document
    const doc = new PDFDocument();
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=user-report.pdf');
      res.send(pdfData);
    });

    // PDF Header
    doc.fontSize(20).text('Vital Choice - User Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    // Process each user
    for (const profile of profiles) {
      doc.fontSize(16).text(`User: ${profile.name}`, { underline: true });
      doc.moveDown();

      // Personal Information
      if (includePersonalInfo) {
        doc.fontSize(14).text('Personal Information:', { underline: true });
        doc.fontSize(10);
        doc.text(`Name: ${profile.name || 'N/A'}`);
        doc.text(`Age: ${profile.age || 'N/A'}`);
        doc.text(`Sex: ${profile.sex || 'N/A'}`);
        doc.text(`Nationality: ${profile.nationality || 'N/A'}`);
        if (profile.nationality === 'India') {
          doc.text(`Aadhar Number: ${profile.aadhar || 'N/A'}`);
        }
        doc.text(`Address: ${profile.address || 'N/A'}`);
        doc.text(`Phone: ${profile.phone || 'N/A'}`);
        doc.text(`Email: ${profile.email || 'N/A'}`);
        doc.text(`Marital Status: ${profile.maritalStatus || 'N/A'}`);
        doc.text(`Occupation: ${profile.occupation || 'N/A'}`);
        if (profile.occupation === 'Other') {
          doc.text(`Other Occupation: ${profile.occupationOther || 'N/A'}`);
        }
        doc.text(`Income: ${profile.income || 'N/A'}`);
        doc.moveDown();
      }

      // Tobacco Usage Information
      if (includeTobaccoInfo) {
        doc.fontSize(14).text('Tobacco Usage Information:', { underline: true });
        doc.fontSize(10);
        doc.text(`Types of Tobacco Used: ${profile.tobaccoTypes?.join(', ') || 'N/A'}`);
        if (profile.tobaccoTypes?.includes('Other')) {
          doc.text(`Other Tobacco Type: ${profile.otherTobaccoType || 'N/A'}`);
        }
        doc.text(`Frequency Per Day: ${profile.frequencyPerDay || 'N/A'}`);
        doc.text(`Usual Craving Timings: ${profile.cravingTimings?.join(', ') || 'N/A'}`);
        if (profile.cravingTimings?.includes('Other')) {
          doc.text(`Other Craving Timing: ${profile.otherCravingTiming || 'N/A'}`);
        }
        doc.text(`Years Using Tobacco: ${profile.yearsUsing || 'N/A'}`);
        doc.text(`Reason for Quitting: ${profile.quittingReason || 'N/A'}`);
        if (profile.quittingReason === 'Other') {
          doc.text(`Other Quitting Reason: ${profile.quittingReasonOther || 'N/A'}`);
        }
        doc.text(`Confidence Level to Quit: ${profile.confidenceLevel || 'N/A'}`);
        doc.text(`Health Issues: ${profile.healthIssues?.join(', ') || 'N/A'}`);
        if (profile.healthIssues?.includes('Other')) {
          doc.text(`Other Health Issues: ${profile.healthIssuesOther || 'N/A'}`);
        }
        doc.text(`Triggers: ${profile.triggers?.join(', ') || 'N/A'}`);
        if (profile.triggers?.includes('Other')) {
          doc.text(`Other Trigger: ${profile.otherTrigger || 'N/A'}`);
        }
        doc.text(`Average Monthly Tobacco Spending (₹): ${profile.tobaccoSpending || 'N/A'}`);
        doc.moveDown();
      }

      // Breathing Progress
      if (includeBreathingProgress) {
        doc.fontSize(14).text('Breathing Exercise Progress:', { underline: true });

        try {
          const sessionsSnapshot = await admin.firestore()
            .collection('breathingSessions')
            .where('uid', '==', profile.uid)
            .orderBy('timestamp', 'asc')
            .get();

          if (!sessionsSnapshot.empty) {
            const sessions = [];
            sessionsSnapshot.forEach(doc => sessions.push(doc.data()));

            const totalDuration = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
            const sessionCount = sessions.length;
            const bestSession = sessions.length > 0 ? Math.max(...sessions.map(s => s.duration || 0)) : 0;

            doc.fontSize(10);
            doc.text(`Total Duration: ${totalDuration} seconds`);
            doc.text(`Number of Sessions: ${sessionCount}`);
            doc.text(`Best Session: ${bestSession} seconds`);
          } else {
            doc.fontSize(10).text('No breathing exercise data available');
          }
        } catch (error) {
          console.error('Error fetching breathing data for PDF:', error);
          doc.fontSize(10).text('Error loading breathing data');
        }
        doc.moveDown();
      }

      doc.moveDown(2);
      // Add page break if not the last user
      if (profile !== profiles[profiles.length - 1]) {
        doc.addPage();
      }
    }

    doc.end();
  } catch (error) {
    console.error('Generate PDF error:', error);
    return res.status(500).json({ error: 'Failed to generate PDF report' });
  }
};

const generateUserReportPDFsingle = async (req, res) => {
  const targetUid = req.params.uid;
  const { includePersonalInfo, includeTobaccoInfo, includeBreathingProgress } = req.body || {};

  try {
    // Fetch profile for that user
    const profileRef = admin.firestore().collection('profiles').doc(targetUid);
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    const profile = { uid: profileSnap.id, ...profileSnap.data() };

    // Set headers for streaming PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="user-report-${targetUid}.pdf"`);

    const doc = new PDFDocument({ autoFirstPage: false });
    doc.pipe(res); // stream directly to response

    // First page header
    doc.addPage();
    doc.fontSize(20).text('Vital Choice - User Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    // User header
    doc.fontSize(16).text(`User: ${profile.name || profile.email || profile.uid}`, { underline: true });
    doc.moveDown();

    // Personal Information
    if (includePersonalInfo) {
      doc.fontSize(14).text('Personal Information:', { underline: true });
      doc.fontSize(10);
      doc.text(`Name: ${profile.name || 'N/A'}`);
      doc.text(`Age: ${profile.age || 'N/A'}`);
      doc.text(`Sex: ${profile.sex || 'N/A'}`);
      doc.text(`Nationality: ${profile.nationality || 'N/A'}`);
      if (profile.nationality === 'India') {
        doc.text(`Aadhar Number: ${profile.aadhar || 'N/A'}`);
      }
      doc.text(`Address: ${profile.address || 'N/A'}`);
      doc.text(`Phone: ${profile.phone || 'N/A'}`);
      doc.text(`Email: ${profile.email || 'N/A'}`);
      doc.text(`Marital Status: ${profile.maritalStatus || 'N/A'}`);
      doc.text(`Occupation: ${profile.occupation || 'N/A'}`);
      if (profile.occupation === 'Other') {
        doc.text(`Other Occupation: ${profile.occupationOther || 'N/A'}`);
      }
      doc.text(`Income: ${profile.income || 'N/A'}`);
      doc.moveDown();
    }

    // Tobacco Usage Information
    if (includeTobaccoInfo) {
      doc.fontSize(14).text('Tobacco Usage Information:', { underline: true });
      doc.fontSize(10);
      doc.text(`Types of Tobacco Used: ${profile.tobaccoTypes?.join(', ') || 'N/A'}`);
      if (profile.tobaccoTypes?.includes('Other')) {
        doc.text(`Other Tobacco Type: ${profile.otherTobaccoType || 'N/A'}`);
      }
      doc.text(`Frequency Per Day: ${profile.frequencyPerDay || 'N/A'}`);
      doc.text(`Usual Craving Timings: ${profile.cravingTimings?.join(', ') || 'N/A'}`);
      if (profile.cravingTimings?.includes('Other')) {
        doc.text(`Other Craving Timing: ${profile.otherCravingTiming || 'N/A'}`);
      }
      doc.text(`Years Using Tobacco: ${profile.yearsUsing || 'N/A'}`);
      doc.text(`Reason for Quitting: ${profile.quittingReason || 'N/A'}`);
      if (profile.quittingReason === 'Other') {
        doc.text(`Other Quitting Reason: ${profile.quittingReasonOther || 'N/A'}`);
      }
      doc.text(`Confidence Level to Quit: ${profile.confidenceLevel || 'N/A'}`);
      doc.text(`Health Issues: ${profile.healthIssues?.join(', ') || 'N/A'}`);
      if (profile.healthIssues?.includes('Other')) {
        doc.text(`Other Health Issues: ${profile.healthIssuesOther || 'N/A'}`);
      }
      doc.text(`Triggers: ${profile.triggers?.join(', ') || 'N/A'}`);
      if (profile.triggers?.includes('Other')) {
        doc.text(`Other Trigger: ${profile.otherTrigger || 'N/A'}`);
      }
      doc.text(`Average Monthly Tobacco Spending (₹): ${profile.tobaccoSpending || 'N/A'}`);
      doc.moveDown();
    }

    // Breathing Progress
    if (includeBreathingProgress) {
      doc.fontSize(14).text('Breathing Exercise Progress:', { underline: true });

      try {
        const sessionsSnapshot = await admin.firestore()
          .collection('breathingSessions')
          .where('uid', '==', targetUid)
          .orderBy('timestamp', 'asc')
          .get();

        if (!sessionsSnapshot.empty) {
          const sessions = sessionsSnapshot.docs.map(d => d.data());
          const totalDuration = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
          const sessionCount = sessions.length;
          const bestSession = sessionCount > 0 ? Math.max(...sessions.map(s => s.duration || 0)) : 0;

          doc.fontSize(10);
          doc.text(`Total Duration: ${totalDuration} seconds`);
          doc.text(`Number of Sessions: ${sessionCount}`);
          doc.text(`Best Session: ${bestSession} seconds`);
        } else {
          doc.fontSize(10).text('No breathing exercise data available');
        }
      } catch (error) {
        console.error('Error fetching breathing data for PDF:', error);
        doc.fontSize(10).text('Error loading breathing data');
      }

      doc.moveDown();
    }

    // finalize PDF
    doc.end();
    // streamed response will finish when doc.end() is called
  } catch (error) {
    console.error('Generate single-user PDF error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to generate PDF report' });
    }
    // If headers already sent, just end the stream (PDFKit will do that)
  }
};

module.exports = { loginDoctor, getAllProfiles, getProfileById, updateProfileById, getBreathingSessionsByUserId, generateUserReportPDF, generateUserReportPDFsingle };
