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

async function restoreCurrentSession() {
  try {
    // Create new "current" session document
    await db.collection('sessions').doc('current').set({
      date: "26/01/2026",
      day: "Monday",
      startTime: "10:00",
      endTime: "12:00",
      maxPlayers: 12,
      published: true,
      closed: false,
      maintenanceMode: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ "current" session document restored!');
    console.log('📋 Session details:');
    console.log('   Date: 26/01/2026 (Monday)');
    console.log('   Time: 10:00 - 12:00');
    console.log('   Max players: 12');
    console.log('   Published: true');
    console.log('');
    console.log('🎉 You can now use the lineapp admin again!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

restoreCurrentSession();
