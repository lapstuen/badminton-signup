const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../badminton-b95ac-firebase-adminsdk-q4bzt-ea51a2e89b.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function clearCurrentPlayers() {
    console.log('🗑️  Clearing all players from sessions/current/players...\n');

    const snapshot = await db.collection('sessions').doc('current').collection('players').get();

    console.log(`Found ${snapshot.size} players to delete\n`);

    for (const doc of snapshot.docs) {
        const data = doc.data();
        console.log(`  Deleting: ${data.name}`);
        await doc.ref.delete();
    }

    console.log('\n✅ All players deleted from sessions/current/players');
    process.exit(0);
}

clearCurrentPlayers().catch(console.error);
