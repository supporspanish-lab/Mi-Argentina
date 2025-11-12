// Este archivo ahora solo contiene la lógica para la música de fondo,
// encapsulada en una función para ser llamada desde main.js.

// --- NUEVO: Comprobación de sesión al cargar la página de inicio ---
// Si no hay una sesión guardada en localStorage, redirigir a la página de login.
// Esto previene que un usuario no autenticado acceda a home.html directamente.
if (localStorage.getItem('userIsLoggedIn') !== 'true') {
    // Excepción: no redirigir si estamos en la página de login para evitar un bucle infinito.
    if (!window.location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html';
    }
}

let backgroundAudio; // Make backgroundAudio accessible in this module

export const setupBackgroundMusic = () => {
    // --- Elementos del botón de música y lógica de audio de fondo ---
    const muteMusicBtn = document.getElementById('mute-music-btn');
    const muteIcon = document.getElementById('mute-icon');
    const unmuteIcon = document.getElementById('unmute-icon');
    
    // --- Seleccionar una pista de música de fondo aleatoria ---
    const backgroundMusicTracks = [
        '../audio/home/1.mp3',
        '../audio/home/2.mp3',
        '../audio/home/3.mp3',
        '../audio/home/4.mp3'
    ];
    const randomTrack = backgroundMusicTracks[Math.floor(Math.random() * backgroundMusicTracks.length)];
    backgroundAudio = new Audio(randomTrack); // Assign to the module-level variable
    backgroundAudio.loop = true;
    backgroundAudio.volume = 0.6;

    // --- NUEVO: Cargar el estado de silencio desde localStorage ---
    const savedMuteState = localStorage.getItem('musicMuted');
    if (savedMuteState === 'true') {
        backgroundAudio.muted = true;
        muteIcon.style.display = 'none';
        unmuteIcon.style.display = 'block';
    }

    // Intentar reproducir la música automáticamente al cargar la página
    // Esto puede ser bloqueado por las políticas de autoplay de los navegadores
    // Se reproducirá cuando el usuario interactúe con la página (ej. clic en el botón de mute)
    window.addEventListener('load', () => {
        backgroundAudio.play().catch(error => {
            console.warn("Autoplay de música de fondo bloqueado:", error);
        });
    });

    muteMusicBtn.addEventListener('click', () => {
        if (backgroundAudio.muted) {
            backgroundAudio.muted = false;
            backgroundAudio.play().catch(error => {
                console.warn("Error al reproducir música después de desmutear:", error);
            });
            muteIcon.style.display = 'block';
            unmuteIcon.style.display = 'none';
        } else {
            backgroundAudio.muted = true;
            muteIcon.style.display = 'none';
            unmuteIcon.style.display = 'block';
        }
        // --- NUEVO: Guardar el estado de silencio en localStorage ---
        localStorage.setItem('musicMuted', backgroundAudio.muted);
    });

    // --- NUEVO: Escuchar el evento de fin de partida para reanudar la música ---
    window.addEventListener('storage', (event) => {
        if (event.key === 'gameEnded' && event.newValue === 'true') {
            console.log("Game ended, attempting to resume background music.");
            // --- MODIFICADO: Respetar el estado de silencio guardado ---
            if (localStorage.getItem('musicMuted') !== 'true') {
                backgroundAudio.muted = false;
                muteIcon.style.display = 'block';
                unmuteIcon.style.display = 'none';
                backgroundAudio.play().catch(error => {
                    console.warn("Error al reanudar música de fondo después de fin de partida:", error);
                });
            }
            // Clear the flag to prevent re-playing on subsequent page loads/refreshes
            localStorage.removeItem('gameEnded');
            localStorage.removeItem('gameEndedTimestamp');
        }
    });
};

export const getBackgroundAudio = () => backgroundAudio;
