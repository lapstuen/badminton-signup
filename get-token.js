#!/usr/bin/env node

const admin = require("firebase-admin");
const fs = require("fs");

const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!saPath) {
  throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set");
}
const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

async function getToken() {
  try {
    const doc = await db.collection('authorizedUsers').doc('KyRo8G7ND4d2zNdDe0E8u5VtEJL2').get();
    
    if (!doc.exists) {
      console.log('❌ User document not found');
      return;
    }
    
    const data = doc.data();
    const token = data.fcmToken;
    
    if (!token) {
      console.log('❌ No fcmToken field in document');
      console.log('Available fields:', Object.keys(data));
      return;
    }
    
    console.log(token);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

getToken();
