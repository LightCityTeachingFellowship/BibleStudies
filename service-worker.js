---
layout: null
---
const BASE = new URL('./', self.location.href);
const CACHE = 'lightcity-pwa-v1-' + BASE.pathname;
const offline = new URL('offline.html', BASE).href;
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(c => c.addAll([offline])).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('lightcity-pwa-') && (k.endsWith(BASE.pathname) || k.endsWith(BASE.pathname+'-assets')) && k !== CACHE && k !== CACHE+'-assets').map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
 const request = event.request, url = new URL(request.url);
 if (request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
 if (['style','script','image','font'].includes(request.destination) && !url.pathname.endsWith('pwa-config.js')) {
  event.respondWith(fetch(request).then(async response => {
   if (response.ok && !response.headers.get('content-type')?.includes('text/html')) {
    const c=await caches.open(CACHE+'-assets'); await c.put(request,response.clone());
    const keys=await c.keys(); if(keys.length>150) await c.delete(keys[0]);
   }
   return response;
  }).catch(async()=> (await caches.match(request)) || Response.error()));
  return;
 }
 if (request.mode === 'navigate') event.respondWith(fetch(request).then(async response => {
  if (response.ok) { const c = await caches.open(CACHE); await c.put(request, response.clone()); const keys = await c.keys(); const pages = keys.filter(k => k.url !== offline); if (pages.length > 40) await c.delete(pages[0]); }
  return response;
 }).catch(async () => (await caches.match(request)) || caches.match(offline)));
});
self.addEventListener('notificationclick', event => {
 // Let Firebase handle notifications it displays automatically.
 if (!event.notification.data?.lightcity) return;
 event.stopImmediatePropagation();
 event.notification.close();
 let target = new URL(event.notification.data?.url || 'LightCity-Teaching-Fellowship/', BASE);
 if (target.origin !== BASE.origin || !target.pathname.startsWith(BASE.pathname)) target = new URL('LightCity-Teaching-Fellowship/', BASE);
 event.waitUntil(self.clients.openWindow(target.href));
});

// Firebase initializes background delivery only after the public config is completed.
importScripts(new URL('pwa-config.js', BASE).href);
if (self.LIGHTCITY_PUSH?.enabled) {
 importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
 importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
 firebase.initializeApp(self.LIGHTCITY_PUSH.firebase);
 firebase.messaging().onBackgroundMessage(payload => {
  // Firebase automatically displays messages containing a notification payload.
  if (payload.notification) return;
  const data = payload.data || {};
  return self.registration.showNotification(data.title || 'LightCity', {body: data.body || 'New teaching available', icon: new URL('images/pwa-192.png', BASE).href, badge: new URL('images/notification-badge.png', BASE).href, tag:data.id, data:{url:data.url,lightcity:true}});
 });
}
