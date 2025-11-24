const getQueryParam = window.getQueryParam;

async function initGame() {
    // Funciones de inicialización que no dependen de assets cargados
    window.initScene();
    window.initUI();
    window.initBloodCanvas();
    window.initInput();

    // 1. Precargar sonidos
    await window.preloadSounds();

    // 2. Cargar mapa y jugador
    await window.loadMap(getQueryParam('map') || 'mapa.json');
    await window.loadPlayer();

    // 3. Calentar la IA
    await window.warmUpAI();
    // 4. Ocultar pantalla de carga y empezar el juego
    window.hideLoadingScreen();

    // 5. Iniciar sonido de ambiente después de que todo esté cargado
    window.playLoopingSound('sonido/ambiente-despacio.wav', 0.15);
    animateGame();
}

initGame();