// Este archivo ahora solo contiene la lógica para la música de fondo,
// encapsulada en una función para ser llamada desde main.js.

export const setupBackgroundMusic = () => {
    // --- Elementos del botón de música y lógica de audio de fondo ---
    const muteMusicBtn = document.getElementById('mute-music-btn');
    const muteIcon = document.getElementById('mute-icon');
    const unmuteIcon = document.getElementById('unmute-icon');
    
    // --- Seleccionar una pista de música de fondo aleatoria ---
    // --- CORRECCIÓN: Rutas relativas correctas para GitHub Pages ---
    const backgroundMusicTracks = [
        '../../audio/home/1.mp3', // Sube de 'home-ecensiales/' a 'login/', luego a 'pool/' y entra a 'audio/'
        '../../audio/home/2.mp3',
        '../../audio/home/3.mp3',
        '../../audio/home/4.mp3'
    ];
    const randomTrack = backgroundMusicTracks[Math.floor(Math.random() * backgroundMusicTracks.length)];
    const backgroundAudio = new Audio(randomTrack);
    backgroundAudio.loop = true;
    backgroundAudio.volume = 0.5; // Bajar un poco el volumen inicial
    backgroundAudio.muted = true; // --- SOLUCIÓN: Empezar la música silenciada
    
    // --- CORRECCIÓN: Esperar a que el audio pueda reproducirse antes de llamar a .play() ---
    // Esto evita el error "The element has no supported sources" si la red es lenta.
    backgroundAudio.addEventListener('canplaythrough', () => {
        backgroundAudio.play().catch(error => {
            console.warn("La reproducción automática de música (silenciada) fue bloqueada. Se iniciará con la interacción del usuario.");
        });
    }, { once: true });
    
    // --- SOLUCIÓN: En la primera interacción, solo quitamos el silencio ---
    const unmuteOnInteraction = () => {
        backgroundAudio.muted = false;
        // Si por alguna razón no se estaba reproduciendo, esto lo asegura.
        backgroundAudio.play(); 
    };
    window.addEventListener('userInteracted', unmuteOnInteraction, { once: true });

    muteMusicBtn.addEventListener('click', () => {
        if (backgroundAudio.muted) { // Si el usuario quiere desmutear
            backgroundAudio.muted = false;
            backgroundAudio.play().catch(error => {
                console.warn("Error al reproducir música después de desmutear:", error);
            });
            muteIcon.style.display = 'block';
            unmuteIcon.style.display = 'none';
        } else {
            backgroundAudio.muted = true; // Si el usuario quiere mutear
            muteIcon.style.display = 'none';
            unmuteIcon.style.display = 'block';
        }
    });
};
