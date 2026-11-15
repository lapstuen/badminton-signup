#!/usr/bin/env node

/**
 * LOCAL FCM TEST SCRIPT
 *
 * Tests FCM sending directly from local machine (not Cloud Functions)
 * to isolate if the problem is in Cloud Functions environment or Firebase/APNs config.
 */

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

admin.credential.cert(serviceAccount).getAccessToken()
  .then(t => console.log("AdminSDK access token starts with:", (t.access_token || "").slice(0, 20)))
  .catch(e => console.error("AdminSDK token error:", e));

// FCM token from latest app install (2026-01-25)
const FCM_TOKEN = 'chH5A4EWqUvhsA015cYj26:APA91bGwvA_n8fQYavt1ZI_DeorhxM3yQZKl-RO-bA26XOw8u9jNaKDy07nMR_lFFtHz7A66oOIPezlmdBYh7cmKy6CVfs-Ex69iFwc-r5uxX7X62fVW4vk';

// Build FCM message (same structure as Cloud Functions)
const message = {
    notification: {
        title: '🧪 LOCAL TEST',
        body: 'Sendt direkte fra Mac (ikke Cloud Functions)'
    },
    data: {
        test: 'true',
        source: 'local-script',
        timestamp: new Date().toISOString()
    },
    apns: {
        payload: {
            aps: {
                alert: {
                    title: '🧪 LOCAL TEST',
                    body: 'Sendt direkte fra Mac (ikke Cloud Functions)'
                },
                sound: 'default',
                badge: 1
            }
        }
    },
    token: FCM_TOKEN
};

console.log('🧪 LOKAL FCM TEST');
console.log('═'.repeat(60));
console.log('📱 Target token:', FCM_TOKEN.substring(0, 30) + '...');
console.log('📦 Message payload:');
console.log(JSON.stringify(message, null, 2));
console.log('═'.repeat(60));
console.log('\n📤 Sending FCM message...\n');

// Send FCM message
admin.messaging().send(message)
    .then(response => {
        console.log('✅ SUCCESS!');
        console.log('═'.repeat(60));
        console.log('Message ID:', response);
        console.log('═'.repeat(60));
        console.log('\n🎉 KONKLUSJON: Problemet ER i Cloud Functions environment!');
        console.log('   - FCM fungerer når sendt lokalt');
        console.log('   - Problemet er IAM permissions eller service account config');
        console.log('   - Sjekk Cloud Functions service account permissions\n');
        process.exit(0);
    })
    .catch(error => {
        console.error("❌ FAILED!");
        console.error("code:", error.code);
        console.error("message:", error.message);
        console.error("stack:", error.stack);
        console.error("raw:", error);
        try {
            console.error("toJSON:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        } catch (e) {
            console.error("toJSON failed:", e);
        }
        process.exit(1);
    });
