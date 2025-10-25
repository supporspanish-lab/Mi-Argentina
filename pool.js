import * as THREE from 'three';
import { updateBallPositions, areBallsMoving } from './fisicas.js';
import { initializeHandles, handles, pockets, BALL_RADIUS, TABLE_WIDTH, TABLE_HEIGHT } from './config.js'; // Asegúrate que handles se exporta
import { scene, camera, renderer, loadTableTexture } from './scene.js'; // --- CORRECCIÓN: Importar showFoulMessage
import { balls, cueBall, setupBalls, loadBallModels, cueBallRedDot, prepareBallLoaders } from './ballManager.js'; // --- SOLUCIÓN: Quitar updateSafeArea
import { handleInput, initializeUI, updateUI, prepareUIResources } from './ui.js'; // --- SOLUCIÓN: Quitar updateSafeArea
import { initAudio, loadSound, prepareAudio } from './audioManager.js';
import { initFallPhysics, addBallToFallSimulation, updateFallPhysics } from './fallPhysics.js'; // --- CORRECCIÓN: Importar showFoulMessage
import { setOnLoadingComplete, setProcessingSteps } from './loadingManager.js';
import { prepareAimingResources } from './aiming.js';
import { getGameState, handleTurnEnd, startShot, addPocketedBall, setGamePaused, areBallsAnimating, setPlacingCueBall, showFoulMessage } from './gameState.js';

let lastTime;
window.currentShotAngle = 0; // Ángulo de tiro global, gestionado por inputManager

// --- NUEVO: Variables para el efecto de vibración de la cámara ---
let shakeIntensity = 0;
let shakeDuration = 0;
let originalCameraPosition = new THREE.Vector3();

