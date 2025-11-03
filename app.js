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
    promptPayNumber: '0943869220', // Ditt PromptPay nummer
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
    
    // PromptPay QR format
    const promptPayData = generatePromptPayString(state.promptPayNumber, 150);
    
    // Create clickable PromptPay link
    qrContainer.innerHTML = `
        <div style="padding: 20px; background: #f0f0f0; border-radius: 8px; text-align: center;">
            <p style="font-size: 12px; color: #666;">PromptPay</p>
            <p id="promptPayDisplay" style="font-size: 22px; font-weight: bold; margin: 10px 0; color: #1e40af;">${state.promptPayNumber}</p>
            <p style="font-size: 20px; color: #059669; font-weight: bold;">${state.paymentAmount} THB</p>
            
            <button onclick="copyPromptPayNumber()" style="margin-top: 10px; padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; width: 100%;">
                📋 Copy Number / คัดลอกเบอร์
            </button>
            
            <button onclick="openPromptPay()" style="margin-top: 8px; padding: 12px 24px; background: #059669; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; width: 100%;">
                🏦 Open Banking App / เปิดแอปธนาคาร
            </button>
            
            <div style="margin-top: 15px; padding: 15px; background: white; border-radius: 8px; text-align: left; font-size: 13px;">
                <strong>How to pay / วิธีชำระเงิน:</strong><br>
                1. Copy number above / คัดลอกเบอร์ด้านบน<br>
                2. Open your banking app / เปิดแอปธนาคาร<br>
                3. Choose PromptPay transfer / เลือกโอนเงิน PromptPay<br>
                4. Paste number & amount / วางเบอร์และจำนวนเงิน<br>
                5. Confirm transfer / ยืนยันการโอน
            </div>
        </div>
    `;
}

// Copy PromptPay number to clipboard
function copyPromptPayNumber() {
    const number = state.promptPayNumber;
    
    // Track the copy action
    const currentPlayer = getCurrentPlayer();
    if (currentPlayer) {
        currentPlayer.copiedNumber = true;
        currentPlayer.copiedAt = new Date().toISOString();
        saveState();
    }
    
    // Copy to clipboard
    navigator.clipboard.writeText(number).then(() => {
        // Visual feedback
        const button = event.target;
        const originalText = button.innerHTML;
        button.innerHTML = '✅ Copied! / คัดลอกแล้ว!';
        button.style.background = '#10b981';
        
        // Show amount reminder
        setTimeout(() => {
            alert(`Number copied: ${number}\nAmount to transfer: ${state.paymentAmount} THB\n\nเบอร์คัดลอกแล้ว: ${number}\nจำนวนเงิน: ${state.paymentAmount} บาท`);
        }, 300);
        
        setTimeout(() => {
            button.innerHTML = originalText;
            button.style.background = '#3b82f6';
        }, 2000);
    }).catch(err => {
        // Fallback for older browsers
        alert(`PromptPay: ${number}\nAmount: ${state.paymentAmount} THB`);
    });
}

// Track PromptPay clicks
function openPromptPay() {
    const currentPlayer = getCurrentPlayer();
    if (currentPlayer) {
        // Mark that this player clicked payment link
        currentPlayer.clickedPaymentLink = true;
        currentPlayer.paymentLinkClickedAt = new Date().toISOString();
        saveState();
        
        // Show confirmation
        alert('Opening PromptPay app... / เปิดแอป PromptPay...\n\nPayment link clicked recorded! / บันทึกการคลิกลิงก์แล้ว!');
    }
    
    // Create PromptPay deep link (if supported)
    const promptPayUrl = `promptpay://pay?mobileno=${state.promptPayNumber}&amount=${state.paymentAmount}`;
    
    // Try to open PromptPay app, fallback to showing number
    try {
        window.open(promptPayUrl, '_blank');
    } catch (error) {
        alert(`PromptPay Number: ${state.promptPayNumber}\nAmount: ${state.paymentAmount} THB\n\nCopy this number to your banking app / คัดลอกหมายเลขนี้ไปยังแอปธนาคาร`);
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

// Generate PromptPay string (simplified version)
function generatePromptPayString(phoneNumber, amount) {
    // This would normally generate the actual PromptPay QR data
    // For production, use a proper PromptPay QR generator library
    return `promptpay://${phoneNumber}/${amount}`;
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
        playerInfo.textContent = player.name;
        
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
        document.getElementById('adminActions').style.display = 'block';
        updatePaymentList();
        alert('Logged in as admin / เข้าสู่ระบบสำเร็จ');
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
            alert('Session updated / อัปเดตเซสชันแล้ว');
        }
    }
}

function addRegularPlayers() {
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
                    name: name + ' (Regular)',
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
}