// ONE-TIME SCRIPT: Set Suree as moderator
// Run this in browser console after logging in as admin

async function setSureeAsModerator() {
    console.log('🔄 Setting Suree as moderator...');

    try {
        // Find Suree in authorized users
        const usersSnapshot = await db.collection('authorizedUsers').where('name', '==', 'Suree').get();

        if (usersSnapshot.empty) {
            alert('❌ Error: User "Suree" not found in database.');
            console.error('❌ User "Suree" not found');
            return;
        }

        const sureeDoc = usersSnapshot.docs[0];
        const sureeId = sureeDoc.id;

        // Update role to moderator
        await db.collection('authorizedUsers').doc(sureeId).update({
            role: 'moderator'
        });

        console.log('✅ Suree is now a moderator!');
        alert('✅ Success! Suree is now a moderator.\n\nSuree will see the admin button (👤) and have access to:\n- Manage Wallets\n- View Transactions\n- Refund Waiting List\n- Export List\n\nNo admin password required for Suree.');

        // Refresh page to apply changes
        setTimeout(() => {
            window.location.reload();
        }, 2000);

    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error setting moderator: ' + error.message);
    }
}

// Run the function
setSureeAsModerator();
