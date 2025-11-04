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
    sessionTime: '18:00 - 20:00',
    paymentAmount: 150,
    isAdmin: false,
    authorizedUsers: [],
    loggedInUser: null
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

async function initializeApp() {
    try {
        // Load session data
        await loadSessionData();

        // Load authorized users
        await loadAuthorizedUsers();

        // Set up realtime listeners
        setupRealtimeListeners();

        // Check if user is logged in
        checkLoggedInUser();

        // Setup event listeners
        setupEventListeners();

        // Update UI
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
            name: authorizedUser.name
        };
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
// PAYMENT MARKING
// ============================================

async function markAsPaid() {
    // Get current player from localStorage
    const userName = localStorage.getItem('userName');
    if (!userName) {
        alert('Please sign up first / กรุณาลงทะเบียนก่อน');
        return;
    }

    // Check if user is authorized
    const authorizedUser = state.authorizedUsers.find(u => u.name === userName);
    if (!authorizedUser) {
        alert('You are not authorized. Contact admin. / คุณไม่มีสิทธิ์ ติดต่อผู้ดูแล');
        return;
    }

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

        // No alert - payment status updates automatically via realtime listener
        console.log('✅ Payment marked for:', userName);
    } catch (error) {
        console.error('Error marking payment:', error);
        alert('Error marking payment. Please try again.');
    }
}

// ============================================
// LOGGED IN USER CHECK
// ============================================

function checkLoggedInUser() {
    const loggedInData = localStorage.getItem('loggedInUser');
    if (loggedInData) {
        state.loggedInUser = JSON.parse(loggedInData);
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
            name: authorizedUser.name
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

    // Generate QR code for payment
    generatePaymentQR();
}

// Generate payment QR code
function generatePaymentQR() {
    const qrContainer = document.getElementById('qrCode');

    // Simple payment button - details are handled elsewhere
    qrContainer.innerHTML = `
        <div style="width: 100%; max-width: 400px; margin: 0 auto; padding: 25px; text-align: center;">
            <button onclick="markAsPaid()" style="margin-top: 10px; padding: 20px 40px; background: #10b981; color: white; border: none; border-radius: 10px; font-size: 18px; cursor: pointer; width: 100%; font-weight: bold;">
                I have paid
            </button>
        </div>
    `;
}

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
    const registrationFormEl = document.getElementById('registrationForm');

    // If user is logged in - show who they are and hide login form
    if (state.loggedInUser) {
        userLoginEl.style.display = 'none';
        loggedInInfoEl.style.display = 'block';
        document.getElementById('loggedInName').textContent = state.loggedInUser.name;

        // Check if already registered this session
        const alreadyRegistered = state.players.find(p => p.name === state.loggedInUser.name);
        if (alreadyRegistered) {
            registrationFormEl.style.display = 'none';
        } else {
            registrationFormEl.style.display = 'block';
            // Hide name input field and update button text
            const nameInput = document.getElementById('playerName');
            const signupButton = document.querySelector('#signupForm button[type="submit"]');
            nameInput.style.display = 'none';
            nameInput.removeAttribute('required'); // Remove required when hidden!
            signupButton.textContent = `Join as ${state.loggedInUser.name} / ลงทะเบียน`;
        }
    } else {
        // Not logged in - show login form, hide logged-in info and registration form
        userLoginEl.style.display = 'block';
        loggedInInfoEl.style.display = 'none';
        registrationFormEl.style.display = 'none';

        // Reset name input and button (in case it was changed)
        const nameInput = document.getElementById('playerName');
        const signupButton = document.querySelector('#signupForm button[type="submit"]');
        if (nameInput) {
            nameInput.style.display = 'block';
            nameInput.setAttribute('required', ''); // Add required back when visible!
        }
        if (signupButton) signupButton.textContent = 'Join / เข้าร่วม';
    }

    // Update session info
    document.getElementById('sessionDate').textContent = state.sessionDate;
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
    if (password === 'admin123') { // Change this password!
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

            localStorage.removeItem('userName');
            location.reload();
        } catch (error) {
            console.error('Error clearing session:', error);
            alert('Error clearing session. Please try again.');
        }
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

        const timePrompt = 'Enter time / ใส่เวลา (e.g., 18:00 - 20:00):';
        const time = prompt(timePrompt, state.sessionTime);

        if (time) {
            state.sessionTime = time;
            await saveSessionData();
            updateUI();

            // Ask if they want to add regular players
            const addPlayers = confirm('Do you want to add regular players? / ต้องการเพิ่มผู้เล่นประจำหรือไม่?');

            if (addPlayers) {
                const regularPlayersList = `Regular players / ผู้เล่นประจำ:

Monday: John, Sarah, Mike (3 players)
Tuesday: Tom, Lisa, David, Anna (4 players)
Wednesday: Peter, Emma (2 players)
Thursday: Mark, Julia, Chris (3 players)
Friday: Alex, Sophie (2 players)
Saturday: Free play
Sunday: Tournament

Enter names separated by commas for ${state.sessionDay}:`;

                const names = prompt(regularPlayersList);

                if (names) {
                    const playerNames = names.split(',').map(n => n.trim()).filter(n => n);

                    // Add regular players
                    for (const name of playerNames) {
                        if (!state.players.find(p => p.name === name)) {
                            await playersRef().add({
                                name: name,
                                paid: false,
                                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                                position: state.players.length + 1,
                                isRegular: true
                            });
                        }
                    }

                    // Players added - will show up automatically via realtime listener
                }
            }
            // Session updated - no alert needed
        }
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
        item.innerHTML = `
            <div class="user-info">
                <strong>${user.name}</strong>
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
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('User added successfully! Default password: 123 / เพิ่มผู้ใช้สำเร็จ! รหัสผ่านเริ่มต้น: 123');
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
