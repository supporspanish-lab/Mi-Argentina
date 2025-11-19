window.getQueryParam = function(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// --- INICIO: Sistema de Precarga y Reproducción de Sonido ---

const soundUrls = [
    'sonido/ambiente-despacio.wav',
    'sonido/barricada-destruida.mp3',
    'sonido/barricada-golpe.mp3',
    'sonido/base-golpeada.mp3',
    'sonido/boss1-caminata.wav',
    'sonido/boss1-dead.wav',
    'sonido/boss1-grito.wav',
    'sonido/boss1-grito2.mp3',
    'sonido/boss1-paso1.wav',
    'sonido/boss1-paso2.wav',
    'sonido/casco-roto-enemigo.mp3',
    'sonido/espada-no-daño.wav',
    'sonido/espada1.mp3',
    'sonido/espada2.wav',
    'sonido/espada3.wav',
    'sonido/golpe-personaje.mp3',
    'sonido/oleada8.wav',
    'sonido/escudo-bloqueo.wav',
    'sonido/escudo-bloqueo2.wav',
    'sonido/escudo-bloqueo3.wav',
    'sonido/escudo-bloqueo-destruido.wav',
    'sonido/equipando.mp3',
    'sonido/compra.mp3',
    'sonido/boss1-bloqueo.mp3',
    'sonido/boss1-dolor.mp3',
    'sonido/boss1-dolor2.mp3'
];

function updateLoadingScreen(progress) {
    const soundLoadingText = document.getElementById('sound-loading-text');
    const soundLoadingBar = document.getElementById('sound-loading-bar');
    if (soundLoadingText && soundLoadingBar) {
        soundLoadingText.textContent = `Cargando Sonidos: ${Math.round(progress)}%`;
        soundLoadingBar.style.width = `${progress}%`;
    }
}

function updateMapLoadingScreen(message, progress) {
    const mapLoadingContainer = document.getElementById('map-loading-container');
    const mapLoadingText = document.getElementById('map-loading-text');
    const mapLoadingBar = document.getElementById('map-loading-bar');

    if (mapLoadingContainer && mapLoadingContainer.style.display === 'none') {
        mapLoadingContainer.style.display = 'block';
    }

    if (mapLoadingText) mapLoadingText.textContent = message;
    if (mapLoadingBar && progress !== undefined) {
        mapLoadingBar.style.width = `${progress}%`;
    }
}

window.preloadSounds = async function() {
    console.log("Iniciando precarga de sonidos...");
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    window.globalState.audioContext = audioContext;
    const soundCache = {};
    let loadedCount = 0;

    const promises = soundUrls.map(url =>
        fetch(url)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
            soundCache[url] = audioBuffer;
            loadedCount++;
            const progress = (loadedCount / soundUrls.length) * 100;
            updateLoadingScreen(progress);
            console.log(`Sonido cargado: ${url}`);
        })
        .catch(error => console.error(`Error cargando sonido ${url}:`, error))
    );

    await Promise.all(promises);

    window.globalState.soundCache = soundCache;

    // --- INICIO: Reanudar AudioContext en la primera interacción ---
    // Los navegadores modernos suspenden el audio hasta que el usuario interactúa.
    if (audioContext.state === 'suspended') {
        const resumeAudio = () => {
            audioContext.resume();
            document.body.removeEventListener('click', resumeAudio);
        };
        document.body.addEventListener('click', resumeAudio);
    }
    // --- FIN: Reanudar AudioContext en la primera interacción ---

    console.log("Todos los sonidos han sido precargados.");

    // Ocultar pantalla de carga
    // Se moverá al final del proceso de carga completo en sceneSetup.js
};

window.warmUpAI = async function() {
    console.log("Iniciando calentamiento de la IA...");
    const aiContainer = document.getElementById('ai-warmup-container');
    const aiText = document.getElementById('ai-warmup-text');
    const aiBar = document.getElementById('ai-warmup-bar');

    if (aiContainer) aiContainer.style.display = 'block';

    const iterations = 200;
    for (let i = 0; i <= iterations; i++) {
        // Ejecutar la función de IA. Aunque no haya enemigos, esto calienta el motor de JS.
        window.globalState.handleEnemyAI(16 / 1000); // Simular un frame de 60fps

        if (i % 10 === 0) { // Actualizar la UI no tan frecuentemente para no ralentizar
            const progress = (i / iterations) * 100;
            if (aiText && aiBar) {
                aiText.textContent = `Calentando IA: ${Math.round(progress)}%`;
                aiBar.style.width = `${progress}%`;
            }
            // Permitir que el navegador repinte la pantalla
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    console.log("Calentamiento de la IA completado.");
};

window.hideLoadingScreen = function() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => { loadingScreen.style.display = 'none'; }, 500); // Esperar a que termine la transición
    }
}

window.playSound = function(src, volume = 1.0) {
    const audioContext = window.globalState.audioContext;
    if (!audioContext) return; // No intentar reproducir si el audio no está inicializado
    const soundBuffer = window.globalState.soundCache[src];

    if (audioContext && soundBuffer) {
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();

        source.buffer = soundBuffer;
        gainNode.gain.value = Math.max(0, Math.min(1, volume));

        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        source.start(0);
    } else {
        console.warn(`El sonido ${src} no fue precargado o no se encontró.`);
        // Fallback para reproducir de todas formas si no se encontró en el caché
        const audio = new Audio(src);
        audio.volume = volume;
        audio.play();
    }
};
// --- FIN: Sistema de Precarga y Reproducción de Sonido ---

window.globalState.getQueryParam = window.getQueryParam;
window.globalState.playSound = window.playSound;