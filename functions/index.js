/**
 * Firebase Cloud Function for sending Line notifications
 * When a user cancels their badminton registration
 */

const {onCall, onRequest, HttpsError} = require('firebase-functions/v2/https');
const {onDocumentDeleted} = require('firebase-functions/v2/firestore');
const {defineSecret} = require('firebase-functions/params');
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin SDK
admin.initializeApp();

// Environment secrets (for v2 Cloud Functions)
const lineToken = defineSecret('LINE_TOKEN');
const lineGroupId = defineSecret('LINE_GROUP_ID');

// Line Messaging API endpoint
const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

/**
 * LINE Webhook Endpoint
 * Receives webhook events from LINE Messaging API
 * Logs group IDs when messages are sent in groups
 */
exports.lineWebhook = onRequest(async (req, res) => {
    try {
        console.log('📨 Webhook received:', JSON.stringify(req.body, null, 2));

        // LINE sends events in the body
        const events = req.body.events || [];

        events.forEach(event => {
            console.log('🎯 Event type:', event.type);
            console.log('📍 Source:', JSON.stringify(event.source));

            if (event.source && event.source.type === 'group') {
                const groupId = event.source.groupId;
                console.log('🔍 GROUP ID FOUND:', groupId);
                console.log('👤 User ID:', event.source.userId);

                if (event.type === 'message') {
                    console.log('💬 Message:', event.message.text);
                }
            }
        });

        // Respond to LINE that we received the webhook
        res.status(200).send('OK');

    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(500).send('Error');
    }
});

/**
 * Send session announcement to Line group
 * When admin publishes a new session
 */
