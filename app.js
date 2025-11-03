// LocalStorage keys
const STORAGE_KEYS = {
    players: 'badminton_players',
    session: 'badminton_session',
    admin: 'badminton_admin'
};

// App state
let state = {
    players: [],
    maxPlayers: 12,
    sessionDate: new Date().toLocaleDateString('en-GB'),
    sessionDay: 'Monday / วันจันทร์',
    sessionTime: '18:00 - 20:00',
    paymentAmount: 150, // Payment amount in THB
    isAdmin: false,
    regularPlayers: [] // Regular players for each day
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    updateUI();
    setupEventListeners();
    generateShareLink();
});

// Setup event listeners
function setupEventListeners() {
    document.getElementById('signupForm').addEventListener('submit', handleSignup);
}

// Load state from localStorage
function loadState() {
    const savedPlayers = localStorage.getItem(STORAGE_KEYS.players);
    const savedSession = localStorage.getItem(STORAGE_KEYS.session);
    
    if (savedPlayers) {
        state.players = JSON.parse(savedPlayers);
    }
    
    if (savedSession) {
        const session = JSON.parse(savedSession);
        state.maxPlayers = session.maxPlayers || 12;
        state.sessionDate = session.date || new Date().toLocaleDateString('en-GB');
        state.sessionDay = session.day || 'Monday / วันจันทร์';
        state.sessionTime = session.time || '18:00 - 20:00';
        state.paymentAmount = session.paymentAmount || 150;
        state.regularPlayers = session.regularPlayers || [];
    }
    
    // Check if already registered
    checkExistingRegistration();
}

// Save state to localStorage
function saveState() {
    localStorage.setItem(STORAGE_KEYS.players, JSON.stringify(state.players));
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({
        maxPlayers: state.maxPlayers,
        date: state.sessionDate,
        day: state.sessionDay,
        time: state.sessionTime,
        paymentAmount: state.paymentAmount,
        regularPlayers: state.regularPlayers
    }));
}

// Check if user already registered
function checkExistingRegistration() {
    const phone = localStorage.getItem('userPhone');
    if (phone) {
        const player = state.players.find(p => p.phone === phone);
        if (player) {
            showSuccessMessage(player);
        }
    }
}

// Handle signup
function handleSignup(e) {
    e.preventDefault();
    
    const name = document.getElementById('playerName').value.trim();
    const phone = document.getElementById('playerPhone').value.trim();
    
    if (!name || !phone) {
        alert('Please fill all fields / กรุณากรอกข้อมูลให้ครบ');
        return;
    }
    
    // Check if already registered
    if (state.players.find(p => p.phone === phone)) {
        alert('This phone number is already registered / หมายเลขนี้ลงทะเบียนแล้ว');
        return;
    }
    
    const player = {
        id: Date.now(),
        name,
        phone,
        paid: false,
        timestamp: new Date().toISOString(),
        position: state.players.length + 1
    };
    
    state.players.push(player);
    saveState();
    
    // Save phone for future visits
    localStorage.setItem('userPhone', phone);
    
    showSuccessMessage(player);
    updateUI();
    
    // Reset form
    document.getElementById('signupForm').reset();
}

// Show success message
function showSuccessMessage(player) {
    document.getElementById('registrationForm').style.display = 'none';
    document.getElementById('successMessage').style.display = 'block';
    document.getElementById('playerNumber').textContent = player.position;
    
    // Generate QR code for payment
    generatePaymentQR();
}

// Generate payment QR code
function generatePaymentQR() {
    const qrContainer = document.getElementById('qrCode');
    const currentPlayer = getCurrentPlayer();

    // Simple payment button - details are handled elsewhere
    qrContainer.innerHTML = `
        <div style="width: 100%; max-width: 400px; margin: 0 auto; padding: 25px; text-align: center;">
            <button onclick="markAsPaid()" style="margin-top: 10px; padding: 20px 40px; background: #10b981; color: white; border: none; border-radius: 10px; font-size: 18px; cursor: pointer; width: 100%; font-weight: bold;">
                I have paid
            </button>
        </div>
    `;
}

