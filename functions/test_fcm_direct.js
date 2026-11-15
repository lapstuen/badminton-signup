// Test script to verify FCM token and send test notification
const admin = require('firebase-admin');

// Initialize with default credentials
admin.initializeApp({
  projectId: 'badminton-b95ac'
});

const db = admin.firestore();

async function testFCM() {
  try {
    // Get user's FCM token
    const userDoc = await db.collection('authorizedUsers').doc('IOpvSebiXW0B3g7ZT1KD').get();
    
    if (!userDoc.exists) {
      console.log('❌ User not found');
      return;
    }
    
    const userData = userDoc.data();
    const token = userData.fcmToken;
    
    console.log('📱 FCM Token in Firestore:');
    console.log(token);
    console.log('\n📤 Sending test notification...');
    
    // Try to send test notification
    const message = {
      notification: {
        title: '🧪 Test Notification',
        body: 'Testing FCM from script'
      },
      token: token
    };
    
    const response = await admin.messaging().send(message);
    console.log('✅ Successfully sent message:', response);
    
  } catch (error) {
    console.log('❌ Error:', error.code);
    console.log('   Message:', error.message);
    console.log('   Details:', error.errorInfo);
  }
  
  process.exit();
}

testFCM();