exports.sendSessionAnnouncement = onCall({
    secrets: [lineToken, lineGroupId]
}, async (request) => {
    try {
        // Get environment variables
        const accessToken = lineToken.value();
        const groupId = lineGroupId.value();

        if (!accessToken) {
            throw new HttpsError('failed-precondition', 'Line Access Token not configured');
        }

        if (!groupId) {
            throw new HttpsError('failed-precondition', 'Line Group ID not configured');
        }

        // Extract data from request
        const {
            sessionDay,
            sessionDate,
            sessionTime,
            currentPlayers,
            maxPlayers,
            availableSpots,
            waitingListCount,
            paymentAmount,
            appUrl,
            playerNames,
            waitingListNames
        } = request.data;

        // Build notification message
        const message = buildSessionAnnouncementMessage(
            sessionDay,
            sessionDate,
            sessionTime,
            currentPlayers,
            maxPlayers,
            availableSpots,
            waitingListCount,
            paymentAmount,
            appUrl,
            playerNames,
            waitingListNames
        );

        console.log('📤 Sending session announcement to Line');

        // Send message to Line group
        const response = await axios.post(
            LINE_API_URL,
            {
                to: groupId,
                messages: [
                    {
                        type: 'text',
                        text: message
                    }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        console.log('✅ Session announcement sent successfully:', response.data);

        return {
            success: true,
            message: 'Session announcement sent to Line group'
        };

    } catch (error) {
        console.error('❌ Error sending session announcement:', error.message);

        if (error.response) {
            console.error('Line API error:', error.response.data);
        }

        throw new HttpsError(
            'internal',
            'Failed to send session announcement: ' + error.message
        );
    }
});

/**
 * Send cancellation notification to Line group
 * Smart logic: only mention available spot if no waiting list
 */
exports.sendCancellationNotification = onCall({
    secrets: [lineToken, lineGroupId]
}, async (request) => {
    try {
        // Get environment variables
        const accessToken = lineToken.value();
        const groupId = lineGroupId.value();

        if (!accessToken) {
            throw new HttpsError('failed-precondition', 'Line Access Token not configured');
        }

        if (!groupId) {
            throw new HttpsError('failed-precondition', 'Line Group ID not configured');
        }

        // Extract data from request
        const {
            playerName,
            currentPlayers,
            maxPlayers,
            hasWaitingList,
            sessionDate,
            sessionDay,
            sessionTime,
            appUrl
        } = request.data;

        // Build notification message
        const message = buildCancellationMessage(
            playerName,
            currentPlayers,
            maxPlayers,
            hasWaitingList,
            sessionDate,
            sessionDay,
            sessionTime,
            appUrl
        );

        console.log('📤 Sending cancellation notification for:', playerName);

        // Send message to Line group
        const response = await axios.post(
            LINE_API_URL,
            {
                to: groupId,
                messages: [
                    {
                        type: 'text',
                        text: message
                    }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        console.log('✅ Cancellation notification sent successfully:', response.data);

        return {
            success: true,
            message: 'Notification sent to Line group'
        };

    } catch (error) {
        console.error('❌ Error sending cancellation notification:', error.message);

        if (error.response) {
            console.error('Line API error:', error.response.data);
        }

        throw new HttpsError(
            'internal',
            'Failed to send cancellation notification: ' + error.message
        );
    }
});

/**
 * Build formatted session announcement message
 */
function buildSessionAnnouncementMessage(
    sessionDay,
    sessionDate,
    sessionTime,
    currentPlayers,
    maxPlayers,
    availableSpots,
    waitingListCount,
    paymentAmount,
    appUrl,
    playerNames = [],
    waitingListNames = []
) {
    let message = `🏸 BADMINTON SESSION PUBLISHED! / เซสชันเผยแพร่แล้ว!

📅 ${sessionDay}
📆 ${sessionDate}
🕐 ${sessionTime}
💰 ${paymentAmount} THB per player

👥 Players: ${currentPlayers}/${maxPlayers}`;

    // Add registered players list
    if (playerNames && playerNames.length > 0) {
        message += `

📋 Registered / ลงทะเบียนแล้ว:`;
        playerNames.forEach((name, index) => {
            message += `\n${index + 1}. ${name}`;
        });
    }

    // Add waiting list if exists
    if (waitingListNames && waitingListNames.length > 0) {
        message += `

⏳ Waiting List / รายชื่อสำรอง:`;
        waitingListNames.forEach((name, index) => {
            message += `\n${index + 1}. ${name}`;
        });
    }

    // Add availability status
    if (availableSpots > 0) {
        message += `

✅ ${availableSpots} spot${availableSpots > 1 ? 's' : ''} available!
✅ มี ${availableSpots} ที่ว่าง!`;
    } else if (waitingListCount > 0) {
        message += `

⚠️ Session is full! / เต็มแล้ว!`;
    } else {
        message += `

✅ Session is full! / เต็มแล้ว!`;
    }

    message += `

👉 Sign up here / ลงทะเบียนที่นี่:
${appUrl}`;

    return message;
}

/**
 * Build formatted cancellation message
 * Smart logic: only mention available spot if no waiting list
 */
function buildCancellationMessage(
    playerName,
    currentPlayers,
    maxPlayers,
    hasWaitingList,
    sessionDate,
    sessionDay,
    sessionTime,
    appUrl
) {
    let message = `⚠️ ${playerName} cancelled registration
${playerName} ยกเลิกการลงทะเบียน

👥 Now ${currentPlayers}/${maxPlayers} players
ตอนนี้ ${currentPlayers}/${maxPlayers} คน

📅 ${sessionDay}
🕐 ${sessionTime}`;

    // Only mention available spot if there's NO waiting list
    if (!hasWaitingList) {
        message = `🏸 SLOT AVAILABLE! / มีที่ว่าง!\n\n` + message;
        message += `

👉 Sign up here / ลงทะเบียนที่นี่:
${appUrl}`;
    }

    return message;
}

/**
 * Send nudge notification to Line group
 * Remind players to register when there are available spots
 */
exports.sendNudgeNotification = onCall({
    secrets: [lineToken, lineGroupId]
}, async (request) => {
    try {
        // Get environment variables
        const accessToken = lineToken.value();
        const groupId = lineGroupId.value();

        if (!accessToken) {
            throw new HttpsError('failed-precondition', 'Line Access Token not configured');
        }

        if (!groupId) {
            throw new HttpsError('failed-precondition', 'Line Group ID not configured');
        }

        // Extract data from request
        const {
            sessionDay,
            sessionDate,
            sessionTime,
            currentPlayers,
            maxPlayers,
            availableSpots,
            paymentAmount,
            appUrl
        } = request.data;

        // Build nudge message
        const message = buildNudgeMessage(
            sessionDay,
            sessionDate,
            sessionTime,
            currentPlayers,
            maxPlayers,
            availableSpots,
            paymentAmount,
            appUrl
        );

        console.log('📢 Sending nudge notification to Line');

        // Send message to Line group
        const response = await axios.post(
            LINE_API_URL,
            {
                to: groupId,
                messages: [
                    {
                        type: 'text',
                        text: message
                    }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        console.log('✅ Nudge notification sent successfully:', response.data);

        return {
            success: true,
            message: 'Nudge notification sent to Line group'
        };

    } catch (error) {
        console.error('❌ Error sending nudge notification:', error.message);

        if (error.response) {
            console.error('Line API error:', error.response.data);
        }

        throw new HttpsError(
            'internal',
            'Failed to send nudge notification: ' + error.message
        );
    }
});

/**
 * Build formatted nudge message
 */
function buildNudgeMessage(
    sessionDay,
    sessionDate,
    sessionTime,
    currentPlayers,
    maxPlayers,
    availableSpots,
    paymentAmount,
    appUrl
) {
    let message = `📢 REMINDER / เตือนความจำ

🏸 We have ${availableSpots} available spot${availableSpots > 1 ? 's' : ''} for ${sessionDay}!
เรามี ${availableSpots} ที่ว่างสำหรับ${sessionDay}!

📅 ${sessionDay}
🕐 ${sessionTime}
💰 ${paymentAmount} THB

👥 Currently: ${currentPlayers}/${maxPlayers} players
ปัจจุบัน: ${currentPlayers}/${maxPlayers} คน

👉 Sign up here / ลงทะเบียนที่นี่:
${appUrl}`;

    return message;
}

/**
 * Generic Line message sender
 * Send any text message to Line group
 */
exports.sendLineMessage = onCall({
    secrets: [lineToken, lineGroupId]
}, async (request) => {
    try {
        // Get environment variables
        const accessToken = lineToken.value();
        const groupId = lineGroupId.value();

        if (!accessToken) {
            throw new HttpsError('failed-precondition', 'Line Access Token not configured');
        }

        if (!groupId) {
            throw new HttpsError('failed-precondition', 'Line Group ID not configured');
        }

        // Extract message from request
        const { message } = request.data;

        if (!message) {
            throw new HttpsError('invalid-argument', 'Message is required');
        }

        console.log('📤 Sending generic message to Line');

        // Send message to Line group
        const response = await axios.post(
            LINE_API_URL,
            {
                to: groupId,
                messages: [
                    {
                        type: 'text',
                        text: message
                    }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        console.log('✅ Message sent successfully:', response.data);

        return {
            success: true,
            message: 'Message sent to Line group'
        };

    } catch (error) {
        console.error('❌ Error sending Line message:', error.message);

        if (error.response) {
            console.error('Line API error:', error.response.data);
        }

        throw new HttpsError(
            'internal',
            'Failed to send Line message: ' + error.message
        );
    }
});

/**
 * Send password reset notification to Line group
 * Notifies admins when a user resets their password
 */
exports.sendPasswordResetNotification = onCall({
    secrets: [lineToken, lineGroupId]
}, async (request) => {
    try {
        // Get environment variables
        const accessToken = lineToken.value();
        const groupId = lineGroupId.value();

        if (!accessToken) {
            throw new HttpsError('failed-precondition', 'Line Access Token not configured');
        }

        if (!groupId) {
            throw new HttpsError('failed-precondition', 'Line Group ID not configured');
        }

        // Extract data from request
        const { userName, timestamp } = request.data;

        if (!userName || !timestamp) {
            throw new HttpsError('invalid-argument', 'userName and timestamp are required');
        }

        console.log(`🔐 Sending password reset notification for: ${userName}`);

        // Build notification message
        const message = `🔐 PASSWORD RESET / รีเซ็ตรหัสผ่าน

User / ผู้ใช้: ${userName}
Time / เวลา: ${timestamp}`;

        // Send message to Line group
        const response = await axios.post(
            LINE_API_URL,
            {
                to: groupId,
                messages: [
                    {
                        type: 'text',
                        text: message
                    }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        console.log('✅ Password reset notification sent successfully:', response.data);

        return {
            success: true,
            message: 'Password reset notification sent to Line group'
        };

    } catch (error) {
        console.error('❌ Error sending password reset notification:', error.message);

        if (error.response) {
            console.error('Line API error:', error.response.data);
        }

        throw new HttpsError(
            'internal',
            'Failed to send password reset notification: ' + error.message
        );
    }
});

/**
 * Test Line configuration - Send test message and log Group ID
 * Use this to verify Line is working and see which group is configured
 */
exports.testLineConfig = onCall({
    secrets: [lineToken, lineGroupId]
}, async (request) => {
    try {
        // Get environment variables
        const accessToken = lineToken.value();
        const groupId = lineGroupId.value();

        console.log('🧪 Testing Line configuration...');
        console.log('📋 Group ID:', groupId);
        console.log('🔑 Token exists:', !!accessToken);

        if (!accessToken) {
            throw new HttpsError('failed-precondition', 'Line Access Token not configured');
        }

        if (!groupId) {
            throw new HttpsError('failed-precondition', 'Line Group ID not configured');
        }

        // Build test message
        const message = `🧪 LINE TEST PRODUKSJON / ทดสอบ LINE โปรดักชัน

This is a test message from your Badminton app.
นี่คือข้อความทดสอบจากแอปแบดมินตัน

✅ Line integration is working!
✅ การเชื่อมต่อ Line ใช้งานได้!

Group ID: ${groupId}

Version: 2025-11-19 14:15 TESTGRUPPE
Hvis denne går til produksjon er det feil!

You can ignore this message.
คุณสามารถเพิกเฉยข้อความนี้ได้`;

        console.log('📤 Sending test message to group:', groupId);

        // Send message to Line group
        const response = await axios.post(
            LINE_API_URL,
            {
                to: groupId,
                messages: [
                    {
                        type: 'text',
                        text: message
                    }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        console.log('✅ Test message sent successfully!');
        console.log('Response:', response.data);

        return {
            success: true,
            message: 'Test message sent successfully',
            groupId: groupId
        };

    } catch (error) {
        console.error('❌ Error testing Line config:', error.message);

        if (error.response) {
            console.error('Line API error:', error.response.data);
        }

        throw new HttpsError(
            'internal',
            'Failed to send test message: ' + error.message
        );
    }
});

/**
 * Send weekly report to Line group
 * Shows income, expenses, profit, balance, and recommended price for next week
 */
exports.sendWeeklyReport = onCall({
    secrets: [lineToken, lineGroupId]
}, async (request) => {
    try {
        // Get environment variables
        const accessToken = lineToken.value();
        const groupId = lineGroupId.value();

        if (!accessToken) {
            throw new HttpsError('failed-precondition', 'Line Access Token not configured');
        }

        if (!groupId) {
            throw new HttpsError('failed-precondition', 'Line Group ID not configured');
        }

        // Extract data from request
        const {
            weekId,
            startDate,
            endDate,
            sessionCount,
            totalPlayers,
            totalIncome,
            totalExpenses,
            courtCost,
            shuttlecockCost,
            grossProfit,
            newBalance,
            recommendedPrice,
            basePrice,
            priceAdjustmentPerPlayer
        } = request.data;

        // Build report message
        const message = buildWeeklyReportMessage(
            weekId,
            startDate,
            endDate,
            sessionCount,
            totalPlayers,
            totalIncome,
            totalExpenses,
            courtCost,
            shuttlecockCost,
            grossProfit,
            newBalance,
            recommendedPrice,
            basePrice,
            priceAdjustmentPerPlayer
        );

        console.log('📊 Sending weekly report to Line');

        // Send message to Line group
        const response = await axios.post(
            LINE_API_URL,
            {
                to: groupId,
                messages: [
                    {
                        type: 'text',
                        text: message
                    }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        console.log('✅ Weekly report sent successfully:', response.data);

        return {
            success: true,
            message: 'Weekly report sent to Line group'
        };

    } catch (error) {
        console.error('❌ Error sending weekly report:', error.message);

        if (error.response) {
            console.error('Line API error:', error.response.data);
        }

        throw new HttpsError(
            'internal',
            'Failed to send weekly report: ' + error.message
        );
    }
});

/**
 * Build formatted weekly report message
 */
function buildWeeklyReportMessage(
    weekId,
    startDate,
    endDate,
    sessionCount,
    totalPlayers,
    totalIncome,
    totalExpenses,
    courtCost,
    shuttlecockCost,
    grossProfit,
    newBalance,
    recommendedPrice,
    basePrice,
    priceAdjustmentPerPlayer
) {
    const profitSign = grossProfit >= 0 ? '+' : '';
    const balanceSign = newBalance >= 0 ? '+' : '';
    const adjustmentSign = priceAdjustmentPerPlayer >= 0 ? '-' : '+';

    const message = `📊 WEEKLY REPORT / รายงานประจำสัปดาห์

📅 Week ${weekId}
📆 ${startDate} to ${endDate}

🏸 SESSIONS / เซสชัน
• Sessions: ${sessionCount}
• Total players: ${totalPlayers}

💰 INCOME / รายได้
• Total: ${totalIncome} THB

💸 EXPENSES / ค่าใช้จ่าย
• Courts: ${courtCost} THB
• Shuttlecocks: ${shuttlecockCost} THB
• Total: ${totalExpenses} THB

📈 PROFIT / กำไร
• Gross profit: ${profitSign}${grossProfit} THB
• Running balance: ${balanceSign}${newBalance} THB

💵 NEXT WEEK PRICE / ราคาสัปดาห์หน้า
• Base price: ${basePrice} THB
• Balance adjustment: ${adjustmentSign}${Math.abs(priceAdjustmentPerPlayer)} THB
• Recommended price: ${recommendedPrice} THB

(Balance distributed over 4 weeks / กระจายยอดคงเหลือ 4 สัปดาห์)`;

    return message;
}

/**
 * FIRESTORE TRIGGER: Automatic cancellation notification
 * Sends FCM push notification to admins when a player cancels
 * Also attempts Line notification (may fail on free plan)
 */
exports.onPlayerDeleted = onDocumentDeleted({
    document: 'sessions/{sessionId}/players/{playerId}',
    secrets: [lineToken, lineGroupId]
}, async (event) => {
    try {
        const deletedData = event.data.data();
        const sessionId = event.params.sessionId;

        // Skip if no data (shouldn't happen, but safety check)
        if (!deletedData) {
            console.log('⚠️ No deleted data found, skipping notification');
            return null;
        }

        const playerName = deletedData.name;
        console.log(`🗑️ Player deleted: ${playerName} from session ${sessionId}`);

        // Skip notification for guests (they have guestOf field)
        if (deletedData.guestOf) {
            console.log(`👤 Skipping notification for guest: ${playerName}`);
            return null;
        }

        // Get session data
        const db = admin.firestore();
        const sessionDoc = await db.collection('sessions').doc(sessionId).get();

        if (!sessionDoc.exists) {
            console.log(`⚠️ Session ${sessionId} not found, skipping notification`);
            return null;
        }

        const sessionData = sessionDoc.data();

        // Skip if session is not published (draft mode)
        if (!sessionData.published) {
            console.log('⚠️ Session not published, skipping notification');
            return null;
        }

        // Skip if session is closed/archived
        if (sessionData.closed) {
            console.log('⚠️ Session is closed/archived, skipping notification');
            return null;
        }

        // Count remaining players
        const playersSnapshot = await db.collection('sessions').doc(sessionId)
            .collection('players').get();
        const currentPlayers = playersSnapshot.size;
        const maxPlayers = sessionData.maxPlayers || 12;

        // Check if there's a waiting list
        const hasWaitingList = currentPlayers >= maxPlayers;

        // Build notification message
        const title = hasWaitingList
            ? `${playerName} cancelled`
            : `🏸 SLOT AVAILABLE!`;
        const body = hasWaitingList
            ? `Now ${currentPlayers}/${maxPlayers} players`
            : `${playerName} cancelled. Now ${currentPlayers}/${maxPlayers} players`;

        // ==========================================
        // SEND FCM PUSH NOTIFICATIONS TO ADMINS
        // ==========================================
        try {
            // Get all admin users with FCM tokens
            const adminsSnapshot = await db.collection('authorizedUsers')
                .where('role', '==', 'admin')
                .get();

            const tokens = [];
            adminsSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.fcmToken) {
                    tokens.push(data.fcmToken);
                }
            });

            if (tokens.length > 0) {
                console.log(`📱 Sending FCM to ${tokens.length} admin(s)`);

                // Send to all admin tokens
                const fcmMessage = {
                    notification: {
                        title: title,
                        body: body
                    },
                    data: {
                        playerName: playerName,
                        sessionId: sessionId,
                        currentPlayers: String(currentPlayers),
                        maxPlayers: String(maxPlayers),
                        click_action: 'https://lapstuen.github.io/badminton-signup/'
                    },
                    tokens: tokens
                };

                const fcmResponse = await admin.messaging().sendEachForMulticast(fcmMessage);
                console.log(`✅ FCM sent: ${fcmResponse.successCount} success, ${fcmResponse.failureCount} failed`);

                // Log any failures
                if (fcmResponse.failureCount > 0) {
                    fcmResponse.responses.forEach((resp, idx) => {
                        if (!resp.success) {
                            console.log(`❌ FCM failed for token ${idx}:`, resp.error?.message);
                        }
                    });
                }
            } else {
                console.log('📱 No admin FCM tokens found');
            }
        } catch (fcmError) {
            console.error('❌ FCM error:', fcmError.message);
        }

        // ==========================================
        // ALSO TRY LINE (may fail on free plan)
        // ==========================================
        try {
            const accessToken = lineToken.value();
            const groupId = lineGroupId.value();

            if (accessToken && groupId) {
                const lineMessage = buildCancellationMessage(
                    playerName,
                    currentPlayers,
                    maxPlayers,
                    hasWaitingList,
                    sessionData.date || sessionId,
                    sessionData.day || 'Unknown',
                    sessionData.time || 'Unknown',
                    'https://lapstuen.github.io/badminton-signup/'
                );

                console.log('📤 Attempting Line notification...');

                const response = await axios.post(
                    LINE_API_URL,
                    {
                        to: groupId,
                        messages: [{ type: 'text', text: lineMessage }]
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`
                        }
                    }
                );

                console.log('✅ Line notification sent:', response.data);
            }
        } catch (lineError) {
            // Line may fail on free plan - this is expected
            console.log('⚠️ Line notification failed (expected on free plan):', lineError.message);
        }

        return { success: true, playerName: playerName };

    } catch (error) {
        console.error('❌ Error in onPlayerDeleted trigger:', error.message);
        return null;
    }
});

/**
 * Callable function to send test FCM notification
 * For testing push notifications are working
 */
exports.testFCMNotification = onCall({}, async (request) => {
    try {
        const { fcmToken } = request.data;

        if (!fcmToken) {
            throw new HttpsError('invalid-argument', 'FCM token is required');
        }

        console.log('🧪 Sending test FCM notification');

        const message = {
            notification: {
                title: '🧪 Test Notification',
                body: 'FCM is working! Du vil motta varsler når noen melder seg av.'
            },
            token: fcmToken
        };

        const response = await admin.messaging().send(message);
        console.log('✅ Test FCM sent:', response);

        return { success: true, messageId: response };
    } catch (error) {
        console.error('❌ Test FCM error:', error.message);
        throw new HttpsError('internal', 'Failed to send test notification: ' + error.message);
    }
});
