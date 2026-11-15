#!/usr/bin/env node

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

const db = admin.firestore();

async function debugRegularPlayers() {
  try {
    console.log('🔍 DEBUGGING REGULAR PLAYERS ISSUE');
    console.log('═'.repeat(60));
    
    // 1. Check current session
    console.log('\n1️⃣ Current Session:');
    const currentSession = await db.collection('sessions').doc('current').get();
    if (currentSession.exists) {
      const data = currentSession.data();
      console.log(`   day: "${data.day}"`);
      console.log(`   date: ${data.date}`);
      console.log(`   startTime: ${data.startTime}`);
      
      // Check which day number this is
      const days = [
        'วันจันทร์ / Monday',
        'วันอังคาร / Tuesday',
        'วันพุธ / Wednesday',
        'พฤหัสบดี / Thursday',
        'วันศุกร์ / Friday',
        'วันเสาร์ / Saturday',
        'อาทิตย์ / Sunday'
      ];
      const currentDayIndex = days.findIndex(d => d === data.day);
      const dayNumber = currentDayIndex + 1;
      console.log(`   dayNumber calculated: ${dayNumber} (index: ${currentDayIndex})`);
    } else {
      console.log('   ❌ Current session NOT FOUND!');
      return;
    }
    
    // 2. Check regularPlayers config
    console.log('\n2️⃣ Regular Players Config:');
    const configDoc = await db.collection('config').doc('regularPlayers').get();
    if (configDoc.exists) {
      const config = configDoc.data();
      console.log('   ✅ regularPlayers config EXISTS');
      console.log('   Fields:', Object.keys(config));
      
      // Show each day
      for (let i = 1; i <= 7; i++) {
        const dayKey = `day${i}`;
        const players = config[dayKey] || [];
        const dayName = days[i-1] || `Unknown day ${i}`;
        console.log(`   ${dayKey} (${dayName}): [${players.join(', ')}]`);
      }
    } else {
      console.log('   ❌ regularPlayers config NOT FOUND!');
      console.log('   Expected location: config/regularPlayers');
    }
    
    // 3. Check current players in session
    console.log('\n3️⃣ Current Players in Session:');
    const playersSnapshot = await db.collection('sessions').doc('current').collection('players').get();
    console.log(`   Total players: ${playersSnapshot.size}`);
    playersSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.name} (position: ${data.position}, paid: ${data.paid})`);
    });
    
    console.log('\n' + '═'.repeat(60));
    console.log('🎯 DIAGNOSIS:');
    
    const currentSession = await db.collection('sessions').doc('current').get();
    const sessionData = currentSession.data();
    const days = [
      'วันจันทร์ / Monday',
      'วันอังคาร / Tuesday',
      'วันพุธ / Wednesday',
      'พฤหัสบดี / Thursday',
      'วันศุกร์ / Friday',
      'วันเสาร์ / Saturday',
      'อาทิตย์ / Sunday'
    ];
    const currentDayIndex = days.findIndex(d => d === sessionData.day);
    const dayNumber = currentDayIndex + 1;
    const dayKey = `day${dayNumber}`;
    
    const configDoc = await db.collection('config').doc('regularPlayers').get();
    if (!configDoc.exists) {
      console.log('❌ Problem: config/regularPlayers document does NOT exist!');
      console.log('   Solution: Create it with manageRegularPlayers() in admin panel');
    } else {
      const config = configDoc.data();
      const regularPlayers = config[dayKey] || [];
      
      if (regularPlayers.length === 0) {
        console.log(`❌ Problem: ${dayKey} has NO regular players!`);
        console.log(`   Solution: Add regular players for ${sessionData.day}`);
      } else {
        console.log(`✅ Regular players found for ${dayKey}: [${regularPlayers.join(', ')}]`);
        console.log(`   These should appear when you "Initiate dagens spillere"`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugRegularPlayers();
