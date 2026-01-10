const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./badminton-b95ac-firebase-adminsdk-q4bzt-ea51a2e89b.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function debugWeeklyBalance() {
    console.log('🔍 Checking weeklyBalance collection...\n');

    const snapshot = await db.collection('weeklyBalance').get();

    console.log(`Found ${snapshot.size} documents\n`);

    snapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`Document ID: ${doc.id}`);
        console.log(`  balanceBefore: ${data.balanceBefore}`);
        console.log(`  balanceAfter: ${data.balanceAfter}`);
        console.log(`  startDate: ${data.startDate}`);
        console.log(`  endDate: ${data.endDate}`);
        console.log('---');
    });

    process.exit(0);
}

debugWeeklyBalance().catch(console.error);
