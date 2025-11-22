// ============================================
// BADMINTON APP - FIREBASE VERSION
// ============================================

// App URL - Production URL for sharing in Line messages
const APP_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'https://lapstuen.github.io/badminton-signup/';

// Current session ID - FIXED to "current" (does not auto-change daily)
// Admin must manually start "New Session" to create a new session
let currentSessionId = 'current';

// App state (synced with Firebase)
let state = {
    isSessionLoaded: false, // CRITICAL: Prevents saving before Firebase data is loaded
    players: [],
    maxPlayers: 12,
    sessionDate: new Date().toLocaleDateString('en-GB'),
    sessionDay: 'Not Set / ไม่ได้กำหนด', // Default to day 8 (blank)
    sessionTime: '10:00 - 12:00', // Default time (most common)
    paymentAmount: 150,
    published: true, // Session visibility (false = draft mode)
    maintenanceMode: false, // Maintenance mode (blocks all user actions)
    shuttlecocksUsed: 0, // Number of shuttlecocks used in session (for cost tracking)
    closed: false, // Session archived/closed status
    isAdmin: false,
    authorizedUsers: [],
    loggedInUser: null, // Now includes: { name, balance, userId, role }
    transactions: []
};

// Firestore references
const currentSessionRef = () => sessionsRef.doc(currentSessionId);
const playersRef = () => currentSessionRef().collection('players');

// ============================================
// PRIVATE MODE DETECTION
// ============================================

/**
 * Check if browser is in private/incognito mode
 * Private mode does not support localStorage persistently
 */
function isPrivateMode() {
    try {
        // Test if localStorage is available and writable
        const test = '__privatemode_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return false; // localStorage works = not private mode
    } catch (e) {
        return true; // localStorage blocked = private mode
    }
}

/**
 * Show warning banner if browser is in private mode
 */
function checkPrivateMode() {
    if (isPrivateMode()) {
        console.warn('⚠️ Private browsing mode detected!');

        // Create warning banner
        const banner = document.createElement('div');
        banner.id = 'privateModeWarning';
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #dc2626;
            color: white;
            padding: 12px 20px;
            text-align: center;
            z-index: 10000;
            font-weight: bold;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        banner.innerHTML = `
            ⚠️ <strong>PRIVATE BROWSING MODE / โหมดเปิดเว็บแบบส่วนตัว</strong><br>
            <span style="font-size: 12px; font-weight: normal;">
                Auto-login will not work. Please use normal browser tab.<br>
                การเข้าสู่ระบบอัตโนมัติจะไม่ทำงาน กรุณาใช้แท็บเบราว์เซอร์ปกติ
            </span>
        `;

        // Insert at top of body
        document.body.insertBefore(banner, document.body.firstChild);

        // Add padding to content so it doesn't hide under banner
        const container = document.querySelector('.container');
        if (container) {
            container.style.paddingTop = '80px';
        }

        // Force logout if user was logged in (localStorage won't persist anyway)
        localStorage.removeItem('loggedInUser');
        state.loggedInUser = null;
    }
}

// ============================================
// INITIALIZE APP
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 App starting...');
    checkPrivateMode();
    initializeApp();
});

// Refresh balance when user returns to the app (e.g., after paying via admin)
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && state.loggedInUser) {
        console.log('👁️ User returned to app, refreshing balance...');
        await checkLoggedInUser();
        updateUI();
    }
});

// Manual refresh balance function
async function refreshBalance() {
    if (!state.loggedInUser) return;

    console.log('🔄 Manually refreshing balance...');
    const btn = document.querySelector('.refresh-balance-btn');

    // Add spinning animation
    if (btn) btn.style.transform = 'rotate(360deg)';

    await checkLoggedInUser();
    updateUI();

    // Reset button after animation
    setTimeout(() => {
        if (btn) btn.style.transform = '';
    }, 300);
}

async function initializeApp() {
    try {
        // Load session data
        await loadSessionData();

        // Load authorized users
        await loadAuthorizedUsers();

        // Set up realtime listeners
        setupRealtimeListeners();

        // Check if user is logged in
        await checkLoggedInUser();

        // Setup event listeners
        setupEventListeners();

        // Update UI (this will also show success message if user is registered)
        updateUI();

        // Generate share link
        generateShareLink();

        console.log('✅ App initialized successfully!');
    } catch (error) {
        console.error('❌ Error initializing app:', error);
        alert('Error loading app. Please refresh the page.');
    }
}

// ============================================
// FIRESTORE OPERATIONS
// ============================================

