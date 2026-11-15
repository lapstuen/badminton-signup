// ============================================
// BADMINTON APP - FIREBASE VERSION
// ============================================

// App URL - Production URL for sharing in Line messages
const APP_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'https://lapstuen.github.io/badminton-signup/';

// Production URL - ALWAYS use this for Line messages (even when testing locally)
const PRODUCTION_URL = 'https://lapstuen.github.io/badminton-signup/';

// Current session ID - FIXED to "current" (does not auto-change daily)
// Admin must manually start "New Session" to create a new session
let currentSessionId = 'current';

// Lock session N hours before start time (prevents last-minute registrations/cancellations)
const LOCK_HOURS_BEFORE_SESSION = 1; // Easy to adjust (2, 3, 4, etc.)

// Minimum balance required AFTER payment (prevents users from going below minimum)
const MINIMUM_BALANCE = -100; // THB - users must have at least 10 THB remaining after payment

// App state (synced with Firebase)
let state = {
    isSessionLoaded: false, // CRITICAL: Prevents saving before Firebase data is loaded
    players: [],
    maxPlayers: 12,
    sessionDate: new Date().toLocaleDateString('en-GB'),
    sessionDay: 'ไม่ได้กำหนด / Not Set', // Default to day 8 (blank)
    sessionTime: '10:00 - 12:00', // Default time (most common)
    paymentAmount: 10,
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
// POSITION RECALCULATION HELPER
// ============================================

/**
 * Recalculate all player positions to be sequential (1, 2, 3, ...)
 * Call this after any player deletion to ensure waiting list players move up correctly
 * Uses batch write for efficiency and atomicity
 */
async function recalculatePlayerPositions() {
    try {
        // Get fresh player list from Firestore
        const playersSnapshot = await playersRef().get();
        const players = [];
        playersSnapshot.forEach(doc => {
            players.push({ id: doc.id, ...doc.data() });
        });

        if (players.length === 0) {
            console.log('📍 No players to recalculate positions for');
            return;
        }

        // Sort by current position
        players.sort((a, b) => a.position - b.position);

        // Check if any positions need updating
        let needsUpdate = false;
        players.forEach((player, index) => {
            if (player.position !== index + 1) {
                needsUpdate = true;
            }
        });

        if (!needsUpdate) {
            console.log('📍 Positions already sequential, no update needed');
            return;
        }

        // Update each player's position to be sequential (1, 2, 3, ...)
        const batch = db.batch();
        players.forEach((player, index) => {
            const newPosition = index + 1;
            if (player.position !== newPosition) {
                const playerRef = playersRef().doc(player.id);
                batch.update(playerRef, { position: newPosition });
                console.log(`📍 Position update: ${player.name} from ${player.position} to ${newPosition}`);
            }
        });

        await batch.commit();
        console.log(`✅ Positions recalculated: ${players.length} players now sequential`);
    } catch (error) {
        console.error('❌ Error recalculating positions:', error);
    }
}

// ============================================
// SESSION LOCK TIME CALCULATION
// ============================================

/**
 * Calculate when the session should be locked (N hours before session start)
 * @returns {Date|null} Lock time as Date object, or null if unable to parse
 */
function calculateSessionLockTime() {
    try {
        // Parse sessionDate (format: "DD/MM/YYYY")
        const [day, month, year] = state.sessionDate.split('/');
        if (!day || !month || !year) {
            console.warn('⚠️ Invalid sessionDate format:', state.sessionDate);
            return null;
        }

        // Parse sessionTime to extract start time (format: "HH:MM - HH:MM")
        // Example: "18:00 - 20:00" → "18:00"
        const timeParts = state.sessionTime.split(' - ');
        if (timeParts.length < 1) {
            console.warn('⚠️ Invalid sessionTime format:', state.sessionTime);
            return null;
        }

        const startTime = timeParts[0].trim(); // "18:00"
        const [hours, minutes] = startTime.split(':');
        if (!hours || !minutes) {
            console.warn('⚠️ Invalid time format:', startTime);
            return null;
        }

        // Create Date object for session start time
        // Note: month is 0-indexed in JavaScript Date
        const sessionStart = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hours),
            parseInt(minutes),
            0
        );

        // Calculate lock time (N hours before session start)
        const lockTime = new Date(sessionStart);
        lockTime.setHours(lockTime.getHours() - LOCK_HOURS_BEFORE_SESSION);

        console.log('🔒 Lock time calculated:', {
            sessionDate: state.sessionDate,
            sessionTime: state.sessionTime,
            sessionStart: sessionStart.toLocaleString('en-GB'),
            lockTime: lockTime.toLocaleString('en-GB'),
            hoursBeforeSession: LOCK_HOURS_BEFORE_SESSION
        });

        return lockTime;
    } catch (error) {
        console.error('❌ Error calculating lock time:', error);
        return null;
    }
}

