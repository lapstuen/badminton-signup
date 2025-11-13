// ============================================
// BADMINTON APP - FIREBASE VERSION
// ============================================

// Current session ID (today's date)
let currentSessionId = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

// App state (synced with Firebase)
let state = {
    players: [],
    maxPlayers: 12,
    sessionDate: new Date().toLocaleDateString('en-GB'),
    sessionDay: 'Monday / วันจันทร์',
    sessionTime: '10:00 - 12:00',
    paymentAmount: 150,
    isAdmin: false,
    authorizedUsers: [],
    loggedInUser: null, // Now includes: { name, balance, userId }
    transactions: []
};

// Firestore references
const currentSessionRef = () => sessionsRef.doc(currentSessionId);
const playersRef = () => currentSessionRef().collection('players');

// ============================================
// INITIALIZE APP
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 App starting...');
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
            state.maxPlayers = data.maxPlayers || 12;
            state.sessionDate = data.date || state.sessionDate;
            state.sessionDay = data.day || state.sessionDay;
            state.sessionTime = data.time || state.sessionTime;
            state.paymentAmount = data.paymentAmount || 150;
            console.log('📥 Session data loaded from Firestore');
        } else {
            // Create new session
            await currentSessionRef().set({
                date: state.sessionDate,
                day: state.sessionDay,
                time: state.sessionTime,
                maxPlayers: state.maxPlayers,
                paymentAmount: state.paymentAmount,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('📝 New session created');
        }
    } catch (error) {
        console.error('Error loading session:', error);
    }
}

