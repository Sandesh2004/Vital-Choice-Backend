// backend/firebaseAdmin.js
const admin = require("firebase-admin");

let serviceAccount;

try {
  // 1. Try to load from the local file (Development)
  serviceAccount = require("./tobacco-rehab-app-firebase-adminsdk-fbsvc-ad65c6450b.json");
} catch (error) {
  // 2. Fallback: Load from Environment Variable (Production on Render)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    // Fix for private keys with escaped newlines
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  } else {
    console.error("❌ Firebase credentials missing! Attach JSON or set FIREBASE_SERVICE_ACCOUNT.");
  }
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();

module.exports = { admin, db };
