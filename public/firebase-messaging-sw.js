// Import Firebase compat libraries in Service Worker context
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Initialize Firebase inside the Service Worker
// Note: Fill these placeholders with your actual configuration keys matching your .env file
firebase.initializeApp({
  apiKey: "AIzaSyDyAfYJISC05DyTBWHeVkjZTYMCYHSMJbw",
  authDomain: "task-facility-system.firebaseapp.com",
  projectId: "task-facility-system",
  storageBucket: "task-facility-system.firebasestorage.app",
  messagingSenderId: "584664752080",
  appId: "1:584664752080:web:b4c9acc293573aea7b63d5"
});

const messaging = firebase.messaging();

// Handle background notifications
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);
  
  const notificationTitle = payload.notification?.title || 'แจ้งเตือนระบบงาน';
  const notificationOptions = {
    body: payload.notification?.body || 'มีข้อมูลอัปเดตใหม่ในระบบ กรุณาตรวจสอบ',
    icon: '/logo.png',
    badge: '/logo.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