function gameLoop(time) {
    // --- LOG: Indica el inicio de un nuevo fotograma en el bucle del juego.
    // console.log('[GameLoop] Iniciando nuevo fotograma...');

    // Vuelve a llamar a gameLoop para el siguiente fotograma
    requestAnimationFrame(gameLoop);

    // --- NUEVO: Log para verificar el estado de pausa ---
    // console.log(`Juego Pausado: ${getGameState().gamePaused}`);

    // --- NUEVO: Si el juego está pausado, no se actualiza la lógica, solo se renderiza. ---
    if (getGameState().gamePaused) {
        // --- LOG: Indica que el bucle está en modo pausa.
        // console.log('[GameLoop] Juego en pausa, solo renderizando.');
        renderer.render(scene, camera); // Renderizar la escena
        return; // Detener la ejecución del resto del bucle
    }

    // --- NUEVO: Lógica para la vibración de la cámara ---
    if (shakeDuration > 0 && lastTime !== undefined) {
        const dt = (time - lastTime) / 1000;
        // Aplicar el desplazamiento aleatorio
        camera.position.x = originalCameraPosition.x + (Math.random() - 0.5) * shakeIntensity;
        camera.position.y = originalCameraPosition.y + (Math.random() - 0.5) * shakeIntensity;

        // Reducir la duración y la intensidad
        shakeDuration -= dt;
        shakeIntensity *= 0.95; // Decaimiento suave de la intensidad

        if (shakeDuration <= 0) {
            camera.position.copy(originalCameraPosition); // Restaurar la posición original
        }
    }
    let dt = 0;
    if (lastTime !== undefined) {
        dt = (time - lastTime) / 1000; // Delta time en segundos
        // --- LOG: Indica que se va a actualizar la física de las bolas.
        // console.log('[GameLoop] Llamando a updateBallPositions...');
        const pocketedInFrame = updateBallPositions(dt, balls, pockets, handles, BALL_RADIUS);

        if (pocketedInFrame.length > 0) {
            pocketedInFrame.forEach(ball => addPocketedBall(ball));
        }

        // --- MODIFICACIÓN: El turno solo termina si no hay bolas moviéndose NI animándose ---
        if (getGameState().shotInProgress && !areBallsMoving(balls) && !areBallsAnimating(balls)) {
            // --- LOG: Indica que se cumplen las condiciones para finalizar el turno.
            // --- MODIFICACIÓN: El log ahora se muestra dentro de handleTurnEnd para ser más preciso.
            
            // handleTurnEnd ahora se encarga de toda la lógica, incluida la notificación de "listo para jugar".
            handleTurnEnd();
            // --- MEJORA: Restablecer la rotación visual de la bola blanca para el siguiente tiro ---
            if (cueBall && cueBall.mesh) {
                cueBall.mesh.quaternion.set(0, 0, 0, 1); // Resetea a la rotación identidad
            }
        }
    }
    lastTime = time;

    // --- CORREGIDO: Lógica para la rotación visual de las bolas ---
    if (dt > 0) {
        const timeStep = dt * 100; // Usamos el mismo multiplicador que en fisicas.js

        // --- CORRECCIÓN: Iterar hacia atrás para poder eliminar elementos de forma segura ---
        for (let i = balls.length - 1; i >= 0; i--) {
            const ball = balls[i];

            // --- CORRECCIÓN: Reestructurar la lógica de estados para que sea más clara ---

    // Estado 1: La bola está siendo simulada por el motor de física 3D (Cannon.js)
            // --- NUEVO: Comprobar si una bola de color fue recolectada para eliminarla ---
            if (ball.pocketedState === 'collected') {
                if (ball.number === null) { // Si es la bola blanca
                    // La marcamos como inactiva y la añadimos a la lista de entroneradas para que se gestione la falta.
                    ball.isActive = false;
                    ball.vx = 0; ball.vy = 0;
                    addPocketedBall(ball);
                } else { // Si es una bola de color
                    // La eliminamos de la escena y del array de bolas.
                    scene.remove(ball.mesh);
                    if (ball.shadowMesh) scene.remove(ball.shadowMesh);
                    balls.splice(i, 1);
                }
            } 
        }

        balls.forEach(ball => {
            if (ball.isActive && (ball.vx !== 0 || ball.vy !== 0)) {
                // --- CORRECCIÓN: La rotación debe ser proporcional a la distancia recorrida ---
                // Esto hace que la animación de giro sea realista y dependa de la velocidad.
                const distance = Math.sqrt((ball.vx * timeStep)**2 + (ball.vy * timeStep)**2);
                const rotationAngle = distance / BALL_RADIUS;

                // --- CORRECCIÓN: El eje de rotación debe ser perpendicular a la dirección del movimiento.
                // Esto asegura que la bola "ruede" en la dirección en la que se mueve.
                // La velocidad de la animación es fija, pero la dirección del giro es dinámica.
                const rotationAxis = new THREE.Vector3(-ball.vy, ball.vx, 0).normalize();

                const deltaQuaternion = new THREE.Quaternion();
                deltaQuaternion.setFromAxisAngle(rotationAxis, rotationAngle);

                // --- SOLUCIÓN DEFINITIVA: Aplicar primero la rotación de rodado y luego la de efecto ---
                // 1. Aplicar la rotación de rodado natural a la malla de la bola.
                ball.mesh.children[0].quaternion.premultiply(deltaQuaternion);

                // 2. Si es la bola blanca y tiene efecto, aplicar esa rotación adicionalmente en su espacio local.
                if (ball === cueBall && (ball.spin.x !== 0 || ball.spin.y !== 0)) {
                    // Efecto lateral (spin.x) alrededor del eje Y local de la bola
                    const sideSpinAxis = new THREE.Vector3(0, 1, 0); 
                    const sideSpinAngle = -ball.spin.x * 0.05 * timeStep; // Reducimos un poco la velocidad del efecto visual
                    ball.mesh.children[0].rotateOnWorldAxis(sideSpinAxis, sideSpinAngle);

                    // Efecto vertical (spin.y) alrededor del eje X local de la bola
                    const verticalSpinAxis = new THREE.Vector3(1, 0, 0); 
                    const verticalSpinAngle = ball.spin.y * 0.05 * timeStep; // Reducimos un poco la velocidad del efecto visual
                    ball.mesh.children[0].rotateOnWorldAxis(verticalSpinAxis, verticalSpinAngle);
                }
            }
        });
    }

    handleInput();
    updateUI(); // --- NUEVO: Actualizar la UI (incluyendo el taco)
    renderer.render(scene, camera);
}

// --- NUEVO: Función para marcar que un tiro ha comenzado ---
window.startShot = () => { // --- CORRECCIÓN: Hacerla global para que ui.js pueda llamarla
    startShot();
}

