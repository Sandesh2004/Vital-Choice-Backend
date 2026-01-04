const { admin } = require('../firebase/firebaseAdmin');
const axios = require('axios');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const registerUser = async (req, res) => {
  const { uid, email } = req.body;

  if (!uid || !email) {
    return res.status(400).json({ error: "UID and email are required" });
  }

  try {
    // Optional: check if user exists in Firebase Auth
    const userRecord = await admin.auth().getUser(uid);

    // Save profile in Firestore or your DB
    await admin.firestore().collection("users").doc(uid).set({
      email: email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ message: "User profile created successfully" });
  } catch (error) {
    console.log("createUserProfile error:", error);
    return res.status(400).json({ error: error.message });
  }
};


// // Your Android app deep link
// const APP_DEEP_LINK = "vitalchoiceapp://verify-success";
// // Change to your deep link scheme (from app.json → scheme: "myapp")

// const emailVerified = async (req, res) =>{
//   const { mode, oobCode, apiKey } = req.query;

//   if (!mode || !oobCode || !apiKey) {
//     return res.status(400).send("<h1>Invalid verification link.</h1>");
//   }

//   if (mode !== "verifyEmail") {
//     return res.status(400).send("<h1>Invalid email verification mode.</h1>");
//   }

//   try {
//     // ---------------------------------------------------------
//     // STEP 1: Apply the OOB code (this finishes email verification)
//     // Firebase REST API endpoint:
//     // https://identitytoolkit.googleapis.com/v1/accounts:update?key=API_KEY
//     // ---------------------------------------------------------
//     const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${process.env.FIREBASE_API_KEY}`;

//     const applyResponse = await axios.post(verifyUrl, {
//       oobCode: oobCode
//     });

//     const uid = applyResponse.data.localId;

//     // ---------------------------------------------------------
//     // STEP 2: Mark user verified in your DB (Firestore)
//     // ---------------------------------------------------------
//     await admin.firestore().collection("users").doc(uid).update({
//       verified: true,
//       verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
//     });

//     // ---------------------------------------------------------
//     // STEP 3: Redirect to your app (Android deep link)
//     // ---------------------------------------------------------
//     return res.redirect(APP_DEEP_LINK);

//   } catch (err) {
//     console.error("Email verification error:", err.response?.data || err.message);

//     return res.status(400).send(`
//       <h1>Email verification failed.</h1>
//       <p>The link may have expired or already been used.</p>
//     `);
//   }
// };

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
      {
        email,
        password,
        returnSecureToken: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

const uid = response.data.localId;

    // 2) Get user record from Admin SDK and check emailVerified
    const userRecord = await admin.auth().getUser(uid);

    if (!userRecord.emailVerified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
      });
    }

    // 3) Mark verified in Firestore (idempotent)
    await admin.firestore().collection('users').doc(uid).set(
      {
        verified: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 4) Return tokens if everything OK
    return res.status(200).json({
      message: 'Login successful',
      idToken: response.data.idToken,
      refreshToken: response.data.refreshToken,
      uid,
    });
  } catch (error) {
    console.log('Login error:', error.response?.data || error.message);
    return res.status(401).json({
      error: error.response?.data?.error?.message || 'Login failed',
    });
  }
};

const validateToken = async(req, res) => {
  const { token } = req.body;

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return res.json({ valid: true, uid: decoded.uid });
  } catch (err) {
    return res.json({ valid: false });
  }
};

// Middleware to verify Firebase ID token
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid token' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.uid = decodedToken.uid; // attach UID to request
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(403).json({ message: 'Unauthorized' });
  }
};

