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

async function listUsers() {
  try {
    const snapshot = await db.collection('authorizedUsers').get();
    
    if (snapshot.empty) {
      console.log('❌ No users found in authorizedUsers collection');
      return;
    }
    
    console.log('📋 Users in authorizedUsers collection:\n');
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`User ID: ${doc.id}`);
      console.log(`  Name: ${data.name || 'N/A'}`);
      console.log(`  Email: ${data.email || 'N/A'}`);
      console.log(`  FCM Token: ${data.fcmToken ? data.fcmToken.substring(0, 30) + '...' : 'NONE'}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listUsers();
