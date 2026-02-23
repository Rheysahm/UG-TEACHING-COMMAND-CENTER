const CACHE_NAME = 'tcc-app-v3';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './js/xlsx.full.min.js',
  './js/exceljs.min.js',
  './js/FileSaver.min.js',
  './js/qrcode.min.js',
  './js/html2canvas.min.js',
  './js/jspdf.umd.min.js'
];

// Install Event - Caches the files
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Fetch Event - Serves from cache if offline
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});