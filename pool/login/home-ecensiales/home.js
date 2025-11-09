// Este archivo ahora solo contiene la lógica para la música de fondo,
// encapsulada en una función para ser llamada desde main.js.

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
    });

    // --- NUEVO: Escuchar el evento de fin de partida para reanudar la música ---
    window.addEventListener('storage', (event) => {
        if (event.key === 'gameEnded' && event.newValue === 'true') {
            console.log("Game ended, attempting to resume background music.");
            if (backgroundAudio.muted) {
                backgroundAudio.muted = false; // Unmute if it was muted
                muteIcon.style.display = 'block';
                unmuteIcon.style.display = 'none';
            }
            backgroundAudio.play().catch(error => {
                console.warn("Error al reanudar música de fondo después de fin de partida:", error);
            });
            // Clear the flag to prevent re-playing on subsequent page loads/refreshes
            localStorage.removeItem('gameEnded');
            localStorage.removeItem('gameEndedTimestamp');
        }
    });
};

export const getBackgroundAudio = () => backgroundAudio;
