// Register synchronous dummy listeners to prevent Chrome initial evaluation warnings
self.addEventListener('install', () => {});
self.addEventListener('activate', () => {});
self.addEventListener('message', () => {});
self.addEventListener('push', () => {});
self.addEventListener('notificationclick', () => {});
self.addEventListener('notificationclose', () => {});

importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

