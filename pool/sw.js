const CACHE_NAME = 'pool-game-cache-v2';

// A list of all the essential files to be cached when the service worker is installed.
const ASSETS_TO_CACHE = [
    './', // --- CORRECCIÓN: Usar ruta relativa para el directorio raíz
    'index.html',
    'pool.js',
    'ui.js',
    'fisicas.js',
    'inputManager.js',
    'shooting.js',
    'cuePlacement.js',
    'spinControls.js',
    'gameState.js',
    'ballManager.js',
    'config.js',
    'scene.js',
    'revisar.js', // --- SOLUCIÓN: Añadir el archivo de revisión que faltaba
    'powerControls.js',
    'cueBallEffects.js', // --- SOLUCIÓN: Añadir el archivo de efectos que faltaba
    'aiming.js',
    'audioManager.js',
    'fallPhysics.js',
    'loadingManager.js',
    'spatialManager.js',
    'imajenes/mesa.png',
    'imajenes/taco.png',
    'imajenes/zombra.png',
    'imajenes/BolasMetidas/efecto.png', // --- SOLUCIÓN: Añadir la nueva imagen del selector de efecto
    'imajenes/moneda/moneda.png', // Add the coin image
    'audio/ballHit2.wav',
    'audio/cushionHit.wav',
    'audio/EntrarPelotaTronera.mp3',
    'audio/cueHit.wav',
    // --- NUEVO: Añadir las pistas de música de fondo a la caché ---
    'audio/home/1.mp3',
    'audio/home/2.mp3',
    'audio/home/3.mp3',
    'audio/login.mp3', // Add login sound
    'modelos/billiard_balls.glb',
    // Login page assets
    'login/login.html',
    'login/home.html',
    'login/manifest.json',
    'login/auth.js',
    'login/home-ecensiales/authHandlers.js',
    'login/home-ecensiales/domElements.js',
    'login/home-ecensiales/firebaseService.js',
    'login/home-ecensiales/friendshipHandlers.js',
    'login/home-ecensiales/gameRoomHandlers.js',
    'login/home-ecensiales/home.js',
    'login/home-ecensiales/main.js',
    'login/home-ecensiales/modalHandlers.js',
    'login/home-ecensiales/state.js',
    'login/home-ecensiales/style.css',
    'login/home-ecensiales/utils.js',
    // --- NUEVO: Añadir los videos de fondo a la caché ---
    'video/video1.mp4',
    'video/video2.mp4',
    'video/video3.mp4',
    'audio/home/4.mp3', // --- NUEVO: Añadir la cuarta pista de música de fondo
    // External dependencies from unpkg
    'https://unpkg.com/three@0.160.0/build/three.module.js',
    'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js',
    'https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js'
];

// Add pocketed ball images to the cache list
for (let i = 1; i <= 15; i++) {
    if (i !== 8) { // The 8-ball is not shown in the player pockets UI
        ASSETS_TO_CACHE.push(`imajenes/BolasMetidas/${i}.png`); // --- CORRECCIÓN: Usar la ruta con mayúscula
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
    // --- NUEVO: Bypassar el Service Worker para las peticiones de Firebase ---
    const requestUrl = new URL(event.request.url);
    // --- MODIFICADO: Añadir PocketBase (onrender.com) y Google a la lista de exclusiones ---
    if (requestUrl.hostname.includes('googleapis.com') || 
        requestUrl.hostname.includes('firebase') ||
        requestUrl.hostname.includes('google.com') || // Para evitar errores con cleardot.gif, etc.
        requestUrl.hostname.includes('onrender.com')) {
        return fetch(event.request); // Ir directamente a la red para Firebase
    }

    // --- CORRECCIÓN: Estrategia "Network First" para desarrollo ---
    // Intenta obtener el recurso de la red primero.
    // Si falla (por ejemplo, sin conexión), recurre a la caché.
    // Esto asegura que siempre veamos los últimos cambios al recargar.
    event.respondWith((async () => {
        try {
            // 1. Intenta ir a la red primero
            const networkResponse = await fetch(event.request);

            // 2. Si tiene éxito, actualiza la caché y devuelve la respuesta de la red
            // Solo guardar en caché respuestas válidas (status 200) y de nuestro propio dominio
            if (networkResponse.ok && networkResponse.type === 'basic') {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
        } catch (error) {
            // 3. Si la red falla, busca en la caché
            console.log('Service Worker: Fallo de red, buscando en caché para:', event.request.url);
            const cachedResponse = await caches.match(event.request);
            // --- SOLUCIÓN: Si está en caché, lo devolvemos. Si no, devolvemos una respuesta de error. ---
            if (cachedResponse) {
                return cachedResponse;
            }
            // Si no está en caché, generamos una respuesta de error para evitar el TypeError.
            return new Response(`Recurso no encontrado en la red ni en la caché: ${event.request.url}`, { status: 404, statusText: "Not Found" });
        }
    })());
});

// --- NUEVO: Evento 'message' para manejar la lógica de actualización ---
self.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'CHECK_FOR_UPDATES') {
        console.log('Service Worker: Recibida solicitud de verificación de actualizaciones.');
        event.source.postMessage({ type: 'UPDATE_CHECKING' });

        try {
            const registration = await self.registration;
            if (!registration) {
                console.error('Service Worker: No se pudo obtener el objeto de registro.');
                event.source.postMessage({ type: 'NO_UPDATE' });
                return;
            }

            // Force an update check
            console.log('Service Worker: Iniciando verificación de actualización forzada.');
            await registration.update();
            console.log('Service Worker: Verificación de actualización forzada completada.');

            if (registration.installing) {
                console.log('Service Worker: registration.installing es true.');
                console.log('Service Worker: Nueva versión instalándose.');
                event.source.postMessage({ type: 'UPDATE_FOUND' });
                registration.installing.addEventListener('statechange', () => {
                    if (registration.waiting) {
                        // Skip waiting and activate the new service worker immediately
                        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }
                });
            } else if (registration.waiting) {
                console.log('Service Worker: Nueva versión en espera.');
                event.source.postMessage({ type: 'UPDATE_FOUND' });
                // Skip waiting and activate the new service worker immediately
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            } else if (registration.active) {
                console.log('Service Worker: No hay actualizaciones disponibles o ya está activa la última versión.');
                event.source.postMessage({ type: 'NO_UPDATE' });
            }

        } catch (error) {
            console.error('Service Worker: Fallo la verificación de actualizaciones:', error);
            event.source.postMessage({ type: 'NO_UPDATE' }); // Assume no update on error
        }
    }

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activado.');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Eliminando caché antigua', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Inform all clients that a new version has been activated
            self.clients.matchAll().then(clients => {
                clients.forEach(client => client.postMessage({ type: 'UPDATE_ACTIVATED' }));
            });
        })
    );
});