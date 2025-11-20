// Firebase Configuration for Badminton App
const firebaseConfig = {
    apiKey: "AIzaSyCYPRnwPGwCJmts58XG3qOBaMGMtgxt5yM",
    authDomain: "badminton-b95ac.firebaseapp.com",
    projectId: "badminton-b95ac",
    storageBucket: "badminton-b95ac.firebasestorage.app",
    messagingSenderId: "667668341395",
    appId: "1:667668341395:web:a924da2977c1106865a366"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Initialize Functions
const functions = firebase.functions();

// For local testing, uncomment this:
// functions.useEmulator('localhost', 5001);

// Collection references
const sessionsRef = db.collection('sessions');
const usersRef = db.collection('authorizedUsers');
const transactionsRef = db.collection('transactions');
const incomeRef = db.collection('income');
const expensesRef = db.collection('expenses');
const passwordResetsRef = db.collection('passwordResets');
const weeklyBalanceRef = db.collection('weeklyBalance');

console.log('🔥 Firebase initialized successfully!');