// Mark player as paid
function markAsPaid() {
    const currentPlayer = getCurrentPlayer();
    if (currentPlayer) {
        currentPlayer.paid = true;
        currentPlayer.markedPaidAt = new Date().toISOString();
        saveState();
        updateUI();
        alert('Payment marked! / บันทึกการชำระเงินแล้ว!');
    }
}

// Get current player from localStorage
function getCurrentPlayer() {
    const phone = localStorage.getItem('userPhone');
    if (phone) {
        return state.players.find(p => p.phone === phone);
    }
    return null;
}


// Update UI
function updateUI() {
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

// Admin functions
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

function updatePaymentList() {
    const paymentList = document.getElementById('paymentList');
    paymentList.innerHTML = '';
    
    state.players.forEach(player => {
        const item = document.createElement('div');
        item.className = 'payment-item';
        
        const info = document.createElement('span');
        info.textContent = `${player.name} - ${player.phone}`;
        
        const button = document.createElement('button');
        button.textContent = player.paid ? 'Mark Unpaid' : 'Mark Paid ✓';
        button.onclick = () => togglePayment(player.id);
        
        item.appendChild(info);
        item.appendChild(button);
        paymentList.appendChild(item);
    });
}

function togglePayment(playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (player) {
        player.paid = !player.paid;
        saveState();
        updateUI();
    }
}

function changePaymentAmount() {
    const newAmount = prompt('New payment amount in THB / ราคาใหม่ (บาท):', state.paymentAmount);
    if (newAmount && !isNaN(newAmount) && newAmount > 0) {
        state.paymentAmount = parseInt(newAmount);
        saveState();
        updateUI();
        alert(`Payment amount updated to ${state.paymentAmount} THB / อัปเดตราคาเป็น ${state.paymentAmount} บาทแล้ว`);
    }
}

function changeMaxPlayers() {
    const newMax = prompt('New maximum players / จำนวนผู้เล่นสูงสุด:', state.maxPlayers);
    if (newMax && !isNaN(newMax) && newMax > 0) {
        state.maxPlayers = parseInt(newMax);
        saveState();
        updateUI();
    }
}

function clearSession() {
    if (confirm('Start new session? This will delete all registrations.\nเริ่มใหม่? จะลบการลงทะเบียนทั้งหมด')) {
        state.players = [];
        state.sessionDate = new Date().toLocaleDateString('en-GB');
        localStorage.removeItem('userPhone');
        saveState();
        location.reload();
    }
}

function exportList() {
    let text = `Badminton ${state.sessionDate}\n`;
    text += '=' .repeat(30) + '\n\n';
    text += 'PLAYERS / ผู้เล่น:\n';
    
    state.players.slice(0, state.maxPlayers).forEach((player, index) => {
        text += `${index + 1}. ${player.name} - ${player.phone} ${player.paid ? '✓' : '○'}\n`;
    });
    
    if (state.players.length > state.maxPlayers) {
        text += '\nWAITING LIST / รายชื่อสำรอง:\n';
        state.players.slice(state.maxPlayers).forEach((player, index) => {
            text += `${index + 1}. ${player.name} - ${player.phone}\n`;
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
    
    // You can create a button to share via Line
    // Line share URL format: https://line.me/R/msg/text/?[URL-encoded-text]
    const lineShareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(shareText)}`;
    
    console.log('Share via Line:', lineShareUrl);
}

// New admin functions for session management
function changeSessionDetails() {
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
            saveState();
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

                    // Add regular players with special marking
                    playerNames.forEach(name => {
                        if (!state.players.find(p => p.name === name)) {
                            const player = {
                                id: Date.now() + Math.random(),
                                name: name,
                                phone: 'regular',
                                paid: false,
                                timestamp: new Date().toISOString(),
                                position: state.players.length + 1,
                                isRegular: true
                            };
                            state.players.push(player);
                        }
                    });

                    saveState();
                    updateUI();
                    alert(`Added ${playerNames.length} regular players / เพิ่มผู้เล่นประจำ ${playerNames.length} คน`);
                }
            } else {
                alert('Session updated / อัปเดตเซสชันแล้ว');
            }
        }
    }
}

