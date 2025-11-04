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

// Collection references
const sessionsRef = db.collection('sessions');
const usersRef = db.collection('authorizedUsers');

console.log('🔥 Firebase initialized successfully!');
