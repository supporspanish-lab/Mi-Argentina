const CACHE_NAME = 'pool-game-cache-v2';

// Check if running in secure context
const isSecureContext = self.location.protocol === 'https:' || self.location.hostname === 'localhost';

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
    'audio/ballHit2.mp3',
    'audio/cushionHit.wav',
    'audio/EntrarPelotaTronera.mp3',
    'audio/cueHit.wav',
    'audio/TurnoFinalizado.mp3',
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
  const requestUrl = new URL(event.request.url);

  // 1. Excluir peticiones a Firebase, Google, etc.
  if (requestUrl.hostname.includes('googleapis.com') ||
    requestUrl.hostname.includes('firebase') ||
    requestUrl.hostname.includes('google.com') || // Para evitar errores con cleardot.gif, etc.
    requestUrl.hostname.includes('onrender.com')) {
    return; // Dejar que el navegador maneje la petición
  }

  // 2. Estrategia "Network Only" para archivos multimedia y modelos 3D
  // Esto evita el error "Partial response (status code 206) is unsupported"
  // al no intentar cachear estos recursos.
  if (event.request.url.match(/\.(mp4|mp3|wav|glb|png|jpg|jpeg|gif)$/)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. Estrategia "Network First" para el resto de los archivos (HTML, JS, CSS)
  if (!isSecureContext) {
      // En contexto inseguro, no cachear, solo fetch
      event.respondWith(fetch(event.request));
      return;
  }
  event.respondWith(
      fetch(event.request).then(networkResponse => {
          const responseToCache = networkResponse.clone(); // Clonar la respuesta
          caches.open(CACHE_NAME).then(cache => {
              if (networkResponse.status === 200) { // Only cache full responses
                  cache.put(event.request, responseToCache).catch(error => {
                      console.error('Service Worker: Failed to cache response:', error);
                  });
              }
          }).catch(error => {
              console.error('Service Worker: Failed to open cache:', error);
          });
          return networkResponse; // Devolver la respuesta original
      }).catch(() => {
          return caches.match(event.request);
      })
  );
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