// 👻 [GHOST-SERVICE] JOE Background Messaging SW
// This file MUST live in your 'public/' folder for the phone to wake up.

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// 🔥 Initialize your project config here (Copy from your Project Settings -> General)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);

// 🔊 [SYSTEM-TRAY] Handle Background Messages
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('📬 Background Pulse Caught:', payload);

  const notificationTitle = payload.notification.title || "JOE Pulse";
  const notificationOptions = {
    body: payload.notification.body || "New cafeteria update!",
    icon: "/logo.png", // Ensure you have a logo in public/ for the system tray
    tag: 'marketing-pulse',
    data: { url: window.location.origin }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
