const CACHE_NAME = 'pool-game-cache-v1';

// A list of all the essential files to be cached when the service worker is installed.
const ASSETS_TO_CACHE = [
    './', // --- CORRECCIÓN: Usar ruta relativa para el directorio raíz
    'index.html',
    'pool.js',
    'ui.js',
    'fisicas.js',
    'inputManager.js',
    'powerControls.js',
    'shooting.js',
    'cuePlacement.js',
    'spinControls.js',
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
    // 'imajenes/brillo.png' ya no es necesario, el efecto se genera con canvas.
    'imajenes/bolasMetidas/blanca.png', // --- NUEVO: Añadir la imagen de la bola blanca al caché
    'audio/ballHit2.wav',
    'audio/cushionHit.wav',
    'audio/EntrarPelotaTronera.mp3',
    // 'audio/error.mp3', // --- NUEVO: Añadir el sonido de falta al caché
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
    // --- CORRECCIÓN: Estrategia "Network First" para desarrollo ---
    // Intenta obtener el recurso de la red primero.
    // Si falla (por ejemplo, sin conexión), recurre a la caché.
    // Esto asegura que siempre veamos los últimos cambios al recargar.
    event.respondWith(
        fetch(event.request).then((networkResponse) => {
            // Si la petición a la red tiene éxito, la usamos y actualizamos la caché.
            // --- SOLUCIÓN: Solo guardar en caché las respuestas de nuestro propio dominio ---
            // Las respuestas a dominios externos (como unpkg.com) pueden ser "opacas" y no se pueden guardar con cache.put().
            if (event.request.url.startsWith(self.location.origin)) {
                return caches.open(CACHE_NAME).then((cache) => {
                    // Clonamos la respuesta porque solo se puede consumir una vez.
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            } else {
                return networkResponse;
            }
        }).catch(() => {
            // Si la petición a la red falla, buscamos en la caché.
            return caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse; // Devolver la versión en caché si existe.
                }
                // Si no está ni en la red ni en la caché, la petición fallará.
            });
        })
    );
});