// --- NUEVO: Función global para activar la vibración de la pantalla ---
window.triggerScreenShake = (intensity, duration) => {
    shakeIntensity = intensity;
    shakeDuration = duration;
    // Guardar la posición actual de la cámara para restaurarla después
    originalCameraPosition.copy(camera.position);
};


// --- 4. Iniciar el juego --- (Lógica de inicialización refactorizada)

function initGame() {
    initializeHandles(); // Inicializamos los puntos de los bordes
    // initFallPhysics(); // Ya no es necesario

    // --- MODIFICACIÓN: La inicialización de audio y UI se hace aquí, pero la carga se dispara después ---
    initAudio(camera); 

    // --- CORRECCIÓN: setupBalls() ya no se llama aquí. Se pasa como callback a loadBallModels.
    initializeUI(); // Inicializamos los listeners y elementos de la UI
    gameLoop(); // Iniciar el bucle del juego
}

// --- MODIFICACIÓN: El juego se inicializa por pasos controlados por el loadingManager ---
setOnLoadingComplete((step, onStepComplete) => {
    // El loadingManager nos dice qué paso ejecutar.
    // --- LOG: Indica qué paso de procesamiento posterior a la carga se está ejecutando.
    switch (step) {
        case 'init_game':
            initGame();
            // El bucle del juego ya está corriendo, pero la pantalla de carga sigue encima.
            break;

        case 'setup_balls':
            // Los modelos ya están cargados, ahora creamos las bolas en la escena.
            setupBalls(true); // El 'true' indica que es la configuración inicial.
            break;

        case 'warmup_physics':
            // Ejecuta una simulación muy breve para forzar la compilación JIT del navegador.
            const warmUpFrames = 15; // Aumentamos un poco para asegurar la compilación
            for (let i = 0; i < warmUpFrames; i++) {
                updateBallPositions(1 / 60, balls, pockets, handles, BALL_RADIUS);
            }
            // Reseteamos cualquier posible micro-movimiento que se haya podido generar
            balls.forEach(ball => {
                ball.vx = 0;
                ball.vy = 0;
            });
            break;
        
        case 'super_warmup':
            // --- SOLUCIÓN DEFINITIVA: Simular un golpe real de forma invisible ---
            // 1. Silenciar todos los sonidos temporalmente.
            window.muteAllSounds(true);

            // 2. Simular un golpe potente a la bola blanca.
            if (cueBall) {
                cueBall.vx = 1500; // Impulso fuerte para asegurar colisiones.
                cueBall.vy = 50;
            }

            // 3. Ejecutar varios frames de la simulación completa.
            // Esto forzará la compilación JIT de las colisiones, la compilación de shaders
            // y la inicialización de los buffers de audio.
            for (let i = 0; i < 20; i++) {
                updateBallPositions(1 / 60, balls, pockets, handles, BALL_RADIUS);
            }

            // 4. Resetear completamente el estado del juego a su posición inicial.
            setupBalls(true); // Esto recoloca todas las bolas y resetea sus velocidades.
            window.muteAllSounds(false); // 5. Reactivar los sonidos.
            break;
    }

    // Notificamos al loadingManager que este paso ha terminado, para que pueda actualizar la barra
    // de progreso y decidir si empieza el siguiente paso o finaliza la carga.
    onStepComplete();
});

// --- MODIFICACIÓN: Centralizar el inicio de todas las cargas ---

// 0. Definimos los pasos de procesamiento que ocurrirán después de la descarga de archivos.
setProcessingSteps(['init_game', 'setup_balls', 'warmup_physics', 'super_warmup']);

// 1. Preparamos todos los cargadores
prepareAudio();
prepareBallLoaders();
prepareUIResources();
prepareAimingResources(); // --- CORRECCIÓN: Añadir la llamada para cargar los recursos del taco.
loadTableTexture(); // --- NUEVO: Iniciar la carga de la textura de la mesa aquí.

// 2. Iniciamos la carga de los modelos, que es la operación principal que el LoadingManager rastreará.
// --- MODIFICACIÓN: Ya no se llama a setupBalls aquí. Se ha convertido en un paso de procesamiento.
loadBallModels();
