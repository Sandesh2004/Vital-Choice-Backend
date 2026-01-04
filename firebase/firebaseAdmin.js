// backend/firebaseAdmin.js
const admin = require("firebase-admin");
const serviceAccount = require("./tobacco-rehab-app-firebase-adminsdk-fbsvc-ad65c6450b.json"); // Download this from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore(); // If using Firestore

module.exports = { admin, db };