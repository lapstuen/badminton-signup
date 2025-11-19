/**
 * Firebase Cloud Function for sending Line notifications
 * When a user cancels their badminton registration
 */

const {onCall, onRequest, HttpsError} = require('firebase-functions/v2/https');
const {defineString} = require('firebase-functions/params');
const axios = require('axios');

// Environment parameters (for v2 Cloud Functions)
const lineToken = defineString('LINE_TOKEN');
const lineGroupId = defineString('LINE_GROUP_ID');

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
exports.sendSessionAnnouncement = onCall(async (request) => {
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
            appUrl
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
            appUrl
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
exports.sendCancellationNotification = onCall(async (request) => {
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
    appUrl
) {
    let message = `🏸 BADMINTON SESSION PUBLISHED! / เซสชันเผยแพร่แล้ว!

📅 ${sessionDay}
🕐 ${sessionTime}

👥 Players: ${currentPlayers}/${maxPlayers}`;

    if (availableSpots > 0) {
        message += `
✅ ${availableSpots} spot${availableSpots > 1 ? 's' : ''} available!
✅ มี ${availableSpots} ที่ว่าง!`;
    } else if (waitingListCount > 0) {
        message += `
⏳ Full - ${waitingListCount} on waiting list
⏳ เต็มแล้ว - ${waitingListCount} คนในรายชื่อสำรอง`;
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
${appUrl}

Reply quickly! / ตอบเร็ว!`;
    }

    return message;
}

/**
 * Send nudge notification to Line group
 * Remind players to register when there are available spots
 */
exports.sendNudgeNotification = onCall(async (request) => {
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

Please register soon to keep costs down! 🙏
กรุณาลงทะเบียนเร็วๆ เพื่อรักษาค่าใช้จ่ายให้ต่ำ!

👉 Sign up here / ลงทะเบียนที่นี่:
${appUrl}`;

    return message;
}

/**
 * Generic Line message sender
 * Send any text message to Line group
 */
exports.sendLineMessage = onCall(async (request) => {
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
exports.sendPasswordResetNotification = onCall(async (request) => {
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
Time / เวลา: ${timestamp}

⚠️ This user has reset their password to default (123)
ผู้ใช้นี้ได้รีเซ็ตรหัสผ่านเป็นค่าเริ่มต้น (123)

If this was not authorized, please contact admin immediately.
หากไม่ได้รับอนุญาต กรุณาติดต่อผู้ดูแลระบบทันที`;

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
exports.testLineConfig = onCall(async (request) => {
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
        const message = `🧪 LINE TEST / ทดสอบ LINE

This is a test message from your Badminton app.
นี่คือข้อความทดสอบจากแอปแบดมินตัน

✅ Line integration is working!
✅ การเชื่อมต่อ Line ใช้งานได้!

Group ID: ${groupId}

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
