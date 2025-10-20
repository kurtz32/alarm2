// Service Worker for Offline Alarm Clock PWA

const CACHE_NAME = 'alarm-clock-v1';
const urlsToCache = [
  '/',
  '/static/style.css',
  '/static/script.js',
  '/static/manifest.json'
];

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch from cache
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});

// Background sync for alarms (if supported)
self.addEventListener('sync', event => {
  if (event.tag === 'alarm-sync') {
    event.waitUntil(syncAlarms());
  }
});

function syncAlarms() {
  // This would sync alarms when online
  return Promise.resolve();
}

// Handle push notifications (if implemented)
self.addEventListener('push', event => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: 'icon-192.png',
    badge: 'icon-192.png'
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});