/**
 * Check if the session is currently locked (past lock time)
 * @returns {boolean} true if session is locked, false otherwise
 */
function isSessionLocked() {
    // Session cannot be locked if not published or already closed/archived
    if (!state.published || state.closed) {
        return false;
    }

    // Session cannot be locked during maintenance mode (maintenance takes priority)
    if (state.maintenanceMode) {
        return false;
    }

    const lockTime = calculateSessionLockTime();
    if (!lockTime) {
        // Unable to parse time - default to NOT locked (safe fallback)
        console.warn('⚠️ Unable to calculate lock time, defaulting to unlocked');
        return false;
    }

    const now = new Date();
    const isLocked = now >= lockTime;

    if (isLocked) {
        console.log('🔒 Session is LOCKED (current time past lock time)');
    }

    return isLocked;
}

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
        // generateShareLink(); // DISABLED - function does not exist

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
            state.paymentAmount = data.paymentAmount !== undefined ? data.paymentAmount : 10;
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

    // NEW: Check if session is locked
    if (isSessionLocked()) {
        const lockTime = calculateSessionLockTime();
        const lockTimeStr = lockTime ? lockTime.toLocaleString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
        }) : 'N/A';

        alert(
            `🔒 Registration is closed / ปิดรับลงทะเบียนแล้ว\n\n` +
            `The session is locked ${LOCK_HOURS_BEFORE_SESSION} hours before start time.\n` +
            `เซสชันถูกล็อค ${LOCK_HOURS_BEFORE_SESSION} ชั่วโมงก่อนเวลาเริ่ม\n\n` +
            `Session time / เวลาเล่น: ${state.sessionTime}\n` +
            `Locked since / ล็อคตั้งแต่: ${lockTimeStr}\n\n` +
            `Registration is no longer possible.\n` +
            `ไม่สามารถลงทะเบียนได้อีกต่อไป`
        );
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

    // Get FRESH player data from Firestore (not from state which might be stale)
    const playersSnapshot = await playersRef().get();
    const currentPlayerCount = playersSnapshot.size;
    const currentPlayers = [];
    playersSnapshot.forEach(doc => {
        currentPlayers.push({ id: doc.id, ...doc.data() });
    });

    // Check if already registered (by name)
    if (currentPlayers.find(p => p.name === name)) {
        alert('This name is already registered / ชื่อนี้ลงทะเบียนแล้ว');
        return;
    }

    // Check balance and deduct payment IMMEDIATELY (for all players, including waiting list)
    const currentBalance = authorizedUser.balance || 0;
    if (currentBalance < MINIMUM_BALANCE) {
        alert(`x12 Insufficient balance / ยอดเงินไม่เพียงพอ\n\nCurrent: ${currentBalance} THB\nNeeded: ${MINIMUM_BALANCE} THB\n\nยอดเงินปัจจุบัน: ${currentBalance} บาท\nต้องการ: ${MINIMUM_BALANCE} บาท`);
        return;
    }

    try {
        // Deduct payment BEFORE adding to Firestore
        const isWaitingList = currentPlayerCount >= state.maxPlayers;
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
            position: currentPlayerCount + 1
        };

        console.log('🔵 Adding player to sessions/' + currentSessionId + '/players');
        const docRef = await playersRef().add(playerData);
        console.log('✅ SUCCESS! Player added with ID:', docRef.id);

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
        console.error('❌ ERROR adding player:', error.code, '-', error.message);
        console.error('Full error:', error);

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

    // NEW: Check if session is locked
    if (isSessionLocked()) {
        const lockTime = calculateSessionLockTime();
        const lockTimeStr = lockTime ? lockTime.toLocaleString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
        }) : 'N/A';

        alert(
            `🔒 Guest registration is closed / ปิดรับลงทะเบียนแขกแล้ว\n\n` +
            `The session is locked ${LOCK_HOURS_BEFORE_SESSION} hours before start time.\n` +
            `เซสชันถูกล็อค ${LOCK_HOURS_BEFORE_SESSION} ชั่วโมงก่อนเวลาเริ่ม\n\n` +
            `Locked since / ล็อคตั้งแต่: ${lockTimeStr}`
        );
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

    // Get FRESH player data from Firestore (not from state which might be stale)
    const playersSnapshot = await playersRef().get();
    const currentPlayerCount = playersSnapshot.size;
    const currentPlayers = [];
    playersSnapshot.forEach(doc => {
        currentPlayers.push({ id: doc.id, ...doc.data() });
    });

    // Check if guest name already exists
    if (currentPlayers.find(p => p.name === fullGuestName)) {
        alert('This guest is already registered / แขกคนนี้ลงทะเบียนแล้ว');
        return;
    }

    // Check if there's space available
    if (currentPlayerCount >= state.maxPlayers) {
        // Ask if user wants to join waiting list
        if (!confirm(`Session is full (${state.maxPlayers}/${state.maxPlayers})\n\nJoin waiting list? / เซสชันเต็มแล้ว เข้าสู่รายการรอ?`)) {
            return;
        }
    }

    // Check balance from host and deduct payment IMMEDIATELY
    const currentBalance = state.loggedInUser.balance || 0;
    if (currentBalance < MINIMUM_BALANCE) {
        alert(`x13 Insufficient balance / ยอดเงินไม่เพียงพอ\n\nCurrent: ${currentBalance} THB\nNeeded: ${MINIMUM_BALANCE} THB\n\nยอดเงินปัจจุบัน: ${currentBalance} บาท\nต้องการ: ${MINIMUM_BALANCE} บาท`);
        return;
    }

    try {
        // Deduct payment from host BEFORE adding guest to Firestore
        const isWaitingList = currentPlayerCount >= state.maxPlayers;
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
            position: currentPlayerCount + 1
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





// ============================================================================
// SIMPLE LINE NOTIFICATION API
// ============================================================================





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



// ============================================
// CLOSE LAST SESSION - Session Summary
// ============================================









// ============================================
// SESSION ACCOUNTING - Income & Expenses
// ============================================





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

        // DISABLED: Line notifications stopped working reliably (quota issues)
        /*
        const sendNotification = functions.httpsCallable('sendSessionAnnouncement');

        const notificationData = {
            sessionDay: state.sessionDay || 'วันจันทร์ / Monday',
            sessionDate: state.sessionDate || '01/01/2025',
            sessionTime: state.sessionTime || '18:00 - 20:00',
            currentPlayers: playerNames.length,  // Use actual player count
            maxPlayers: state.maxPlayers,
            availableSpots: state.maxPlayers - playerNames.length,  // Calculate based on mock data
            waitingListCount: waitingListNames.length,
            paymentAmount: state.paymentAmount,
            appUrl: PRODUCTION_URL,  // Always use production URL for Line messages
            playerNames: playerNames,
            waitingListNames: waitingListNames
        };

        console.log('📤 TEST: Sending session announcement...', notificationData);
        const result = await sendNotification(notificationData);

        console.log('✅ Session announcement sent:', result.data);
        alert('✅ Session announcement sent!\n\nประกาศเซสชันส่งไปแล้ว!');
        */
        console.log('📤 Line notifications disabled');
        alert('ℹ️ Line notifications are currently disabled\n\nLine notifications ถูกปิดใช้งานชั่วคราว');
    } catch (error) {
        console.error('❌ Error sending session announcement:', error);
        alert(`❌ Failed to send:\n\n${error.message}`);
    }
}





















