// Firebase Messaging Service Worker
// Handles background push notifications

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize Firebase in service worker
firebase.initializeApp({
    apiKey: "AIzaSyCYPRnwPGwCJmts58XG3qOBaMGMtgxt5yM",
    authDomain: "badminton-b95ac.firebaseapp.com",
    projectId: "badminton-b95ac",
    storageBucket: "badminton-b95ac.firebasestorage.app",
    messagingSenderId: "667668341395",
    appId: "1:667668341395:web:a924da2977c1106865a366"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);

    const notificationTitle = payload.notification?.title || 'Badminton Update';
    const notificationOptions = {
        body: payload.notification?.body || 'New update available',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'badminton-notification',
        requireInteraction: true,
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification clicked');
    event.notification.close();

    // Open the app when notification is clicked
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If app is already open, focus it
                for (const client of clientList) {
                    if (client.url.includes('badminton') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise open new window
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});
