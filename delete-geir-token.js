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

async function deleteToken() {
  try {
    await db.collection('authorizedUsers').doc('IOpvSebiXW0B3g7ZT1KD').update({
      fcmToken: admin.firestore.FieldValue.delete()
    });
    console.log('✅ FCM token deleted for Geir');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

deleteToken();