// ============================================
// WEEKLY BALANCE REPORT
// ============================================

















// ============================================
// LINE NOTIFICATIONS
// ============================================



// ============================================
// CANCEL REGISTRATION
// ============================================

async function cancelRegistration() {
    // Check maintenance mode
    if (state.maintenanceMode && !state.isAdmin) {
        alert('System is under maintenance. Please wait.\nระบบกำลังปรับปรุง กรุณารอสักครู่');
        return;
    }

    // NEW: Check if session is locked
    if (isSessionLocked()) {
        const lockTime = calculateSessionLockTime();
        const lockTimeStr = lockTime ? lockTime.toLocaleString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
        }) : 'N/A';

        alert(
            `🔒 Cancellation is not allowed / ไม่สามารถยกเลิกได้\n\n` +
            `The session is locked ${LOCK_HOURS_BEFORE_SESSION} hours before start time.\n` +
            `เซสชันถูกล็อค ${LOCK_HOURS_BEFORE_SESSION} ชั่วโมงก่อนเวลาเริ่ม\n\n` +
            `Session time / เวลาเล่น: ${state.sessionTime}\n` +
            `Locked since / ล็อคตั้งแต่: ${lockTimeStr}\n\n` +
            `Your registration is now final.\n` +
            `การลงทะเบียนของคุณเป็นสิ้นสุดแล้ว`
        );
        return;
    }

    // Check if user is logged in
    if (!state.loggedInUser) {
        alert('Please log in first / กรุณาเข้าสู่ระบบก่อน');
        return;
    }

    const userName = state.loggedInUser.name;
    const userId = state.loggedInUser.userId;

    // Find the player (may be null if host only registered guests)
    const currentPlayer = state.players.find(p => p.name === userName);

    // Check if user has registered guests
    const userGuests = state.players.filter(p => p.guestOf === userId);

    // If user is not registered AND has no guests, nothing to cancel
    if (!currentPlayer && userGuests.length === 0) {
        alert('You are not registered / คุณไม่ได้ลงทะเบียน');
        return;
    }

    // Calculate refund based on what will be cancelled
    const selfRefund = currentPlayer ? state.paymentAmount : 0;
    const guestRefund = userGuests.length * state.paymentAmount;
    const totalRefund = selfRefund + guestRefund;

    // Build confirmation message based on what will be cancelled
    let confirmMessage = '';

    if (currentPlayer && userGuests.length > 0) {
        // Both self and guests
        confirmMessage = `Cancel your registration and ${userGuests.length} guest(s)?\n`;
        confirmMessage += `ยกเลิกการลงทะเบียนของคุณและแขก ${userGuests.length} คน?\n\n`;
        confirmMessage += `You: ${userName}\n`;
        confirmMessage += `Guests:\n`;
        userGuests.forEach(g => {
            const guestNameOnly = g.name.split(' friend: ')[1] || g.name.split(' venn: ')[1] || g.name.split(' + ')[1];
            confirmMessage += `  - ${guestNameOnly}\n`;
        });
        confirmMessage += `\nTotal refund: ${totalRefund} THB\n`;
        confirmMessage += `รวมเงินคืน: ${totalRefund} บาท`;
    } else if (currentPlayer) {
        // Only self (no guests)
        confirmMessage = `Cancel your registration? / ยกเลิกการลงทะเบียน?\n\n`;
        confirmMessage += `This will remove you from the player list.\n`;
        confirmMessage += `Refund: ${state.paymentAmount} THB`;
    } else {
        // Only guests (user not registered themselves)
        confirmMessage = `Cancel your ${userGuests.length} guest registration(s)?\n`;
        confirmMessage += `ยกเลิกการลงทะเบียนแขก ${userGuests.length} คน?\n\n`;
        confirmMessage += `Guests:\n`;
        userGuests.forEach(g => {
            const guestNameOnly = g.name.split(' friend: ')[1] || g.name.split(' venn: ')[1] || g.name.split(' + ')[1];
            confirmMessage += `  - ${guestNameOnly}\n`;
        });
        confirmMessage += `\nTotal refund: ${guestRefund} THB\n`;
        confirmMessage += `รวมเงินคืน: ${guestRefund} บาท`;
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

        // Cancel self registration (if registered)
        if (currentPlayer) {
            // Refund the payment amount for main player
            await updateUserBalance(
                userId,
                userName,
                state.paymentAmount,
                `Refund for cancelled registration ${state.sessionDate}`
            );

            // Delete player from Firestore
            await playersRef().doc(currentPlayer.id).delete();
            console.log(`✅ Registration cancelled for: ${userName}`);
        }

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

        // Recalculate positions so waiting list players move up correctly
        await recalculatePlayerPositions();

        // NOTE: Line notification is now sent automatically by Firestore trigger (onPlayerDeleted)
        // No need to call sendLineCancellationNotification() from frontend anymore
        // This ensures notification is sent even if user's phone/browser has issues

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

    // Check if sufficient balance (must have minimum balance)
    if (currentBalance < MINIMUM_BALANCE) {
        alert(`x1 Insufficient balance / ยอดเงินไม่เพียงพอ\n\nBalance: ${currentBalance} THB\nNeeded: ${MINIMUM_BALANCE} THB\n\nยอดเงิน: ${currentBalance} บาท\nต้องการ: ${MINIMUM_BALANCE} บาท\n\nPlease contact admin to top up your wallet.`);
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
    // Confirm logout
    if (!confirm('Logout? / ออกจากระบบ?')) {
        return;
    }

    state.loggedInUser = null;
    localStorage.removeItem('loggedInUser');
    updateUI();
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
        // DISABLED: Line notifications stopped working reliably (quota issues)
        /*
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
        */
        console.log('📤 Line notifications disabled (password reset)');

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
        // Already paid - show green button with "จ่ายแล้ว ✓"
        qrContainer.innerHTML = `
            <div style="text-align: center;">
                <button style="padding: 12px 24px; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: not-allowed; font-weight: bold;" disabled>
                    <span class="thai-text">จ่ายแล้ว ✓</span><br><span class="eng-text" style="color: rgba(255,255,255,0.8);">Paid</span>
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
            if (balance < MINIMUM_BALANCE) {
                balanceEl.style.color = '#ef4444'; // Red - insufficient for registration
            } else if (balance < 140) {
                balanceEl.style.color = '#f59e0b'; // Orange - low balance warning
            } else {
                balanceEl.style.color = '#10b981'; // Green - healthy balance
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

                // NEW: Disable cancel button if session is locked
                if (isSessionLocked()) {
                    cancelBtnEl.disabled = true;
                    cancelBtnEl.style.background = '#9ca3af';
                    cancelBtnEl.style.cursor = 'not-allowed';
                    cancelBtnEl.innerHTML = `<span class="thai-text">ไม่สามารถยกเลิกได้</span><br><span class="eng-text">Cancellation Locked</span>`;
                } else {
                    cancelBtnEl.disabled = false;
                    cancelBtnEl.style.background = '#ef4444';
                    cancelBtnEl.style.cursor = 'pointer';
                    cancelBtnEl.innerHTML = `<span class="thai-text">ยกเลิก</span><br><span class="eng-text">Cancel Registration</span>`;
                }

                // Show "Register Guest" button ONLY when user is registered themselves
                const guestBtnEl = document.getElementById('guestRegistrationBtn');
                if (guestBtnEl) {
                    guestBtnEl.style.display = 'block';
                }

                // Show "Give 100 baht" button when logged in
                const give100BtnEl = document.getElementById('give100BahtBtn');
                if (give100BtnEl) {
                    give100BtnEl.style.display = 'block';
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

                console.log("userBalance:", userBalance);
                console.log("MINIMUM_BALANCE:", MINIMUM_BALANCE);

                if (userBalance < MINIMUM_BALANCE) {
                    // Insufficient balance - gray button with warning
                    signupButton.disabled = true;
                    signupButton.style.background = '#9ca3af';
                    signupButton.style.cursor = 'not-allowed';
                    signupButton.innerHTML = `<span class="thai-text">ยอดเงินไม่เพียงพอ</span><br><span class="eng-text">xx Insufficient Balance</span><br><small style="font-size: 12px;">ยอดเงิน: ${userBalance} THB (ต้องการ: ${MINIMUM_BALANCE} THB)</small>`;
                } else {
                    // Sufficient balance - green button
                    signupButton.disabled = false;
                    signupButton.style.background = '#10b981';
                    signupButton.style.cursor = 'pointer';

                    // NEW: Check if session is locked
                    if (isSessionLocked()) {
                        // Session locked - gray out button
                        signupButton.disabled = true;
                        signupButton.style.background = '#9ca3af';
                        signupButton.style.cursor = 'not-allowed';
                        signupButton.innerHTML = `<span class="thai-text">ปิดรับลงทะเบียนแล้ว</span><br><span class="eng-text">Registration Closed</span>`;
                    } else {
                        // Normal flow - show join button
                        signupButton.innerHTML = `<span class="thai-text">ลงทะเบียน ${state.loggedInUser.name}</span><br><span class="eng-text">Join as ${state.loggedInUser.name}</span>`;
                    }
                }

                // Hide "Register Guest" button - user must register themselves first
                const guestBtnEl = document.getElementById('guestRegistrationBtn');
                if (guestBtnEl) {
                    guestBtnEl.style.display = 'none';
                }

                // Show "Give 100 baht" button when logged in (even if not registered)
                const give100BtnEl = document.getElementById('give100BahtBtn');
                if (give100BtnEl) {
                    give100BtnEl.style.display = 'block';
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

        // Hide "Give 100 baht" button when not logged in
        const give100BtnEl = document.getElementById('give100BahtBtn');
        if (give100BtnEl) {
            give100BtnEl.style.display = 'none';
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

    // NEW: Show/hide locked banner
    const lockedBanner = document.getElementById('lockedBanner');
    if (lockedBanner) {
        if (isSessionLocked()) {
            lockedBanner.style.display = 'block';

            // Update lock time info
            const lockedTimeInfo = document.getElementById('lockedTimeInfo');
            if (lockedTimeInfo) {
                const lockTime = calculateSessionLockTime();
                const lockTimeStr = lockTime ? lockTime.toLocaleString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit'
                }) : '';

                lockedTimeInfo.textContent = `Locked since ${lockTimeStr} (${LOCK_HOURS_BEFORE_SESSION}h before session)`;
            }
        } else {
            lockedBanner.style.display = 'none';
        }
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

        // Hide registration form, cancel button and guest button
        if (registrationFormEl) registrationFormEl.style.display = 'none';
        if (cancelBtnEl) cancelBtnEl.style.display = 'none';
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

    // Update session info - split Thai/English and display Thai larger
    const dayParts = state.sessionDay.split(' / ');
    if (dayParts.length === 2) {
        document.getElementById('sessionDay').innerHTML = `<span class="thai-text">${dayParts[0]}</span> <span class="eng-text">${dayParts[1]}</span>`;
    } else {
        document.getElementById('sessionDay').textContent = state.sessionDay;
    }
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
    }

    // Hide player list for regular users when session is not published
    const userRole = state.loggedInUser.role || 'user';
    const isAdminOrModerator = (userRole === 'admin' || userRole === 'moderator');

    if (!state.published && !isAdminOrModerator) {
        if (playersListContainer) {
            playersListContainer.style.display = 'none';
        }
        return; // Exit early, don't render player list for regular users
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
            badge.textContent = 'จ่ายแล้ว ✓';
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
    // updateAdminButtonVisibility(); // DISABLED - function does not exist
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
 * Define all action buttons for each group
 */
const adminGroupButtons = {
    setup: [
        { label: 'New', onclick: 'clearSession()', bg: '#ef4444', color: 'white' },
        { label: 'Edit', onclick: 'changeSessionDetails()', bg: '#f59e0b' },
        { label: 'Pay Amt', onclick: 'changePaymentAmount()', bg: '#f59e0b' },
        { label: 'Max Pl', onclick: 'changeMaxPlayers()', bg: '#f59e0b' },
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
        { label: 'Regular', onclick: 'manageRegularPlayers()', bg: '#f59e0b' },
        { label: 'Wallets', onclick: 'manageWallets()', bg: '#10b981', color: 'white' },
        { label: 'Remove', onclick: 'removePlayerFromSession()', bg: '#ef4444', color: 'white' }
    ],
    money: [
        { label: 'Trans', onclick: 'viewTransactions()', bg: '#3b82f6', color: 'white' },
        { label: 'Report', onclick: 'viewAccountingReport()', bg: '#8b5cf6', color: 'white', bold: true },
        { label: 'Debug', onclick: 'debugViewRawData()', bg: '#f59e0b' },
        { label: 'Expense', onclick: 'addManualExpense()', bg: '#ef4444', color: 'white' }
    ],
    line: [
        { label: '📢 Announce Session', onclick: 'showSessionAnnouncement()', bg: '#10b981', color: 'white', bold: true },
        { label: 'Config', onclick: 'testLineConfig()', bg: '#9ca3af', color: 'white' },
        { label: 'Demo', onclick: 'testDemoLine()', bg: '#9ca3af', color: 'white' },
        { label: 'Test', onclick: 'testLineMessage()', bg: '#9ca3af', color: 'white' },
        { label: 'Announce', onclick: 'testSessionAnnouncement()', bg: '#9ca3af', color: 'white' },
        { label: 'Cancel', onclick: 'testCancellationNotification()', bg: '#9ca3af', color: 'white' },
        { label: 'Nudge', onclick: 'testNudgeNotification()', bg: '#9ca3af', color: 'white' },
        { label: 'Reset', onclick: 'testPasswordResetNotification()', bg: '#9ca3af', color: 'white' },
        { label: 'Extra', onclick: 'sendExtraCourtMessage()', bg: '#9ca3af', color: 'white' }
    ],
    settings: [
        { label: 'Weekly', onclick: 'generateWeeklyReport()', bg: '#f59e0b', color: 'white', bold: true },
        { label: 'Maint', onclick: 'toggleMaintenanceMode()', bg: '#ef4444', color: 'white', bold: true },
        { label: 'Export', onclick: 'exportList()', bg: '#3b82f6', color: 'white' },
        { label: '🔔 Enable', onclick: 'enablePushNotifications()', bg: '#9ca3af', color: 'white' },
        { label: '🧪 Lokal', onclick: 'testPushNotification()', bg: '#9ca3af', color: 'white' },
        { label: '🚀 FCM', onclick: 'testRealFCM()', bg: '#9ca3af', color: 'white' }
    ]
};















// ============================================
// MAINTENANCE MODE
// ============================================



// Track which setup steps are completed




// ============================================
// USER MODAL: showMyTransactions
// ============================================

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
            // Handle missing timestamps - put them at the end
            if (!a.timestamp && !b.timestamp) return 0;
            if (!a.timestamp) return 1;  // a goes after b (to the end)
            if (!b.timestamp) return -1; // b goes after a (to the end)

            // Sort by actual timestamp (newest first)
            return b.timestamp.toMillis() - a.timestamp.toMillis();
        });

        // Limit to 20 newest
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

// ============================================
// USER MODAL: closeMyTransactions
// ============================================

function closeMyTransactions() {
    document.getElementById('userTransactionModal').style.display = 'none';
}

// ============================================
// USER MODAL: showGive100Modal
// ============================================

async function showGive100Modal() {
    // Check if user is logged in
    if (!state.loggedInUser) {
        alert('Please login first / กรุณาเข้าสู่ระบบก่อน');
        return;
    }

    // DEBUG: Log entire state.loggedInUser object
    console.log('🔍 === DEBUG: state.loggedInUser ===');
    console.log(JSON.stringify(state.loggedInUser, null, 2));
    console.log('🔍 === END DEBUG ===');

    // Get current user's ACTUAL balance from Firebase (not from state)
    const userId = state.loggedInUser.userId || state.loggedInUser.id;
    const userName = state.loggedInUser.name;

    console.log(`🔍 Looking up user in Firebase:`);
    console.log(`   Name: ${userName}`);
    console.log(`   ID from state: ${userId}`);

    let currentBalance = 0;
    let actualUserId = userId;

    try {
        // First try with the ID from state
        let userDoc = await usersRef.doc(userId).get();

        if (!userDoc.exists) {
            // ID didn't work - try finding by name instead
            console.warn(`⚠️ User ID ${userId} not found, searching by name: ${userName}`);
            const snapshot = await usersRef.where('name', '==', userName).get();
            if (snapshot.empty) {
                alert(`Error: User "${userName}" not found in database / ข้อผิดพลาด: ไม่พบผู้ใช้ "${userName}" ในฐานข้อมูล`);
                return;
            }
            userDoc = snapshot.docs[0];
            actualUserId = userDoc.id;
            console.log(`✅ Found user by name. Actual ID: ${actualUserId}`);
        }

        const userData = userDoc.data();
        currentBalance = userData.balance || 0;
        console.log(`💰 User data from Firebase:`);
        console.log(`   Name: ${userData.name}`);
        console.log(`   Balance: ${currentBalance} THB`);
        console.log(`   Document ID: ${actualUserId}`);

    } catch (error) {
        console.error('Error fetching user balance:', error);
        alert('Error loading balance / ข้อผิดพลาดในการโหลดยอดเงิน');
        return;
    }

    // Check if user has enough balance (100 THB + minimum balance)
    const transferAmount = 100;
    const requiredBalance = transferAmount + MINIMUM_BALANCE;
    if (currentBalance < requiredBalance) {
        alert(`Insufficient balance / ยอดเงินไม่เพียงพอ\n\nYour balance: ${currentBalance} THB\nRequired: ${requiredBalance} THB (${transferAmount} THB transfer + ${MINIMUM_BALANCE} THB minimum)\n\nคุณ: ${state.loggedInUser.name}\nยอดเงินของคุณ: ${currentBalance} บาท\nต้องการ: ${requiredBalance} บาท (${transferAmount} บาท + ${MINIMUM_BALANCE} บาทขั้นต่ำ)`);
        return;
    }

    // Get all ACTIVE users with balance less than MINIMUM_BALANCE (including negative balances)
    const lowBalanceUsers = state.authorizedUsers.filter(user => {
        const balance = user.balance || 0;
        const isActive = user.active !== false; // Default to true if not set
        // Exclude current user, inactive users, and only show users with balance < MINIMUM_BALANCE
        const currentUserId = state.loggedInUser.userId || state.loggedInUser.id;
        const userId = user.userId || user.id;
        return userId !== currentUserId && isActive && balance < MINIMUM_BALANCE;
    });

    const recipientsList = document.getElementById('give100RecipientsList');
    const noRecipients = document.getElementById('give100NoRecipients');

    if (lowBalanceUsers.length === 0) {
        // No users with low balance
        recipientsList.innerHTML = '';
        recipientsList.style.display = 'none';
        noRecipients.style.display = 'block';
    } else {
        // Show users as clickable buttons
        noRecipients.style.display = 'none';
        recipientsList.style.display = 'block';
        recipientsList.innerHTML = lowBalanceUsers
            .sort((a, b) => (a.balance || 0) - (b.balance || 0)) // Sort by balance (lowest first)
            .map(user => {
                const balance = user.balance || 0;
                const userId = user.userId || user.id; // Support both field names
                // Escape special characters in name for safe display
                const safeName = user.name.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                return `
                    <button onclick="give100BahtById('${userId}')"
                            data-user-id="${userId}"
                            data-user-name="${safeName}"
                            data-user-balance="${balance}"
                            style="width: 100%; padding: 15px; margin-bottom: 10px; background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; cursor: pointer; text-align: left; font-size: 15px; transition: all 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="font-size: 16px; color: #92400e;">${user.name}</strong>
                                <br>
                                <span style="color: #dc2626; font-weight: bold;">Balance: ${balance} THB</span>
                            </div>
                            <div style="font-size: 24px;">👉</div>
                        </div>
                    </button>
                `;
            }).join('');
    }

    // Show modal
    document.getElementById('give100Modal').style.display = 'flex';
}

// ============================================
// USER MODAL: give100Baht
// ============================================

async function give100Baht(recipientId, recipientName, recipientBalance) {
    // Confirm transfer
    const confirmed = confirm(
        `Give 100 baht to ${recipientName}?\n` +
        `ให้ 100 บาท กับ ${recipientName}?\n\n` +
        `Their current balance: ${recipientBalance} THB\n` +
        `After transfer: ${recipientBalance + 100} THB\n\n` +
        `Your balance will decrease by 100 THB`
    );

    if (!confirmed) return;

    try {
        const giverId = state.loggedInUser.userId || state.loggedInUser.id;
        const giverName = state.loggedInUser.name;

        console.log(`🎁 Starting transfer: ${giverName} (ID: ${giverId}) → ${recipientName} (ID: ${recipientId}) (100 THB)`);

        // Deduct 100 from giver
        const giverSuccess = await updateUserBalance(
            giverId,
            giverName,
            -100,
            `Gift to ${recipientName} / มอบให้ ${recipientName}`
        );

        console.log(`🎁 Giver deduction result:`, giverSuccess);

        if (!giverSuccess) {
            alert('Transfer failed - Could not deduct from your balance / การโอนล้มเหลว - ไม่สามารถหักเงินจากคุณได้');
            return;
        }

        // Add 100 to recipient
        const recipientSuccess = await updateUserBalance(
            recipientId,
            recipientName,
            100,
            `Gift from ${giverName} / ของขวัญจาก ${giverName}`
        );

        console.log(`🎁 Recipient addition result:`, recipientSuccess);

        if (!recipientSuccess) {
            // If recipient update fails, refund the giver
            console.log(`🎁 Refunding giver...`);
            await updateUserBalance(
                giverId,
                giverName,
                100,
                `Refund - failed gift / คืนเงิน - การมอบล้มเหลว`,
                true // silent
            );
            alert('Transfer failed - Could not add to recipient balance / การโอนล้มเหลว - ไม่สามารถเพิ่มเงินให้ผู้รับได้');
            return;
        }

        // Success!
        alert(
            `✅ Transfer successful! / โอนสำเร็จ!\n\n` +
            `You gave 100 THB to ${recipientName}\n` +
            `คุณให้ 100 บาท กับ ${recipientName}\n\n` +
            `Your new balance: ${(state.loggedInUser.balance || 0)} THB`
        );

        // Close modal and refresh
        closeGive100Modal();
        await refreshBalance();

    } catch (error) {
        console.error('Error in give100Baht:', error);
        alert('Transfer failed. Please try again. / การโอนล้มเหลว กรุณาลองใหม่');
    }
}

// ============================================
// USER MODAL: give100BahtById
// ============================================

async function give100BahtById(recipientId) {
    // Find recipient in authorized users (support both userId and id fields)
    const recipient = state.authorizedUsers.find(u => {
        const userId = u.userId || u.id;
        return userId === recipientId;
    });

    console.log(`🔍 Looking for user with ID: ${recipientId}`);
    console.log(`🔍 Found ${state.authorizedUsers.length} users in state`);
    console.log(`🔍 Recipient found:`, recipient);

    if (!recipient) {
        alert('Recipient not found / ไม่พบผู้รับ');
        return;
    }

    await give100Baht(recipientId, recipient.name, recipient.balance || 0);
}

// ============================================
// USER MODAL: closeGive100Modal
// ============================================

function closeGive100Modal() {
    document.getElementById('give100Modal').style.display = 'none';
}

// ============================================
// USER MODAL: showLowBalanceWarning
// ============================================

function showLowBalanceWarning(players) {
    const modal = document.getElementById('lowBalanceWarningModal');
    const content = document.getElementById('lowBalanceWarningContent');

    let message = `<p style="font-size: 18px; margin-bottom: 15px; font-weight: bold;">❌ SOME REGULAR PLAYERS WERE NOT ADDED</p>`;
    message += `<p style="font-size: 18px; margin-bottom: 20px; font-weight: bold;">❌ ผู้เล่นประจำบางคนไม่ถูกเพิ่ม</p>`;
    message += `<p style="margin-bottom: 10px;">The following regular players have <strong>INSUFFICIENT BALANCE</strong>:</p>`;
    message += `<p style="margin-bottom: 20px;">ผู้เล่นประจำต่อไปนี้มี<strong>ยอดเงินไม่เพียงพอ</strong>:</p>`;
    message += `<div style="background: white; padding: 15px; border-radius: 8px; border: 2px solid #dc2626; margin-bottom: 20px;">`;

    players.forEach(p => {
        message += `<p style="margin: 8px 0; font-size: 16px;">`;
        message += `<strong>${p.name}</strong>: `;
        message += `<span style="color: #dc2626; font-weight: bold;">${p.balance} THB</span> `;
        message += `(needs ${state.paymentAmount} THB)`;
        message += `</p>`;
    });

    message += `</div>`;
    message += `<p style="font-size: 16px; font-weight: bold; margin-top: 20px;">⚠️ Please top up their wallets before they can join!</p>`;
    message += `<p style="font-size: 16px; font-weight: bold;">⚠️ กรุณาเติมเงินให้พวกเขาก่อนที่จะเข้าร่วมได้!</p>`;

    content.innerHTML = message;
    modal.style.display = 'block';
}

// ============================================
// USER MODAL: closeLowBalanceWarning
// ============================================

function closeLowBalanceWarning() {
    document.getElementById('lowBalanceWarningModal').style.display = 'none';
}