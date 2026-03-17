importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in your app's Firebase config
firebase.initializeApp({
  apiKey: "AIzaSyBRzOIMBTExHkfM92EMNfCodh63t54OKSw",
  authDomain: "joecafe-a7fff.firebaseapp.com",
  projectId: "joecafe-a7fff",
  storageBucket: "joecafe-a7fff.firebasestorage.app",
  messagingSenderId: "1034738714307",
  appId: "1:1034738714307:web:95e1f52bfa57a101ae8476"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/JeoLogoFinal.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
