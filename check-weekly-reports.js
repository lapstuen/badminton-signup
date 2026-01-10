const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./badminton-b95ac-firebase-adminsdk-q4bzt-ea51a2e89b.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkWeeklyReports() {
    console.log('📊 Checking last 2 weekly reports...\n');

    // Get all weekly reports, sorted by date
    const reportsSnapshot = await db.collection('weeklyBalance')
        .orderBy('endDate', 'desc')
        .limit(2)
        .get();

    if (reportsSnapshot.empty) {
        console.log('❌ No weekly reports found');
        return;
    }

    reportsSnapshot.forEach((doc) => {
        if (doc.id === 'summary') return; // Skip summary doc

        const data = doc.data();
        console.log('═══════════════════════════════════════');
        console.log(`Week ID: ${doc.id}`);
        console.log(`Start: ${data.startDate}, End: ${data.endDate}`);
        console.log('───────────────────────────────────────');
        console.log(`Sessions: ${data.sessionCount}`);
        console.log(`Total Players: ${data.totalPlayers}`);
        console.log(`Total Income: ${data.totalIncome} THB`);
        console.log(`Total Expense: ${data.totalExpenses} THB`);
        console.log(`  - Court: ${data.courtCost} THB`);
        console.log(`  - Shuttles: ${data.shuttlecockCost} THB`);
        console.log(`Profit: ${data.grossProfit} THB`);
        console.log('───────────────────────────────────────');

        if (data.priceCalculation) {
            const calc = data.priceCalculation;
            console.log('Price Calculation:');
            console.log(`  Weekly Cost: ${calc.weeklyCost} THB`);
            console.log(`  Base Price: ${calc.basePrice} THB/player`);
            console.log(`  Current Balance: ${calc.currentBalance} THB`);
            console.log(`  Weeks to Distribute: ${calc.weeksToDistribute}`);
            console.log(`  Players per Week: ${calc.playersPerWeek}`);
            console.log(`  Balance to Distribute (per week): ${calc.balanceToDistribute} THB`);
            console.log(`  Price Adjustment: ${calc.priceAdjustment} THB/player`);
            console.log(`  Recommended Price: ${calc.recommendedPrice} THB/player`);
            console.log('───────────────────────────────────────');

            // Verify calculation
            const expectedBalancePerWeek = calc.currentBalance / calc.weeksToDistribute;
            const expectedAdjustment = Math.round(expectedBalancePerWeek / calc.playersPerWeek);
            const expectedPrice = calc.basePrice - expectedAdjustment;

            console.log('Verification:');
            console.log(`  Expected balance/week: ${expectedBalancePerWeek.toFixed(2)} THB`);
            console.log(`  Expected adjustment: ${expectedAdjustment} THB/player`);
            console.log(`  Expected recommended price: ${expectedPrice} THB/player`);

            if (expectedPrice === calc.recommendedPrice) {
                console.log('  ✅ CORRECT!');
            } else {
                console.log(`  ❌ WRONG! Should be ${expectedPrice}, but got ${calc.recommendedPrice}`);
            }
        }
        console.log('═══════════════════════════════════════\n');
    });

    process.exit(0);
}

checkWeeklyReports().catch(console.error);