const createProfile = async (req, res) => {
    try {
        const profile = req.body;
    
        if (!profile || !profile.name || !profile.phone) {
          return res.status(400).json({ message: 'Missing required fields' });
        }
    
        const profileData = {
          ...profile,
          uid: req.uid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
    
        // Save profile with UID as document ID (ensures 1 profile per user)
        await admin.firestore().collection('profiles').doc(req.uid).set(profileData);
    
        res.json({ message: 'Profile saved successfully' });
      } catch (error) {
        console.error('Error saving profile:', error);
        res.status(500).json({ message: 'Server error' });
      }
};

const fetchProfile = async (req, res) => {
  try {
    const docRef = admin.firestore().collection('profiles').doc(req.uid);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    return res.json(doc.data());
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};


// routes/passwordReset.js
// const express = require('express');
// const router = express.Router();

// const APP_RESET_DEEP_LINK = 'vitalchoiceapp://reset-password'; // use your scheme

// const passwordReset = async (req, res) => {
//   const { mode, oobCode } = req.query;
//   if (!mode || mode !== 'resetPassword' || !oobCode) {
//     return res.status(400).send('<h1>Invalid reset link</h1>');
//   }

//   const deep = `${APP_RESET_DEEP_LINK}?oobCode=${encodeURIComponent(oobCode)}&mode=resetPassword`;
//   return res.send(`
//     <html>
//       <head><meta http-equiv="refresh" content="0;url='${deep}'" /></head>
//       <body>
//         <p>If you are not redirected automatically, <a href="${deep}">open the app</a>.</p>
//       </body>
//     </html>`);
// };

// Save breathing session data
const saveBreathingSession = async (req, res) => {
  try {
    const uid = req.uid; // Get uid directly from req.uid
    const { duration, timestamp } = req.body;
    
    // Validate input
    if (duration === undefined || !timestamp) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Create a new breathing session document
    const sessionData = {
      duration,
      timestamp,
      timestamp: timestamp || new Date().toISOString(),
      uid: req.uid,  // Add the user ID from the authenticated request
    };

    // Save to Firestore - ensure we have a valid document ID
    const breathingSessionsRef = admin.firestore().collection('breathingSessions');
    
    // Generate a new document ID if none is provided
    await breathingSessionsRef.doc().set(sessionData);
    
    res.status(200).json({ message: 'Breathing session saved successfully' });
  } catch (error) {
    console.error('Save breathing session error:', error);
    res.status(500).json({ message: 'Failed to save breathing session', error: error.message });
  }
};

const getBreathingSessions = async (req, res) => {
  try {
    const uid = req.uid;
    
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

const songsByMood = {
  Stressed: [
    { id: '1', title: 'Water Fountain', url: `${process.env.BASE_URL}/music/water_fountain.mp3` },
    { id: '2', title: 'Beautiful Calming', url: `${process.env.BASE_URL}/music/Beautiful_Calming_Music.mp3` },
    { id: '3', title: 'Healing Harmony', url: `${process.env.BASE_URL}/music/Healing_Harmony.mp3` },
    { id: '4', title: 'Temple Rhythms', url: `${process.env.BASE_URL}/music/Temple_Rhythms.mp3` }
  ],
  Sad: [
    { id: '5', title: 'Senorita', url: `${process.env.BASE_URL}/music/Senorita.mp3` },
    { id: '6', title: 'Jiya Re', url: `${process.env.BASE_URL}/music/Jiya_Re.mp3` },
    { id: '7', title: 'Gilehriyaan', url: `${process.env.BASE_URL}/music/Gilehriyaan.mp3` },
    { id: '8', title: 'Feel Good Hindi', url: `${process.env.BASE_URL}/music/Feel_Good_Hindi.mp3` },
    { id: '9', title: 'Self love', url: `${process.env.BASE_URL}/music/Self_love.mp3` }
  ],
  Hopeful: [
    { id: '10', title: 'Give Me Some Sunshine', url: `${process.env.BASE_URL}/music/Give_Me_Some_Sunshine.mp3` },
    { id: '11', title: 'All is Well', url: `${process.env.BASE_URL}/music/All_is_Well.mp3` },
    { id: '12', title: 'Love You Zindagi', url: `${process.env.BASE_URL}/music/Love_You_Zindagi.mp3` },
    { id: '13', title: 'Unstoppable', url: `${process.env.BASE_URL}/music/Unstoppable.mp3` }
  ],
  Motivated: [
    { id: '14', title: 'Winning Moments', url: `${process.env.BASE_URL}/music/Winning_Moments.mp3` },
    { id: '15', title: 'Badal Pe Paon Hain', url: `${process.env.BASE_URL}/music/Badal_Pe_Paon_Hain.mp3` },
    { id: '16', title: 'Ziddi Dil', url: `${process.env.BASE_URL}/music/Ziddi_Dil.mp3` },
    { id: '17', title: 'Best Motivational', url: `${process.env.BASE_URL}/music/Best_motivational.mp3` }
  ],
  IndianInstrumental: [
    { id: '18', title: 'Mind Relaxing Meditation', url: `${process.env.BASE_URL}/music/Mind_Relaxing_Meditation.mp3` },
    { id: '19', title: 'Indian Traditional', url: `${process.env.BASE_URL}/music/Indian_Traditional.mp3` },
    { id: '20', title: 'Traditional Sitar', url: `${process.env.BASE_URL}/music/Traditional_Sitar.mp3` }
  ],
};

const getSongsByMood = (req, res) => {
  const mood = req.query.mood;
  if (!mood || !songsByMood[mood]) {
    return res.status(200).json({ songs: [] });
  }
  return res.status(200).json({ songs: songsByMood[mood] });
};

// Get user profile for personalized notifications
const getUserProfileForNotifications = async (req, res) => {
  try {
    const docRef = admin.firestore().collection('profiles').doc(req.uid);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    const profileData = doc.data();
    
    // Return only the data needed for notifications
    const notificationData = {
      name: profileData.name,
      quittingReason: profileData.quittingReason || [],
      cravingTimings: profileData.cravingTimings || [],
      cravingTimes: profileData.cravingTimes || {}
    };

    return res.json(notificationData);
  } catch (error) {
    console.error('Error fetching profile for notifications:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {registerUser,
                  loginUser,
                  validateToken,
                  authenticate,
                  createProfile,
                  fetchProfile,
                  saveBreathingSession,
                  getBreathingSessions,
                  getSongsByMood,
                  getUserProfileForNotifications};

