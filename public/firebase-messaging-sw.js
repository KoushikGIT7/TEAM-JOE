// 👻 [SERVICE-WORKER] JOE Background Messaging Service Worker
// This file MUST live in the 'public/' folder so that browsers can load it at '/firebase-messaging-sw.js'.

importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBRzOIMBTExHkfM92EMNfCodh63t54OKSw",
  authDomain: "joecafe-a7fff.firebaseapp.com",
  projectId: "joecafe-a7fff",
  storageBucket: "joecafe-a7fff.firebasestorage.app",
  messagingSenderId: "1034738714307",
  appId: "1:1034738714307:web:95e1f52bfa57a101ae8476"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('📬 Background FCM Message:', payload);

  const title = payload.notification?.title || payload.data?.title || "JOE Cafeteria";
  const body = payload.notification?.body || payload.data?.body || "New update regarding your order!";
  const orderId = payload.data?.orderId || "";
  
  const notificationOptions = {
    body: body,
    icon: "/JeoLogoFinal.png",
    badge: "/JeoLogoFinal.png",
    tag: orderId || 'order-update',
    renotify: true,
    data: {
      url: self.location.origin + (orderId ? `/?orderId=${orderId}` : ''),
      orderId: orderId
    }
  };

  self.registration.showNotification(title, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || self.location.origin;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If there's an open window, focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client && client.url !== urlToOpen) {
            return client.navigate(urlToOpen);
          }
          return;
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
