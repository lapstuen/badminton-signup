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

async function fixCurrentSession() {
  try {
    // Update "current" session with CORRECT day format
    await db.collection('sessions').doc('current').update({
      day: "วันจันทร์ / Monday"  // Bilingual format som koden forventer
    });

    console.log('✅ "current" session day format fixed!');
    console.log('   Old: "Monday"');
    console.log('   New: "วันจันทร์ / Monday"');
    console.log('');
    console.log('🎉 "Initiate dagens spillere" should now work!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixCurrentSession();
