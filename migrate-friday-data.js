// ONE-TIME MIGRATION SCRIPT
// Copy Friday's session (2025-11-06) to "current" session
// Run this in browser console: copy and paste the entire script

async function migrateFridayToCurrent() {
    console.log('🔄 Starting migration from 2025-11-06 to current...');

    try {
        // 1. Get Friday's session data
        const fridaySessionDoc = await db.collection('sessions').doc('2025-11-06').get();

        if (!fridaySessionDoc.exists) {
            console.error('❌ Friday session not found!');
            alert('Error: Friday session (2025-11-06) not found in database.');
            return;
        }

        const fridayData = fridaySessionDoc.data();
        console.log('📥 Friday session data:', fridayData);

        // 2. Get Friday's players
        const fridayPlayersSnapshot = await db.collection('sessions').doc('2025-11-06').collection('players').get();
        const fridayPlayers = [];
        fridayPlayersSnapshot.forEach(doc => {
            fridayPlayers.push({ id: doc.id, ...doc.data() });
        });
        console.log(`📥 Found ${fridayPlayers.length} players from Friday`);

        // 3. Delete current session data
        const currentPlayersSnapshot = await db.collection('sessions').doc('current').collection('players').get();
        const deleteBatch = db.batch();
        currentPlayersSnapshot.forEach(doc => {
            deleteBatch.delete(doc.ref);
        });
        await deleteBatch.commit();
        console.log('🗑️ Deleted current session players');

        // 4. Copy Friday's session data to "current"
        await db.collection('sessions').doc('current').set({
            date: fridayData.date || '06/11/2025',
            day: fridayData.day || 'Friday / วันศุกร์',
            time: fridayData.time || '10:00 - 12:00',
            maxPlayers: fridayData.maxPlayers || 12,
            paymentAmount: fridayData.paymentAmount || 150,
            migratedFrom: '2025-11-06',
            migratedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('💾 Copied session data to current');

        // 5. Copy Friday's players to "current"
        const copyBatch = db.batch();
        for (const player of fridayPlayers) {
            const newPlayerRef = db.collection('sessions').doc('current').collection('players').doc();
            const playerData = {
                name: player.name,
                paid: player.paid || false,
                position: player.position,
                timestamp: player.timestamp || firebase.firestore.FieldValue.serverTimestamp()
            };
            if (player.clickedPaymentLink) {
                playerData.clickedPaymentLink = true;
            }
            copyBatch.set(newPlayerRef, playerData);
        }
        await copyBatch.commit();
        console.log(`✅ Copied ${fridayPlayers.length} players to current session`);

        alert(`✅ Migration successful!\n\nCopied ${fridayPlayers.length} players from Friday (2025-11-06) to current session.\n\nPlease refresh the page.`);

        // Reload page
        setTimeout(() => {
            window.location.reload();
        }, 2000);

    } catch (error) {
        console.error('❌ Migration error:', error);
        alert('Error during migration: ' + error.message);
    }
}

// Run migration
migrateFridayToCurrent();