// Save session data to Firestore
async function saveSessionData() {
    try {
        await currentSessionRef().update({
            date: state.sessionDate,
            day: state.sessionDay,
            time: state.sessionTime,
            maxPlayers: state.maxPlayers,
            paymentAmount: state.paymentAmount
        });
        console.log('💾 Session data saved');
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
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
}

// ============================================
// USER REGISTRATION
// ============================================

async function handleSignup(e) {
    e.preventDefault();

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

    // Check and deduct balance
    const success = await updateUserBalance(
        authorizedUser.id,
        authorizedUser.name,
        -state.paymentAmount,
        `Registration for ${state.sessionDay} ${state.sessionDate}`
    );

    if (!success) {
        // Balance insufficient - don't register
        return;
    }

    try {
        // Add player to Firestore
        const playerData = {
            name,
            paid: false,
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
        alert('Error registering. Please try again.');
    }
}

// ============================================
// LINE NOTIFICATION
// ============================================

async function sendLineCancellationNotification(playerName) {
    try {
        // Get Cloud Function reference
        const sendNotification = functions.httpsCallable('sendCancellationNotification');

        // Prepare notification data
        const notificationData = {
            playerName: playerName,
            currentPlayers: state.players.length,
            maxPlayers: state.maxPlayers,
            sessionDate: state.sessionDate,
            sessionDay: state.sessionDay,
            sessionTime: state.sessionTime,
            appUrl: window.location.href
        };

        console.log('📤 Sending Line notification...', notificationData);

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
    // Check if user is logged in
    if (!state.loggedInUser) {
        alert('Please log in first / กรุณาเข้าสู่ระบบก่อน');
        return;
    }

    const userName = state.loggedInUser.name;
    const userId = state.loggedInUser.userId;

    // Confirm cancellation
    if (!confirm(`Cancel your registration? / ยกเลิกการลงทะเบียน?\n\nThis will remove you from the player list and refund ${state.paymentAmount} THB.`)) {
        return;
    }

    // Find the player
    const currentPlayer = state.players.find(p => p.name === userName);
    if (!currentPlayer) {
        alert('You are not registered / คุณไม่ได้ลงทะเบียน');
        return;
    }

    try {
        // Refund the payment amount
        await updateUserBalance(
            userId,
            userName,
            state.paymentAmount,
            `Refund for cancelled registration ${state.sessionDate}`
        );

        // Delete player from Firestore
        await playersRef().doc(currentPlayer.id).delete();

        // Send Line notification (async, don't wait)
        // TESTING MODE: Temporarily disabled to prevent spam during testing
        // sendLineCancellationNotification(userName);

        // Clear localStorage
        localStorage.removeItem('userName');

        // Hide success message and show registration form again
        document.getElementById('successMessage').style.display = 'none';
        document.getElementById('registrationForm').style.display = 'block';

        console.log('✅ Registration cancelled for:', userName);
    } catch (error) {
        console.error('Error cancelling registration:', error);
        alert('Error cancelling. Please try again.');
    }
}

// ============================================
// PAYMENT MARKING
// ============================================

// DISABLED: Mark as paid - now using wallet system instead
/*
async function markAsPaid() {
    // Check if user is logged in
    if (!state.loggedInUser) {
        alert('Please log in first / กรุณาเข้าสู่ระบบก่อน');
        return;
    }

    const userName = state.loggedInUser.name;

    // Find the player and mark as paid
    const currentPlayer = state.players.find(p => p.name === userName);
    if (!currentPlayer) {
        alert('You must be registered first / คุณต้องลงทะเบียนก่อน');
        return;
    }

    try {
        await playersRef().doc(currentPlayer.id).update({
            paid: true,
            markedPaidAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update button to show paid status
        generatePaymentQR();

        console.log('✅ Payment marked for:', userName);
    } catch (error) {
        console.error('Error marking payment:', error);
        alert('Error marking payment. Please try again.');
    }
}
*/

// ============================================
// LOGGED IN USER CHECK
// ============================================

async function checkLoggedInUser() {
    const loggedInData = localStorage.getItem('loggedInUser');
    if (loggedInData) {
        state.loggedInUser = JSON.parse(loggedInData);

        // If userId is missing (old localStorage format), find it
        if (!state.loggedInUser.userId && state.loggedInUser.name) {
            console.log('⚠️ userId missing, finding user by name:', state.loggedInUser.name);
            const user = state.authorizedUsers.find(u => u.name === state.loggedInUser.name);
            if (user) {
                state.loggedInUser.userId = user.id;
                state.loggedInUser.balance = user.balance || 0;
                localStorage.setItem('loggedInUser', JSON.stringify(state.loggedInUser));
                console.log('✅ userId restored:', state.loggedInUser.userId);
            } else {
                console.error('❌ User not found, clearing localStorage');
                localStorage.removeItem('loggedInUser');
                state.loggedInUser = null;
                return;
            }
        }

        // Refresh balance from server
        if (state.loggedInUser && state.loggedInUser.userId) {
            try {
                const userDoc = await usersRef.doc(state.loggedInUser.userId).get();
                if (userDoc.exists) {
                    state.loggedInUser.balance = userDoc.data().balance || 0;
                    localStorage.setItem('loggedInUser', JSON.stringify(state.loggedInUser));
                }
            } catch (error) {
                console.error('Error refreshing balance:', error);
            }
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
// USER LOGIN
// ============================================

async function handleLogin(e) {
    e.preventDefault();

    const name = document.getElementById('loginName').value.trim();
    const password = document.getElementById('loginPassword').value;

    // Check if user is authorized
    const authorizedUser = state.authorizedUsers.find(u => u.name === name && u.password === password);

    if (authorizedUser) {
        state.loggedInUser = {
            name: authorizedUser.name,
            balance: authorizedUser.balance || 0,
            userId: authorizedUser.id
        };
        localStorage.setItem('loggedInUser', JSON.stringify(state.loggedInUser));

        document.getElementById('loginForm').reset();
        updateUI();
        // No alert - just go straight to the app
    } else {
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

        // Check if already registered this session
        const alreadyRegistered = state.players.find(p => p.name === state.loggedInUser.name);
        if (alreadyRegistered) {
            // User is registered - show success message and cancel button
            registrationFormEl.style.display = 'none';
            cancelBtnEl.style.display = 'block';
            showSuccessMessage(alreadyRegistered);
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
        }
    } else {
        // Not logged in - show login form, hide logged-in info and registration form
        userLoginEl.style.display = 'block';
        loggedInInfoEl.style.display = 'none';
        logoutContainerEl.style.display = 'none';
        registrationFormEl.style.display = 'none';

        // Reset name input and button (in case it was changed)
        const nameInput = document.getElementById('playerName');
        const signupButton = document.querySelector('#signupForm button[type="submit"]');
        if (nameInput) {
            nameInput.style.display = 'block';
            nameInput.setAttribute('required', ''); // Add required back when visible!
        }
        if (signupButton) signupButton.innerHTML = 'Join<br>เข้าร่วม';
    }

    // Update session info
    document.getElementById('sessionDay').textContent = state.sessionDay;
    document.getElementById('sessionTime').textContent = state.sessionTime;
    document.getElementById('currentPlayers').textContent = Math.min(state.players.length, state.maxPlayers);
    document.getElementById('maxPlayers').textContent = state.maxPlayers;

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
        playerInfo.textContent = `${index + 1}. ${player.name}`;

        const statusDiv = document.createElement('div');
        statusDiv.className = 'player-status';

        if (player.paid) {
            const badge = document.createElement('span');
            badge.className = 'paid-badge';
            badge.textContent = 'Paid ✓';
            statusDiv.appendChild(badge);
        }

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

    // Update admin payment list
    if (state.isAdmin) {
        updatePaymentList();
    }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

function toggleAdmin() {
    const panel = document.getElementById('adminPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function loginAdmin() {
    const password = document.getElementById('adminPassword').value;
    if (password === '1') { // TESTING MODE - Change to secure password for production!
        state.isAdmin = true;
        document.getElementById('adminPassword').style.display = 'none';
        event.target.style.display = 'none';
        document.getElementById('adminActions').style.display = 'block';
        updatePaymentList();
    } else {
        alert('Wrong password / รหัสผ่านไม่ถูกต้อง');
    }
}

async function clearSession() {
    if (confirm('Start new session? This will delete all registrations.\nเริ่มใหม่? จะลบการลงทะเบียนทั้งหมด')) {
        try {
            // Delete all players from current session
            const snapshot = await playersRef().get();
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            // Update session date
            state.sessionDate = new Date().toLocaleDateString('en-GB');
            await saveSessionData();

            // Remove old userName (deprecated)
            localStorage.removeItem('userName');

            // Players will be automatically updated via real-time listener
            // No need to reload - admin stays logged in
            console.log('✅ Session cleared successfully');
        } catch (error) {
            console.error('Error clearing session:', error);
            alert('Error clearing session. Please try again.');
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
        'Sunday / วันอาทิตย์'
    ];

    const dayPrompt = `Select day / เลือกวัน:\n${days.map((d, i) => `${i+1}. ${d}`).join('\n')}\n\nEnter number (1-7):`;
    const dayChoice = prompt(dayPrompt);

    if (dayChoice && dayChoice >= 1 && dayChoice <= 7) {
        state.sessionDay = days[dayChoice - 1];

        const timePrompt = 'Enter time / ใส่เวลา (e.g., 10:00 - 12:00):';
        const time = prompt(timePrompt, state.sessionTime);

        if (time) {
            state.sessionTime = time;
            await saveSessionData();
            updateUI();

            // Get regular players for this day from Firestore
            const regularPlayers = await getRegularPlayersForDay(dayChoice);

            if (regularPlayers && regularPlayers.length > 0) {
                // Show which players will be added
                const confirm = window.confirm(
                    `Add regular players for ${state.sessionDay}?\n` +
                    `จะเพิ่มผู้เล่นประจำหรือไม่?\n\n` +
                    `${regularPlayers.join(', ')}\n\n` +
                    `(${regularPlayers.length} players)`
                );

                if (confirm) {
                    // Track results
                    let added = 0;
                    let skippedBalance = [];
                    let skippedAlready = 0;

                    // Add regular players
                    for (const name of regularPlayers) {
                        // Check if player already registered
                        if (!state.players.find(p => p.name === name)) {
                            // Find the user and deduct balance
                            const user = state.authorizedUsers.find(u => u.name === name);
                            if (user) {
                                // Use silent mode to avoid alert popup
                                const success = await updateUserBalance(
                                    user.id,
                                    user.name,
                                    -state.paymentAmount,
                                    `Auto-registration as regular player ${state.sessionDay}`,
                                    true // silent mode
                                );

                                if (success) {
                                    await playersRef().add({
                                        name: name,
                                        paid: false,
                                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                                        position: state.players.length + 1,
                                        isRegular: true
                                    });
                                    added++;
                                } else {
                                    skippedBalance.push(name);
                                }
                            }
                        } else {
                            skippedAlready++;
                        }
                    }

                    // Show summary
                    let message = `✅ Auto-registration complete!\n\n` +
                                 `Added: ${added} players\n`;
                    if (skippedAlready > 0) {
                        message += `Already registered: ${skippedAlready}\n`;
                    }
                    if (skippedBalance.length > 0) {
                        message += `\n⚠️ Skipped (insufficient balance):\n${skippedBalance.join(', ')}`;
                    }
                    alert(message);

                    console.log(`✅ Added ${added} regular players, skipped ${skippedBalance.length} (no balance)`);
                }
            } else {
                console.log('ℹ️ No regular players configured for this day');
            }
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
    if (newAmount && !isNaN(newAmount) && newAmount > 0) {
        state.paymentAmount = parseInt(newAmount);
        await saveSessionData();
        updateUI();
        alert(`Payment amount updated to ${state.paymentAmount} THB / อัปเดตราคาเป็น ${state.paymentAmount} บาทแล้ว`);
    }
}

async function changeMaxPlayers() {
    const newMax = prompt('New maximum players / จำนวนผู้เล่นสูงสุด:', state.maxPlayers);
    if (newMax && !isNaN(newMax) && newMax > 0) {
        state.maxPlayers = parseInt(newMax);
        await saveSessionData();
        updateUI();
    }
}

// ============================================
// REGULAR PLAYERS MANAGEMENT
// ============================================

async function manageRegularPlayers() {
    const days = [
        'Monday / วันจันทร์',
        'Tuesday / วันอังคาร',
        'Wednesday / วันพุธ',
        'Thursday / วันพฤหัสบดี',
        'Friday / วันศุกร์',
        'Saturday / วันเสาร์',
        'Sunday / วันอาทิตย์'
    ];

    // Load current configuration
    let config = {};
    try {
        const configDoc = await db.collection('config').doc('regularPlayers').get();
        if (configDoc.exists) {
            config = configDoc.data();
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }

    // Show current configuration
    let configText = 'Current regular players configuration:\n';
    configText += '═'.repeat(50) + '\n\n';

    for (let i = 1; i <= 7; i++) {
        const dayKey = `day${i}`;
        const players = config[dayKey] || [];
        configText += `${i}. ${days[i-1]}\n`;
        configText += `   Players: ${players.length > 0 ? players.join(', ') : 'None'}\n\n`;
    }

    configText += '\nEnter day number (1-7) to edit, or Cancel:';

    const dayChoice = prompt(configText);

    if (dayChoice && dayChoice >= 1 && dayChoice <= 7) {
        const dayKey = `day${dayChoice}`;
        const currentPlayers = config[dayKey] || [];

        const newPlayers = prompt(
            `Edit regular players for ${days[dayChoice - 1]}:\n\n` +
            `Current: ${currentPlayers.join(', ') || 'None'}\n\n` +
            `Enter names separated by commas:\n` +
            `(Leave empty to clear all)`,
            currentPlayers.join(', ')
        );

        if (newPlayers !== null) {
            // Update configuration
            config[dayKey] = newPlayers
                .split(',')
                .map(n => n.trim())
                .filter(n => n.length > 0);

            try {
                await db.collection('config').doc('regularPlayers').set(config);
                alert(
                    `✅ Updated regular players for ${days[dayChoice - 1]}!\n` +
                    `อัปเดตผู้เล่นประจำแล้ว!\n\n` +
                    `Players: ${config[dayKey].length > 0 ? config[dayKey].join(', ') : 'None'}`
                );
            } catch (error) {
                console.error('Error saving config:', error);
                alert('Error saving configuration. Please try again.');
            }
        }
    }
}

// ============================================
// AUTHORIZED USERS MANAGEMENT
// ============================================

function manageAuthorizedUsers() {
    const section = document.getElementById('authorizedUsersSection');
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

async function manageWallets() {
    // Load current users with balances
    let userList = 'User Wallets / ยอดเงินผู้ใช้:\n';
    userList += '═'.repeat(50) + '\n\n';

    state.authorizedUsers
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((user, index) => {
            const balance = user.balance || 0;
            userList += `${index + 1}. ${user.name}: ${balance} THB\n`;
        });

    userList += '\n' + '─'.repeat(50) + '\n';
    userList += 'Enter user number to adjust balance, or Cancel:';

    const choice = prompt(userList);

    if (!choice || isNaN(choice)) return;

    const userIndex = parseInt(choice) - 1;
    const user = state.authorizedUsers.sort((a, b) => a.name.localeCompare(b.name))[userIndex];

    if (!user) {
        alert('Invalid selection / เลือกไม่ถูกต้อง');
        return;
    }

    // Show custom modal for balance adjustment
    showBalanceAdjustModal(user);
}

async function viewTransactions() {
    const section = document.getElementById('transactionsSection');
    if (section.style.display === 'none' || !section.style.display) {
        section.style.display = 'block';
        await loadTransactions();
    } else {
        section.style.display = 'none';
    }
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

    state.players.forEach(player => {
        const item = document.createElement('div');
        item.className = 'payment-item';

        const info = document.createElement('span');
        info.textContent = player.name;

        const button = document.createElement('button');
        button.textContent = player.paid ? 'Mark Unpaid' : 'Mark Paid ✓';
        button.onclick = () => togglePayment(player.id);

        item.appendChild(info);
        item.appendChild(button);
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
