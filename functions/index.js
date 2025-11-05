/**
 * Firebase Cloud Function for sending Line notifications
 * When a user cancels their badminton registration
 */

const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {defineString} = require('firebase-functions/params');
const axios = require('axios');

// Define environment parameters
const lineToken = defineString('LINE_TOKEN');
const lineGroupId = defineString('LINE_GROUP_ID');

// Line Messaging API endpoint
const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

/**
 * Send cancellation notification to Line group
 *
 * Triggered via HTTP request from the web app
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
        const { playerName, currentPlayers, maxPlayers, sessionDate, sessionDay, sessionTime, appUrl } = request.data;

        // Build notification message
        const message = buildCancellationMessage(
            playerName,
            currentPlayers,
            maxPlayers,
            sessionDate,
            sessionDay,
            sessionTime,
            appUrl
        );

        console.log('📤 Sending Line notification for:', playerName);

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

        console.log('✅ Line notification sent successfully:', response.data);

        return {
            success: true,
            message: 'Notification sent to Line group'
        };

    } catch (error) {
        console.error('❌ Error sending Line notification:', error.message);

        if (error.response) {
            console.error('Line API error:', error.response.data);
        }

        throw new HttpsError(
            'internal',
            'Failed to send Line notification: ' + error.message
        );
    }
});

/**
 * Build formatted cancellation message
 */
function buildCancellationMessage(playerName, currentPlayers, maxPlayers, sessionDate, sessionDay, sessionTime, appUrl) {
    return `🏸 SLOT AVAILABLE! / มีที่ว่าง!

⚠️ ${playerName} cancelled registration
${playerName} ยกเลิกการลงทะเบียน

👥 Now ${currentPlayers}/${maxPlayers} players
ตอนนี้ ${currentPlayers}/${maxPlayers} คน

📅 ${sessionDay}
🕐 ${sessionTime}
📆 ${sessionDate}

👉 Sign up here / ลงทะเบียนที่นี่:
${appUrl}

Reply quickly! / ตอบเร็ว!`;
}