// Load session data from Firestore
async function loadSessionData() {
    try {
        const doc = await currentSessionRef().get();

        if (doc.exists) {
            const data = doc.data();
            state.maxPlayers = data.maxPlayers !== undefined ? data.maxPlayers : 12;
            state.sessionDate = data.date || state.sessionDate;
            state.sessionDay = data.day || state.sessionDay;
            state.sessionTime = data.time || state.sessionTime;
            state.paymentAmount = data.paymentAmount !== undefined ? data.paymentAmount : 150;
            state.published = data.published !== undefined ? data.published : true; // Default true for old sessions
            state.maintenanceMode = data.maintenanceMode !== undefined ? data.maintenanceMode : false; // Default false
            state.shuttlecocksUsed = data.shuttlecocksUsed !== undefined ? data.shuttlecocksUsed : 0; // Default 0 for old sessions
            state.closed = data.closed !== undefined ? data.closed : false; // Default false - session not archived
            console.log('📥 Session data loaded from Firestore:', {
                day: state.sessionDay,
                time: state.sessionTime,
                published: state.published,
                maintenanceMode: state.maintenanceMode,
                shuttlecocksUsed: state.shuttlecocksUsed,
                closed: state.closed
            });
        } else {
            // Create new session
            await currentSessionRef().set({
                date: state.sessionDate,
                day: state.sessionDay,
                time: state.sessionTime,
                maxPlayers: state.maxPlayers,
                paymentAmount: state.paymentAmount,
                published: true,
                maintenanceMode: false,
                shuttlecocksUsed: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('📝 New session created');
        }

        // CRITICAL: Mark session as loaded to allow saving
        state.isSessionLoaded = true;
        console.log('✅ Session data loaded - saving is now allowed');
    } catch (error) {
        console.error('Error loading session:', error);
    }
}

// Save session data to Firestore
async function saveSessionData() {
    // CRITICAL SAFETY CHECK: Prevent saving before Firebase data is loaded
    if (!state.isSessionLoaded) {
        console.error('🚨 BLOCKED: Attempted to save session before Firebase data loaded!');
        console.error('   This prevents hardcoded defaults from overwriting real data.');
        console.error('   Current state:', {
            day: state.sessionDay,
            time: state.sessionTime,
            published: state.published
        });
        return; // STOP - do not save
    }

    try {
        const updateData = {
            date: state.sessionDate,
            day: state.sessionDay,
            time: state.sessionTime,
            maxPlayers: state.maxPlayers,
            paymentAmount: state.paymentAmount,
            published: state.published,
            maintenanceMode: state.maintenanceMode,
            shuttlecocksUsed: state.shuttlecocksUsed
        };

        // Include closed status if defined in state
        if (typeof state.closed !== 'undefined') {
            updateData.closed = state.closed;
        }

        await currentSessionRef().update(updateData);
        console.log('💾 Session data saved:', {
            day: state.sessionDay,
            time: state.sessionTime,
            published: state.published,
            maintenanceMode: state.maintenanceMode,
            shuttlecocksUsed: state.shuttlecocksUsed
        });
    } catch (error) {
        console.error('Error saving session:', error);
    }
}

// Load authorized users from Firestore
async function loadAuthorizedUsers() {
    try {
        const snapshot = await usersRef.get();
        state.authorizedUsers = [];
        snapshot.forEach(doc => {
            state.authorizedUsers.push({
                id: doc.id,
                ...doc.data()
            });
        });
        console.log(`📥 Loaded ${state.authorizedUsers.length} authorized users`);
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Create transaction record
async function createTransaction(userId, userName, amount, description) {
    // Skip transaction logging if amount is 0
    if (amount === 0) {
        console.log(`⏭️ Skipped transaction (0 THB): ${userName} - ${description}`);
        return;
    }

    try {
        await transactionsRef.add({
            userId: userId,
            userName: userName,
            amount: amount, // Positive for deposits, negative for withdrawals
            description: description,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            sessionId: currentSessionId,
            sessionDate: state.sessionDate
        });
        console.log(`💰 Transaction created: ${userName} ${amount > 0 ? '+' : ''}${amount} THB (${description})`);
    } catch (error) {
        console.error('Error creating transaction:', error);
    }
}

// Update user balance
async function updateUserBalance(userId, userName, amountChange, description, silent = false) {
    try {
        const userDoc = await usersRef.doc(userId).get();
        if (!userDoc.exists) {
            console.error('User not found');
            return false;
        }

        const currentBalance = userDoc.data().balance || 0;
        const newBalance = currentBalance + amountChange;

        // Don't allow negative balance
        if (newBalance < 0) {
            if (!silent) {
                alert(`Insufficient balance / ยอดเงินไม่เพียงพอ\n\nCurrent: ${currentBalance} THB\nNeeded: ${Math.abs(amountChange)} THB`);
            }
            console.log(`⚠️ Insufficient balance for ${userName}: ${currentBalance} THB (need ${Math.abs(amountChange)} THB)`);
            return false;
        }

        // Update balance in Firestore
        await usersRef.doc(userId).update({
            balance: newBalance
        });

        // Create transaction record
        await createTransaction(userId, userName, amountChange, description);

        // Update local state if this is the logged in user
        if (state.loggedInUser && state.loggedInUser.userId === userId) {
            state.loggedInUser.balance = newBalance;
            updateUI();
        }

        console.log(`✅ Balance updated: ${userName} = ${newBalance} THB`);
        return true;
    } catch (error) {
        console.error('Error updating balance:', error);
        return false;
    }
}

// ============================================
// REALTIME LISTENERS
// ============================================

function setupRealtimeListeners() {
    // Listen to SESSION changes (day, time, maxPlayers, etc.)
    currentSessionRef().onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            const oldDay = state.sessionDay;

            state.maxPlayers = data.maxPlayers !== undefined ? data.maxPlayers : 12;
            state.sessionDate = data.date || state.sessionDate;
            state.sessionDay = data.day || state.sessionDay;
            state.sessionTime = data.time || state.sessionTime;
            state.paymentAmount = data.paymentAmount !== undefined ? data.paymentAmount : 150;
            state.published = data.published !== undefined ? data.published : true;
            state.maintenanceMode = data.maintenanceMode !== undefined ? data.maintenanceMode : false;

            // Log if session day changed (to detect unauthorized changes)
            if (oldDay && oldDay !== state.sessionDay) {
                console.warn(`⚠️ SESSION DAY CHANGED: ${oldDay} → ${state.sessionDay}`);
            }

            console.log(`📅 Session updated: ${state.sessionDay} at ${state.sessionTime} (maintenance: ${state.maintenanceMode})`);
            updateUI();
        }
    }, (error) => {
        console.error('Error listening to session:', error);
    });

    // Listen to players changes
    playersRef().onSnapshot((snapshot) => {
        state.players = [];
        snapshot.forEach(doc => {
            state.players.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Sort by position
        state.players.sort((a, b) => a.position - b.position);

        console.log(`👥 Players updated: ${state.players.length} players`);
        updateUI();
    }, (error) => {
        console.error('Error listening to players:', error);
    });

    // Listen to authorized users changes
    usersRef.onSnapshot((snapshot) => {
        state.authorizedUsers = [];
        snapshot.forEach(doc => {
            state.authorizedUsers.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`👤 Users updated: ${state.authorizedUsers.length} users`);
        if (state.isAdmin) {
            updateAuthorizedUsersList();
        }
    }, (error) => {
        console.error('Error listening to users:', error);
    });
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    document.getElementById('signupForm').addEventListener('submit', handleSignup);

    // Listen to name input to switch between login and reset password
    const loginNameInput = document.getElementById('loginName');
    loginNameInput.addEventListener('input', checkLoginMethod);
    loginNameInput.addEventListener('blur', checkLoginMethod);
}

/**
 * Check if user should see Login button or Reset Password button
 * Based on password length in database (UUID = long, 123 = short)
 */
async function checkLoginMethod() {
    const name = document.getElementById('loginName').value.trim();

    if (!name) {
        // No name entered - show normal login
        showNormalLogin();
        return;
    }

    // Find user in authorized users (EXACT match only, no partial matches)
    // E.g., "Gei" will NOT match "Geir"
    const user = state.authorizedUsers.find(u => u.name === name);

    if (!user) {
        // User not found - show normal login
        showNormalLogin();
        return;
    }

    // Check password length
    if (user.password.length >= 20) {
        // UUID password - show reset button
        showResetPassword();
    } else {
        // Short password (123 etc.) - show normal login
        showNormalLogin();
    }
}

function showNormalLogin() {
    document.getElementById('normalLoginSection').style.display = 'block';
    document.getElementById('resetPasswordSection').style.display = 'none';
}

function showResetPassword() {
    document.getElementById('normalLoginSection').style.display = 'none';
    document.getElementById('resetPasswordSection').style.display = 'block';
}

/**
 * Handle login button click
 * Separated from form submit to allow manual triggering
 */
async function handleLoginClick() {
    const name = document.getElementById('loginName').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!name || !password) {
        alert('Please enter name and password / กรุณาใส่ชื่อและรหัสผ่าน');
        return;
    }

    await handleLogin({ preventDefault: () => {} }, name, password);
}

// ============================================
// USER REGISTRATION
// ============================================

async function handleSignup(e) {
    e.preventDefault();

    // Check maintenance mode
    if (state.maintenanceMode && !state.isAdmin) {
        alert('System is under maintenance. Please wait.\nระบบกำลังปรับปรุง กรุณารอสักครู่');
        return;
    }

    // Use logged-in user's name if available, otherwise get from form
    let name;
    if (state.loggedInUser) {
        name = state.loggedInUser.name;
    } else {
        name = document.getElementById('playerName').value.trim();
        if (!name) {
            alert('Please enter your name / กรุณากรอกชื่อ');
            return;
        }
    }

    // Check if user is authorized
    const authorizedUser = state.authorizedUsers.find(u => u.name === name);
    if (!authorizedUser) {
        alert('You are not authorized. Contact admin. / คุณไม่มีสิทธิ์ ติดต่อผู้ดูแล');
        return;
    }

    // Check if already registered (by name)
    if (state.players.find(p => p.name === name)) {
        alert('This name is already registered / ชื่อนี้ลงทะเบียนแล้ว');
        return;
    }

    // Check balance and deduct payment IMMEDIATELY (for all players, including waiting list)
    const currentBalance = authorizedUser.balance || 0;
    if (currentBalance < state.paymentAmount) {
        alert(`Insufficient balance / ยอดเงินไม่เพียงพอ\n\nCurrent: ${currentBalance} THB\nNeeded: ${state.paymentAmount} THB`);
        return;
    }

    try {
        // Deduct payment BEFORE adding to Firestore
        const isWaitingList = state.players.length >= state.maxPlayers;
        const paymentSuccess = await updateUserBalance(
            authorizedUser.id,
            name,
            -state.paymentAmount, // Negative = deduct
            isWaitingList
                ? `Payment for joining waiting list ${state.sessionDate}`
                : `Payment for session ${state.sessionDate}`
        );

        if (!paymentSuccess) {
            // updateUserBalance already showed error message
            return;
        }

        // Add player to Firestore
        const playerData = {
            name,
            userId: authorizedUser.id,
            paid: true,  // Already paid at registration
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            position: state.players.length + 1
        };

        await playersRef().add(playerData);

        // Save name for future visits
        localStorage.setItem('userName', name);

        // Auto-login (user is already verified as authorized)
        state.loggedInUser = {
            name: authorizedUser.name,
            balance: authorizedUser.balance || 0,
            userId: authorizedUser.id
        };

        // Refresh balance from server after deduction
        const userDoc = await usersRef.doc(authorizedUser.id).get();
        if (userDoc.exists) {
            state.loggedInUser.balance = userDoc.data().balance || 0;
        }

        localStorage.setItem('loggedInUser', JSON.stringify(state.loggedInUser));

        // Show success message
        const player = { name, position: playerData.position };
        showSuccessMessage(player);

        // Reset form
        document.getElementById('signupForm').reset();

        console.log('✅ Player registered:', name);
    } catch (error) {
        console.error('Error registering player:', error);

        // IMPORTANT: Refund payment since Firestore add failed
        await updateUserBalance(
            authorizedUser.id,
            name,
            state.paymentAmount, // Positive = refund
            `Refund for failed registration ${state.sessionDate}`
        );

        alert('Error registering. Payment refunded. Please try again.\n\nเกิดข้อผิดพลาด คืนเงินแล้ว กรุณาลองใหม่อีกครั้ง');
    }
}

// ============================================
// GUEST REGISTRATION
// ============================================

/**
 * Register a guest player (friend/family member)
 * - Guest takes one player slot
 * - Payment deducted from host's wallet
 * - Guest name format: "HostName friend: GuestName"
 * - Displayed as: "GuestName 👤 (HostName)"
 * - If host cancels, all their guests are also cancelled
 */
async function handleGuestRegistration() {
    // Check maintenance mode
    if (state.maintenanceMode && !state.isAdmin) {
        alert('System is under maintenance. Please wait.\nระบบกำลังปรับปรุง กรุณารอสักครู่');
        return;
    }

    // Check if user is logged in
    if (!state.loggedInUser) {
        alert('Please log in first / กรุณาเข้าสู่ระบบก่อน');
        return;
    }

    const hostName = state.loggedInUser.name;
    const hostUserId = state.loggedInUser.userId;

    // Prompt for guest name
    const guestName = prompt('Enter guest name / ใส่ชื่อแขก:');
    if (!guestName || !guestName.trim()) {
        return; // User cancelled or empty name
    }

    const trimmedGuestName = guestName.trim();
    const fullGuestName = `${hostName} friend: ${trimmedGuestName}`;

    // Check if guest name already exists
    if (state.players.find(p => p.name === fullGuestName)) {
        alert('This guest is already registered / แขกคนนี้ลงทะเบียนแล้ว');
        return;
    }

    // Check if there's space available
    if (state.players.length >= state.maxPlayers) {
        // Ask if user wants to join waiting list
        if (!confirm(`Session is full (${state.maxPlayers}/${state.maxPlayers})\n\nJoin waiting list? / เซสชันเต็มแล้ว เข้าสู่รายการรอ?`)) {
            return;
        }
    }

    // Check balance from host and deduct payment IMMEDIATELY
    const currentBalance = state.loggedInUser.balance || 0;
    if (currentBalance < state.paymentAmount) {
        alert(`Insufficient balance / ยอดเงินไม่เพียงพอ\n\nCurrent: ${currentBalance} THB\nNeeded: ${state.paymentAmount} THB`);
        return;
    }

    try {
        // Deduct payment from host BEFORE adding guest to Firestore
        const isWaitingList = state.players.length >= state.maxPlayers;
        const paymentSuccess = await updateUserBalance(
            hostUserId,
            hostName,
            -state.paymentAmount, // Negative = deduct
            isWaitingList
                ? `Payment for guest (${trimmedGuestName}) on waiting list ${state.sessionDate}`
                : `Payment for guest (${trimmedGuestName}) ${state.sessionDate}`
        );

        if (!paymentSuccess) {
            // updateUserBalance already showed error message
            return;
        }

        // Add guest to Firestore
        const guestData = {
            name: fullGuestName,
            userId: hostUserId,
            paid: true,  // Already paid at registration
            isGuest: true, // Flag to identify guests
            guestOf: hostUserId, // Link to host user
            guestOfName: hostName, // Host's name for easy reference
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            position: state.players.length + 1
        };

        await playersRef().add(guestData);

        alert(`✅ Guest registered: ${trimmedGuestName}\n\nแขกลงทะเบียนแล้ว: ${trimmedGuestName}\n\nPosition: ${guestData.position}\n${guestData.position <= state.maxPlayers ? 'Active player' : 'Waiting list'}`);

        console.log('✅ Guest registered:', fullGuestName);
    } catch (error) {
        console.error('Error registering guest:', error);

        // IMPORTANT: Refund payment since Firestore add failed
        await updateUserBalance(
            hostUserId,
            hostName,
            state.paymentAmount, // Positive = refund
            `Refund for failed guest registration (${trimmedGuestName})`
        );

        alert('Error registering guest. Payment refunded. Please try again.\n\nเกิดข้อผิดพลาด คืนเงินแล้ว กรุณาลองใหม่อีกครั้ง');
    }
}

// ============================================
// LINE NOTIFICATION
// ============================================

// ============================================
// LINE NOTIFICATIONS
// ============================================

/**
 * Share published session to Line group
 */
async function shareSessionToLine() {
    try {
        // Check if session is published
        if (!state.published) {
            alert('⚠️ Session is not published yet!\n\nPlease publish the session first.\n\nกรุณาเผยแพร่เซสชันก่อน');
            return;
        }

        // Count active players and waiting list
        const activePlayers = state.players.slice(0, state.maxPlayers);
        const waitingList = state.players.slice(state.maxPlayers);
        const availableSpots = state.maxPlayers - activePlayers.length;

        // Extract player names
        const playerNames = activePlayers.map(p => p.name);
        const waitingListNames = waitingList.map(p => p.name);

        // Get Cloud Function reference
        const sendNotification = functions.httpsCallable('sendSessionAnnouncement');

        // Prepare notification data
        const notificationData = {
            sessionDay: state.sessionDay,
            sessionDate: state.sessionDate,
            sessionTime: state.sessionTime,
            currentPlayers: activePlayers.length,
            maxPlayers: state.maxPlayers,
            availableSpots: availableSpots,
            waitingListCount: waitingList.length,
            paymentAmount: state.paymentAmount,
            appUrl: window.location.href,
            playerNames: playerNames,           // NEW: Add player names
            waitingListNames: waitingListNames  // NEW: Add waiting list names
        };

        console.log('📤 Sharing session to Line...', notificationData);

        // Call Cloud Function
        const result = await sendNotification(notificationData);

        console.log('✅ Session shared to Line:', result.data);
        alert('✅ Session shared to Line!\n\nเผยแพร่ไปยัง Line แล้ว!');
    } catch (error) {
        console.error('❌ Error sharing to Line:', error);
        alert(`❌ Failed to share to Line:\n\n${error.message}\n\nกรุณาลองใหม่อีกครั้ง`);
    }
}

/**
 * Test Line configuration
 * Sends a test message and displays Group ID
 */
async function testLineConfig() {
    try {
        console.log('🧪 Testing Line configuration...');

        // Get Cloud Function reference
        const testConfig = functions.httpsCallable('testLineConfig');

        // Call the test function
        const result = await testConfig({});

        console.log('✅ Test result:', result.data);

        // Show success message with Group ID
        alert(
            `✅ LINE TEST SUCCESSFUL! / สำเร็จ!\n\n` +
            `Group ID: ${result.data.groupId}\n\n` +
            `✅ Test message sent to Line group!\n` +
            `✅ ข้อความทดสอบส่งไปยังกลุ่ม Line แล้ว!\n\n` +
            `Check your Line group for the test message.\n` +
            `ตรวจสอบกลุ่ม Line ของคุณสำหรับข้อความทดสอบ`
        );

    } catch (error) {
        console.error('❌ Error testing Line config:', error);

        let errorMessage = '❌ LINE TEST FAILED / ล้มเหลว\n\n';

        if (error.message.includes('not configured')) {
            errorMessage += 'LINE_TOKEN or LINE_GROUP_ID not configured.\n';
            errorMessage += 'Please set Firebase secrets first.\n\n';
            errorMessage += 'ไม่ได้ตั้งค่า LINE_TOKEN หรือ LINE_GROUP_ID\n';
            errorMessage += 'กรุณาตั้งค่า Firebase secrets ก่อน';
        } else if (error.message.includes('monthly limit')) {
            errorMessage += 'You have reached your monthly message limit.\n';
            errorMessage += 'Please upgrade your Line plan.\n\n';
            errorMessage += 'คุณถึงขีดจำกัดข้อความรายเดือนแล้ว\n';
            errorMessage += 'กรุณาอัพเกรดแผน Line ของคุณ';
        } else {
            errorMessage += `Error: ${error.message}`;
        }

        alert(errorMessage);
    }
}

// ============================================================================
// SIMPLE LINE NOTIFICATION API
// ============================================================================

/**
 * Send a custom message to Line group
 *
 * This is the SIMPLE API for sending Line messages.
 * Just call this function with your message text!
 *
 * @param {string} message - The message to send (can be multiline)
 * @returns {Promise<boolean>} - True if sent successfully
 *
 * USAGE EXAMPLES:
 *
 * // Example 1: Simple message
 * await sendLineNotification('Hello from app!');
 *
 * // Example 2: Multiline message
 * await sendLineNotification(`
 *     🔴 SESSION CLOSED / เซสชันปิด
 *
 *     The session is now closed.
 *     Thank you for playing!
 *
 *     เซสชันปิดแล้ว
 *     ขอบคุณที่มาเล่น!
 * `);
 *
 * // Example 3: With session info
 * await sendLineNotification(`
 *     ✅ SESSION OPEN / เซสชันเปิด
 *
 *     📅 ${state.sessionDay}
 *     🕐 ${state.sessionTime}
 *
 *     Registration is now open!
 *     ลงทะเบียนเปิดแล้ว!
 *
 *     👉 ${APP_URL}
 * `);
 *
 * // Example 4: With error handling
 * const success = await sendLineNotification('Test message');
 * if (success) {
 *     console.log('Message sent!');
 * }
 */
async function sendLineNotification(message) {
    try {
        console.log('📤 Sending Line notification:', message);

        // Get Cloud Function reference
        const sendMessage = functions.httpsCallable('sendLineMessage');

        // Call the function with the message
        const result = await sendMessage({ message });

        console.log('✅ Line notification sent:', result.data);
        return true;

    } catch (error) {
        console.error('❌ Error sending Line notification:', error);

        // Show error to user
        alert(
            `❌ Failed to send Line notification / ไม่สามารถส่งข้อความไปยัง Line\n\n` +
            `Error: ${error.message}`
        );

        return false;
    }
}

/**
 * Test Demo Line - Send a demo message
 * Click "Test Demo Line" button in Settings to try this
 */
async function testDemoLine() {
    try {
        console.log('📤 Testing demo Line message...');

        // Define your message here
        const message = `🎯 DEMO MESSAGE / ข้อความทดสอบ

This is a demo message from the Badminton app!
นี่คือข้อความทดสอบจากแอปแบดมินตัน!

📅 ${state.sessionDay}
🕐 ${state.sessionTime}
👥 ${state.players.length}/${state.maxPlayers} players

You can customize this message easily!
คุณสามารถปรับแต่งข้อความนี้ได้ง่าย!

👉 ${APP_URL}`;

        // Send the message using the simple API
        const success = await sendLineNotification(message);

        if (success) {
            alert(
                `✅ DEMO MESSAGE SENT! / ส่งข้อความสำเร็จ!\n\n` +
                `Check your Line group for the demo message.\n` +
                `ตรวจสอบกลุ่ม Line ของคุณสำหรับข้อความทดสอบ\n\n` +
                `To add more messages:\n` +
                `1. Find this function in app.js\n` +
                `2. Change the message text\n` +
                `3. Or copy the pattern to other places!`
            );
        }

    } catch (error) {
        console.error('❌ Error testing demo Line:', error);
        alert(`❌ Error: ${error.message}`);
    }
}

// ============================================================================
// USAGE EXAMPLES - Copy these patterns to add Line notifications anywhere!
// ============================================================================

/**
 * EXAMPLE 1: Send notification when session is closed
 * Add this to your clearSession() function:
 *
 * await sendLineNotification(`
 *     🔴 SESSION CLOSED / เซสชันปิด
 *
 *     📅 ${state.sessionDay}
 *
 *     The session is now closed.
 *     Thank you everyone for playing!
 *
 *     เซสชันปิดแล้ว
 *     ขอบคุณทุกคนที่มาเล่น!
 * `);
 */

/**
 * EXAMPLE 2: Send notification when session is opened for registration
 * Add this to your publishSession() function (already exists):
 *
 * await sendLineNotification(`
 *     ✅ REGISTRATION OPEN / เปิดลงทะเบียน
 *
 *     📅 ${state.sessionDay}
 *     🕐 ${state.sessionTime}
 *     💰 ${state.paymentAmount} THB
 *
 *     Registration is now open!
 *     ลงทะเบียนเปิดแล้ว!
 *
 *     👉 ${APP_URL}
 * `);
 */

/**
 * EXAMPLE 3: Send reminder 1 day before session
 * (You would need to add a scheduled function or button for this)
 *
 * await sendLineNotification(`
 *     ⏰ REMINDER / เตือนความจำ
 *
 *     Tomorrow's session:
 *     เซสชันพรุ่งนี้:
 *
 *     📅 ${state.sessionDay}
 *     🕐 ${state.sessionTime}
 *     👥 ${state.players.length}/${state.maxPlayers} players
 *
 *     See you tomorrow!
 *     พบกันพรุ่งนี้!
 * `);
 */

/**
 * EXAMPLE 4: Custom notification with button
 * Add a button anywhere in your HTML:
 *
 * <button onclick="sendCustomNotification()">Send Custom Message</button>
 *
 * Then add this function:
 *
 * async function sendCustomNotification() {
 *     const message = prompt('Enter your message:');
 *     if (message) {
 *         await sendLineNotification(message);
 *     }
 * }
 */

// ============================================================================

/**
 * Send nudge notification to Line group
 * Remind players about available spots
 */
async function nudgePlayers() {
    try {
        // Check if session is published
        if (!state.published) {
            alert('⚠️ Session is not published yet!\n\nPlease publish the session first.\n\nกรุณาเผยแพร่เซสชันก่อน');
            return;
        }

        // Count active players
        const activePlayers = state.players.slice(0, state.maxPlayers);
        const availableSpots = state.maxPlayers - activePlayers.length;

        // Check if there are available spots
        if (availableSpots <= 0) {
            alert('⚠️ No available spots!\n\nSession is full.\n\nไม่มีที่ว่าง เซสชันเต็มแล้ว');
            return;
        }

        // Confirm before sending
        const confirmed = confirm(
            `📢 Send reminder to Line group?\n\n` +
            `This will notify players about ${availableSpots} available spot${availableSpots > 1 ? 's' : ''}.\n\n` +
            `ส่งข้อความเตือนไปยัง Line?\n` +
            `จะแจ้งผู้เล่นเกี่ยวกับ ${availableSpots} ที่ว่าง`
        );

        if (!confirmed) {
            return;
        }

        // Get Cloud Function reference
        const sendNotification = functions.httpsCallable('sendNudgeNotification');

        // Prepare notification data
        const notificationData = {
            sessionDay: state.sessionDay,
            sessionDate: state.sessionDate,
            sessionTime: state.sessionTime,
            currentPlayers: activePlayers.length,
            maxPlayers: state.maxPlayers,
            availableSpots: availableSpots,
            paymentAmount: state.paymentAmount,
            appUrl: window.location.href
        };

        console.log('📢 Sending nudge to Line...', notificationData);

        // Call Cloud Function
        const result = await sendNotification(notificationData);

        console.log('✅ Nudge sent to Line:', result.data);
        alert('✅ Nudge sent to Line!\n\nเตือนความจำส่งไปยัง Line แล้ว!');
    } catch (error) {
        console.error('❌ Error sending nudge:', error);
        alert(`❌ Failed to send nudge:\n\n${error.message}\n\nกรุณาลองใหม่อีกครั้ง`);
    }
}

// ============================================
// CLOSE LAST SESSION - Session Summary
// ============================================

/**
 * Close last session and show summary
 * - Thanks for the session
 * - Shows session details (date, time, player count)
 * - Lists all players who played
 * - Warns about low wallet balance (<150 THB)
 */
async function closeLastSession() {
    // Directly call copyAndCloseSession to do everything in one step
    await copyAndCloseSession();
}

/**
 * Close session summary modal
 */
function closeSessionSummary() {
    document.getElementById('sessionSummaryModal').style.display = 'none';
}

/**
 * Copy & Close Session - Does everything in one action:
 * 1. Copy session summary to clipboard
 * 2. Archive session with all players
 * 3. Register income & expenses
 * 4. Mark session as closed
 * 5. Close modal
 */
async function copyAndCloseSession() {
    try {
        // Check if session is already closed
        const sessionDoc = await currentSessionRef().get();
        if (sessionDoc.exists && sessionDoc.data().closed) {
            alert('⚠️ เซสชันนี้ถูกปิดแล้ว!\n\nThis session is already closed!');
            return;
        }

        const activePlayers = state.players.slice(0, state.maxPlayers);
        const waitingList = state.players.slice(state.maxPlayers);

        // ============================================
        // STEP 1: BUILD & COPY TEXT TO CLIPBOARD
        // ============================================
        let text = `✅ ขอบคุณสำหรับการเล่น! Thank you for the session!\n\n`;
        text += `📅 ${state.sessionDay}\n`;
        text += `📆 ${state.sessionDate}\n`;
        text += `🕐 ${state.sessionTime}\n`;
        text += `👥 Players: ${activePlayers.length}/${state.maxPlayers}\n\n`;

        // List players
        if (activePlayers.length > 0) {
            text += `👥 Players Who Played / ผู้เล่นที่เล่น:\n`;
            activePlayers.forEach((player, index) => {
                const paidIcon = player.paid ? '✅' : '❌';
                text += `${index + 1}. ${player.name} ${paidIcon}\n`;
            });
            text += `\n`;
        }

        // List waiting list
        if (waitingList.length > 0) {
            text += `⏳ Waiting List / รายชื่อสำรอง:\n`;
            waitingList.forEach((player, index) => {
                text += `${index + 1}. ${player.name}\n`;
            });
            text += `\n`;
        }

        // Check for low balance users
        const lowBalanceUsers = state.authorizedUsers.filter(user => {
            const balance = user.balance || 0;
            return balance < 150;
        }).sort((a, b) => (a.balance || 0) - (b.balance || 0));

        if (lowBalanceUsers.length > 0) {
            text += `⚠️ Low Balance Warning / แจ้งเตือนยอดเงินต่ำ:\n`;
            text += `Please top up before next session / กรุณาเติมเงินก่อนรอบถัดไป:\n\n`;
            lowBalanceUsers.forEach(user => {
                const balance = user.balance || 0;
                text += `${user.name}: ${balance} THB\n`;
            });
        }

        // Copy to clipboard
        await navigator.clipboard.writeText(text);
        console.log('✅ Session summary copied to clipboard');

        // ============================================
        // STEP 2: CALCULATE FINANCES
        // ============================================
        const income = activePlayers.length * state.paymentAmount;

        // Calculate number of courts automatically (6 players per court)
        const courts = Math.ceil(activePlayers.length / 6);
        const courtCost = courts * 440;

        // Calculate shuttlecock cost
        const shuttlecockCost = (state.shuttlecocksUsed || 0) * 90;
        const totalExpense = courtCost + shuttlecockCost;

        // ============================================
        // STEP 3: ARCHIVE SESSION TO DATED DOCUMENT
        // ============================================

        // Generate ISO date for archived document (YYYY-MM-DD)
        // Convert sessionDate from "DD/MM/YYYY" to "YYYY-MM-DD"
        const [day, month, year] = state.sessionDate.split('/');
        const archivedSessionId = `${year}-${month}-${day}`; // e.g., "2025-11-22"

        console.log(`📦 Archiving session to: sessions/${archivedSessionId}`);

        // Copy session data to archived document
        const archivedSessionRef = sessionsRef.doc(archivedSessionId);
        await archivedSessionRef.set({
            date: state.sessionDate,
            day: state.sessionDay,
            time: state.sessionTime,
            maxPlayers: state.maxPlayers,
            paymentAmount: state.paymentAmount,
            shuttlecocksUsed: state.shuttlecocksUsed || 0,
            published: state.published,
            closed: true,
            closedAt: firebase.firestore.FieldValue.serverTimestamp(),
            finalPlayerCount: activePlayers.length,
            finalIncome: income,
            finalExpense: totalExpense,
            courts: courts,
            archivedFrom: 'current',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ Session data archived');

        // Copy ALL players to archived session
        const playersSnapshot = await playersRef().get();
        const archivedPlayersRef = archivedSessionRef.collection('players');

        const batch = db.batch();
        let playersCopied = 0;

        playersSnapshot.forEach(doc => {
            const playerData = doc.data();
            const newPlayerRef = archivedPlayersRef.doc(); // Auto-generate new ID
            batch.set(newPlayerRef, {
                ...playerData,
                archivedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            playersCopied++;
        });

        await batch.commit();
        console.log(`✅ ${playersCopied} players copied to archived session`);

        // ============================================
        // STEP 3.5: REFUND WAITING LIST AUTOMATICALLY
        // ============================================
        let waitingListRefunded = 0;
        let waitingListErrors = [];

        if (waitingList.length > 0) {
            console.log(`💰 Auto-refunding ${waitingList.length} waiting list player(s)...`);

            for (const player of waitingList) {
                try {
                    // Refund the payment (they already paid at registration)
                    const success = await updateUserBalance(
                        player.userId,
                        player.name,
                        state.paymentAmount,
                        `Auto-refund - Waiting list ${state.sessionDate}`,
                        true // silent mode
                    );

                    if (success) {
                        waitingListRefunded++;
                        console.log(`✅ Refunded ${state.paymentAmount} THB to ${player.name} (waiting list)`);
                    } else {
                        waitingListErrors.push(player.name);
                        console.error(`❌ Failed to refund ${player.name}`);
                    }
                } catch (error) {
                    console.error(`❌ Error refunding ${player.name}:`, error);
                    waitingListErrors.push(player.name);
                }
            }

            if (waitingListRefunded > 0) {
                console.log(`✅ Total refunded: ${waitingListRefunded}/${waitingList.length} waiting list players`);
            }
            if (waitingListErrors.length > 0) {
                console.error(`⚠️ Refund errors for: ${waitingListErrors.join(', ')}`);
            }
        }

        // ============================================
        // STEP 4: REGISTER INCOME & EXPENSES
        // ============================================

        // Register income (ISO date format: YYYY-MM-DD)
        await incomeRef.add({
            date: archivedSessionId, // ISO format (YYYY-MM-DD)
            sessionId: archivedSessionId, // Link to archived session
            amount: income,
            paymentPerPlayer: state.paymentAmount,
            playerCount: activePlayers.length,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            notes: `${state.sessionDay} ${state.sessionTime}`
        });

        console.log('✅ Income registered:', income);

        // Register court rental expense (ISO date format: YYYY-MM-DD)
        await expensesRef.add({
            date: archivedSessionId, // ISO format (YYYY-MM-DD)
            type: 'court_rental',
            sessionId: archivedSessionId,
            amount: courtCost,
            courts: courts,
            costPerCourt: 440,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            notes: `${state.sessionDay} ${state.sessionTime}`
        });

        console.log('✅ Court expense registered:', courtCost);

        // Register shuttlecock expense (if any) (ISO date format: YYYY-MM-DD)
        if (state.shuttlecocksUsed > 0) {
            await expensesRef.add({
                date: archivedSessionId, // ISO format (YYYY-MM-DD)
                type: 'shuttlecocks',
                sessionId: archivedSessionId,
                amount: shuttlecockCost,
                quantity: state.shuttlecocksUsed,
                costPerItem: 90,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                notes: `${state.sessionDay} ${state.sessionTime}`
            });

            console.log('✅ Shuttlecock expense registered:', shuttlecockCost);
        }

        // ============================================
        // STEP 5: MARK CURRENT SESSION AS CLOSED
        // ============================================

        await currentSessionRef().update({
            closed: true,
            closedAt: firebase.firestore.FieldValue.serverTimestamp(),
            finalPlayerCount: activePlayers.length,
            finalIncome: income,
            finalExpense: totalExpense,
            archivedTo: archivedSessionId
        });

        console.log('✅ Current session marked as closed');

        // Build expense text for alert
        let expenseText = `💸 รายจ่าย / Expenses:\n${courts} สนาม × 440 = ${courtCost} THB\n`;
        if (state.shuttlecocksUsed > 0) {
            expenseText += `${state.shuttlecocksUsed} ลูก × 90 = ${shuttlecockCost} THB\n`;
            expenseText += `รวม / Total: ${totalExpense} THB\n`;
        }

        // Build waiting list refund info
        let refundInfo = '';
        if (waitingList.length > 0) {
            refundInfo = `\n💸 คืนเงินรายชื่อสำรอง / Waiting List Refunded:\n`;
            refundInfo += `✅ ${waitingListRefunded}/${waitingList.length} players\n`;
            refundInfo += `💰 Total refunded: ${waitingListRefunded * state.paymentAmount} THB\n`;
            if (waitingListErrors.length > 0) {
                refundInfo += `⚠️ Errors: ${waitingListErrors.join(', ')}\n`;
            }
            refundInfo += `\n`;
        }

        // Success message with clipboard info
        let successMsg = `✅ เสร็จสมบูรณ์! / Complete!\n\n` +
            `📋 คัดลอกไปยัง Clipboard แล้ว!\n` +
            `📋 Copied to clipboard!\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📦 เซสชันถูกบันทึกที่ / Session archived to:\n` +
            `sessions/${archivedSessionId}\n\n` +
            `👥 ผู้เล่นที่เล่น / Active Players: ${activePlayers.length}\n` +
            `📋 รวมทั้งหมด / Total Archived: ${playersCopied}\n` +
            refundInfo +
            `\n💰 รายรับ / Income: ${income} THB\n` +
            `   (${activePlayers.length} players × ${state.paymentAmount} THB)\n\n` +
            expenseText + `\n` +
            `💵 กำไร/ขาดทุน / Profit: ${income - totalExpense} THB\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `💡 คุณสามารถวาง (Paste) รายชื่อใน Line ได้เลย!\n` +
            `💡 You can now paste the list in Line!`;

        alert(successMsg);

        // Close the modal
        closeSessionSummary();

    } catch (error) {
        console.error('❌ Error closing session:', error);
        alert(`❌ Error: ${error.message}`);
    }
}

/**
 * Copy session summary to clipboard as plain text
 */
async function copySessionSummaryToClipboard() {
    try {
        const activePlayers = state.players.slice(0, state.maxPlayers);
        const waitingList = state.players.slice(state.maxPlayers);

        // Build plain text summary
        let text = `✅ ขอบคุณสำหรับการเล่น! Thank you for the session!\n\n`;
        text += `📅 ${state.sessionDay}\n`;
        text += `📆 ${state.sessionDate}\n`;
        text += `🕐 ${state.sessionTime}\n`;
        text += `👥 Players: ${activePlayers.length}/${state.maxPlayers}\n\n`;

        // List players
        if (activePlayers.length > 0) {
            text += `👥 Players Who Played / ผู้เล่นที่เล่น:\n`;
            activePlayers.forEach((player, index) => {
                const paidIcon = player.paid ? '✅' : '❌';
                text += `${index + 1}. ${player.name} ${paidIcon}\n`;
            });
            text += `\n`;
        }

        // List waiting list
        if (waitingList.length > 0) {
            text += `⏳ Waiting List / รายชื่อสำรอง:\n`;
            waitingList.forEach((player, index) => {
                text += `${index + 1}. ${player.name}\n`;
            });
            text += `\n`;
        }

        // Check for low balance users
        const lowBalanceUsers = state.authorizedUsers.filter(user => {
            const balance = user.balance || 0;
            return balance < 150;
        }).sort((a, b) => (a.balance || 0) - (b.balance || 0));

        if (lowBalanceUsers.length > 0) {
            text += `⚠️ Low Balance Warning / แจ้งเตือนยอดเงินต่ำ:\n`;
            text += `Please top up before next session / กรุณาเติมเงินก่อนรอบถัดไป:\n\n`;
            lowBalanceUsers.forEach(user => {
                const balance = user.balance || 0;
                text += `${user.name}: ${balance} THB\n`;
            });
        }

        // Copy to clipboard
        await navigator.clipboard.writeText(text);

        alert('✅ คัดลอกแล้ว!\n\nCopied to clipboard!\n\nYou can now paste this in Line.');

    } catch (error) {
        console.error('❌ Error copying to clipboard:', error);
        alert(`❌ Failed to copy:\n\n${error.message}`);
    }
}

// ============================================
// SESSION ACCOUNTING - Income & Expenses
// ============================================

/**
 * Share session summary to Line
 */
async function shareSessionSummaryToLine() {
    try {
        const activePlayers = state.players.slice(0, state.maxPlayers);
        const income = activePlayers.length * state.paymentAmount;
        const courts = Math.ceil(activePlayers.length / 6);
        const courtCost = courts * 440;

        // Build message directly
        const message = `📊 บันทึกการเงิน / Record Finances\n\n` +
            `📅 วันที่ / Date: ${state.sessionDate}\n` +
            `👥 ผู้เล่น / Players: ${activePlayers.length}\n\n` +
            `💰 รายรับ / Income:\n` +
            `${activePlayers.length} × ${state.paymentAmount} = ${income} THB\n\n` +
            `💸 รายจ่าย / Expenses:\n` +
            `${courts} สนาม × 440 = ${courtCost} THB\n\n` +
            `💵 กำไร/ขาดทุน / Profit/Loss: ${income - courtCost} THB`;

        console.log('📤 Sharing session summary to Line...');

        // Use generic Line sender
        const sendToLine = functions.httpsCallable('sendLineMessage');
        const result = await sendToLine({ message: message });

        console.log('✅ Summary shared to Line:', result.data);
        alert('✅ แชร์ไปยัง Line แล้ว!\n\nShared to Line successfully!');
    } catch (error) {
        console.error('❌ Error sharing to Line:', error);
        alert(`❌ Failed to share:\n\n${error.message}`);
    }
}

/**
 * Test Line message - Simple test without revealing details
 */
async function testLineMessage() {
    try {
        const message = `🏸 Test message from Badminton app\n\nTesting Line integration... ✅`;

        console.log('📤 Sending test message to Line...');

        // Use generic Line sender
        const sendToLine = functions.httpsCallable('sendLineMessage');
        const result = await sendToLine({ message: message });

        console.log('✅ Test message sent:', result.data);
        alert('✅ Test message sent to Line!\n\nข้อความทดสอบส่งไปแล้ว!');
    } catch (error) {
        console.error('❌ Error sending test message:', error);
        alert(`❌ Failed to send test:\n\n${error.message}`);
    }
}

/**
 * TEST: Session Announcement
 * Sends session announcement without validation checks
 * Uses mock data if no real players exist
 */
async function testSessionAnnouncement() {
    try {
        // Use current state data (may be incomplete, but that's OK for testing)
        const activePlayers = state.players.slice(0, state.maxPlayers);
        const waitingList = state.players.slice(state.maxPlayers);
        const availableSpots = state.maxPlayers - activePlayers.length;

        // Extract player names - use mock data if empty for testing
        let playerNames = activePlayers.map(p => p.name);
        let waitingListNames = waitingList.map(p => p.name);

        // If no players, use mock data for testing
        if (playerNames.length === 0) {
            playerNames = ['John (test)', 'Sarah (test)', 'Michael (test)', 'Lisa (test)', 'Tom (test)'];
            console.log('⚠️ No real players found, using mock data for testing');
        }

        const sendNotification = functions.httpsCallable('sendSessionAnnouncement');

        const notificationData = {
            sessionDay: state.sessionDay || 'Monday / วันจันทร์',
            sessionDate: state.sessionDate || '01/01/2025',
            sessionTime: state.sessionTime || '18:00 - 20:00',
            currentPlayers: playerNames.length,  // Use actual player count
            maxPlayers: state.maxPlayers,
            availableSpots: state.maxPlayers - playerNames.length,  // Calculate based on mock data
            waitingListCount: waitingListNames.length,
            paymentAmount: state.paymentAmount,
            appUrl: window.location.href,
            playerNames: playerNames,
            waitingListNames: waitingListNames
        };

        console.log('📤 TEST: Sending session announcement...', notificationData);
        const result = await sendNotification(notificationData);

        console.log('✅ Session announcement sent:', result.data);
        alert('✅ Session announcement sent!\n\nประกาศเซสชันส่งไปแล้ว!');
    } catch (error) {
        console.error('❌ Error sending session announcement:', error);
        alert(`❌ Failed to send:\n\n${error.message}`);
    }
}

/**
 * TEST: Cancellation Notification
 * Sends cancellation notification with mock data
 */
async function testCancellationNotification() {
    try {
        // Use mock data for testing
        const mockPlayerName = state.loggedInUser?.name || 'Test Player';
        const hasWaitingList = state.players.length > state.maxPlayers;

        const sendNotification = functions.httpsCallable('sendCancellationNotification');

        const notificationData = {
            playerName: mockPlayerName,
            currentPlayers: state.players.length,
            maxPlayers: state.maxPlayers,
            hasWaitingList: hasWaitingList,
            sessionDate: state.sessionDate || '01/01/2025',
            sessionDay: state.sessionDay || 'Monday / วันจันทร์',
            sessionTime: state.sessionTime || '18:00 - 20:00',
            appUrl: window.location.href
        };

        console.log('📤 TEST: Sending cancellation notification...', notificationData);
        const result = await sendNotification(notificationData);

        console.log('✅ Cancellation notification sent:', result.data);
        alert('✅ Cancellation notification sent!\n\nข้อความยกเลิกส่งไปแล้ว!');
    } catch (error) {
        console.error('❌ Error sending cancellation notification:', error);
        alert(`❌ Failed to send:\n\n${error.message}`);
    }
}

/**
 * TEST: Nudge Notification
 * Sends nudge/reminder without validation checks
 */
async function testNudgeNotification() {
    try {
        const activePlayers = state.players.slice(0, state.maxPlayers);
        const availableSpots = state.maxPlayers - activePlayers.length;

        const sendNotification = functions.httpsCallable('sendNudgeNotification');

        const notificationData = {
            sessionDay: state.sessionDay || 'Monday / วันจันทร์',
            sessionDate: state.sessionDate || '01/01/2025',
            sessionTime: state.sessionTime || '18:00 - 20:00',
            currentPlayers: activePlayers.length,
            maxPlayers: state.maxPlayers,
            availableSpots: availableSpots > 0 ? availableSpots : 1, // Mock at least 1 for testing
            paymentAmount: state.paymentAmount,
            appUrl: window.location.href
        };

        console.log('📤 TEST: Sending nudge notification...', notificationData);
        const result = await sendNotification(notificationData);

        console.log('✅ Nudge notification sent:', result.data);
        alert('✅ Nudge notification sent!\n\nข้อความเตือนส่งไปแล้ว!');
    } catch (error) {
        console.error('❌ Error sending nudge notification:', error);
        alert(`❌ Failed to send:\n\n${error.message}`);
    }
}

/**
 * TEST: Password Reset Notification
 * Sends password reset notification with mock data
 */
async function testPasswordResetNotification() {
    try {
        const mockUserName = state.loggedInUser?.name || 'Test User';

        const sendNotification = functions.httpsCallable('sendPasswordResetNotification');

        const notificationData = {
            userName: mockUserName,
            timestamp: new Date().toLocaleString('en-GB', {
                timeZone: 'Asia/Bangkok',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
        };

        console.log('📤 TEST: Sending password reset notification...', notificationData);
        const result = await sendNotification(notificationData);

        console.log('✅ Password reset notification sent:', result.data);
        alert('✅ Password reset notification sent!\n\nข้อความรีเซ็ตรหัสผ่านส่งไปแล้ว!');
    } catch (error) {
        console.error('❌ Error sending password reset notification:', error);
        alert(`❌ Failed to send:\n\n${error.message}`);
    }
}

/**
 * Send message about possible extra court
 * Encourages players to join waiting list even if it seems full
 */
async function sendExtraCourtMessage() {
    const message = `🏸 EXTRA COURT UPDATE / อัพเดทสนามเพิ่ม

📅 ${state.sessionDay}
📆 ${state.sessionDate}
🕐 ${state.sessionTime}

🎾 We have requested an additional court!
เราได้ขอสนามเพิ่มแล้ว!

⏳ Waiting for confirmation from the sports center.
รอการยืนยันจากศูนย์กีฬา

🔗 Register here / ลงทะเบียนที่นี่:
${window.location.origin}${window.location.pathname}`;

    try {
        // Use Firebase Cloud Function - sendLineMessage (not sendLineGroupMessage!)
        const sendNotification = functions.httpsCallable('sendLineMessage');
        const result = await sendNotification({ message: message });

        console.log('✅ Extra court message sent:', result);
        alert('✅ Message sent to Line group!\n\nข้อความถูกส่งไปยังกลุ่ม Line แล้ว!');
    } catch (error) {
        console.error('❌ Error sending extra court message:', error);
        alert(`❌ Failed to send:\n\n${error.message}`);
    }
}

/**
 * Finalize session accounting - Register income and expenses
 */
async function finalizeSessionAccounting() {
    try {
        // Check if session is already closed
        const sessionDoc = await currentSessionRef().get();
        if (sessionDoc.exists && sessionDoc.data().closed) {
            alert('⚠️ เซสชันนี้ถูกปิดแล้ว!\n\nThis session is already closed!');
            return;
        }

        const activePlayers = state.players.slice(0, state.maxPlayers);
        const income = activePlayers.length * state.paymentAmount;

        // Calculate number of courts automatically (6 players per court)
        const courts = Math.ceil(activePlayers.length / 6);
        const courtCost = courts * 440;

        // Calculate shuttlecock cost
        const shuttlecockCost = (state.shuttlecocksUsed || 0) * 90;
        const totalExpense = courtCost + shuttlecockCost;

        // Build expense breakdown text
        let expenseText = `💸 รายจ่าย / Expenses:\n${courts} สนาม × 440 = ${courtCost} THB\n`;
        if (state.shuttlecocksUsed > 0) {
            expenseText += `${state.shuttlecocksUsed} ลูก × 90 = ${shuttlecockCost} THB\n`;
            expenseText += `รวม / Total: ${totalExpense} THB\n`;
        }

        // Confirm before recording
        const confirmed = confirm(
            `📊 บันทึกการเงิน / Record Finances\n\n` +
            `📅 วันที่ / Date: ${state.sessionDate}\n` +
            `👥 ผู้เล่น / Players: ${activePlayers.length}\n\n` +
            `💰 รายรับ / Income:\n` +
            `${activePlayers.length} × ${state.paymentAmount} = ${income} THB\n\n` +
            expenseText + `\n` +
            `💵 กำไร/ขาดทุน / Profit/Loss: ${income - totalExpense} THB\n\n` +
            `ยืนยันการบันทึก / Confirm?`
        );

        if (!confirmed) {
            return;
        }

        // ============================================
        // STEP 1: ARCHIVE SESSION TO DATED DOCUMENT
        // ============================================

        // Generate ISO date for archived document (YYYY-MM-DD)
        const today = new Date();
        const archivedSessionId = today.toISOString().split('T')[0]; // e.g., "2025-11-14"

        console.log(`📦 Archiving session to: sessions/${archivedSessionId}`);

        // Copy session data to archived document
        const archivedSessionRef = sessionsRef.doc(archivedSessionId);
        await archivedSessionRef.set({
            date: state.sessionDate,
            day: state.sessionDay,
            time: state.sessionTime,
            maxPlayers: state.maxPlayers,
            paymentAmount: state.paymentAmount,
            shuttlecocksUsed: state.shuttlecocksUsed || 0,
            published: state.published,
            closed: true,
            closedAt: firebase.firestore.FieldValue.serverTimestamp(),
            finalPlayerCount: activePlayers.length,
            finalIncome: income,
            finalExpense: totalExpense,
            courts: courts,
            archivedFrom: 'current',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ Session data archived');

        // Copy ALL players to archived session
        const playersSnapshot = await playersRef().get();
        const archivedPlayersRef = archivedSessionRef.collection('players');

        const batch = db.batch();
        let playersCopied = 0;

        playersSnapshot.forEach(doc => {
            const playerData = doc.data();
            const newPlayerRef = archivedPlayersRef.doc(); // Auto-generate new ID
            batch.set(newPlayerRef, {
                ...playerData,
                archivedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            playersCopied++;
        });

        await batch.commit();
        console.log(`✅ ${playersCopied} players copied to archived session`);

        // ============================================
        // STEP 2: REGISTER INCOME & EXPENSES
        // ============================================

        // Register income (ISO date format: YYYY-MM-DD)
        await incomeRef.add({
            date: archivedSessionId, // ISO format (YYYY-MM-DD)
            sessionId: archivedSessionId, // Link to archived session
            amount: income,
            paymentPerPlayer: state.paymentAmount,
            playerCount: activePlayers.length,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            notes: `${state.sessionDay} ${state.sessionTime}`
        });

        console.log('✅ Income registered:', income);

        // Register court rental expense (ISO date format: YYYY-MM-DD)
        await expensesRef.add({
            date: archivedSessionId, // ISO format (YYYY-MM-DD)
            type: 'court_rental',
            sessionId: archivedSessionId,
            amount: courtCost,
            courts: courts,
            costPerCourt: 440,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            notes: `${state.sessionDay} ${state.sessionTime}`
        });

        console.log('✅ Court expense registered:', courtCost);

        // Register shuttlecock expense (if any) (ISO date format: YYYY-MM-DD)
        if (state.shuttlecocksUsed > 0) {
            await expensesRef.add({
                date: archivedSessionId, // ISO format (YYYY-MM-DD)
                type: 'shuttlecocks',
                sessionId: archivedSessionId,
                amount: shuttlecockCost,
                quantity: state.shuttlecocksUsed,
                costPerItem: 90,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                notes: `${state.sessionDay} ${state.sessionTime}`
            });

            console.log('✅ Shuttlecock expense registered:', shuttlecockCost);
        }

        // ============================================
        // STEP 3: MARK CURRENT SESSION AS CLOSED
        // ============================================

        await currentSessionRef().update({
            closed: true,
            closedAt: firebase.firestore.FieldValue.serverTimestamp(),
            finalPlayerCount: activePlayers.length,
            finalIncome: income,
            finalExpense: totalExpense,
            archivedTo: archivedSessionId
        });

        console.log('✅ Current session marked as closed');

        // Success message
        let successMsg = `✅ บันทึกสำเร็จ / Success!\n\n` +
            `📦 เซสชันถูกบันทึกที่ / Session archived to:\n` +
            `sessions/${archivedSessionId}\n\n` +
            `👥 ผู้เล่น / Players copied: ${playersCopied}\n\n` +
            `💰 รายรับ / Income: ${income} THB\n` +
            `💸 รายจ่าย / Expenses:\n` +
            `  - สนาม / Courts: ${courtCost} THB\n`;

        if (state.shuttlecocksUsed > 0) {
            successMsg += `  - ลูกขนไก่ / Shuttlecocks: ${shuttlecockCost} THB\n`;
        }

        successMsg += `  - รวม / Total: ${totalExpense} THB\n\n` +
            `💵 กำไร/ขาดทุน / Profit: ${income - totalExpense} THB\n\n` +
            `เซสชันถูกปิดแล้ว / Session closed`;

        alert(successMsg);

        // Close the modal
        closeSessionSummary();

    } catch (error) {
        console.error('❌ Error finalizing accounting:', error);
        alert(`❌ Error: ${error.message}`);
    }
}

/**
 * Add manual expense (shuttles, etc.)
 */
async function addManualExpense() {
    try {
        // Ask for expense type
        const type = prompt(
            `ประเภทค่าใช้จ่าย / Expense type:\n\n` +
            `ตัวอย่าง / Examples:\n` +
            `- Shuttles / ลูกขนไก่\n` +
            `- Equipment / อุปกรณ์\n` +
            `- Other / อื่นๆ\n\n` +
            `ใส่ประเภท / Enter type:`,
            'Shuttles'
        );

        if (!type) return;

        // Ask for amount
        const amountInput = prompt(
            `จำนวนเงิน / Amount (THB):\n\n` +
            `ใส่จำนวนเงิน / Enter amount:`,
            ''
        );

        if (!amountInput) return;

        const amount = parseFloat(amountInput);
        if (isNaN(amount) || amount <= 0) {
            alert('❌ กรุณาใส่จำนวนเงินที่ถูกต้อง\n\nPlease enter valid amount');
            return;
        }

        // Ask for notes (optional)
        const notes = prompt(
            `หมายเหตุ (ถ้ามี) / Notes (optional):\n\n` +
            `เช่น: ซื้อลูก 12 ลูก / Example: Bought 12 shuttles`,
            ''
        );

        // Confirm
        const confirmed = confirm(
            `📝 บันทึกค่าใช้จ่าย / Add Expense\n\n` +
            `ประเภท / Type: ${type}\n` +
            `จำนวน / Amount: ${amount} THB\n` +
            `หมายเหตุ / Notes: ${notes || '-'}\n` +
            `วันที่ / Date: ${state.sessionDate}\n\n` +
            `ยืนยัน / Confirm?`
        );

        if (!confirmed) return;

        // Register expense
        await expensesRef.add({
            date: state.sessionDate,
            type: 'other',
            category: type,
            amount: amount,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            notes: notes || ''
        });

        console.log('✅ Manual expense registered:', amount);

        alert(`✅ บันทึกสำเร็จ / Success!\n\n${type}: ${amount} THB`);

    } catch (error) {
        console.error('❌ Error adding manual expense:', error);
        alert(`❌ Error: ${error.message}`);
    }
}

/**
 * View accounting report - Income vs Expenses
 */
async function viewAccountingReport() {
    try {
        // Close other admin sections
        closeAllAdminSections();

        // Ask for date range
        const range = prompt(
            `📊 รายงานบัญชี / Accounting Report\n\n` +
            `เลือกช่วงเวลา / Select period:\n` +
            `1 = วันนี้ / Today\n` +
            `7 = 7 วันที่แล้ว / Last 7 days\n` +
            `30 = 30 วันที่แล้ว / Last 30 days\n` +
            `365 = 1 ปีที่แล้ว / Last year\n` +
            `730 = 2 ปีที่แล้ว / Last 2 years\n\n` +
            `ใส่จำนวนวัน / Enter days:`,
            '30'
        );

        if (!range) return;

        const days = parseInt(range);
        if (isNaN(days) || days <= 0) {
            alert('❌ กรุณาใส่จำนวนวันที่ถูกต้อง\n\nPlease enter valid number of days');
            return;
        }

        // Calculate start date
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        console.log('📊 Fetching accounting report for last', days, 'days');

        // Fetch income
        const incomeSnapshot = await incomeRef
            .where('timestamp', '>=', startDate)
            .orderBy('timestamp', 'desc')
            .get();

        // Fetch expenses
        const expensesSnapshot = await expensesRef
            .where('timestamp', '>=', startDate)
            .orderBy('timestamp', 'desc')
            .get();

        let totalIncome = 0;
        let totalExpenses = 0;

        const incomeData = [];
        incomeSnapshot.forEach(doc => {
            const data = doc.data();
            totalIncome += data.amount;
            incomeData.push(data);
        });

        const expensesData = [];
        expensesSnapshot.forEach(doc => {
            const data = doc.data();
            totalExpenses += data.amount;
            expensesData.push(data);
        });

        const profit = totalIncome - totalExpenses;
        const profitColor = profit >= 0 ? '#10b981' : '#ef4444';

        // Generate report HTML
        let reportHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <h3 style="color: #374151; margin-bottom: 10px;">📊 รายงานบัญชี / Accounting Report</h3>
                <p style="color: #6b7280;">${days} วันที่แล้ว / Last ${days} days</p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
                <div style="background: #dcfce7; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 12px; color: #16a34a; font-weight: bold;">💰 รายรับ / Income</div>
                    <div style="font-size: 20px; font-weight: bold; color: #15803d; margin-top: 5px;">${totalIncome.toLocaleString()} ฿</div>
                </div>
                <div style="background: #fee2e2; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 12px; color: #dc2626; font-weight: bold;">💸 รายจ่าย / Expenses</div>
                    <div style="font-size: 20px; font-weight: bold; color: #b91c1c; margin-top: 5px;">${totalExpenses.toLocaleString()} ฿</div>
                </div>
                <div style="background: ${profit >= 0 ? '#dcfce7' : '#fee2e2'}; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 12px; color: ${profitColor}; font-weight: bold;">💵 กำไร/ขาดทุน / Profit</div>
                    <div style="font-size: 20px; font-weight: bold; color: ${profitColor}; margin-top: 5px;">${profit >= 0 ? '+' : ''}${profit.toLocaleString()} ฿</div>
                </div>
            </div>
        `;

        // Show income details
        if (incomeData.length > 0) {
            reportHTML += `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #10b981;">💰 รายรับ / Income (${incomeData.length} รายการ)</h4>
                    <div style="max-height: 200px; overflow-y: auto;">
            `;

            incomeData.forEach((item, index) => {
                reportHTML += `
                    <div style="background: ${index % 2 === 0 ? '#f9fafb' : 'white'}; padding: 10px; border-radius: 4px; margin-bottom: 5px; display: flex; justify-content: space-between;">
                        <div>
                            <strong>${item.date}</strong><br>
                            <span style="font-size: 12px; color: #6b7280;">${item.playerCount} คน × ${item.paymentPerPlayer} = ${item.amount} ฿</span>
                        </div>
                        <div style="font-weight: bold; color: #10b981;">+${item.amount.toLocaleString()} ฿</div>
                    </div>
                `;
            });

            reportHTML += `</div></div>`;
        }

        // Show expenses details
        if (expensesData.length > 0) {
            reportHTML += `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #ef4444;">💸 รายจ่าย / Expenses (${expensesData.length} รายการ)</h4>
                    <div style="max-height: 200px; overflow-y: auto;">
            `;

            expensesData.forEach((item, index) => {
                let description = '';
                if (item.type === 'court_rental') {
                    description = `${item.courts} สนาม × ${item.costPerCourt} = ${item.amount} ฿`;
                } else {
                    description = `${item.category || item.type}: ${item.notes || '-'}`;
                }

                reportHTML += `
                    <div style="background: ${index % 2 === 0 ? '#f9fafb' : 'white'}; padding: 10px; border-radius: 4px; margin-bottom: 5px; display: flex; justify-content: space-between;">
                        <div>
                            <strong>${item.date}</strong><br>
                            <span style="font-size: 12px; color: #6b7280;">${description}</span>
                        </div>
                        <div style="font-weight: bold; color: #ef4444;">-${item.amount.toLocaleString()} ฿</div>
                    </div>
                `;
            });

            reportHTML += `</div></div>`;
        }

        // Show in transactions section (reuse existing modal area)
        document.getElementById('transactionsSection').style.display = 'block';
        document.getElementById('transactionsList').innerHTML = reportHTML;

    } catch (error) {
        console.error('❌ Error fetching accounting report:', error);
        alert(`❌ Error: ${error.message}\n\nNote: You need to create indexes in Firestore first.`);
    }
}

// ============================================
// WEEKLY BALANCE REPORT
// ============================================

/**
 * Generate Weekly Financial Report
 * Calculates income, expenses, and profit for a date range
 * Updates running balance and stores weekly summary
 */
async function generateWeeklyReport() {
    try {
        // Prompt for week selection
        const useThisWeek = confirm(
            'Generate report for THIS WEEK (Nov 17-23)?\n\n' +
            'สร้างรายงานสำหรับสัปดาห์นี้ (17-23 พ.ย.)?\n\n' +
            'Click OK for this week, or CANCEL to enter custom dates.\n' +
            'กด OK สำหรับสัปดาห์นี้ หรือ ยกเลิกเพื่อใส่วันที่'
        );

        let startDate, endDate;

        if (useThisWeek) {
            // Hardcoded: This week (Monday Nov 17 - Sunday Nov 23, 2025)
            startDate = '2025-11-17';
            endDate = '2025-11-23';
        } else {
            // Custom date range
            startDate = prompt('Start date (YYYY-MM-DD) / วันเริ่มต้น:');
            if (!startDate) return;

            endDate = prompt('End date (YYYY-MM-DD) / วันสิ้นสุด:');
            if (!endDate) return;
        }

        console.log(`📊 Generating weekly report: ${startDate} to ${endDate}`);

        // Query income for date range
        const incomeSnapshot = await incomeRef
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .orderBy('date', 'asc')
            .get();

        // Query expenses for date range
        const expensesSnapshot = await expensesRef
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .orderBy('date', 'asc')
            .get();

        // Aggregate income
        let totalIncome = 0;
        let totalPlayers = 0;
        const incomeSessions = [];

        incomeSnapshot.forEach(doc => {
            const data = doc.data();
            totalIncome += data.amount || 0;
            totalPlayers += data.playerCount || 0;
            incomeSessions.push({
                date: data.date,
                amount: data.amount,
                playerCount: data.playerCount,
                sessionId: data.sessionId
            });
        });

        // Aggregate expenses
        let totalExpenses = 0;
        let courtCost = 0;
        let shuttlecockCost = 0;
        let otherExpenses = 0;
        const expenseBreakdown = {
            court_rental: [],
            shuttlecocks: [],
            other: []
        };

        expensesSnapshot.forEach(doc => {
            const data = doc.data();
            const amount = data.amount || 0;
            totalExpenses += amount;

            if (data.type === 'court_rental') {
                courtCost += amount;
                expenseBreakdown.court_rental.push({
                    date: data.date,
                    amount: amount,
                    courts: data.courts || 0,
                    costPerCourt: data.costPerCourt || 440
                });
            } else if (data.type === 'shuttlecocks') {
                shuttlecockCost += amount;
                expenseBreakdown.shuttlecocks.push({
                    date: data.date,
                    amount: amount,
                    quantity: data.quantity || 0,
                    costPerItem: data.costPerItem || 90
                });
            } else {
                otherExpenses += amount;
                expenseBreakdown.other.push({
                    date: data.date,
                    amount: amount,
                    category: data.category || 'Other',
                    notes: data.notes || ''
                });
            }
        });

        // Calculate profit
        const grossProfit = totalIncome - totalExpenses;
        const sessionCount = incomeSessions.length;

        // Calculate week number (ISO 8601)
        const startDateObj = new Date(startDate);
        const weekNumber = getISOWeekNumber(startDateObj);
        const year = startDateObj.getFullYear();
        const weekId = `${year}-W${String(weekNumber).padStart(2, '0')}`;

        // ============================================
        // CHECK IF REPORT ALREADY EXISTS
        // ============================================
        const existingReportDoc = await weeklyBalanceRef.doc(weekId).get();

        if (existingReportDoc.exists) {
            const existingData = existingReportDoc.data();
            const oldProfit = existingData.grossProfit || 0;

            const overwrite = confirm(
                `⚠️ REPORT ALREADY EXISTS FOR ${weekId}\n\n` +
                `Previous profit: ${oldProfit} THB\n` +
                `Previous balance update: ${oldProfit} THB\n\n` +
                `If you continue, the old report will be REPLACED\n` +
                `and the balance will be recalculated.\n\n` +
                `Do you want to OVERWRITE and regenerate?\n\n` +
                `รายงานมีอยู่แล้ว คุณต้องการสร้างใหม่?\n\n` +
                `⚠️ This will reverse the old profit from balance first!`
            );

            if (!overwrite) {
                console.log('User cancelled - report already exists');
                return;
            }

            // Reverse the old profit from current balance before recalculating
            const summaryDoc = await weeklyBalanceRef.doc('summary').get();
            const currentBalance = summaryDoc.exists ? (summaryDoc.data().currentBalance || 0) : 0;
            const adjustedBalance = currentBalance - oldProfit;

            console.log(`🔄 Reversing old profit: ${currentBalance} - ${oldProfit} = ${adjustedBalance}`);

            // Update summary with reversed balance
            await weeklyBalanceRef.doc('summary').update({
                currentBalance: adjustedBalance
            });

            console.log(`✅ Old report will be overwritten, balance adjusted`);
        }

        // Get current balance AFTER potential reversal
        const summaryDoc = await weeklyBalanceRef.doc('summary').get();
        const currentBalance = summaryDoc.exists ? (summaryDoc.data().currentBalance || 0) : 0;
        const newBalance = currentBalance + grossProfit;

        // ============================================
        // CALCULATE NEXT WEEK RECOMMENDED PRICE
        // ============================================
        const WEEKLY_COURTS = 12;
        const COURT_PRICE = 220;
        const WEEKLY_SHUTTLECOCKS = 18;
        const SHUTTLECOCK_PRICE = 90;
        const PLAYERS_PER_WEEK = 36; // 3 sessions × 12 players
        const DISTRIBUTION_WEEKS = 4; // Distribute balance over 4 weeks

        const weeklyCost = (WEEKLY_COURTS * COURT_PRICE) + (WEEKLY_SHUTTLECOCKS * SHUTTLECOCK_PRICE);
        const basePrice = Math.round(weeklyCost / PLAYERS_PER_WEEK); // 118 THB

        // Calculate price adjustment based on balance
        const balanceToDistribute = newBalance / DISTRIBUTION_WEEKS;
        const priceAdjustmentPerPlayer = Math.round(balanceToDistribute / PLAYERS_PER_WEEK);
        const recommendedPrice = basePrice - priceAdjustmentPerPlayer;

        const priceCalculation = {
            weeklyCost: weeklyCost,
            basePrice: basePrice,
            currentBalance: newBalance,
            balanceToDistribute: balanceToDistribute,
            weeksToDistribute: DISTRIBUTION_WEEKS,
            playersPerWeek: PLAYERS_PER_WEEK,
            priceAdjustment: priceAdjustmentPerPlayer,
            recommendedPrice: recommendedPrice
        };

        console.log('💰 Price calculation:', priceCalculation);

        // Build report data
        const reportData = {
            weekNumber: weekNumber,
            year: year,
            startDate: startDate,
            endDate: endDate,

            // Income
            totalIncome: totalIncome,
            totalPlayers: totalPlayers,
            sessionCount: sessionCount,
            incomeSessions: incomeSessions,

            // Expenses
            totalExpenses: totalExpenses,
            courtCost: courtCost,
            shuttlecockCost: shuttlecockCost,
            otherExpenses: otherExpenses,
            expenseBreakdown: expenseBreakdown,

            // Summary
            grossProfit: grossProfit,
            profitPerSession: sessionCount > 0 ? (grossProfit / sessionCount) : 0,
            profitPerPlayer: totalPlayers > 0 ? (grossProfit / totalPlayers) : 0,

            // Balance
            balanceBefore: currentBalance,
            balanceAfter: newBalance,

            // Next Week Pricing
            nextWeekRecommendedPrice: recommendedPrice,
            priceCalculation: priceCalculation,

            // Metadata
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Confirm before saving
        const confirmMessage =
            `📊 WEEKLY REPORT SUMMARY\n\n` +
            `Week: ${weekId}\n` +
            `Period: ${startDate} to ${endDate}\n\n` +
            `💰 INCOME: ${totalIncome} THB\n` +
            `   Sessions: ${sessionCount}\n` +
            `   Players: ${totalPlayers}\n\n` +
            `💸 EXPENSES: ${totalExpenses} THB\n` +
            `   Court: ${courtCost} THB\n` +
            `   Shuttles: ${shuttlecockCost} THB\n` +
            `   Other: ${otherExpenses} THB\n\n` +
            `📈 PROFIT: ${grossProfit} THB\n\n` +
            `💰 BALANCE UPDATE:\n` +
            `   Before: ${currentBalance} THB\n` +
            `   After: ${newBalance} THB\n\n` +
            `💵 NEXT WEEK PRICING:\n` +
            `   Base price: ${basePrice} THB/player\n` +
            `   Balance to distribute: ${Math.round(balanceToDistribute)} THB\n` +
            `   Over ${DISTRIBUTION_WEEKS} weeks among ${PLAYERS_PER_WEEK} players\n` +
            `   Adjustment: ${priceAdjustmentPerPlayer >= 0 ? '+' : ''}${priceAdjustmentPerPlayer} THB/player\n\n` +
            `   ⭐ RECOMMENDED PRICE: ${recommendedPrice} THB/player\n\n` +
            `Save this report?\n` +
            `บันทึกรายงานนี้?`;

        if (!confirm(confirmMessage)) {
            return;
        }

        // Save weekly report
        await weeklyBalanceRef.doc(weekId).set(reportData);

        // Update summary
        await weeklyBalanceRef.doc('summary').set({
            currentBalance: newBalance,
            lastProcessedDate: endDate,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`✅ Weekly report saved: ${weekId}`);

        // Build detailed report text
        const reportText =
            `📊 WEEKLY REPORT / รายงานประจำสัปดาห์\n\n` +
            `📅 Week ${weekId}\n` +
            `📆 ${startDate} to ${endDate}\n\n` +
            `🏸 SESSIONS / เซสชัน\n` +
            `• Sessions: ${sessionCount}\n` +
            `• Total players: ${totalPlayers}\n\n` +
            `💰 INCOME / รายได้\n` +
            `• Total: ${totalIncome} THB\n\n` +
            `💸 EXPENSES / ค่าใช้จ่าย\n` +
            `• Courts: ${courtCost} THB\n` +
            `• Shuttlecocks: ${shuttlecockCost} THB\n` +
            `• Other: ${otherExpenses} THB\n` +
            `• Total: ${totalExpenses} THB\n\n` +
            `📈 PROFIT / กำไร\n` +
            `• Gross profit: ${grossProfit >= 0 ? '+' : ''}${grossProfit} THB\n` +
            `• Balance before: ${currentBalance} THB\n` +
            `• Balance after: ${newBalance >= 0 ? '+' : ''}${newBalance} THB\n\n` +
            `💵 NEXT WEEK PRICE / ราคาสัปดาห์หน้า\n` +
            `• Base price: ${basePrice} THB\n` +
            `• Balance adjustment: ${priceAdjustmentPerPlayer >= 0 ? '-' : '+'}${Math.abs(priceAdjustmentPerPlayer)} THB\n` +
            `• ⭐ Recommended price: ${recommendedPrice} THB\n\n` +
            `(Balance distributed over 4 weeks / กระจายยอดคงเหลือ 4 สัปดาห์)`;

        // Show report in a modal with copy and send buttons
        showWeeklyReportModal(reportText, {
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
        });

    } catch (error) {
        console.error('❌ Error generating weekly report:', error);
        alert(`❌ Error: ${error.message}\n\nNote: Ensure Firestore indexes exist for date queries.`);
    }
}

/**
 * Show weekly report in a modal with copy and send buttons
 */
function showWeeklyReportModal(reportText, reportData) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;

    // Create modal container
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 20px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    `;

    // Header
    const header = document.createElement('h2');
    header.textContent = '✅ Weekly Report Generated / รายงานสร้างเรียบร้อย';
    header.style.cssText = `
        margin: 0 0 15px 0;
        font-size: 18px;
        color: #10b981;
        text-align: center;
    `;

    // Text area (scrollable)
    const textarea = document.createElement('textarea');
    textarea.value = reportText;
    textarea.readOnly = true;
    textarea.style.cssText = `
        width: 100%;
        height: 400px;
        padding: 15px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-family: monospace;
        font-size: 13px;
        line-height: 1.6;
        resize: none;
        margin-bottom: 15px;
        overflow-y: auto;
        white-space: pre-wrap;
    `;

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        justify-content: center;
    `;

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 Copy / คัดลอก';
    copyBtn.style.cssText = `
        padding: 12px 24px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
        font-weight: 600;
    `;
    copyBtn.onclick = () => {
        textarea.select();
        document.execCommand('copy');
        copyBtn.textContent = '✅ Copied! / คัดลอกแล้ว!';
        setTimeout(() => {
            copyBtn.textContent = '📋 Copy / คัดลอก';
        }, 2000);
    };

    // Send to Line button
    const sendBtn = document.createElement('button');
    sendBtn.textContent = '📤 Send to Line';
    sendBtn.style.cssText = `
        padding: 12px 24px;
        background: #10b981;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
        font-weight: 600;
    `;
    sendBtn.onclick = async () => {
        sendBtn.disabled = true;
        sendBtn.textContent = '⏳ Sending... / กำลังส่ง...';
        try {
            await sendWeeklyReportToLine(reportData);
            sendBtn.textContent = '✅ Sent! / ส่งแล้ว!';
            sendBtn.style.background = '#6b7280';
        } catch (error) {
            sendBtn.disabled = false;
            sendBtn.textContent = '📤 Send to Line';
        }
    };

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Close / ปิด';
    closeBtn.style.cssText = `
        padding: 12px 24px;
        background: #6b7280;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
        font-weight: 600;
    `;
    closeBtn.onclick = () => {
        document.body.removeChild(overlay);
    };

    // Assemble modal
    buttonContainer.appendChild(copyBtn);
    buttonContainer.appendChild(sendBtn);
    buttonContainer.appendChild(closeBtn);

    modal.appendChild(header);
    modal.appendChild(textarea);
    modal.appendChild(buttonContainer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    };
}

/**
 * Send weekly report to Line group
 */
async function sendWeeklyReportToLine(data) {
    try {
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
        } = data;

        // Get Cloud Function reference
        const sendNotification = functions.httpsCallable('sendWeeklyReport');

        // Prepare notification data
        const notificationData = {
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
        };

        console.log('📤 Sending weekly report to Line...', notificationData);

        // Call Cloud Function
        const result = await sendNotification(notificationData);

        console.log('✅ Line notification sent:', result.data);
        alert('✅ Report sent to Line group!\n\nรายงานส่งไปยังกลุ่ม Line แล้ว!');

    } catch (error) {
        console.error('❌ Error sending to Line:', error);
        alert(`❌ Failed to send to Line:\n${error.message}\n\nไม่สามารถส่งไปยัง Line ได้`);
    }
}

/**
 * Helper: Get ISO 8601 week number
 */
function getISOWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Debug: View Raw Financial Data
 * Shows what actually exists in Firestore for income/expenses/sessions
 */
async function debugViewRawData() {
    console.log('🔍 DEBUG: Function started');
    alert('🔍 Starting debug data fetch...\n\nThis may take a few seconds.');

    try {
        // Prompt for date range
        const startDate = prompt('Start date (YYYY-MM-DD) / วันเริ่มต้น:', '2025-11-10');
        if (!startDate) {
            console.log('🔍 DEBUG: Cancelled by user (no start date)');
            return;
        }

        const endDate = prompt('End date (YYYY-MM-DD) / วันสิ้นสุด:', '2025-11-16');
        if (!endDate) {
            console.log('🔍 DEBUG: Cancelled by user (no end date)');
            return;
        }

        console.log(`🔍 DEBUG: Fetching data for ${startDate} to ${endDate}`);

        // Query archived sessions
        console.log('🔍 DEBUG: Querying sessions...');
        const sessionsSnapshot = await sessionsRef
            .where(firebase.firestore.FieldPath.documentId(), '>=', startDate)
            .where(firebase.firestore.FieldPath.documentId(), '<=', endDate + '\uf8ff')
            .get();
        console.log(`🔍 DEBUG: Found ${sessionsSnapshot.size} sessions`);

        // Query income
        console.log('🔍 DEBUG: Querying income...');
        const incomeSnapshot = await incomeRef
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .orderBy('date', 'asc')
            .get();
        console.log(`🔍 DEBUG: Found ${incomeSnapshot.size} income records`);

        // Query expenses
        console.log('🔍 DEBUG: Querying expenses...');
        const expensesSnapshot = await expensesRef
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .orderBy('date', 'asc')
            .get();
        console.log(`🔍 DEBUG: Found ${expensesSnapshot.size} expense records`);

        // Build debug report
        let report = `🔍 DEBUG: RAW DATA REPORT\n`;
        report += `Period: ${startDate} to ${endDate}\n`;
        report += `${'='.repeat(50)}\n\n`;

        // Archived Sessions
        report += `📅 ARCHIVED SESSIONS (${sessionsSnapshot.size}):\n\n`;
        if (sessionsSnapshot.empty) {
            report += `   ❌ No archived sessions found!\n`;
            report += `   💡 Sessions must be CLOSED to create income/expense records.\n\n`;
        } else {
            sessionsSnapshot.forEach(doc => {
                const data = doc.data();
                report += `   Session: ${doc.id}\n`;
                report += `   - Day: ${data.day}\n`;
                report += `   - Time: ${data.time}\n`;
                report += `   - Players: ${data.finalPlayerCount || 'N/A'}\n`;
                report += `   - Income: ${data.finalIncome || 0} THB\n`;
                report += `   - Expense: ${data.finalExpense || 0} THB\n`;
                report += `   - Profit: ${data.finalProfit || 0} THB\n`;
                report += `   - Closed: ${data.closedAt ? 'Yes' : 'No'}\n\n`;
            });
        }

        // Income Records
        report += `💰 INCOME RECORDS (${incomeSnapshot.size}):\n\n`;
        if (incomeSnapshot.empty) {
            report += `   ❌ No income records found!\n`;
            report += `   💡 Income is created when you close a session.\n\n`;
        } else {
            let totalIncome = 0;
            incomeSnapshot.forEach(doc => {
                const data = doc.data();
                totalIncome += data.amount || 0;
                report += `   ${data.date}: ${data.amount} THB (${data.playerCount} players)\n`;
            });
            report += `\n   TOTAL INCOME: ${totalIncome} THB\n\n`;
        }

        // Expense Records
        report += `💸 EXPENSE RECORDS (${expensesSnapshot.size}):\n\n`;
        if (expensesSnapshot.empty) {
            report += `   ❌ No expense records found!\n`;
            report += `   💡 Expenses are created when you close a session.\n\n`;
        } else {
            let totalExpenses = 0;
            let courtTotal = 0;
            let shuttleTotal = 0;
            let otherTotal = 0;

            expensesSnapshot.forEach(doc => {
                const data = doc.data();
                const amount = data.amount || 0;
                totalExpenses += amount;

                if (data.type === 'court_rental') {
                    courtTotal += amount;
                    report += `   ${data.date}: Court ${amount} THB (${data.courts} courts)\n`;
                } else if (data.type === 'shuttlecocks') {
                    shuttleTotal += amount;
                    report += `   ${data.date}: Shuttles ${amount} THB (${data.quantity} pcs)\n`;
                } else {
                    otherTotal += amount;
                    report += `   ${data.date}: ${data.category || 'Other'} ${amount} THB\n`;
                }
            });

            report += `\n   TOTAL EXPENSES: ${totalExpenses} THB\n`;
            report += `   - Court: ${courtTotal} THB\n`;
            report += `   - Shuttles: ${shuttleTotal} THB\n`;
            report += `   - Other: ${otherTotal} THB\n\n`;
        }

        // Summary
        report += `${'='.repeat(50)}\n`;
        report += `📊 SUMMARY:\n\n`;

        if (sessionsSnapshot.empty) {
            report += `⚠️ NO DATA FOUND!\n\n`;
            report += `Possible reasons:\n`;
            report += `1. No sessions were played in this period\n`;
            report += `2. Sessions were played but NOT CLOSED (via "Close Last Session")\n`;
            report += `3. Date format doesn't match (should be DD/MM/YYYY in session)\n\n`;
            report += `💡 To fix: Go to admin panel → Close Session → Close Last Session\n`;
        } else {
            const totalIncome = incomeSnapshot.size > 0 ?
                incomeSnapshot.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0) : 0;
            const totalExpenses = expensesSnapshot.size > 0 ?
                expensesSnapshot.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0) : 0;

            report += `Sessions found: ${sessionsSnapshot.size}\n`;
            report += `Income records: ${incomeSnapshot.size}\n`;
            report += `Expense records: ${expensesSnapshot.size}\n\n`;
            report += `Total Income: ${totalIncome} THB\n`;
            report += `Total Expenses: ${totalExpenses} THB\n`;
            report += `Profit: ${totalIncome - totalExpenses} THB\n`;
        }

        // Display in modal with copy button
        console.log(report);

        const modal = document.getElementById('debugReportModal');
        const content = document.getElementById('debugReportContent');

        content.textContent = report;
        modal.style.display = 'block';

    } catch (error) {
        console.error('❌ Debug error:', error);
        alert(`❌ Error: ${error.message}\n\nCheck console for details.`);
    }
}

/**
 * Copy debug report to clipboard
 */
async function copyDebugReport() {
    const content = document.getElementById('debugReportContent');
    const text = content.textContent;

    try {
        await navigator.clipboard.writeText(text);
        alert('✅ Report copied to clipboard!\n\nคัดลอกรายงานแล้ว!');
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        alert('❌ Failed to copy. Please try selecting and copying manually.');
    }
}

/**
 * Close debug report modal
 */
function closeDebugReport() {
    document.getElementById('debugReportModal').style.display = 'none';
}

/**
 * Calculate Next Week's Recommended Price
 * Shows what price per player is needed to reach 0 balance
 * Based on fixed assumptions: 3 sessions/week, 12 players each, 6 shuttlecocks each
 */
async function calculateNextWeekPrice() {
    console.log('💰 Calculating next week price recommendation...');

    try {
        // Fixed values for next week
        const SESSIONS_PER_WEEK = 3;  // Monday, Wednesday, Friday
        const PLAYERS_PER_SESSION = 12;
        const TOTAL_PLAYERS = SESSIONS_PER_WEEK * PLAYERS_PER_SESSION; // 36
        const SHUTTLECOCKS_PER_SESSION = 6;
        const COURTS_PER_SESSION = 2;
        const HOURS_PER_COURT = 2;

        // Get current prices from state (or use defaults)
        const shuttlecockPrice = 90; // THB per shuttlecock
        const courtPricePerHour = 220; // THB per hour per court

        // Calculate expenses per session
        const courtCostPerSession = COURTS_PER_SESSION * HOURS_PER_COURT * courtPricePerHour; // 2 × 2 × 220 = 880
        const shuttleCostPerSession = SHUTTLECOCKS_PER_SESSION * shuttlecockPrice; // 6 × 90 = 540
        const totalCostPerSession = courtCostPerSession + shuttleCostPerSession; // 1,420 THB

        // Calculate total weekly expenses
        const weeklyExpenses = totalCostPerSession * SESSIONS_PER_WEEK; // 1,420 × 3 = 4,260 THB

        // Breakeven price (balance = 0)
        const breakevenPrice = weeklyExpenses / TOTAL_PLAYERS; // 4,260 ÷ 36 = 118.33 THB

        // Get current balance from weeklyBalance/summary
        const summaryDoc = await weeklyBalanceRef.doc('summary').get();
        const currentBalance = summaryDoc.exists ? (summaryDoc.data().currentBalance || 0) : 0;

        // Calculate adjusted price to reach 0 balance
        const adjustedNeededIncome = weeklyExpenses - currentBalance;
        const adjustedPrice = adjustedNeededIncome / TOTAL_PLAYERS;

        // Calculate what the result would be
        const projectedIncome = adjustedPrice * TOTAL_PLAYERS;
        const projectedProfit = projectedIncome - weeklyExpenses;
        const projectedNewBalance = currentBalance + projectedProfit;

        // Build report
        let report = `💰 NEXT WEEK PRICE CALCULATOR\n`;
        report += `${'='.repeat(50)}\n\n`;

        report += `📊 CURRENT SITUATION:\n`;
        report += `   Current Balance: ${currentBalance.toFixed(2)} THB\n\n`;

        report += `📅 NEXT WEEK ASSUMPTIONS:\n`;
        report += `   Sessions: ${SESSIONS_PER_WEEK} (Mon, Wed, Fri)\n`;
        report += `   Players per session: ${PLAYERS_PER_SESSION}\n`;
        report += `   Total players: ${TOTAL_PLAYERS}\n\n`;

        report += `💸 ESTIMATED EXPENSES:\n`;
        report += `   Per session:\n`;
        report += `   - Courts: ${COURTS_PER_SESSION} courts × ${HOURS_PER_COURT} hours × ${courtPricePerHour} THB = ${courtCostPerSession} THB\n`;
        report += `   - Shuttlecocks: ${SHUTTLECOCKS_PER_SESSION} × ${shuttlecockPrice} THB = ${shuttleCostPerSession} THB\n`;
        report += `   - Total per session: ${totalCostPerSession} THB\n\n`;
        report += `   Weekly total: ${totalCostPerSession} × ${SESSIONS_PER_WEEK} = ${weeklyExpenses} THB\n\n`;

        report += `🎯 PRICE RECOMMENDATIONS:\n\n`;

        report += `   Breakeven price (balance stays at ${currentBalance} THB):\n`;
        report += `   💚 ${breakevenPrice.toFixed(2)} THB per player\n\n`;

        report += `   Adjusted price (to reach 0 balance):\n`;
        report += `   💙 ${adjustedPrice.toFixed(2)} THB per player\n\n`;

        report += `📈 PROJECTION (if using adjusted price):\n`;
        report += `   Income: ${adjustedPrice.toFixed(2)} × ${TOTAL_PLAYERS} = ${projectedIncome.toFixed(2)} THB\n`;
        report += `   Expenses: ${weeklyExpenses.toFixed(2)} THB\n`;
        report += `   Profit: ${projectedProfit.toFixed(2)} THB\n`;
        report += `   New Balance: ${currentBalance.toFixed(2)} + ${projectedProfit.toFixed(2)} = ${projectedNewBalance.toFixed(2)} THB\n\n`;

        report += `${'='.repeat(50)}\n`;
        report += `💡 NOTE: This is a calculation only.\n`;
        report += `No data has been updated.\n`;

        console.log(report);
        alert(report);

        return {
            currentBalance,
            weeklyExpenses,
            breakevenPrice,
            adjustedPrice,
            projectedNewBalance
        };

    } catch (error) {
        console.error('❌ Price calculation error:', error);
        alert(`❌ Error calculating price: ${error.message}\n\nCheck console for details.`);
    }
}

// ============================================
// LINE NOTIFICATIONS
// ============================================

/**
 * Send cancellation notification to Line
 * Smart logic: only mention available spot if no waiting list
 */
async function sendLineCancellationNotification(playerName) {
    try {
        // Check if there's a waiting list
        const hasWaitingList = state.players.length > state.maxPlayers;

        // Get Cloud Function reference
        const sendNotification = functions.httpsCallable('sendCancellationNotification');

        // Prepare notification data
        const notificationData = {
            playerName: playerName,
            currentPlayers: state.players.length,
            maxPlayers: state.maxPlayers,
            hasWaitingList: hasWaitingList,
            sessionDate: state.sessionDate,
            sessionDay: state.sessionDay,
            sessionTime: state.sessionTime,
            appUrl: window.location.href
        };

        console.log('📤 Sending Line cancellation notification...', notificationData);

        // Call Cloud Function
        const result = await sendNotification(notificationData);

        console.log('✅ Line notification sent:', result.data);
    } catch (error) {
        console.error('❌ Error sending Line notification:', error);
        // Don't block cancellation if notification fails
    }
}

// ============================================
// CANCEL REGISTRATION
// ============================================

async function cancelRegistration() {
    // Check maintenance mode
    if (state.maintenanceMode && !state.isAdmin) {
        alert('System is under maintenance. Please wait.\nระบบกำลังปรับปรุง กรุณารอสักครู่');
        return;
    }

    // Check if user is logged in
    if (!state.loggedInUser) {
        alert('Please log in first / กรุณาเข้าสู่ระบบก่อน');
        return;
    }

    const userName = state.loggedInUser.name;
    const userId = state.loggedInUser.userId;

    // Find the player
    const currentPlayer = state.players.find(p => p.name === userName);
    if (!currentPlayer) {
        alert('You are not registered / คุณไม่ได้ลงทะเบียน');
        return;
    }

    // Check if user has registered guests
    const userGuests = state.players.filter(p => p.guestOf === userId);
    const totalRefund = state.paymentAmount * (1 + userGuests.length);

    // Confirm cancellation with guest info
    let confirmMessage = `Cancel your registration? / ยกเลิกการลงทะเบียน?\n\n`;
    confirmMessage += `This will remove you from the player list and refund ${state.paymentAmount} THB.\n\n`;

    if (userGuests.length > 0) {
        confirmMessage += `⚠️ You have ${userGuests.length} guest(s) registered:\n`;
        userGuests.forEach(g => {
            const guestNameOnly = g.name.split(' friend: ')[1] || g.name.split(' venn: ')[1] || g.name.split(' + ')[1];
            confirmMessage += `  - ${guestNameOnly}\n`;
        });
        confirmMessage += `\nAll guests will also be cancelled.\n`;
        confirmMessage += `Total refund: ${totalRefund} THB\n\n`;
        confirmMessage += `รวมเงินคืน: ${totalRefund} บาท`;
    }

    if (!confirm(confirmMessage)) {
        return;
    }

    try {
        // Check if there are waiting list players (position > maxPlayers)
        const waitingListPlayers = state.players.filter(p => p.position > state.maxPlayers);
        const hasWaitingList = waitingListPlayers.length > 0;

        // Sort waiting list by position to get first person
        const nextPlayer = hasWaitingList ?
            waitingListPlayers.sort((a, b) => a.position - b.position)[0] : null;

        // Refund the payment amount for main player
        await updateUserBalance(
            userId,
            userName,
            state.paymentAmount,
            `Refund for cancelled registration ${state.sessionDate}`
        );

        // Delete player from Firestore
        await playersRef().doc(currentPlayer.id).delete();

        // Cancel and refund all guests
        if (userGuests.length > 0) {
            for (const guest of userGuests) {
                const guestNameOnly = guest.name.split(' friend: ')[1] || guest.name.split(' venn: ')[1] || guest.name.split(' + ')[1];

                // Refund guest payment
                await updateUserBalance(
                    userId,
                    userName,
                    state.paymentAmount,
                    `Refund for cancelled guest: ${guestNameOnly}`
                );

                // Delete guest from Firestore
                await playersRef().doc(guest.id).delete();

                console.log(`✅ Guest cancelled: ${guest.name}`);
            }
        }

        // Note: Waiting list player already paid at registration, no need to charge again
        if (nextPlayer) {
            console.log(`✅ Player moving up from waiting list: ${nextPlayer.name} (already paid at registration)`);
        }

        // Send Line notification (async, don't wait)
        sendLineCancellationNotification(userName);

        // Clear localStorage
        localStorage.removeItem('userName');

        // Hide success message and show registration form again
        document.getElementById('successMessage').style.display = 'none';
        document.getElementById('registrationForm').style.display = 'block';

        console.log('✅ Registration cancelled for:', userName);
        if (userGuests.length > 0) {
            console.log(`✅ ${userGuests.length} guest(s) also cancelled`);
        }
    } catch (error) {
        console.error('Error cancelling registration:', error);
        alert('Error cancelling. Please try again.');
    }
}

// ============================================
// PAYMENT MARKING (Self-Service Wallet Payment)
// ============================================

/**
 * Allow users to pay for their registration from their wallet
 * This is for players who were added by admin (paid: false)
 * and need to pay themselves instead of waiting for publish
 */
async function markAsPaid() {
    // DISABLED: All payments are now processed at publish time
    alert('⚠️ Payment function disabled.\n\nAll payments will be processed when admin publishes the session.\n\nฟังก์ชันชำระเงินถูกปิดใช้งาน\n\nการชำระเงินจะดำเนินการเมื่อผู้ดูแลเผยแพร่เซสชัน');
    return;

    // OLD CODE BELOW (disabled)
    // Check if user is logged in
    if (!state.loggedInUser) {
        alert('Please log in first / กรุณาเข้าสู่ระบบก่อน');
        return;
    }

    const userName = state.loggedInUser.name;
    const userId = state.loggedInUser.userId;
    const currentBalance = state.loggedInUser.balance || 0;

    // Find the player
    const currentPlayer = state.players.find(p => p.name === userName);
    if (!currentPlayer) {
        alert('You must be registered first / คุณต้องลงทะเบียนก่อน');
        return;
    }

    // Check if already paid
    if (currentPlayer.paid) {
        alert('Already paid / ชำระแล้ว');
        return;
    }

    // Check if sufficient balance
    if (currentBalance < state.paymentAmount) {
        alert(`Insufficient balance / ยอดเงินไม่เพียงพอ\n\nBalance: ${currentBalance} THB\nRequired: ${state.paymentAmount} THB\nShortfall: ${state.paymentAmount - currentBalance} THB\n\nPlease contact admin to top up your wallet.`);
        return;
    }

    // Confirm payment
    if (!confirm(`Pay ${state.paymentAmount} THB from your wallet?\nชำระ ${state.paymentAmount} บาทจากกระเป๋าเงิน?\n\nCurrent balance: ${currentBalance} THB\nNew balance: ${currentBalance - state.paymentAmount} THB`)) {
        return;
    }

    try {
        // Deduct from wallet
        const newBalance = currentBalance - state.paymentAmount;
        await usersRef.doc(userId).update({
            balance: newBalance
        });

        // Mark player as paid
        await playersRef().doc(currentPlayer.id).update({
            paid: true,
            paidAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Add transaction record
        await transactionsRef.add({
            userId: userId,
            userName: userName,
            type: 'payment',
            amount: -state.paymentAmount,
            balance: newBalance,
            reason: `Self-payment for ${state.sessionDay} ${state.sessionDate}`,
            sessionId: currentSessionId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update local state
        state.loggedInUser.balance = newBalance;
        localStorage.setItem('loggedInUser', JSON.stringify(state.loggedInUser));

        alert(`✅ Payment successful!\n\nยอดเงินใหม่: ${newBalance} THB`);

        // Refresh UI
        await checkLoggedInUser();
        updateUI();

        console.log('✅ Self-payment completed for:', userName);
    } catch (error) {
        console.error('Error processing payment:', error);
        alert('Error processing payment. Please try again.');
    }
}

// ============================================
// LOGGED IN USER CHECK
// ============================================

async function checkLoggedInUser() {
    const loggedInData = localStorage.getItem('loggedInUser');
    if (loggedInData) {
        state.loggedInUser = JSON.parse(loggedInData);

        // If userId or role is missing (old localStorage format), refresh from database
        if (!state.loggedInUser.userId || !state.loggedInUser.role) {
            console.log('⚠️ Outdated user data in localStorage, refreshing from database:', state.loggedInUser.name);
            const user = state.authorizedUsers.find(u => u.name === state.loggedInUser.name);
            if (user) {
                // Update with fresh data from database
                state.loggedInUser.userId = user.id;
                state.loggedInUser.balance = user.balance || 0;
                state.loggedInUser.role = user.role || 'user';
                state.loggedInUser.authToken = user.password; // Keep authToken for validation
                localStorage.setItem('loggedInUser', JSON.stringify(state.loggedInUser));
                console.log('✅ User data refreshed from database:', state.loggedInUser);
            } else {
                console.error('❌ User not found, clearing localStorage');
                localStorage.removeItem('loggedInUser');
                state.loggedInUser = null;
                return;
            }
        }

        // Validate authToken (UUID password) against database
        if (state.loggedInUser && state.loggedInUser.userId && state.loggedInUser.authToken) {
            try {
                const userDoc = await usersRef.doc(state.loggedInUser.userId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();

                    // Check if stored authToken matches current password in database
                    if (userData.password === state.loggedInUser.authToken) {
                        // Valid session - update balance and role
                        state.loggedInUser.balance = userData.balance || 0;
                        state.loggedInUser.role = userData.role || 'user';
                        localStorage.setItem('loggedInUser', JSON.stringify(state.loggedInUser));
                        console.log('✅ Auto-login successful for', state.loggedInUser.name);
                    } else {
                        // Password changed (admin reset) - force re-login
                        console.log('⚠️ Password changed, logging out', state.loggedInUser.name);
                        localStorage.removeItem('loggedInUser');
                        state.loggedInUser = null;
                    }
                } else {
                    // User deleted
                    console.log('⚠️ User deleted, logging out');
                    localStorage.removeItem('loggedInUser');
                    state.loggedInUser = null;
                }
            } catch (error) {
                console.error('Error validating session:', error);
            }
        } else if (state.loggedInUser && state.loggedInUser.userId) {
            // Old format without authToken - FORCE RE-LOGIN to upgrade to UUID system
            console.log('⚠️ Old session format detected - forcing re-login to upgrade to UUID system');
            localStorage.removeItem('loggedInUser');
            state.loggedInUser = null;
            alert('Security upgrade: Please log in again to activate secure auto-login.\n\nอัปเกรดความปลอดภัย: กรุณาเข้าสู่ระบบอีกครั้งเพื่อเปิดใช้งานการเข้าสู่ระบบอัตโนมัติที่ปลอดภัย');
        }
    }
}

// ============================================
// USER LOGOUT
// ============================================

function logoutUser() {
    state.loggedInUser = null;
    localStorage.removeItem('loggedInUser');
    updateUI();
    // No alert - just update UI
}

// ============================================
// PASSWORD RESET (Self-Service)
// ============================================

/**
 * Reset password to default (123) for users with UUID passwords
 * Logs reset in Firestore and sends Line notification
 */
async function resetPassword() {
    const name = document.getElementById('loginName').value.trim();

    if (!name) {
        alert('Please enter your name first / กรุณาใส่ชื่อก่อน');
        return;
    }

    // Find user (EXACT match only - "Gei" will NOT match "Geir")
    const user = state.authorizedUsers.find(u => u.name === name);

    if (!user) {
        alert('User not found / ไม่พบผู้ใช้');
        return;
    }

    // Check if user has UUID password (long password)
    if (user.password.length < 20) {
        alert('Your password is already simple. Please login normally.\nรหัสผ่านของคุณเป็นรหัสง่ายแล้ว กรุณาเข้าสู่ระบบตามปกติ');
        return;
    }

    // Confirm reset
    if (!confirm(`Reset password to default?\nรีเซ็ตรหัสผ่านเป็นค่าเริ่มต้น?\n\nUser: ${name}\n\nYou can login with default password after reset.\nคุณสามารถเข้าสู่ระบบด้วยรหัสเริ่มต้นหลังจากรีเซ็ต`)) {
        return;
    }

    try {
        const defaultPassword = '123'; // Hardcoded default password

        // Update password in database
        await usersRef.doc(user.id).update({
            password: defaultPassword
        });

        // Log password reset
        await passwordResetsRef.add({
            userId: user.id,
            userName: name,
            oldPassword: user.password.substring(0, 10) + '...', // Store partial for audit
            newPassword: defaultPassword,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            ipAddress: 'N/A' // Could add IP detection if needed
        });

        // Send Line notification
        try {
            const sendPasswordResetNotification = functions.httpsCallable('sendPasswordResetNotification');
            await sendPasswordResetNotification({
                userName: name,
                timestamp: new Date().toLocaleString('en-GB', {
                    timeZone: 'Asia/Bangkok',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })
            });
            console.log('✅ Line notification sent for password reset');
        } catch (error) {
            console.error('❌ Line notification failed:', error);
            // Don't block reset if Line fails
        }

        // Reload authorized users to get updated password
        await loadAuthorizedUsers();

        // Auto-login with new password
        console.log('🔐 Auto-logging in with new password...');
        try {
            await handleLogin({ preventDefault: () => {} }, name, defaultPassword);
            console.log('✅ Password reset and auto-login completed for:', name);

            alert(`✅ Password reset successful! You are now logged in.\n\nIMPORTANT: If you have issues, restart your browser and open the link again.\n\n✅ รีเซ็ตรหัสผ่านสำเร็จ! คุณเข้าสู่ระบบแล้ว\n\nสำคัญ: หากมีปัญหา ให้รีสตาร์ทเบราว์เซอร์และเปิดลิงก์ใหม่`);
        } catch (error) {
            console.error('Auto-login failed:', error);
            // If auto-login fails, show manual login message
            alert(`✅ Password reset successful!\n\nPlease restart your browser and open the link again.\n\n✅ รีเซ็ตรหัสผ่านสำเร็จ!\n\nกรุณารีสตาร์ทเบราว์เซอร์และเปิดลิงก์ใหม่`);
        }
    } catch (error) {
        console.error('Error resetting password:', error);
        alert('Error resetting password. Please try again or contact admin.');
    }
}

// ============================================
// USER LOGIN
// ============================================

async function handleLogin(e, nameParam = null, passwordParam = null) {
    e.preventDefault();

    const name = nameParam || document.getElementById('loginName').value.trim();
    const password = passwordParam || document.getElementById('loginPassword').value;

    console.log('🔍 Login attempt:', { name, passwordLength: password.length });

    // Check if user is authorized
    const authorizedUser = state.authorizedUsers.find(u => u.name === name && u.password === password);

    if (authorizedUser) {
        console.log('✅ User found:', { name, role: authorizedUser.role, passwordLength: password.length });

        // Show maintenance warning for non-admin users
        if (state.maintenanceMode && authorizedUser.role !== 'admin' && authorizedUser.role !== 'moderator') {
            alert('System is under maintenance. You can login but cannot register or cancel.\nระบบกำลังปรับปรุง คุณสามารถเข้าสู่ระบบได้ แต่ไม่สามารถลงทะเบียนหรือยกเลิกได้');
        }

        let permanentPassword = authorizedUser.password;

        // If password is short (< 5 chars), it's a temporary code - generate UUID
        if (password.length < 5) {
            console.log('🔐 Short password detected - generating UUID for', name);

            // Generate UUID (using crypto.randomUUID or fallback)
            permanentPassword = self.crypto?.randomUUID?.() ||
                'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    const r = Math.random() * 16 | 0;
                    const v = c == 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });

            console.log('🔑 Generated UUID, attempting to save to Firestore...');

            // Update user's password in database to UUID
            try {
                await usersRef.doc(authorizedUser.id).update({
                    password: permanentPassword
                });
                console.log('✅ UUID password saved for', name);
            } catch (error) {
                console.error('❌ Error saving UUID password:', error);
                alert('Error setting up secure password. Please try again.\n\nError: ' + error.message);
                return;
            }
        } else {
            console.log('✅ Using existing long password (>= 5 chars)');
        }

        console.log('💾 Saving to localStorage and state...');

        // Save login info with permanent password (UUID or existing long password)
        state.loggedInUser = {
            name: authorizedUser.name,
            balance: authorizedUser.balance || 0,
            userId: authorizedUser.id,
            authToken: permanentPassword, // Store UUID for auto-login
            role: authorizedUser.role || 'user' // user, moderator, or admin
        };
        localStorage.setItem('loggedInUser', JSON.stringify(state.loggedInUser));

        console.log('🔄 Calling updateUI()...');
        document.getElementById('loginForm').reset();
        updateUI();
        console.log('✅ Login complete!');
        // No alert - just go straight to the app
    } else {
        console.log('❌ User not found or wrong password');
        alert('Invalid name or password / ชื่อหรือรหัสผ่านไม่ถูกต้อง');
    }
}

// ============================================
// SUCCESS MESSAGE
// ============================================

function showSuccessMessage(player) {
    document.getElementById('registrationForm').style.display = 'none';
    document.getElementById('successMessage').style.display = 'block';

    // DISABLED: Payment is now handled via wallet system, no need for "I have paid" button
    // generatePaymentQR();
}

// DISABLED: Payment QR code - now using wallet system instead
/*
function generatePaymentQR() {
    const qrContainer = document.getElementById('qrCode');

    // Check if current user has already paid
    if (!state.loggedInUser) return;

    const userName = state.loggedInUser.name;
    const currentPlayer = state.players.find(p => p.name === userName);
    const hasPaid = currentPlayer && currentPlayer.paid;

    if (hasPaid) {
        // Already paid - show green button with "Paid ✓"
        qrContainer.innerHTML = `
            <div style="text-align: center;">
                <button style="padding: 12px 24px; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: not-allowed; font-weight: bold;" disabled>
                    Paid ✓<br>ชำระแล้ว ✓
                </button>
            </div>
        `;
    } else {
        // Not paid yet - show gray button with "I have paid"
        qrContainer.innerHTML = `
            <div style="text-align: center;">
                <button onclick="markAsPaid()" id="paymentButton" style="padding: 12px 24px; background: #6b7280; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: bold;">
                    I have paid<br>ฉันจ่ายแล้ว
                </button>
            </div>
        `;
    }
}
*/

// Get current player from localStorage
function getCurrentPlayer() {
    const name = localStorage.getItem('userName');
    if (name) {
        return state.players.find(p => p.name === name);
    }
    return null;
}

// ============================================
// UI UPDATE
// ============================================

function updateUI() {
    // Update login UI
    const userLoginEl = document.getElementById('userLogin');
    const loggedInInfoEl = document.getElementById('loggedInInfo');
    const logoutContainerEl = document.getElementById('logoutContainer');
    const cancelBtnEl = document.getElementById('cancelBtn');
    const registrationFormEl = document.getElementById('registrationForm');

    // If user is logged in - show who they are and hide login form
    if (state.loggedInUser) {
        userLoginEl.style.display = 'none';
        loggedInInfoEl.style.display = 'block';
        logoutContainerEl.style.display = 'block';
        document.getElementById('loggedInName').textContent = state.loggedInUser.name;

        // Update balance display
        const balanceEl = document.getElementById('userBalance');
        if (balanceEl) {
            const balance = state.loggedInUser.balance || 0;
            balanceEl.textContent = balance;

            // Add color indicator
            if (balance < state.paymentAmount) {
                balanceEl.style.color = '#ef4444'; // Red
            } else if (balance < state.paymentAmount * 3) {
                balanceEl.style.color = '#f59e0b'; // Orange
            } else {
                balanceEl.style.color = '#10b981'; // Green
            }
        }

        // Check if session is published
        if (!state.published) {
            // Session unpublished - show draft message for non-admin users
            const userRole = state.loggedInUser.role || 'user';
            if (userRole === 'user') {
                registrationFormEl.style.display = 'block';
                cancelBtnEl.style.display = 'none';
                document.getElementById('successMessage').style.display = 'none';

                const signupButton = document.querySelector('#signupForm button[type="submit"]');
                signupButton.disabled = true;
                signupButton.style.background = '#9ca3af';
                signupButton.style.cursor = 'not-allowed';
                signupButton.innerHTML = `⏳ Session Not Ready Yet<br>เซสชันยังไม่พร้อม`;

                // Hide guest registration when unpublished
                const guestBtnEl = document.getElementById('guestRegistrationBtn');
                if (guestBtnEl) {
                    guestBtnEl.style.display = 'none';
                }
            } else {
                // Admin/moderator: show draft banner (handled elsewhere)
                registrationFormEl.style.display = 'none';
                cancelBtnEl.style.display = 'none';

                // Hide guest registration for admin when unpublished
                const guestBtnEl = document.getElementById('guestRegistrationBtn');
                if (guestBtnEl) {
                    guestBtnEl.style.display = 'none';
                }
            }
        } else {
            // Session published - normal flow
            // Check if already registered this session
            const alreadyRegistered = state.players.find(p => p.name === state.loggedInUser.name);
            if (alreadyRegistered) {
                // User is registered - show success message and cancel button
                registrationFormEl.style.display = 'none';
                cancelBtnEl.style.display = 'block';
                showSuccessMessage(alreadyRegistered);

                // STILL show "Register Guest" button - users can register guests even after registering themselves
                const guestBtnEl = document.getElementById('guestRegistrationBtn');
                if (guestBtnEl) {
                    guestBtnEl.style.display = 'block';
                }
            } else {
                // User not registered yet - show join button, hide cancel button
                registrationFormEl.style.display = 'block';
                cancelBtnEl.style.display = 'none';
                document.getElementById('successMessage').style.display = 'none';

                // Hide name input field and update button text
                const nameInput = document.getElementById('playerName');
                const signupButton = document.querySelector('#signupForm button[type="submit"]');
                nameInput.style.display = 'none';
                nameInput.removeAttribute('required'); // Remove required when hidden!

                // Check if user has enough balance
                const userBalance = state.loggedInUser.balance || 0;
                if (userBalance < state.paymentAmount) {
                    // Insufficient balance - gray button with warning
                    signupButton.disabled = true;
                    signupButton.style.background = '#9ca3af';
                    signupButton.style.cursor = 'not-allowed';
                    signupButton.innerHTML = `Insufficient Balance<br>ยอดเงินไม่เพียงพอ<br><small style="font-size: 12px;">Balance: ${userBalance} THB (Need: ${state.paymentAmount} THB)</small>`;
                } else {
                    // Sufficient balance - green button
                    signupButton.disabled = false;
                    signupButton.style.background = '#10b981';
                    signupButton.style.cursor = 'pointer';
                    signupButton.innerHTML = `Join as ${state.loggedInUser.name}<br>ลงทะเบียน`;
                }

                // Show "Register Guest" button only if user is logged in and not registered
                const guestBtnEl = document.getElementById('guestRegistrationBtn');
                if (guestBtnEl) {
                    guestBtnEl.style.display = 'block';
                }
            }
        }
    } else {
        // Not logged in - show login form, hide logged-in info and registration form
        userLoginEl.style.display = 'block';
        loggedInInfoEl.style.display = 'none';
        logoutContainerEl.style.display = 'none';
        registrationFormEl.style.display = 'none';

        // Hide guest registration when not logged in
        const guestBtnEl = document.getElementById('guestRegistrationBtn');
        if (guestBtnEl) {
            guestBtnEl.style.display = 'none';
        }

        // Reset name input and button (in case it was changed)
        const nameInput = document.getElementById('playerName');
        const signupButton = document.querySelector('#signupForm button[type="submit"]');
        if (nameInput) {
            nameInput.style.display = 'block';
            nameInput.setAttribute('required', ''); // Add required back when visible!
        }
        if (signupButton) signupButton.innerHTML = 'Join<br>เข้าร่วม';
    }

    // Show/hide maintenance banner (visible to everyone when active)
    const maintenanceBanner = document.getElementById('maintenanceBanner');
    if (maintenanceBanner) {
        maintenanceBanner.style.display = state.maintenanceMode ? 'block' : 'none';
    }

    // Show/hide draft banner for admin/moderator
    const draftBanner = document.getElementById('draftBanner');
    if (draftBanner && state.loggedInUser) {
        const userRole = state.loggedInUser.role || 'user';
        const isAdminOrModerator = (userRole === 'admin' || userRole === 'moderator');
        draftBanner.style.display = (!state.published && isAdminOrModerator) ? 'block' : 'none';
    } else if (draftBanner) {
        draftBanner.style.display = 'none';
    }

    // Update maintenance mode button text in admin panel
    const maintenanceModeBtn = document.getElementById('maintenanceModeBtn');
    if (maintenanceModeBtn) {
        if (state.maintenanceMode) {
            maintenanceModeBtn.style.background = '#10b981'; // Green when active
            maintenanceModeBtn.innerHTML = '✅ Disable Maintenance Mode / ปิดโหมดซ่อมบำรุง';
        } else {
            maintenanceModeBtn.style.background = '#ef4444'; // Red when inactive
            maintenanceModeBtn.innerHTML = '🔧 Enable Maintenance Mode / เปิดโหมดซ่อมบำรุง';
        }
    }

    // HIDE session details and players for ALL users when session is ARCHIVED
    const sessionDetailsEl = document.querySelector('.session-details');
    const playersListContainerEl = document.querySelector('.players-list');

    if (state.closed) {
        // Session is ARCHIVED - hide everything for ALL users (including admin)
        if (sessionDetailsEl) sessionDetailsEl.style.display = 'none';
        if (playersListContainerEl) playersListContainerEl.style.display = 'none';

        // Hide registration form and guest button
        if (registrationFormEl) registrationFormEl.style.display = 'none';
        const guestBtnEl = document.getElementById('guestRegistrationBtn');
        if (guestBtnEl) guestBtnEl.style.display = 'none';

        // Show "Next session not ready" message instead of "You are registered"
        const successMessage = document.getElementById('successMessage');
        if (successMessage && state.loggedInUser) {
            successMessage.style.display = 'block';
            successMessage.innerHTML = `
                <h2 style="margin-top: 0; color: #f59e0b;">⏳ Next session is not ready yet</h2>
                <h2 style="margin-top: 0; color: #f59e0b;">เซสชันถัดไปยังไม่พร้อม</h2>
                <p style="color: #666; margin-top: 15px;">The previous session has been closed. Please wait for the admin to create a new session.</p>
                <p style="color: #666;">เซสชันก่อนหน้าถูกปิดแล้ว กรุณารอแอดมินสร้างเซสชันใหม่</p>
            `;
        }

        console.log('🔒 Session is ARCHIVED - showing "not ready" message');
        return; // Stop updateUI early - no need to update hidden elements
    } else {
        // Show session details and players list (normal flow)
        if (sessionDetailsEl) sessionDetailsEl.style.display = 'block';
        if (playersListContainerEl && state.loggedInUser) playersListContainerEl.style.display = 'block';
    }

    // Update session info
    document.getElementById('sessionDay').textContent = state.sessionDay;
    document.getElementById('sessionTime').textContent = state.sessionTime;
    document.getElementById('currentPlayers').textContent = Math.min(state.players.length, state.maxPlayers);
    document.getElementById('maxPlayers').textContent = state.maxPlayers;

    // Update shuttlecocks display (only show if > 0)
    const shuttlecocksEl = document.getElementById('sessionShuttlecocks');
    const shuttlecocksCount = state.shuttlecocksUsed || 0;
    if (shuttlecocksCount > 0) {
        const cost = shuttlecocksCount * 90;
        document.getElementById('shuttlecocksCount').textContent = shuttlecocksCount;
        document.getElementById('shuttlecocksCost').textContent = cost;
        shuttlecocksEl.style.display = 'block';
    } else {
        shuttlecocksEl.style.display = 'none';
    }

    // Update payment amount display
    const paymentAmountElement = document.getElementById('paymentAmount');
    if (paymentAmountElement) {
        paymentAmountElement.textContent = state.paymentAmount;
    }

    // Update players list
    const playersList = document.getElementById('playersList');
    const waitingList = document.getElementById('waitingList');
    const playersListContainer = document.querySelector('.players-list');

    // Hide player list if user is not logged in
    if (!state.loggedInUser) {
        if (playersListContainer) {
            playersListContainer.style.display = 'none';
        }
        return; // Exit early, don't render player list
    } else {
        if (playersListContainer) {
            playersListContainer.style.display = 'block';
        }
    }

    playersList.innerHTML = '';
    waitingList.innerHTML = '';

    state.players.forEach((player, index) => {
        const li = document.createElement('li');
        const playerInfo = document.createElement('div');
        playerInfo.className = 'player-info';

        // Add guest icon if this is a guest player
        if (player.isGuest) {
            // Extract guest name and host name from "HostName friend: GuestName" format
            let guestDisplayName = player.name;
            let hostDisplayName = player.guestOfName;

            const parts = player.name.split(' friend: ');
            if (parts.length === 2) {
                guestDisplayName = parts[1]; // GuestName
                hostDisplayName = parts[0];   // HostName
            } else {
                // Fallback for old formats
                const oldParts = player.name.split(' venn: ');
                if (oldParts.length === 2) {
                    guestDisplayName = oldParts[1];
                    hostDisplayName = oldParts[0];
                } else {
                    const legacyParts = player.name.split(' + ');
                    if (legacyParts.length === 2) {
                        guestDisplayName = legacyParts[1];
                        hostDisplayName = legacyParts[0];
                    }
                }
            }

            playerInfo.textContent = `${index + 1}. ${guestDisplayName} 👤 (${hostDisplayName})`;
            playerInfo.title = `Guest of ${hostDisplayName} / แขกของ ${hostDisplayName}`;
        } else {
            playerInfo.textContent = `${index + 1}. ${player.name}`;
        }

        const statusDiv = document.createElement('div');
        statusDiv.className = 'player-status';

        if (player.paid) {
            const badge = document.createElement('span');
            badge.className = 'paid-badge';
            badge.textContent = 'Paid ✓';
            statusDiv.appendChild(badge);
        }
        // REMOVED: "Pay Now" button - all payments processed at publish time

        if (player.clickedPaymentLink) {
            const clickBadge = document.createElement('span');
            clickBadge.className = 'clicked-badge';
            clickBadge.textContent = '💳';
            clickBadge.title = 'Clicked payment link / คลิกลิงก์ชำระเงินแล้ว';
            statusDiv.appendChild(clickBadge);
        }

        li.appendChild(playerInfo);
        li.appendChild(statusDiv);

        if (index < state.maxPlayers) {
            playersList.appendChild(li);
        } else {
            waitingList.appendChild(li);
        }
    });

    // Show/hide admin button based on user role
    const adminBtn = document.querySelector('.admin-btn');
    if (adminBtn && state.loggedInUser) {
        const userRole = state.loggedInUser.role || 'user';
        adminBtn.style.display = (userRole === 'moderator' || userRole === 'admin') ? 'block' : 'none';
    } else if (adminBtn) {
        adminBtn.style.display = 'none';
    }

    // Update admin payment list
    if (state.isAdmin) {
        updatePaymentList();
    }

    // Hide/show admin buttons based on published status
    updateAdminButtonVisibility();
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

/**
 * Update visibility/styling of admin buttons based on published status
 * Prevents dangerous actions when session is published
 */
// ============================================
// ADMIN STATUS & GROUP MANAGEMENT
// ============================================

let currentAdminGroup = null; // Track selected group

/**
 * Get current app status based on state
 * @returns {string} 'maintenance' | 'closed' | 'open' | 'archived'
 */
function getAppStatus() {
    console.log('🔍 getAppStatus check:', {
        maintenanceMode: state.maintenanceMode,
        published: state.published,
        closed: state.closed,
        isSessionLoaded: state.isSessionLoaded
    });

    if (state.maintenanceMode) return 'maintenance';
    if (state.closed) return 'archived'; // Session is archived/finished
    if (!state.published) return 'closed'; // Session not published yet
    return 'open';
}

/**
 * Update status indicator in admin panel
 */
function updateAdminStatusIndicator() {
    const indicator = document.getElementById('adminStatusIndicator');
    const statusText = document.getElementById('statusText');

    if (!indicator || !statusText) {
        console.error('❌ Status indicator elements not found!');
        return;
    }

    // Show indicator when admin panel is open
    indicator.style.display = 'block';

    const status = getAppStatus();
    console.log('📊 Current app status:', status, '(maintenance:', state.maintenanceMode, 'published:', state.published, 'closed:', state.closed, ')');

    switch (status) {
        case 'maintenance':
            indicator.style.background = '#fee2e2';
            indicator.style.border = '2px solid #ef4444';
            indicator.style.color = '#991b1b';
            statusText.textContent = '🔧 MAINT';
            break;
        case 'archived':
            indicator.style.background = '#e0e7ff';
            indicator.style.border = '2px solid #6366f1';
            indicator.style.color = '#3730a3';
            statusText.textContent = '📦 ARCHIVED';
            break;
        case 'closed':
            indicator.style.background = '#fef3c7';
            indicator.style.border = '2px solid #f59e0b';
            indicator.style.color = '#92400e';
            statusText.textContent = '❌ CLOSED';
            break;
        case 'open':
            indicator.style.background = '#d1fae5';
            indicator.style.border = '2px solid #10b981';
            indicator.style.color = '#065f46';
            statusText.textContent = '✅ OPEN';
            break;
    }
}

/**
 * Get which groups should be visible based on app status
 * @param {string} status - 'maintenance' | 'archived' | 'closed' | 'open'
 * @returns {string[]} Array of group names
 */
function getVisibleGroups(status) {
    switch (status) {
        case 'maintenance':
            return ['users', 'settings'];
        case 'archived':
            return ['money', 'settings']; // Archived: Only view reports and settings (no modifications)
        case 'closed':
            return ['setup', 'users', 'money', 'settings'];
        case 'open':
            return ['setup', 'close', 'users', 'money', 'line', 'settings'];
        default:
            return [];
    }
}

/**
 * Update which group tabs are visible based on status
 */
function updateAdminGroupTabs() {
    const status = getAppStatus();
    const visibleGroups = getVisibleGroups(status);

    console.log('🔄 Updating group tabs for status:', status, 'Visible groups:', visibleGroups);

    const tabs = document.querySelectorAll('.group-tab');
    console.log('📌 Found', tabs.length, 'group tabs');

    tabs.forEach(tab => {
        const group = tab.getAttribute('data-group');
        if (visibleGroups.includes(group)) {
            tab.style.display = 'inline-block';
        } else {
            tab.style.display = 'none';
        }
    });

    // Auto-select first visible group if current group is now hidden
    if (!visibleGroups.includes(currentAdminGroup)) {
        console.log('🎯 Auto-selecting first visible group:', visibleGroups[0]);
        selectAdminGroup(visibleGroups[0]);
    }
}

/**
 * Define all action buttons for each group
 */
const adminGroupButtons = {
    setup: [
        { label: 'New', onclick: 'clearSession()', bg: '#ef4444', color: 'white' },
        { label: 'Edit', onclick: 'changeSessionDetails()', bg: '#f59e0b' },
        { label: 'Pay Amt', onclick: 'changePaymentAmount()', bg: '#f59e0b' },
        { label: 'Max Pl', onclick: 'changeMaxPlayers()', bg: '#f59e0b' },
        { label: 'Regular', onclick: 'manageRegularPlayers()', bg: '#f59e0b' },
        { label: 'Today', onclick: 'manageTodaysPlayers()', bg: '#8b5cf6', color: 'white' },
        { label: 'Preview', onclick: 'previewSession()', bg: '#3b82f6', color: 'white' },
        { label: 'Publish', onclick: 'publishSession()', bg: '#10b981', color: 'white', bold: true }
    ],
    close: [
        { label: 'Refund', onclick: 'refundWaitingList()', bg: '#f59e0b' },
        { label: 'Shuttle', onclick: 'registerShuttlecocks()', bg: '#ec4899', color: 'white' },
        { label: 'Close', onclick: 'closeLastSession()', bg: '#6366f1', color: 'white', bold: true }
    ],
    users: [
        { label: 'Users', onclick: 'manageAuthorizedUsers()', bg: '#3b82f6', color: 'white' },
        { label: 'Wallets', onclick: 'manageWallets()', bg: '#10b981', color: 'white' },
        { label: 'Payment', onclick: 'togglePaymentStatus()', bg: '#8b5cf6', color: 'white' },
        { label: 'Remove', onclick: 'removePlayerFromSession()', bg: '#ef4444', color: 'white' }
    ],
    money: [
        { label: 'Trans', onclick: 'viewTransactions()', bg: '#3b82f6', color: 'white' },
        { label: 'Report', onclick: 'viewAccountingReport()', bg: '#8b5cf6', color: 'white', bold: true },
        { label: 'Weekly', onclick: 'generateWeeklyReport()', bg: '#10b981', color: 'white', bold: true },
        { label: 'Debug', onclick: 'debugViewRawData()', bg: '#f59e0b' },
        { label: 'Expense', onclick: 'addManualExpense()', bg: '#ef4444', color: 'white' }
    ],
    line: [
        { label: 'Config', onclick: 'testLineConfig()', bg: '#8b5cf6', color: 'white' },
        { label: 'Demo', onclick: 'testDemoLine()', bg: '#10b981', color: 'white' },
        { label: 'Test', onclick: 'testLineMessage()', bg: '#22c55e', color: 'white' },
        { label: 'Announce', onclick: 'testSessionAnnouncement()', bg: '#3b82f6', color: 'white' },
        { label: 'Cancel', onclick: 'testCancellationNotification()', bg: '#ef4444', color: 'white' },
        { label: 'Nudge', onclick: 'testNudgeNotification()', bg: '#f97316', color: 'white' },
        { label: 'Reset', onclick: 'testPasswordResetNotification()', bg: '#ec4899', color: 'white' },
        { label: 'Extra', onclick: 'sendExtraCourtMessage()', bg: '#10b981', color: 'white', bold: true }
    ],
    settings: [
        { label: 'New', onclick: 'clearSession()', bg: '#10b981', color: 'white', bold: true },
        { label: 'Maint', onclick: 'toggleMaintenanceMode()', bg: '#ef4444', color: 'white', bold: true },
        { label: 'Export', onclick: 'exportList()', bg: '#3b82f6', color: 'white' }
    ]
};

/**
 * Select and display buttons for a group
 * @param {string} groupName - Name of group to select
 */
function selectAdminGroup(groupName) {
    currentAdminGroup = groupName;

    // Update tab styling
    const tabs = document.querySelectorAll('.group-tab');
    tabs.forEach(tab => {
        const isSelected = tab.getAttribute('data-group') === groupName;
        if (isSelected) {
            tab.style.background = '#10b981';
            tab.style.color = 'white';
            tab.style.borderColor = '#10b981';
            tab.style.fontWeight = 'bold';
        } else {
            tab.style.background = '#f3f4f6';
            tab.style.color = '#374151';
            tab.style.borderColor = '#e5e7eb';
            tab.style.fontWeight = 'normal';
        }
    });

    // Render buttons for selected group
    renderAdminActionButtons(groupName);
}

/**
 * Render action buttons for the selected group
 * @param {string} groupName - Name of group
 */
function renderAdminActionButtons(groupName) {
    const container = document.getElementById('adminActionButtons');
    if (!container) return;

    const buttons = adminGroupButtons[groupName] || [];

    container.innerHTML = buttons.map(btn => {
        const style = `
            width: auto !important;
            flex: 0 0 auto;
            padding: 10px 12px;
            font-size: 12px;
            border: none;
            border-radius: 6px;
            background: ${btn.bg || '#f3f4f6'};
            color: ${btn.color || '#374151'};
            cursor: pointer;
            white-space: nowrap;
            font-weight: ${btn.bold ? 'bold' : 'normal'};
        `;
        return `<button onclick="${btn.onclick}" style="${style}">${btn.label}</button>`;
    }).join('');

    // Hide payment status when switching groups
    const paymentSection = document.getElementById('paymentStatusSection');
    if (paymentSection) {
        paymentSection.style.display = 'none';
    }
}

/**
 * Toggle payment status visibility (called by Payment button in Users group)
 */
function togglePaymentStatus() {
    const paymentSection = document.getElementById('paymentStatusSection');
    if (paymentSection) {
        if (paymentSection.style.display === 'none') {
            paymentSection.style.display = 'block';
            updatePaymentList(); // Refresh payment list
        } else {
            paymentSection.style.display = 'none';
        }
    }
}

function updateAdminButtonVisibility() {
    const adminActions = document.getElementById('adminActions');
    if (!adminActions || adminActions.style.display === 'none') {
        return; // Admin panel not open
    }

    // Update status indicator
    updateAdminStatusIndicator();

    // Update which group tabs are visible
    updateAdminGroupTabs();

    // If no group selected yet, select first visible group
    if (!currentAdminGroup) {
        const status = getAppStatus();
        const visibleGroups = getVisibleGroups(status);
        if (visibleGroups.length > 0) {
            selectAdminGroup(visibleGroups[0]);
        }
    }
}

function toggleAdmin() {
    const panel = document.getElementById('adminPanel');
    const newDisplay = panel.style.display === 'none' ? 'block' : 'none';
    panel.style.display = newDisplay;

    // If opening panel, update button visibility
    if (newDisplay === 'block') {
        // Update admin button visibility based on published status
        updateAdminButtonVisibility();

        // If user is moderator, show moderator actions directly
        if (state.loggedInUser && state.loggedInUser.role === 'moderator') {
            document.getElementById('adminPassword').style.display = 'none';
            document.querySelector('.admin-controls button[onclick="loginAdmin()"]').style.display = 'none';
            showModeratorActions();
        }
    }
}

function showModeratorActions() {
    const actionsDiv = document.getElementById('adminActions');
    actionsDiv.style.display = 'block';

    // Hide admin-only buttons for moderators
    const adminOnlyButtons = [
        'clearSession()',
        'changeSessionDetails()',
        'changePaymentAmount()',
        'changeMaxPlayers()',
        'manageRegularPlayers()',
        'manageAuthorizedUsers()',
        'initializeAllBalances()'
    ];

    const allButtons = actionsDiv.querySelectorAll('button');
    allButtons.forEach(button => {
        const onclick = button.getAttribute('onclick');
        if (onclick) {
            const isAdminOnly = adminOnlyButtons.some(func => onclick.includes(func));
            button.style.display = isAdminOnly ? 'none' : 'block';
        }
    });

    // Update button visibility based on published status
    updateAdminButtonVisibility();

    updatePaymentList();
}

function loginAdmin() {
    const password = document.getElementById('adminPassword').value;
    if (password === 'SikkertPassord1955') {
        state.isAdmin = true;
        document.getElementById('adminPassword').style.display = 'none';
        event.target.style.display = 'none';

        const actionsDiv = document.getElementById('adminActions');
        actionsDiv.style.display = 'block';

        // Show ALL buttons for admin (reset any moderator hiding)
        const allButtons = actionsDiv.querySelectorAll('button');
        allButtons.forEach(button => {
            button.style.display = 'block';
        });

        // Update button visibility based on published status
        updateAdminButtonVisibility();

        updatePaymentList();
    } else {
        alert('Wrong password / รหัสผ่านไม่ถูกต้อง');
    }
}

// ============================================
// MAINTENANCE MODE
// ============================================

async function toggleMaintenanceMode() {
    const newMode = !state.maintenanceMode;
    const modeText = newMode ? 'ENABLE' : 'DISABLE';
    const modeTextThai = newMode ? 'เปิดใช้งาน' : 'ปิดใช้งาน';

    if (!confirm(`${modeText} Maintenance Mode?\n${modeTextThai}โหมดซ่อมบำรุง?\n\n${newMode ? 'Users will not be able to register or cancel.\nผู้ใช้จะไม่สามารถลงทะเบียนหรือยกเลิกได้' : 'Users will be able to register and cancel normally.\nผู้ใช้จะสามารถลงทะเบียนและยกเลิกได้ตามปกติ'}`)) {
        return;
    }

    try {
        state.maintenanceMode = newMode;
        await saveSessionData();
        console.log(`🔧 Maintenance mode ${newMode ? 'enabled' : 'disabled'}`);
        updateUI();
    } catch (error) {
        console.error('Error toggling maintenance mode:', error);
        alert('Error updating maintenance mode. Please try again.');
    }
}

// Track which setup steps are completed
function markStepCompleted(stepName) {
    // Mark button as completed (grey)
    const buttons = document.querySelectorAll('.admin-group-content button');
    buttons.forEach(btn => {
        if (btn.textContent.includes(stepName)) {
            btn.style.background = '#9ca3af'; // Grey
            btn.style.color = 'white';
        }
    });
}

function resetSetupSteps() {
    // Reset all NEW SESSION buttons to original colors
    const newSessionButtons = document.querySelector('.admin-group[open] .admin-group-content');
    if (newSessionButtons) {
        const buttons = newSessionButtons.querySelectorAll('button');
        buttons.forEach((btn, index) => {
            // Reset to original colors based on button type
            if (index === 0) {
                // New Session - red
                btn.style.background = '#ef4444';
                btn.style.color = 'white';
            } else if (index >= 1 && index <= 5) {
                // Edit, Payment, Max, Regular, Today's - orange
                btn.style.background = '#f59e0b';
                btn.style.color = '';
            } else if (index === 6) {
                // Preview - blue
                btn.style.background = '#3b82f6';
                btn.style.color = 'white';
            } else if (index === 7) {
                // Publish - green
                btn.style.background = '#10b981';
                btn.style.color = 'white';
            }
        });
    }
}

async function clearSession() {
    // Reset setup step tracking
    resetSetupSteps();

    try {
        // Check if current session is closed
        const sessionDoc = await currentSessionRef().get();
        if (sessionDoc.exists) {
            const sessionData = sessionDoc.data();

            // Only warn if session is PUBLISHED and not closed
            // Draft sessions can be safely overwritten
            if (!sessionData.closed && sessionData.published) {
                const continueAnyway = confirm(
                    '⚠️ WARNING / คำเตือน\n\n' +
                    'Current session is PUBLISHED but not closed yet.\n' +
                    'เซสชันปัจจุบันถูกเผยแพร่แล้วแต่ยังไม่ได้ปิด\n\n' +
                    'This may lose financial data!\n' +
                    'อาจทำให้สูญเสียข้อมูลการเงิน!\n\n' +
                    '💡 Recommended: Close session first with "Close Last Session"\n' +
                    '💡 แนะนำ: ปิดเซสชันก่อนด้วย "Close Last Session"\n\n' +
                    'Continue anyway? / ดำเนินการต่อหรือไม่?'
                );

                if (!continueAnyway) {
                    return; // User cancelled
                }
            }
            // If session is draft (unpublished), we can safely continue without warning
        }
    } catch (error) {
        console.error('Error checking session status:', error);
        // Continue even if check fails (backward compatibility)
    }

    // FIRST confirmation
    const firstConfirm = confirm(
        '⚠️ Are you sure you want to start a NEW session?\n\n' +
        'This will DELETE all current players!\n\n' +
        '⚠️ แน่ใจหรือว่าต้องการเริ่มเซสชันใหม่?\n' +
        'จะลบผู้เล่นทั้งหมด!'
    );

    if (!firstConfirm) {
        return; // User cancelled
    }

    // SECOND confirmation (extra safety)
    const secondConfirm = confirm(
        '🚨 FINAL WARNING!\n\n' +
        'This action CANNOT be undone!\n' +
        'All ' + state.players.length + ' players will be DELETED.\n\n' +
        'Delete all players and start fresh?\n\n' +
        '🚨 คำเตือนสุดท้าย!\n' +
        'ไม่สามารถย้อนกลับได้!\n' +
        'ลบผู้เล่นทั้งหมด ' + state.players.length + ' คนและเริ่มใหม่?'
    );

    if (secondConfirm) {
        try {
            // Delete all players from current session
            const snapshot = await playersRef().get();
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            // Update session date and UNPUBLISH - Set to day 8 (Not Set)
            state.sessionDate = new Date().toLocaleDateString('en-GB');
            state.sessionDay = 'Not Set / ไม่ได้กำหนด'; // Day 8
            state.sessionTime = '10:00 - 12:00'; // Default time (most common)
            state.maxPlayers = 12; // Keep default 12 (show 0 / 12)
            state.published = false; // Set to draft mode
            state.closed = false; // Mark as open (not closed)
            state.shuttlecocksUsed = 0; // Reset shuttlecocks count
            await saveSessionData();

            // Remove old userName (deprecated)
            localStorage.removeItem('userName');

            // Update UI to show draft mode
            updateUI();

            // Players will be automatically updated via real-time listener
            // No need to reload - admin stays logged in

            console.log('✅ Session cleared and set to DRAFT mode');
            alert('✅ Session cleared!\n\nSession is now in DRAFT mode (not visible to users).\n\nNEXT: Click "Edit Session" to set day/time!');

            // Mark step 1 as completed
            markStepCompleted('New Session');
        } catch (error) {
            console.error('Error clearing session:', error);
            alert('Error clearing session. Please try again.');
        }
    }
}

/**
 * Preview Session - Show summary before publishing
 * - Shows all players on the list
 * - Shows regular players who were skipped due to low balance
 * - Shows total payment amount
 */
async function previewSession() {
    try {
        const days = [
            'Monday / วันจันทร์',
            'Tuesday / วันอังคาร',
            'Wednesday / วันพุธ',
            'Thursday / พฤหัสบดี',
            'Friday / วันศุกร์',
            'Saturday / วันเสาร์',
            'Sunday / อาทิตย์'
        ];
        const currentDayIndex = days.findIndex(d => d === state.sessionDay);
        const dayNumber = currentDayIndex + 1;

        // Get regular players for this day
        const regularPlayersForToday = await getRegularPlayersForDay(dayNumber);

        // IMPORTANT: Get FRESH player data from Firestore (not from state which might be stale)
        const playersSnapshot = await playersRef().get();
        const currentPlayers = [];
        playersSnapshot.forEach(doc => {
            currentPlayers.push({ id: doc.id, ...doc.data() });
        });
        // Sort by position
        currentPlayers.sort((a, b) => a.position - b.position);

        // Count players and check their balances
        const totalPlayers = currentPlayers.length;
        const unpaidPlayers = currentPlayers.filter(p => !p.paid);

        // Check which unpaid players will be charged vs removed
        const playersToCharge = [];
        const playersToRemove = [];

        for (const player of unpaidPlayers) {
            if (player.userId) {
                const user = state.authorizedUsers.find(u => u.id === player.userId);
                if (user) {
                    const balance = user.balance || 0;
                    if (balance >= state.paymentAmount) {
                        playersToCharge.push({name: player.name, balance: balance});
                    } else {
                        playersToRemove.push({name: player.name, balance: balance});
                    }
                }
            }
        }

        const totalDeduction = playersToCharge.length * state.paymentAmount;

        // Find regular players who are NOT on the list (potential low balance issue)
        const missingRegularPlayers = [];
        for (const playerName of regularPlayersForToday) {
            const isOnList = currentPlayers.some(p => p.name === playerName);
            if (!isOnList) {
                // Check their balance
                const user = state.authorizedUsers.find(u => u.name === playerName);
                if (user) {
                    const balance = user.balance || 0;
                    missingRegularPlayers.push({
                        name: playerName,
                        balance: balance,
                        insufficient: balance < state.paymentAmount
                    });
                }
            }
        }

        // Build preview message
        let message = `📋 SESSION PREVIEW / ตรวจสอบเซสชัน\n\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `📅 ${state.sessionDay}\n`;
        message += `📆 ${state.sessionDate}\n`;
        message += `🕐 ${state.sessionTime}\n`;
        message += `💰 ${state.paymentAmount} THB per player\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

        // List all players
        message += `👥 PLAYERS (${totalPlayers}):\n\n`;
        currentPlayers.forEach((player, index) => {
            const paidStatus = player.paid ? '✅' : '❌';
            message += `${index + 1}. ${player.name} ${paidStatus}\n`;
        });

        // Summary
        message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
        message += `💰 SUMMARY:\n`;
        message += `- Total players: ${totalPlayers}\n`;
        message += `- ✅ Will be charged: ${playersToCharge.length} players\n`;
        if (playersToRemove.length > 0) {
            message += `- ❌ Will be REMOVED: ${playersToRemove.length} players (insufficient balance)\n`;
            playersToRemove.forEach(p => {
                message += `    • ${p.name} (has ${p.balance} THB, needs ${state.paymentAmount} THB)\n`;
            });
        }
        message += `- Total deduction: ${totalDeduction} THB\n`;

        // Show missing regular players (especially those with low balance)
        const insufficientBalance = missingRegularPlayers.filter(p => p.insufficient);
        if (insufficientBalance.length > 0) {
            message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
            message += `⚠️ MISSING REGULAR PLAYERS (Low Balance):\n`;
            message += `ผู้เล่นประจำที่ขาดหายไป (ยอดเงินต่ำ):\n\n`;
            insufficientBalance.forEach(p => {
                message += `- ${p.name}: ${p.balance} THB (needs ${state.paymentAmount} THB)\n`;
            });
            message += `\n💡 These players were NOT added due to insufficient balance.\n`;
            message += `💡 ผู้เล่นเหล่านี้ไม่ถูกเพิ่มเนื่องจากยอดเงินไม่เพียงพอ\n`;
        }

        message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
        message += `\nReady to publish? / พร้อมเผยแพร่?\n`;
        message += `Click "Publish Session" to proceed!\n`;
        message += `คลิก "Publish Session" เพื่อดำเนินการ!`;

        // Display in scrollable modal instead of alert
        document.getElementById('previewSessionContent').textContent = message;
        document.getElementById('previewSessionModal').style.display = 'flex';

        // Mark step 7 as completed
        markStepCompleted('Preview Session');

    } catch (error) {
        console.error('❌ Error previewing session:', error);
        alert(`❌ Error: ${error.message}`);
    }
}

/**
 * Close preview session modal
 */
function closePreviewSession() {
    document.getElementById('previewSessionModal').style.display = 'none';
}

async function publishSession() {
    const unpaidPlayers = state.players.filter(p => !p.paid);

    let confirmMessage = 'Publish this session?\n\nเผยแพร่เซสชัน?\n\n';
    confirmMessage += `Current players: ${state.players.length}\n`;
    confirmMessage += `All players have already paid at registration.\n\n`;
    confirmMessage += `ผู้เล่นปัจจุบัน: ${state.players.length}\n`;
    confirmMessage += `ผู้เล่นทุกคนจ่ายเงินแล้วตอนลงทะเบียน`;

    // Legacy support: handle any unpaid players (should be 0 with new system)
    if (unpaidPlayers.length > 0) {
        confirmMessage += `\n\n⚠️ Found ${unpaidPlayers.length} unpaid player(s) (legacy):\n`;
        confirmMessage += unpaidPlayers.map(p => p.name).join(', ') + '\n';
        confirmMessage += `Will deduct ${state.paymentAmount} THB from them.`;
    }

    if (confirm(confirmMessage)) {
        try {
            // Process wallet deductions for unpaid players
            let successful = 0;
            let removed = 0;

            for (const player of unpaidPlayers) {
                if (player.userId) {
                    // Get user's current balance
                    const userDoc = await usersRef.doc(player.userId).get();
                    if (userDoc.exists) {
                        const currentBalance = userDoc.data().balance || 0;

                        if (currentBalance >= state.paymentAmount) {
                            // Deduct money
                            const newBalance = currentBalance - state.paymentAmount;
                            await usersRef.doc(player.userId).update({
                                balance: newBalance
                            });

                            // Mark player as paid
                            await playersRef().doc(player.id).update({
                                paid: true
                            });

                            // Add transaction record
                            await transactionsRef.add({
                                userId: player.userId,
                                userName: player.name,
                                type: 'payment',
                                amount: -state.paymentAmount,  // Negative for deduction
                                balance: newBalance,
                                reason: `Auto registration for ${state.sessionDay} ${state.sessionDate}`,
                                sessionDate: state.sessionDate,
                                timestamp: firebase.firestore.FieldValue.serverTimestamp()
                            });

                            successful++;
                            console.log(`✅ Deducted ${state.paymentAmount} THB from ${player.name}`);
                        } else {
                            // REMOVE player from session - insufficient balance
                            await playersRef().doc(player.id).delete();
                            removed++;
                            console.log(`❌ Removed ${player.name} from session - insufficient balance (had ${currentBalance} THB, needed ${state.paymentAmount} THB)`);
                        }
                    }
                }
            }

            // Publish session
            state.published = true;
            await saveSessionData();
            updateUI();

            // Show simple result (no mention of removed players)
            alert(`✅ Session published!\n\nเผยแพร่แล้ว!\n\nPayments processed: ${successful}\n\nUsers can now see and register for the session.`);
            console.log(`✅ Session published: ${successful} paid, ${removed} removed`);

            // Mark step 8 as completed
            markStepCompleted('Publish Session');
        } catch (error) {
            console.error('Error publishing session:', error);
            alert('Error publishing session. Please try again.');
        }
    }
}

async function refundWaitingList() {
    // Find all players on waiting list (position > maxPlayers)
    const waitingPlayers = state.players.filter(p => p.position > state.maxPlayers);

    if (waitingPlayers.length === 0) {
        alert('No players on waiting list / ไม่มีผู้เล่นในรายชื่อสำรอง');
        return;
    }

    const confirmMsg = `Refund ${waitingPlayers.length} player(s) on waiting list?\n\nคืนเงินให้ ${waitingPlayers.length} คนในรายชื่อสำรอง?\n\n` +
        waitingPlayers.map(p => `- ${p.name}`).join('\n');

    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        let refunded = 0;
        let errors = [];

        for (const player of waitingPlayers) {
            try {
                // Find user in authorized users
                const user = state.authorizedUsers.find(u => u.name === player.name);

                if (user) {
                    // Refund the payment amount
                    const success = await updateUserBalance(
                        user.id,
                        user.name,
                        state.paymentAmount,
                        `Refund - Waiting list ${state.sessionDay} / คืนเงิน - รายชื่อสำรอง`,
                        true // silent mode
                    );

                    if (success) {
                        // Delete player from session
                        const playerDoc = await playersRef().where('name', '==', player.name).get();
                        if (!playerDoc.empty) {
                            await playersRef().doc(playerDoc.docs[0].id).delete();
                        }
                        refunded++;
                    } else {
                        errors.push(player.name);
                    }
                } else {
                    errors.push(`${player.name} (not found)`);
                }
            } catch (error) {
                console.error(`Error refunding ${player.name}:`, error);
                errors.push(player.name);
            }
        }

        // Show summary
        let message = `✅ Refunded ${refunded} player(s) / คืนเงิน ${refunded} คน\n`;
        if (errors.length > 0) {
            message += `\n⚠️ Errors: ${errors.join(', ')}`;
        }
        alert(message);

        // Reload users to update balances
        await loadAuthorizedUsers();
        updateUI();

    } catch (error) {
        console.error('Error refunding waiting list:', error);
        alert('Error refunding waiting list. Please try again.');
    }
}

async function changeSessionDetails() {
    const days = [
        'Monday / วันจันทร์',
        'Tuesday / วันอังคาร',
        'Wednesday / วันพุธ',
        'Thursday / วันพฤหัสบดี',
        'Friday / วันศุกร์',
        'Saturday / วันเสาร์',
        'Sunday / วันอาทิตย์',
        'Not Set / ไม่ได้กำหนด' // Day 8 - blank day
    ];

    const dayPrompt = `Select day / เลือกวัน:\n${days.map((d, i) => `${i+1}. ${d}`).join('\n')}\n\nEnter number (1-8):`;
    const dayChoiceStr = prompt(dayPrompt);
    const dayChoice = parseInt(dayChoiceStr);

    console.log(`🔍 User selected: dayChoice=${dayChoice}`);

    if (dayChoice >= 1 && dayChoice <= 8) {
        state.sessionDay = days[dayChoice - 1];
        console.log(`🔍 Session day set to: ${state.sessionDay}`);

        // Calculate date based on selected day (NOT for day 8)
        if (dayChoice <= 7) {
            const today = new Date();
            const todayDayOfWeek = today.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

            console.log(`🔍 Today is: ${today.toLocaleDateString('en-GB')} (day ${todayDayOfWeek})`);

            // Map menu choice to JavaScript day number
            // Menu: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
            // JS:    1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun
            const selectedDayOfWeek = (dayChoice === 7) ? 0 : dayChoice;

            console.log(`🔍 Selected day number: ${selectedDayOfWeek}`);

            // Calculate days to add
            let daysToAdd = selectedDayOfWeek - todayDayOfWeek;

            console.log(`🔍 Initial daysToAdd: ${daysToAdd} (${selectedDayOfWeek} - ${todayDayOfWeek})`);

            // If the day has passed or is today, add 7 to go to next week
            if (daysToAdd <= 0) {
                daysToAdd += 7;
                console.log(`🔍 Day has passed or is today, adding 7: daysToAdd=${daysToAdd}`);
            }

            // Create new date
            const newDate = new Date(today);
            newDate.setDate(today.getDate() + daysToAdd);
            state.sessionDate = newDate.toLocaleDateString('en-GB');

            console.log(`✅ NEW DATE CALCULATED: ${state.sessionDate}`);
        } else {
            console.log(`🔍 Day 8 selected, keeping current date: ${state.sessionDate}`);
        }

        // Default time: 10:00 - 12:00 (most common)
        const defaultTime = (dayChoice == 8) ? '10:00 - 12:00' : state.sessionTime;

        const timePrompt = 'Enter time / ใส่เวลา (e.g., 10:00 - 12:00):';
        const time = prompt(timePrompt, defaultTime);

        if (time) {
            state.sessionTime = time;

            console.log(`💾 SAVING to Firestore: date=${state.sessionDate}, day=${state.sessionDay}, time=${time}`);
            await saveSessionData();
            updateUI();

            alert(`✅ Session details updated!\n\nDay: ${state.sessionDay}\nDate: ${state.sessionDate}\nTime: ${time}\n\nUse "Manage Today's Players" to add players.\n\nอัปเดตแล้ว! ใช้ "จัดการผู้เล่นวันนี้" เพื่อเพิ่มผู้เล่น`);
            console.log(`✅ Session updated: ${state.sessionDay} ${state.sessionDate} ${time}`);

            // Mark step 2 as completed
            markStepCompleted('Edit Session');
        }
    }
}

// Get regular players for a specific day
async function getRegularPlayersForDay(dayNumber) {
    try {
        const configDoc = await db.collection('config').doc('regularPlayers').get();
        if (configDoc.exists) {
            const data = configDoc.data();
            const dayKey = `day${dayNumber}`;
            return data[dayKey] || [];
        }
        return [];
    } catch (error) {
        console.error('Error getting regular players:', error);
        return [];
    }
}

async function changePaymentAmount() {
    const newAmount = prompt('New payment amount in THB / ราคาใหม่ (บาท):', state.paymentAmount);
    if (newAmount !== null && !isNaN(newAmount) && newAmount >= 0) {
        state.paymentAmount = parseInt(newAmount);
        await saveSessionData();
        updateUI();
        alert(`Payment amount updated to ${state.paymentAmount} THB / อัปเดตราคาเป็น ${state.paymentAmount} บาทแล้ว`);

        // Mark step 3 as completed
        markStepCompleted('Change Payment Amount');
    }
}

async function changeMaxPlayers() {
    const currentMax = state.maxPlayers;
    const currentPlayers = state.players.length;

    const newMax = prompt(
        `Current max: ${currentMax} (${currentPlayers} players registered)\n\n` +
        'New maximum players / จำนวนผู้เล่นสูงสุด:',
        currentMax
    );

    if (newMax === null || newMax === '' || isNaN(newMax) || newMax < 0) {
        return; // User cancelled or invalid input
    }

    const newMaxInt = parseInt(newMax);

    // Check if reducing max players
    if (newMaxInt < currentMax && currentPlayers > newMaxInt) {
        // Some players will be moved to waiting list
        const affectedPlayers = currentPlayers - newMaxInt;

        const confirmReduce = confirm(
            `⚠️ WARNING!\n\n` +
            `Reducing from ${currentMax} to ${newMaxInt} will move ${affectedPlayers} player(s) to waiting list.\n\n` +
            `Players #${newMaxInt + 1} to #${currentPlayers} will be affected.\n` +
            `They will NOT be refunded.\n\n` +
            `Continue?\n\n` +
            `⚠️ คำเตือน!\n` +
            `ลดจาก ${currentMax} เป็น ${newMaxInt} จะย้าย ${affectedPlayers} คนไปรายชื่อสำรอง\n` +
            `ผู้เล่น #${newMaxInt + 1} ถึง #${currentPlayers} จะได้รับผลกระทบ\n` +
            `จะไม่มีการคืนเงิน\n\n` +
            `ดำเนินการต่อ?`
        );

        if (!confirmReduce) {
            return; // User cancelled
        }
    }

    // Update max players
    state.maxPlayers = newMaxInt;
    await saveSessionData();
    updateUI();

    if (newMaxInt > currentMax) {
        alert(`✅ Max players increased to ${newMaxInt}\n${newMaxInt - currentMax} more spots available!`);
    } else {
        alert(`✅ Max players reduced to ${newMaxInt}`);
    }

    // Mark step 4 as completed
    markStepCompleted('Change Max Players');
}

/**
 * Register shuttlecocks used in session
 * Track shuttlecock consumption for cost calculation
 */
async function registerShuttlecocks() {
    const currentShuttlecocks = state.shuttlecocksUsed || 0;

    const newCount = prompt(
        `Current shuttlecocks used: ${currentShuttlecocks}\n` +
        `ลูกที่ใช้ปัจจุบัน: ${currentShuttlecocks}\n\n` +
        `New shuttlecock count / จำนวนลูกใหม่:`,
        currentShuttlecocks
    );

    if (newCount === null || newCount === '' || isNaN(newCount) || newCount < 0) {
        return; // User cancelled or invalid input
    }

    const newCountInt = parseInt(newCount);

    // Update shuttlecocks count
    state.shuttlecocksUsed = newCountInt;
    await saveSessionData();
    updateUI();

    const cost = newCountInt * 90; // 90 THB per shuttlecock

    alert(
        `✅ Shuttlecocks registered / ลงทะเบียนลูกแล้ว\n\n` +
        `Count / จำนวน: ${newCountInt}\n` +
        `Cost / ต้นทุน: ${cost} THB (${newCountInt} × 90 THB)`
    );
}

// ============================================
// REGULAR PLAYERS MANAGEMENT
// ============================================

// ============================================
// MANAGE REGULAR PLAYERS (NEW UI)
// ============================================

function manageRegularPlayers() {
    // Close other admin sections first
    closeAllAdminSections();

    const modal = document.getElementById('manageRegularPlayersModal');
    const selectionArea = document.getElementById('regularPlayersSelectionArea');

    // Hide selection area initially, show day selector
    selectionArea.style.display = 'none';

    // Show modal
    modal.style.display = 'flex';
}

async function selectDayForRegularPlayers(dayNumber) {
    const days = [
        'Monday / วันจันทร์',
        'Tuesday / วันอังคาร',
        'Wednesday / วันพุธ',
        'Thursday / วันพฤหัสบดี',
        'Friday / วันศุกร์',
        'Saturday / วันเสาร์',
        'Sunday / วันอาทิตย์'
    ];

    const selectionArea = document.getElementById('regularPlayersSelectionArea');
    const selectedDayEl = document.getElementById('regularPlayersSelectedDay');
    const list = document.getElementById('regularPlayersSelectionList');

    // Update title
    selectedDayEl.textContent = `Regular Players for ${days[dayNumber - 1]}`;

    // Get current regular players for this day
    const regularPlayersForDay = await getRegularPlayersForDay(dayNumber);

    // Sort users alphabetically
    const sortedUsers = state.authorizedUsers
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));

    // Separate regular and non-regular users
    const regularUsers = [];
    const nonRegularUsers = [];

    sortedUsers.forEach(user => {
        const isRegular = regularPlayersForDay.includes(user.name);
        if (isRegular) {
            regularUsers.push(user);
        } else {
            nonRegularUsers.push(user);
        }
    });

    // Build user list
    list.innerHTML = '';

    // Add regular users first
    if (regularUsers.length > 0) {
        const headerRegular = document.createElement('div');
        headerRegular.style.cssText = 'padding: 10px; background: #dcfce7; border-radius: 8px; margin-bottom: 10px; font-weight: bold; color: #166534;';
        headerRegular.textContent = `✅ Regular Players (${regularUsers.length}) / ผู้เล่นประจำ`;
        list.appendChild(headerRegular);

        regularUsers.forEach(user => {
            const item = createRegularPlayerItem(user, dayNumber, true);
            list.appendChild(item);
        });
    }

    // Add non-regular users
    if (nonRegularUsers.length > 0) {
        const headerNonRegular = document.createElement('div');
        headerNonRegular.style.cssText = 'padding: 10px; background: #f3f4f6; border-radius: 8px; margin-bottom: 10px; margin-top: 15px; font-weight: bold; color: #374151;';
        headerNonRegular.textContent = `⬜ Other Users (${nonRegularUsers.length}) / ผู้ใช้อื่น`;
        list.appendChild(headerNonRegular);

        nonRegularUsers.forEach(user => {
            const item = createRegularPlayerItem(user, dayNumber, false);
            list.appendChild(item);
        });
    }

    // Show selection area
    selectionArea.style.display = 'block';
}

function createRegularPlayerItem(user, dayNumber, isRegular) {
    const item = document.createElement('div');
    item.className = 'user-selection-item';

    if (isRegular) {
        item.style.background = '#f0fdf4';
        item.style.borderLeft = '4px solid #10b981';
    }

    item.onclick = () => toggleRegularPlayer(user.name, dayNumber, isRegular);

    item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
            <div style="font-size: 28px;">${isRegular ? '✅' : '⬜'}</div>
            <div style="flex: 1;">
                <div style="font-weight: bold; font-size: 16px;">${user.name}</div>
            </div>
            <div style="color: ${isRegular ? '#059669' : '#6b7280'}; font-size: 12px;">
                ${isRegular ? 'Click to remove / คลิกเพื่อลบ' : 'Click to add / คลิกเพื่อเพิ่ม'}
            </div>
        </div>
    `;

    return item;
}

async function toggleRegularPlayer(userName, dayNumber, isCurrentlyRegular) {
    try {
        // Get current config
        const configDoc = await db.collection('config').doc('regularPlayers').get();
        let config = configDoc.exists ? configDoc.data() : {};

        const dayKey = `day${dayNumber}`;
        let playersForDay = config[dayKey] || [];

        if (isCurrentlyRegular) {
            // Remove from regular players
            playersForDay = playersForDay.filter(name => name !== userName);
            console.log(`✅ Removed ${userName} from regular players for day ${dayNumber}`);
        } else {
            // Add to regular players
            if (!playersForDay.includes(userName)) {
                playersForDay.push(userName);
                console.log(`✅ Added ${userName} to regular players for day ${dayNumber}`);
            }
        }

        // Update config
        config[dayKey] = playersForDay;
        await db.collection('config').doc('regularPlayers').set(config);

        // Refresh the list
        await selectDayForRegularPlayers(dayNumber);
    } catch (error) {
        console.error('Error toggling regular player:', error);
        alert('Error updating regular players. Please try again.');
    }
}

function closeRegularPlayers() {
    document.getElementById('manageRegularPlayersModal').style.display = 'none';

    // Mark step 5 as completed
    markStepCompleted('Manage Regular Players');
}

// ============================================
// AUTHORIZED USERS MANAGEMENT
// ============================================

// Helper function to close all admin sections
function closeAllAdminSections() {
    console.log('🔒 Closing all admin sections...');
    const authSection = document.getElementById('authorizedUsersSection');
    const transSection = document.getElementById('transactionsSection');

    if (authSection) {
        authSection.style.display = 'none';
        console.log('  ✅ Closed authorizedUsersSection');
    }
    if (transSection) {
        transSection.style.display = 'none';
        console.log('  ✅ Closed transactionsSection');
    }
}

function manageAuthorizedUsers() {
    const section = document.getElementById('authorizedUsersSection');

    // Close other sections first
    document.getElementById('transactionsSection').style.display = 'none';

    // Toggle this section
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
    if (section.style.display === 'block') {
        updateAuthorizedUsersList();
    }
}

function updateAuthorizedUsersList() {
    const list = document.getElementById('authorizedUsersList');
    list.innerHTML = '';

    if (state.authorizedUsers.length === 0) {
        list.innerHTML = '<p style="color: #666;">No authorized users yet / ยังไม่มีผู้ใช้ที่ได้รับอนุญาต</p>';
        return;
    }

    state.authorizedUsers.forEach((user, index) => {
        const item = document.createElement('div');
        item.className = 'authorized-user-item';
        const balance = user.balance || 0;
        const balanceColor = balance < state.paymentAmount ? '#ef4444' : balance < state.paymentAmount * 3 ? '#f59e0b' : '#10b981';

        item.innerHTML = `
            <div class="user-info">
                <strong>${user.name}</strong>
                <div style="font-size: 0.9em; color: ${balanceColor}; margin-top: 3px;">Balance: ${balance} THB</div>
            </div>
            <div class="user-actions">
                <button onclick="showUserPassword('${user.id}')" style="background: #8b5cf6; color: white; padding: 5px 10px; border: none; border-radius: 5px; margin-right: 5px; cursor: pointer;">Show Password</button>
                <button onclick="editUserPassword('${user.id}')" style="background: #3b82f6; color: white; padding: 5px 10px; border: none; border-radius: 5px; margin-right: 5px; cursor: pointer;">Change Password</button>
                <button onclick="removeAuthorizedUser('${user.id}')" style="background: #ef4444; color: white; padding: 5px 10px; border: none; border-radius: 5px; cursor: pointer;">Remove</button>
            </div>
        `;
        list.appendChild(item);
    });
}

async function addAuthorizedUser() {
    const name = prompt('Enter name / ใส่ชื่อ:');
    if (!name) return;

    // Check if user already exists
    if (state.authorizedUsers.find(u => u.name === name)) {
        alert('User with this name already exists / มีผู้ใช้ชื่อนี้อยู่แล้ว');
        return;
    }

    const password = prompt('Enter password (default is 123) / ใส่รหัสผ่าน (ค่าเริ่มต้นคือ 123):', '123');

    try {
        await usersRef.add({
            name: name,
            password: password || '123',
            balance: 0, // New users start with 0 balance
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('User added successfully! Default password: 123, Starting balance: 0 THB / เพิ่มผู้ใช้สำเร็จ! รหัสผ่านเริ่มต้น: 123, ยอดเงินเริ่มต้น: 0 บาท');
    } catch (error) {
        console.error('Error adding user:', error);
        alert('Error adding user. Please try again.');
    }
}

function showUserPassword(userId) {
    const user = state.authorizedUsers.find(u => u.id === userId);
    if (!user) return;

    alert(`Password for ${user.name}:\n\n${user.password}\n\nรหัสผ่านสำหรับ ${user.name}:\n${user.password}`);
}

async function editUserPassword(userId) {
    const user = state.authorizedUsers.find(u => u.id === userId);
    if (!user) return;

    const newPassword = prompt(`Change password for ${user.name} / เปลี่ยนรหัสผ่านสำหรับ ${user.name}:`, user.password);

    if (newPassword) {
        try {
            await usersRef.doc(userId).update({
                password: newPassword
            });
            alert('Password changed! / เปลี่ยนรหัสผ่านสำเร็จ!');
        } catch (error) {
            console.error('Error changing password:', error);
            alert('Error changing password. Please try again.');
        }
    }
}

async function removeAuthorizedUser(userId) {
    const user = state.authorizedUsers.find(u => u.id === userId);
    if (!user) return;

    if (confirm(`Remove ${user.name}? / ลบ ${user.name}?`)) {
        try {
            await usersRef.doc(userId).delete();
            alert('User removed / ลบผู้ใช้แล้ว');
        } catch (error) {
            console.error('Error removing user:', error);
            alert('Error removing user. Please try again.');
        }
    }
}

// ============================================
// WALLET MANAGEMENT
// ============================================

function manageWallets() {
    // Close other admin sections first
    closeAllAdminSections();

    const modal = document.getElementById('userSelectionModal');
    const list = document.getElementById('userSelectionList');

    // Sort users alphabetically
    const sortedUsers = state.authorizedUsers
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));

    // Build user list with clickable items
    list.innerHTML = '';

    sortedUsers.forEach(user => {
        const balance = user.balance || 0;
        const balanceColor = balance < state.paymentAmount ? '#ef4444' : balance < state.paymentAmount * 3 ? '#f59e0b' : '#10b981';

        const item = document.createElement('div');
        item.className = 'user-selection-item';
        item.onclick = () => {
            closeUserSelection();
            showBalanceAdjustModal(user);
        };

        item.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight: bold; font-size: 16px; margin-bottom: 3px;">${user.name}</div>
                <div style="color: ${balanceColor}; font-size: 14px;">Balance: ${balance} THB</div>
            </div>
            <div style="font-size: 20px; color: #9ca3af;">›</div>
        `;

        list.appendChild(item);
    });

    modal.style.display = 'flex';
}

function closeUserSelection() {
    document.getElementById('userSelectionModal').style.display = 'none';
}

// ============================================
// MANAGE TODAY'S PLAYERS
// ============================================

async function manageTodaysPlayers(skipAutoLoad = false) {
    // Close other admin sections first
    closeAllAdminSections();

    const modal = document.getElementById('manageTodaysPlayersModal');
    const list = document.getElementById('managedPlayersSelectionList');
    const titleEl = document.getElementById('manageTodaysPlayersTitle');
    const subtitleEl = document.getElementById('manageTodaysPlayersSubtitle');

    // Find which day number we're on
    const days = [
        'Monday / วันจันทร์',
        'Tuesday / วันอังคาร',
        'Wednesday / วันพุธ',
        'Thursday / วันพฤหัสบดี',
        'Friday / วันศุกร์',
        'Saturday / วันเสาร์',
        'Sunday / วันอาทิตย์'
    ];
    const currentDayIndex = days.findIndex(d => d === state.sessionDay);
    const dayNumber = currentDayIndex + 1; // 1-7
    const dayNameShort = state.sessionDay.split(' / ')[0]; // "Monday"

    // Update title to show current day
    titleEl.textContent = `Manage Players: ${state.sessionDay}`;
    subtitleEl.innerHTML = `Click to add/remove players<br>คลิกเพื่อเพิ่ม/ลบผู้เล่น<br><strong>Note: Wallet changes happen when you publish session / หมายเหตุ: เงินจะถูกหักเมื่อเผยแพร่เซสชัน</strong>`;

    // Get regular players for this day from Firestore
    const regularPlayersForToday = await getRegularPlayersForDay(dayNumber);

    // Get fresh player data from Firestore (not from state which might be stale)
    const playersSnapshot = await playersRef().get();
    const currentPlayers = [];
    playersSnapshot.forEach(doc => {
        currentPlayers.push({ id: doc.id, ...doc.data() });
    });

    // NOTE: We do NOT auto-add regular players anymore!
    // Admin must manually click on players to add them.
    // Regular players list is just shown as suggestion (highlighted).

    // Sort users alphabetically
    const sortedUsers = state.authorizedUsers
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));

    // Separate users based on who's on today's session
    const registeredUsers = [];
    const unregisteredUsers = [];

    sortedUsers.forEach(user => {
        // Check if user is already registered for today's session
        const isRegisteredToday = state.players.some(p => p.name === user.name);
        // Check if user is configured as regular player for this day
        const isRegularPlayer = regularPlayersForToday.includes(user.name);

        // Show as "selected" if they are registered for today
        if (isRegisteredToday) {
            registeredUsers.push({...user, isRegisteredToday, isRegularPlayer, dayNumber});
        } else {
            unregisteredUsers.push({...user, isRegisteredToday, isRegularPlayer, dayNumber});
        }
    });

    // Build user list with registered users at the top
    list.innerHTML = '';

    // Add registered users first (at the top)
    if (registeredUsers.length > 0) {
        const headerRegistered = document.createElement('div');
        headerRegistered.style.cssText = 'padding: 10px; background: #dcfce7; border-radius: 8px; margin-bottom: 10px; font-weight: bold; color: #166534;';
        headerRegistered.textContent = `✅ On ${dayNameShort}'s List (${registeredUsers.length}) / อยู่ในรายชื่อ${dayNameShort}`;
        list.appendChild(headerRegistered);

        registeredUsers.forEach(user => {
            const balance = user.balance || 0;
            const balanceColor = balance < state.paymentAmount ? '#ef4444' : balance < state.paymentAmount * 3 ? '#f59e0b' : '#10b981';

            // Show status badge
            let statusBadge = '';
            if (user.isRegularPlayer) {
                statusBadge = '<span style="background: #8b5cf6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 8px;">Regular / ประจำ</span>';
            } else {
                statusBadge = '<span style="background: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 8px;">This session only / ครั้งนี้เท่านั้น</span>';
            }

            const item = document.createElement('div');
            item.className = 'user-selection-item';
            item.style.background = '#f0fdf4'; // Light green background
            item.style.borderLeft = '4px solid #10b981';
            item.onclick = () => togglePlayerForToday(user, true);

            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                    <div style="font-size: 28px;">✅</div>
                    <div style="flex: 1;">
                        <div style="font-weight: bold; font-size: 16px; margin-bottom: 3px;">${user.name}${statusBadge}</div>
                        <div style="color: ${balanceColor}; font-size: 14px;">Balance: ${balance} THB</div>
                    </div>
                    <div style="color: #059669; font-size: 12px;">Click to remove / คลิกเพื่อลบ</div>
                </div>
            `;

            list.appendChild(item);
        });
    }

    // Add unregistered users
    if (unregisteredUsers.length > 0) {
        const headerUnregistered = document.createElement('div');
        headerUnregistered.style.cssText = 'padding: 10px; background: #f3f4f6; border-radius: 8px; margin-bottom: 10px; margin-top: 15px; font-weight: bold; color: #374151;';
        headerUnregistered.textContent = `⬜ Not Registered (${unregisteredUsers.length}) / ยังไม่ได้ลงทะเบียน`;
        list.appendChild(headerUnregistered);

        unregisteredUsers.forEach(user => {
            const balance = user.balance || 0;
            const balanceColor = balance < state.paymentAmount ? '#ef4444' : balance < state.paymentAmount * 3 ? '#f59e0b' : '#10b981';

            const item = document.createElement('div');
            item.className = 'user-selection-item';
            item.onclick = () => togglePlayerForToday(user, false);

            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                    <div style="font-size: 28px;">⬜</div>
                    <div style="flex: 1;">
                        <div style="font-weight: bold; font-size: 16px; margin-bottom: 3px;">${user.name}</div>
                        <div style="color: ${balanceColor}; font-size: 14px;">Balance: ${balance} THB</div>
                    </div>
                    <div style="color: #6b7280; font-size: 12px;">Click to add / คลิกเพื่อเพิ่ม</div>
                </div>
            `;

            list.appendChild(item);
        });
    }

    // Show modal
    modal.style.display = 'flex';
}

async function togglePlayerForToday(user, isCurrentlyRegistered) {
    const days = [
        'Monday / วันจันทร์',
        'Tuesday / วันอังคาร',
        'Wednesday / วันพุธ',
        'Thursday / วันพฤหัสบดี',
        'Friday / วันศุกร์',
        'Saturday / วันเสาร์',
        'Sunday / วันอาทิตย์'
    ];
    const dayName = state.sessionDay.split(' / ')[0]; // "Monday"

    try {
        if (isCurrentlyRegistered) {
            // User is registered - ask HOW to remove using confirm dialogs
            const removeThisOnly = confirm(
                `Remove ${user.name} from THIS ${dayName} only?\n` +
                `ลบ ${user.name} จากเฉพาะ${dayName}นี้?\n\n` +
                `Click OK = Remove from THIS ${dayName} only\n` +
                `Click Cancel = Remove from ALL ${dayName}s (as regular player)\n\n` +
                `กด OK = ลบเฉพาะ${dayName}นี้\n` +
                `กด Cancel = ลบจากทุก${dayName}`
            );
            const choice = removeThisOnly ? '1' : '2';

            if (choice === '1') {
                // Remove from THIS session only
                const playerToRemove = state.players.find(p => p.name === user.name);
                if (playerToRemove && playerToRemove.id) {
                    await playersRef().doc(playerToRemove.id).delete();
                    console.log(`✅ Removed ${user.name} from this ${dayName} session`);
                    await manageTodaysPlayers(true); // Skip auto-load when refreshing
                }
            } else if (choice === '2') {
                // Remove from regular players config AND this session
                const currentDayIndex = days.findIndex(d => d === state.sessionDay);
                const dayNumber = currentDayIndex + 1;

                // Remove from regular players config
                const configDoc = await db.collection('config').doc('regularPlayers').get();
                let config = configDoc.exists ? configDoc.data() : {};
                const dayKey = `day${dayNumber}`;
                let playersForDay = config[dayKey] || [];
                playersForDay = playersForDay.filter(name => name !== user.name);
                config[dayKey] = playersForDay;
                await db.collection('config').doc('regularPlayers').set(config);

                // Remove from this session
                const playerToRemove = state.players.find(p => p.name === user.name);
                if (playerToRemove && playerToRemove.id) {
                    await playersRef().doc(playerToRemove.id).delete();
                }

                console.log(`✅ Removed ${user.name} from ALL ${dayName}s`);
                await manageTodaysPlayers(true); // Skip auto-load when refreshing
            }
        } else {
            // User not registered - CHECK BALANCE FIRST
            const userBalance = user.balance || 0;

            if (userBalance < state.paymentAmount) {
                // Insufficient balance - CANNOT add
                alert(
                    `❌ Cannot add ${user.name}\n` +
                    `ไม่สามารถเพิ่ม ${user.name}\n\n` +
                    `Balance: ${userBalance} THB\n` +
                    `ยอดเงิน: ${userBalance} บาท\n\n` +
                    `Required: ${state.paymentAmount} THB\n` +
                    `ต้องการ: ${state.paymentAmount} บาท\n\n` +
                    `Please top up wallet first!\n` +
                    `กรุณาเติมเงินก่อน!`
                );
                return; // Don't add to session
            }

            // Balance OK - ask HOW to add using confirm dialog
            const addThisOnly = confirm(
                `Add ${user.name} to THIS ${dayName} only?\n` +
                `เพิ่ม ${user.name} ไปยังเฉพาะ${dayName}นี้?\n\n` +
                `Click OK = Add to THIS ${dayName} only\n` +
                `Click Cancel = Add to ALL ${dayName}s (make regular player)\n\n` +
                `กด OK = เพิ่มเฉพาะ${dayName}นี้\n` +
                `กด Cancel = เพิ่มไปยังทุก${dayName}`
            );
            const choice = addThisOnly ? '1' : '2';

            if (choice === '1') {
                // Add to THIS session only
                const userId = user.id || user.userId;
                await playersRef().add({
                    name: user.name,
                    paid: false,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    position: state.players.length + 1,
                    userId: userId,
                    isRegularPlayer: false
                });
                console.log(`✅ Added ${user.name} to this ${dayName} session only`);
                await manageTodaysPlayers(true); // Skip auto-load when refreshing
            } else if (choice === '2') {
                // Add to regular players config AND this session
                const currentDayIndex = days.findIndex(d => d === state.sessionDay);
                const dayNumber = currentDayIndex + 1;

                // Add to regular players config
                const configDoc = await db.collection('config').doc('regularPlayers').get();
                let config = configDoc.exists ? configDoc.data() : {};
                const dayKey = `day${dayNumber}`;
                let playersForDay = config[dayKey] || [];
                if (!playersForDay.includes(user.name)) {
                    playersForDay.push(user.name);
                }
                config[dayKey] = playersForDay;
                await db.collection('config').doc('regularPlayers').set(config);

                // Add to this session
                const userId = user.id || user.userId;
                await playersRef().add({
                    name: user.name,
                    paid: false,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    position: state.players.length + 1,
                    userId: userId,
                    isRegularPlayer: true
                });

                console.log(`✅ Added ${user.name} to ALL ${dayName}s`);
                await manageTodaysPlayers(true); // Skip auto-load when refreshing
            }
        }
    } catch (error) {
        console.error('Error toggling player:', error);
        alert('Error updating player. Please try again.');
    }
}

function closeManagedPlayers() {
    document.getElementById('manageTodaysPlayersModal').style.display = 'none';

    // Mark step 6 as completed
    markStepCompleted("Manage Today's Players");
}

// ============================================
// REMOVE PLAYER FROM SESSION
// ============================================

/**
 * Admin function to remove a player from current session
 * Refunds wallet if player had paid
 */
async function removePlayerFromSession() {
    if (state.players.length === 0) {
        alert('No players registered / ไม่มีผู้เล่นที่ลงทะเบียน');
        return;
    }

    // Build player list for selection
    let playerList = 'Select player number to remove / เลือกหมายเลขผู้เล่นที่จะลบ:\n\n';
    state.players.forEach((player, index) => {
        const position = index + 1;
        const paidStatus = player.paid ? '✓ Paid' : '✗ Unpaid';
        const guestMarker = player.isGuest ? '👤 Guest' : '';
        playerList += `${position}. ${player.name} ${guestMarker} - ${paidStatus}\n`;
    });

    const selection = prompt(playerList + '\nEnter player number / ใส่หมายเลขผู้เล่น:');

    if (!selection) return; // Cancelled

    const playerIndex = parseInt(selection) - 1;

    if (isNaN(playerIndex) || playerIndex < 0 || playerIndex >= state.players.length) {
        alert('Invalid player number / หมายเลขผู้เล่นไม่ถูกต้อง');
        return;
    }

    const playerToRemove = state.players[playerIndex];
    const playerName = playerToRemove.name;
    const wasPaid = playerToRemove.paid;
    const isGuest = playerToRemove.isGuest;

    // Confirm removal
    const confirmMsg = `Remove player from session?\nลบผู้เล่นออกจากเซสชัน?\n\n` +
                      `Player: ${playerName}\n` +
                      `Status: ${wasPaid ? 'Paid ✓' : 'Unpaid ✗'}\n` +
                      `${isGuest ? '(Guest player)' : ''}\n\n` +
                      `${wasPaid && !isGuest ? 'Wallet will be refunded ' + state.paymentAmount + ' THB' : ''}`;

    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        // If player paid and is not a guest, refund to wallet
        if (wasPaid && !isGuest && playerToRemove.userId) {
            const user = state.authorizedUsers.find(u => u.id === playerToRemove.userId);
            if (user) {
                const currentBalance = user.balance || 0;
                const newBalance = currentBalance + state.paymentAmount;

                await usersRef.doc(playerToRemove.userId).update({
                    balance: newBalance
                });

                // Add transaction record
                await transactionsRef.add({
                    userId: playerToRemove.userId,
                    userName: playerName,
                    type: 'refund',
                    amount: state.paymentAmount,
                    balance: newBalance,
                    reason: `Admin removed from session ${state.sessionDay} ${state.sessionDate}`,
                    sessionId: currentSessionId,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

                console.log(`✅ Refunded ${state.paymentAmount} THB to ${playerName}`);
            }
        }

        // Delete player from Firestore
        await playersRef().doc(playerToRemove.id).delete();

        console.log(`✅ Player removed: ${playerName}`);

        alert(`✅ Player removed successfully!\n\n${wasPaid && !isGuest ? `Refunded ${state.paymentAmount} THB to wallet` : ''}\n\nลบผู้เล่นสำเร็จ!`);

        // Reload authorized users if refund happened
        if (wasPaid && !isGuest) {
            await loadAuthorizedUsers();
        }

        updateUI();
    } catch (error) {
        console.error('Error removing player:', error);
        alert('Error removing player. Please try again.');
    }
}

async function viewTransactions() {
    const modal = document.getElementById('adminTransactionModal');
    const list = document.getElementById('transactionsList');

    modal.style.display = 'block';

    // Show loading indicator
    list.innerHTML = '<div style="text-align: center; padding: 50px; color: #666;"><div style="font-size: 40px; margin-bottom: 20px;">⏳</div>Loading transactions...<br>กำลังโหลด...</div>';

    console.log('⏳ Loading transactions...');
    const startTime = Date.now();

    await loadTransactions();

    const endTime = Date.now();
    console.log(`✅ Transactions loaded in ${endTime - startTime}ms`);
}

function closeAdminTransactions() {
    document.getElementById('adminTransactionModal').style.display = 'none';
}

// Reset all balances and clear transaction history (admin utility)
async function initializeAllBalances() {
    const amount = prompt('Reset ALL balances and DELETE ALL transaction history?\n\nEnter starting balance for all users:\n\nรีเซ็ตยอดเงินทั้งหมดและลบประวัติทั้งหมด?\nใส่ยอดเงินเริ่มต้น:', '300');

    if (!amount || isNaN(amount)) {
        alert('Invalid amount / จำนวนเงินไม่ถูกต้อง');
        return;
    }

    const balanceAmount = parseInt(amount);

    if (!confirm(
        `⚠️ WARNING / คำเตือน ⚠️\n\n` +
        `This will:\n` +
        `1. DELETE ALL transaction history for ALL users\n` +
        `2. Set balance to ${balanceAmount} THB for ALL users\n` +
        `3. Create ONE clean "Initial balance" transaction\n\n` +
        `นี่จะ:\n` +
        `1. ลบประวัติการทำรายการทั้งหมด\n` +
        `2. ตั้งยอดเงินเป็น ${balanceAmount} บาท\n` +
        `3. สร้างรายการ "ยอดเริ่มต้น" 1 รายการ\n\n` +
        `Continue? / ดำเนินการต่อ?`
    )) {
        return;
    }

    let updated = 0;
    let transactionsDeleted = 0;

    try {
        console.log('🔄 Starting complete reset...');

        // Step 1: Delete ALL transactions for ALL users
        const allTransactions = await transactionsRef.get();
        console.log(`📜 Found ${allTransactions.size} transactions to delete`);

        for (const doc of allTransactions.docs) {
            await transactionsRef.doc(doc.id).delete();
            transactionsDeleted++;
        }

        console.log(`✅ Deleted ${transactionsDeleted} transactions`);

        // Step 2: Set balance and create ONE clean initial transaction for each user
        for (const user of state.authorizedUsers) {
            // Set balance
            await usersRef.doc(user.id).update({ balance: balanceAmount });

            // Create clean initial transaction
            await createTransaction(
                user.id,
                user.name,
                balanceAmount,
                'Initial balance deposit / ยอดเริ่มต้น'
            );

            updated++;
        }

        alert(
            `✅ Complete reset successful!\n\n` +
            `Deleted: ${transactionsDeleted} old transactions\n` +
            `Reset: ${updated} users to ${balanceAmount} THB\n` +
            `Created: ${updated} clean initial transactions\n\n` +
            `รีเซ็ตเสร็จสมบูรณ์!\n` +
            `ลบ: ${transactionsDeleted} รายการเก่า\n` +
            `รีเซ็ต: ${updated} คน เป็น ${balanceAmount} บาท\n` +
            `สร้าง: ${updated} รายการใหม่`
        );

        // Reload users to get updated balances
        await loadAuthorizedUsers();
    } catch (error) {
        console.error('Error resetting balances:', error);
        alert('Error resetting balances. Please try again.');
    }
}

async function loadTransactions() {
    try {
        const snapshot = await transactionsRef
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();

        const list = document.getElementById('transactionsList');
        list.innerHTML = '';

        if (snapshot.empty) {
            list.innerHTML = '<p style="color: #666;">No transactions yet / ยังไม่มีรายการ</p>';
            return;
        }

        snapshot.forEach(doc => {
            const tx = doc.data();
            const item = document.createElement('div');
            item.className = 'transaction-item';

            // Format timestamp
            let dateStr = '';
            if (tx.timestamp) {
                const date = tx.timestamp.toDate();
                dateStr = date.toLocaleString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }

            const amountColor = tx.amount >= 0 ? '#10b981' : '#ef4444';
            const amountSign = tx.amount >= 0 ? '+' : '';

            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 5px;">
                    <div>
                        <strong>${tx.userName}</strong>
                        <div style="font-size: 0.9em; color: #666;">${dateStr}</div>
                    </div>
                    <div style="text-align: right;">
                        <strong style="color: ${amountColor}; font-size: 1.1em;">${amountSign}${tx.amount} THB</strong>
                    </div>
                </div>
                <div style="font-size: 0.85em; color: #666; font-style: italic;">
                    ${tx.description}
                </div>
            `;
            list.appendChild(item);
        });

        console.log(`📜 Loaded ${snapshot.size} transactions`);
    } catch (error) {
        console.error('Error loading transactions:', error);
        alert('Error loading transactions. Please try again.');
    }
}

// Show logged-in user's transaction history
async function showMyTransactions() {
    console.log('📜 showMyTransactions called');
    console.log('Logged in user:', state.loggedInUser);

    if (!state.loggedInUser) {
        alert('Please log in first / กรุณาเข้าสู่ระบบก่อน');
        return;
    }

    const modal = document.getElementById('userTransactionModal');
    const list = document.getElementById('userTransactionsList');

    console.log('Modal element:', modal);
    console.log('List element:', list);

    if (!modal || !list) {
        console.error('❌ Modal or list element not found!');
        alert('Error: Modal not found. Please refresh the page.');
        return;
    }

    modal.style.display = 'flex';
    list.innerHTML = '<p style="text-align: center; color: #666;">Loading... / กำลังโหลด...</p>';

    try {
        const userId = state.loggedInUser.userId;
        console.log('🔍 Fetching transactions for userId:', userId);

        // Check if userId is valid
        if (!userId) {
            console.error('❌ userId is undefined!');
            list.innerHTML = '<p style="color: #ef4444; text-align: center;">Error: User ID not found. Please log out and log in again.<br>กรุณาออกจากระบบและเข้าสู่ระบบใหม่</p>';
            return;
        }

        // Fetch all transactions for this user (without orderBy to avoid index requirement)
        const snapshot = await transactionsRef
            .where('userId', '==', userId)
            .get();

        console.log('📊 Raw snapshot size:', snapshot.size);

        list.innerHTML = '';

        if (snapshot.empty) {
            list.innerHTML = '<p style="color: #666; text-align: center;">No transactions yet / ยังไม่มีรายการ</p>';
            return;
        }

        // Convert to array and sort by timestamp (client-side sorting)
        const transactions = [];
        snapshot.forEach(doc => {
            transactions.push({ id: doc.id, ...doc.data() });
        });

        // Sort by timestamp descending (newest first)
        transactions.sort((a, b) => {
            if (!a.timestamp || !b.timestamp) return 0;
            return b.timestamp.toMillis() - a.timestamp.toMillis();
        });

        // Limit to 20 most recent
        const recentTransactions = transactions.slice(0, 20);

        console.log('📋 Showing', recentTransactions.length, 'transactions');

        recentTransactions.forEach(tx => {
            const item = document.createElement('div');
            item.className = 'transaction-item';

            // Format timestamp
            let dateStr = '';
            if (tx.timestamp) {
                const date = tx.timestamp.toDate();
                dateStr = date.toLocaleString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }

            const amountColor = tx.amount >= 0 ? '#10b981' : '#ef4444';
            const amountSign = tx.amount >= 0 ? '+' : '';

            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 5px;">
                    <div>
                        <div style="font-size: 0.9em; color: #666;">${dateStr}</div>
                    </div>
                    <div style="text-align: right;">
                        <strong style="color: ${amountColor}; font-size: 1.1em;">${amountSign}${tx.amount} THB</strong>
                    </div>
                </div>
                <div style="font-size: 0.85em; color: #666; font-style: italic;">
                    ${tx.description}
                </div>
            `;
            list.appendChild(item);
        });

        console.log(`📜 Loaded ${snapshot.size} transactions for user ${state.loggedInUser.name}`);
    } catch (error) {
        console.error('❌ Error loading user transactions:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);

        if (error.code === 'failed-precondition' || error.message.includes('index')) {
            list.innerHTML = `
                <p style="color: #ef4444; text-align: center; margin-bottom: 10px;">
                    <strong>Firestore Index Required</strong><br>
                    คุณต้องสร้าง index ใน Firestore
                </p>
                <p style="font-size: 0.85em; color: #666; text-align: center;">
                    Click the link in the console to create the index automatically.<br>
                    คลิกลิงก์ใน console เพื่อสร้าง index อัตโนมัติ
                </p>
            `;
        } else {
            list.innerHTML = `<p style="color: #ef4444; text-align: center;">Error: ${error.message}</p>`;
        }
    }
}

function closeMyTransactions() {
    document.getElementById('userTransactionModal').style.display = 'none';
}

// ============================================
// BALANCE ADJUSTMENT MODAL
// ============================================

let selectedUser = null;

function showBalanceAdjustModal(user) {
    selectedUser = user;
    const currentBalance = user.balance || 0;

    document.getElementById('balanceAdjustTitle').textContent = `Adjust balance for ${user.name}`;
    document.getElementById('balanceAdjustInfo').textContent =
        `Current balance: ${currentBalance} THB / ยอดปัจจุบัน: ${currentBalance} บาท`;
    document.getElementById('balanceAdjustAmount').value = '';
    document.getElementById('balanceAdjustModal').style.display = 'flex';
}

function closeBalanceAdjust() {
    document.getElementById('balanceAdjustModal').style.display = 'none';
    selectedUser = null;
}

function selectAmount(amount) {
    document.getElementById('balanceAdjustAmount').value = amount;
}

async function confirmBalanceAdjust() {
    if (!selectedUser) return;

    const amountStr = document.getElementById('balanceAdjustAmount').value;
    if (!amountStr) {
        alert('Please enter or select an amount / กรุณาใส่หรือเลือกจำนวนเงิน');
        return;
    }

    const amount = parseInt(amountStr);

    // Admin can enter any amount (positive or negative for corrections)
    if (isNaN(amount) || amount === 0) {
        alert('Please enter a valid amount / กรุณาใส่จำนวนเงินที่ถูกต้อง');
        return;
    }

    const currentBalance = selectedUser.balance || 0;
    const description = amount > 0
        ? 'Cash deposit / เติมเงินสด'
        : 'Balance correction / แก้ไขยอดเงิน';

    const success = await updateUserBalance(selectedUser.id, selectedUser.name, amount, description);

    if (success) {
        const changeText = amount > 0 ? `Added: +${amount} THB` : `Deducted: ${amount} THB`;
        alert(
            `✅ Balance updated! / อัปเดตยอดเงินแล้ว!\n\n` +
            `${selectedUser.name}\n` +
            `Previous: ${currentBalance} THB\n` +
            `${changeText}\n` +
            `New: ${currentBalance + amount} THB`
        );

        // Reload users to get updated balances
        await loadAuthorizedUsers();

        // If this is the logged in user, update their balance
        if (state.loggedInUser && state.loggedInUser.userId === selectedUser.id) {
            state.loggedInUser.balance = currentBalance + amount;
            localStorage.setItem('loggedInUser', JSON.stringify(state.loggedInUser));
            updateUI();
        }

        closeBalanceAdjust();
    }
}

// ============================================
// PAYMENT TRACKING
// ============================================

function updatePaymentList() {
    const paymentList = document.getElementById('paymentList');
    paymentList.innerHTML = '';

    state.players.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'payment-item';

        const info = document.createElement('span');
        // Show guest icon and position number
        if (player.isGuest) {
            // Extract guest name and host name from "HostName friend: GuestName" format
            let guestDisplayName = player.name;
            let hostDisplayName = player.guestOfName;

            const parts = player.name.split(' friend: ');
            if (parts.length === 2) {
                guestDisplayName = parts[1]; // GuestName
                hostDisplayName = parts[0];   // HostName
            } else {
                // Fallback for old formats
                const oldParts = player.name.split(' venn: ');
                if (oldParts.length === 2) {
                    guestDisplayName = oldParts[1];
                    hostDisplayName = oldParts[0];
                } else {
                    const legacyParts = player.name.split(' + ');
                    if (legacyParts.length === 2) {
                        guestDisplayName = legacyParts[1];
                        hostDisplayName = legacyParts[0];
                    }
                }
            }

            info.textContent = `${index + 1}. ${guestDisplayName} 👤 (${hostDisplayName})`;
            info.title = `Guest of ${hostDisplayName}`;
        } else {
            info.textContent = `${index + 1}. ${player.name}`;
        }

        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '5px';

        const paymentButton = document.createElement('button');
        paymentButton.textContent = player.paid ? 'Mark Unpaid' : 'Mark Paid ✓';
        paymentButton.onclick = () => togglePayment(player.id);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = '❌';
        deleteButton.title = 'Delete player and refund / ลบผู้เล่นและคืนเงิน';
        deleteButton.style.background = '#ef4444';
        deleteButton.style.padding = '5px 10px';
        deleteButton.style.minWidth = '40px';
        deleteButton.onclick = () => adminDeletePlayer(player.id, player.name, player.isGuest, player.guestOf);

        buttonContainer.appendChild(paymentButton);
        buttonContainer.appendChild(deleteButton);

        item.appendChild(info);
        item.appendChild(buttonContainer);
        paymentList.appendChild(item);
    });
}

async function togglePayment(playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (player) {
        try {
            await playersRef().doc(playerId).update({
                paid: !player.paid
            });
            console.log('✅ Payment status toggled');
        } catch (error) {
            console.error('Error toggling payment:', error);
            alert('Error updating payment. Please try again.');
        }
    }
}

/**
 * Admin function to delete a player and refund their payment
 * @param {string} playerId - Firestore document ID
 * @param {string} playerName - Player's name
 * @param {boolean} isGuest - Whether this is a guest player
 * @param {string} guestOf - User ID of host (if guest)
 */
async function adminDeletePlayer(playerId, playerName, isGuest = false, guestOf = null) {
    // Confirm deletion
    const confirmMsg = isGuest
        ? `Delete guest player?\n\n${playerName}\n\nThis will refund the host's payment.\n\nลบแขกและคืนเงิน?`
        : `Delete player?\n\n${playerName}\n\nThis will refund their payment (${state.paymentAmount} THB).\n\nลบผู้เล่นและคืนเงิน?`;

    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        // Find the player to get full details
        const player = state.players.find(p => p.id === playerId);
        if (!player) {
            alert('Player not found / ไม่พบผู้เล่น');
            return;
        }

        // Determine who to refund
        let refundUserId;
        let refundUserName;
        let refundDescription;

        if (isGuest && guestOf) {
            // Guest: refund the host
            const hostUser = state.authorizedUsers.find(u => u.id === guestOf);
            if (hostUser) {
                refundUserId = hostUser.id;
                refundUserName = hostUser.name;
                const guestNameOnly = playerName.split(' friend: ')[1] || playerName.split(' venn: ')[1] || playerName.split(' + ')[1] || playerName;
                refundDescription = `Admin deleted guest: ${guestNameOnly} (${state.sessionDate})`;
            } else {
                alert('⚠️ Host user not found. Cannot refund.\n\nไม่พบเจ้าของแขก');
                return;
            }
        } else {
            // Regular player: refund themselves
            const regularUser = state.authorizedUsers.find(u => u.name === playerName);
            if (regularUser) {
                refundUserId = regularUser.id;
                refundUserName = regularUser.name;
                refundDescription = `Admin deleted player registration (${state.sessionDate})`;
            } else {
                // User might not exist anymore - allow deletion without refund
                if (!confirm(`⚠️ User "${playerName}" not found in authorized users.\n\nDelete player WITHOUT refund?\n\nลบผู้เล่นโดยไม่คืนเงิน?`)) {
                    return;
                }
            }
        }

        // Refund payment if user was found
        if (refundUserId && refundUserName) {
            await updateUserBalance(
                refundUserId,
                refundUserName,
                state.paymentAmount,
                refundDescription,
                true // silent - no alert
            );
            console.log(`💰 Refunded ${state.paymentAmount} THB to ${refundUserName}`);
        }

        // Delete player from Firestore
        await playersRef().doc(playerId).delete();

        console.log(`✅ Admin deleted player: ${playerName}`);
        alert(`✅ Player deleted and refunded\n\nลบผู้เล่นและคืนเงินแล้ว\n\n${playerName}\nRefund: ${state.paymentAmount} THB`);

    } catch (error) {
        console.error('Error deleting player:', error);
        alert('Error deleting player. Please try again. / เกิดข้อผิดพลาด');
    }
}

// ============================================
// EXPORT & SHARE
// ============================================

function exportList() {
    let text = `Badminton ${state.sessionDate}\n`;
    text += '='.repeat(30) + '\n\n';
    text += 'PLAYERS / ผู้เล่น:\n';

    state.players.slice(0, state.maxPlayers).forEach((player, index) => {
        text += `${index + 1}. ${player.name} ${player.paid ? '✓' : '○'}\n`;
    });

    if (state.players.length > state.maxPlayers) {
        text += '\nWAITING LIST / รายชื่อสำรอง:\n';
        state.players.slice(state.maxPlayers).forEach((player, index) => {
            text += `${index + 1}. ${player.name}\n`;
        });
    }

    // Create download
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `badminton_${state.sessionDate.replace(/\//g, '-')}.txt`;
    a.click();
}

function generateShareLink() {
    const url = window.location.href;
    const shareText = `Meld deg på badminton! ${url}`;

    // Line share URL format
    const lineShareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(shareText)}`;

    console.log('Share via Line:', lineShareUrl);
}

console.log('🔥 Firebase app loaded successfully!');
