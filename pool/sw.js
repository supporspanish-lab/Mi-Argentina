const CACHE_NAME = 'pool-game-cache-v1';

// A list of all the essential files to be cached when the service worker is installed.
const ASSETS_TO_CACHE = [
    '/',
    'index.html',
    'pool.js',
    'ui.js',
    'fisicas.js',
    'gameState.js',
    'ballManager.js',
    'config.js',
    'scene.js',
    'aiming.js',
    'audioManager.js',
    'fallPhysics.js',
    'loadingManager.js',
    'spatialManager.js',
    'imajenes/mesa.png',
    'imajenes/taco.png',
    'imajenes/zombra.png',
    'audio/ballHit2.wav',
    'audio/cushionHit.wav',
    'audio/EntrarPelotaTronera.mp3',
    'audio/cueHit.wav',
    'modelos/billiard_balls.glb',
    // External dependencies from unpkg
    'https://unpkg.com/three@0.160.0/build/three.module.js',
    'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js',
    'https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js'
];

// Add pocketed ball images to the cache list
for (let i = 1; i <= 15; i++) {
    if (i !== 8) { // The 8-ball is not shown in the player pockets UI
        ASSETS_TO_CACHE.push(`imajenes/bolasMetidas/${i}.png`);
    }
}

/**
 * Install event: This is triggered when the service worker is first installed.
 * We open a cache and add all our essential assets to it.
 */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching core assets');
                // Use addAll for atomic operation. If one file fails, the whole cache operation fails.
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .catch(error => {
                console.error('Service Worker: Failed to cache assets during install:', error);
            })
    );
});

/**
 * Fetch event: This is triggered for every network request made by the page.
 * We intercept the request and respond with the cached version if available.
 * If not, we fetch it from the network, cache it for next time, and then return it.
 */
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // If the response is in the cache, return it.
                if (cachedResponse) {
                    return cachedResponse;
                }

                // If not in cache, fetch from the network.
                return fetch(event.request).then((networkResponse) => {
                    // IMPORTANT: Check if we received a valid response
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                        return networkResponse; // Return the error response without caching it.
                    }

                    // Clone the response because it can only be consumed once.
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                });
            }).catch(error => {
                // This could happen if the fetch itself fails (e.g., no network).
                // You could return a fallback offline page here if you had one.
                console.error('Service Worker: Error during fetch:', error);
                // Re-throw the error to ensure the browser handles it.
                throw error;
            })
    );
});