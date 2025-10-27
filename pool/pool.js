import * as THREE from 'three';
import { updateBallPositions, areBallsMoving } from './fisicas.js';
import TWEEN from 'https://unpkg.com/@tweenjs/tween.js@23.1.1/dist/tween.esm.js';
// --- NUEVO: Importar Firebase para el modo online ---
import { db, auth } from './login/auth.js';
import { doc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { initializeHandles, handles, pockets, BALL_RADIUS, TABLE_WIDTH, TABLE_HEIGHT } from './config.js'; // Asegúrate que handles se exporta
import { scene, camera, renderer, loadTableTexture } from './scene.js'; // --- CORRECCIÓN: Importar showFoulMessage
import { balls, cueBall, setupBalls, loadBallModels, cueBallRedDot, prepareBallLoaders, getSceneBalls } from './ballManager.js'; // --- SOLUCIÓN: Quitar updateSafeArea
import { handleInput, initializeUI, updateUI, prepareUIResources, updateTurnTimerUI } from './ui.js'; // --- SOLUCIÓN: Importar updateTurnTimerUI
import { initAudio, loadSound, prepareAudio } from './audioManager.js';
import { initFallPhysics, addBallToFallSimulation, updateFallPhysics } from './fallPhysics.js'; // --- CORRECCIÓN: Importar showFoulMessage
import { setOnLoadingComplete, setProcessingSteps } from './loadingManager.js';
import { initCueBallEffects, updateCueBallEffects, showShotEffect } from './cueBallEffects.js'; // --- SOLUCIÓN: Importar el módulo de efectos
import { prepareAimingResources, updateAimingGuides } from './aiming.js';
import { getGameState, handleTurnEnd, startShot, addPocketedBall, setGamePaused, areBallsAnimating, setPlacingCueBall, showFoulMessage, checkTurnTimer, isTurnTimerActive, turnStartTime, TURN_TIME_LIMIT, clearPocketedBalls, clearFirstHitBall, stopTurnTimer, setOnlineGameData, setShotInProgress } from './gameState.js';
import { revisarEstado } from './revisar.js'; // --- SOLUCIÓN: Importar revisarEstado aquí

let lastTime;

// --- NUEVO: Variables para el efecto de vibración de la cámara ---
let shakeIntensity = 0;
let shakeDuration = 0;
let originalCameraPosition = new THREE.Vector3();

// --- NUEVO: Para evitar procesar el mismo tiro dos veces ---
let lastProcessedShotTimestamp = 0;
// --- NUEVO: Para controlar el mensaje "Es tu turno" ---
let lastNotifiedTurnPlayerUid = null;
const turnIndicator = document.getElementById('turnIndicator');


function gameLoop(time) {
    // --- LOG: Indica el inicio de un nuevo fotograma en el bucle del juego.
    // console.log('[GameLoop] Iniciando nuevo fotograma...');

    TWEEN.update(time); // --- NUEVO: Actualizar el motor de animaciones TWEEN
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
        // --- SOLUCIÓN: Usar una variable de estado para asegurar que la revisión se haga una sola vez ---
        const ballsHaveStopped = !areBallsMoving(balls) && !areBallsAnimating(balls);
        // --- CORRECCIÓN: La revisión del estado debe ocurrir si las bolas se acaban de detener.
        // Se usa una variable externa (importada de ui.js) para saber si en el frame anterior se estaban moviendo.
        // Esta es la forma más fiable de detectar el fin de un tiro.
        if (window.ballsWereMoving && ballsHaveStopped) {
            // --- LOG: Indica que se cumplen las condiciones para finalizar el turno.
            // --- MODIFICACIÓN: El log ahora se muestra dentro de handleTurnEnd para ser más preciso.
            
            // --- SOLUCIÓN: La revisión del estado ahora se hace aquí, después de que las bolas se detienen.
            handleTurnEnd(); // Marcar el tiro como finalizado (resetea shotInProgress)
            revisarEstado(false); // Revisar el resultado del tiro (sin falta por tiempo)

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

                    // --- SOLUCIÓN: Mostrar el efecto de estela si es la bola blanca y se mueve rápido ---
                    if (ball === cueBall) {
                        showShotEffect();
                    }

                    ball.mesh.children[0].rotateOnWorldAxis(verticalSpinAxis, verticalSpinAngle);
                }
            }
        });
    }

    handleInput();
    updateCueBallEffects(dt);
    updateUI(); // --- NUEVO: Actualizar la UI (incluyendo el taco)

    // --- SOLUCIÓN: Actualizar el temporizador de turno ---
    if (isTurnTimerActive()) {
        const elapsedTime = performance.now() - turnStartTime;
        const timeRemainingPercent = Math.max(0, 1 - (elapsedTime / TURN_TIME_LIMIT));
        updateTurnTimerUI(getGameState().currentPlayer, timeRemainingPercent);
        if (checkTurnTimer()) {
            // --- CORRECCIÓN: Forzar fin de turno y revisar el estado inmediatamente.
            // Detener el temporizador para que no se siga ejecutando.
            stopTurnTimer();
            // Se llama a revisarEstado con la bandera de tiempo agotado para procesar la falta.
            revisarEstado(true, doc(db, "games", new URLSearchParams(window.location.search).get('gameId')), null);
        }
    }
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

    // --- MODIFICACIÓN: La inicialización de audio y UI se hace aquí, pero la carga se dispara después ---
    initAudio(camera);
    initCueBallEffects(); // --- SOLUCIÓN: Inicializar el sistema de efectos de la bola blanca

    // --- NUEVO: Lógica para modo online vs offline ---
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('gameId');

    if (gameId) {
        // --- MODO ONLINE ---
        connectToGame(gameId);
    } else {
        // --- MODO OFFLINE (como estaba antes) ---
        // El setup de las bolas se hará a través del loadingManager
    }

    gameLoop(); // Iniciar el bucle del juego en ambos modos
}

// --- NUEVO: Función para conectar y sincronizar con una partida de Firestore ---
function connectToGame(gameId) {
    const gameRef = doc(db, "games", gameId);

    onSnapshot(gameRef, (docSnap) => {
        if (!docSnap.exists()) {
            console.error("La partida no existe!");
            alert("La partida ha sido cerrada o el oponente se ha desconectado.");
            window.location.href = './login/home.html';
            return;
        }

        const gameData = docSnap.data();

        // --- NUEVO: Lógica para mostrar el indicador de turno ---
        const currentUser = auth.currentUser;
        if (currentUser && gameData.currentPlayerUid === currentUser.uid && lastNotifiedTurnPlayerUid !== currentUser.uid) {
            if (turnIndicator) {
                turnIndicator.textContent = "¡Es tu turno!";
                turnIndicator.classList.add('visible');
                // Ocultar el mensaje después de unos segundos
                setTimeout(() => {
                    turnIndicator.classList.remove('visible');
                }, 2500);
            }
            lastNotifiedTurnPlayerUid = currentUser.uid;
        } else if (currentUser && gameData.currentPlayerUid !== currentUser.uid) {
            lastNotifiedTurnPlayerUid = null; // Resetear cuando ya no es mi turno
        }

        // --- NUEVO: Sincronizar el estado de "bola en mano" ---
        if (gameData.ballInHand && currentUser && gameData.currentPlayerUid === currentUser.uid) {
            // Si el servidor dice que tengo bola en mano, la activo localmente.
            setPlacingCueBall(true);
        }

        // --- NUEVO: Sincronización de la mira en tiempo real ---
        // Si hay datos de apuntado y NO soy yo quien apunta...
        if (gameData.aimingState && currentUser && gameData.currentPlayerUid !== currentUser.uid) { // Reutilizamos la variable currentUser ya declarada arriba
            // ...dibuja las guías del oponente.
            updateAimingGuides(gameData.aimingState.angle, getGameState(), 0, false);
        }

        // --- ¡LÓGICA DE SINCRONIZACIÓN CLAVE! ---
        // Si hay un nuevo tiro y no lo hemos procesado ya...
        if (gameData.lastShot && gameData.lastShot.timestamp > lastProcessedShotTimestamp) {
            lastProcessedShotTimestamp = gameData.lastShot.timestamp;

            // Marcar que un tiro está en progreso para bloquear inputs
            setShotInProgress(true);

            // Aplicar el tiro a la bola blanca local
            if (cueBall) {
                const { angle, power, spin } = gameData.lastShot;
                cueBall.vx = Math.cos(angle) * power;
                cueBall.vy = Math.sin(angle) * power;
                cueBall.spin = spin;
                cueBall.initialVx = cueBall.vx;
                cueBall.initialVy = cueBall.vy;
            }

            // Esperar a que la simulación de física termine
            const waitForShotToEnd = setInterval(() => {
                if (!areBallsMoving(getSceneBalls()) && !areBallsAnimating(getSceneBalls())) {
                    clearInterval(waitForShotToEnd);

                    // Solo el jugador que hizo el tiro actualiza el estado final
                    if (gameData.lastShot.playerId === auth.currentUser.uid) {
                        // Preparar el nuevo estado de las bolas para subirlo a Firestore
                        const finalBallStates = getSceneBalls().map(b => ({
                            number: b.number,
                            x: b.mesh.position.x,
                            y: b.mesh.position.y,
                            isActive: b.isActive
                        }));
                        
                        // --- CORRECCIÓN: La revisión del estado ahora la hace el jugador que disparó ---
                        revisarEstado(false, gameRef, finalBallStates);
                    } else {
                        // --- CORRECCIÓN: El jugador que NO hizo el tiro, anima las bolas a su nueva posición ---
                        // El otro jugador recibe las posiciones finales y anima las bolas
                        if (gameData.balls) {
                            gameData.balls.forEach(serverBall => {
                                const localBall = getSceneBalls().find(b => b.number === serverBall.number);
                                if (localBall && localBall.isActive) {
                                    new TWEEN.Tween(localBall.mesh.position)
                                        .to({ x: serverBall.x, y: serverBall.y }, 400) // Animación de 400ms
                                        .easing(TWEEN.Easing.Cubic.Out)
                                        .start();
                                }
                            });
                        }
                    }
                }
            }, 100); // Comprobar cada 100ms
        }

        // --- NUEVO: Sincronización de estado general (bolas que desaparecen, etc.) ---
        if (gameData.balls) {
            gameData.balls.forEach(serverBall => {
                const localBall = getSceneBalls().find(b => b.number === serverBall.number);
                if (localBall) {
                    // Sincronizar visibilidad
                    if (localBall.isActive !== serverBall.isActive) {
                        localBall.isActive = serverBall.isActive;
                        localBall.mesh.visible = serverBall.isActive;
                        if (localBall.shadowMesh) localBall.shadowMesh.visible = serverBall.isActive;
                    }
                    // Sincronizar posición (si no hay un tiro en curso)
                    if (!gameData.lastShot || gameData.lastShot.timestamp <= lastProcessedShotTimestamp) {
                         if (localBall.mesh.position.x !== serverBall.x || localBall.mesh.position.y !== serverBall.y) {
                            new TWEEN.Tween(localBall.mesh.position)
                                .to({ x: serverBall.x, y: serverBall.y }, 200)
                                .easing(TWEEN.Easing.Quadratic.Out)
                                .start();
                        }
                    }
                }
            });
        }

        // --- NUEVO: Guardar el estado del juego online para que otros módulos lo usen ---
        setOnlineGameData(gameData);

        // Actualizar la UI con los nombres de los jugadores
        const player1NameEl = document.getElementById('player1-name');
        const player2NameEl = document.getElementById('player2-name');

        if (player1NameEl) player1NameEl.textContent = gameData.player1.username;
        if (player2NameEl && gameData.player2) player2NameEl.textContent = gameData.player2.username;

        // --- NUEVO: Sincronizar las bolas con los datos de Firestore ---
        if (gameData.balls && balls.length === 0) { // Solo configurar las bolas una vez
            console.log("Configurando bolas desde Firestore...");
            gameData.balls.forEach(ballData => {
                // La función setupBalls ahora puede crear bolas individuales si se le pasa data
                setupBalls(false, ballData); 
            });
        } else if (gameData.balls) {
            // Si las bolas ya existen, solo actualizamos sus posiciones
            gameData.balls.forEach(ballData => {
                const ball = balls.find(b => b.number === ballData.number);
                if (ball) {
                    // No teletransportar, la animación se encarga de esto
                    // ball.mesh.position.set(ballData.x, ballData.y, BALL_RADIUS);
                    ball.isActive = ballData.isActive;
                    ball.mesh.visible = ballData.isActive;
                    if (ball.shadowMesh) ball.shadowMesh.visible = ballData.isActive;
                }
            });
        }
    });
}

setOnLoadingComplete((step, onStepComplete) => {
    // El loadingManager nos dice qué paso ejecutar.
    // --- LOG: Indica qué paso de procesamiento posterior a la carga se está ejecutando.
    switch (step) {
        case 'init_game':
            initGame();
            // El bucle del juego ya está corriendo, pero la pantalla de carga sigue encima.
            break;

        case 'init_ui':
            // --- SOLUCIÓN: Inicializar la UI como un paso separado después de initGame ---
            initializeUI();
            break;

        case 'setup_balls':
            // --- MODIFICADO: Solo colocar las bolas si no es una partida online ---
            const urlParams = new URLSearchParams(window.location.search);
            if (!urlParams.has('gameId')) {
                // Los modelos ya están cargados, ahora creamos las bolas en la escena.
                setupBalls(true); // El 'true' indica que es la configuración inicial.
            }
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
setProcessingSteps(['init_game', 'init_ui', 'setup_balls', 'warmup_physics', 'super_warmup']);

// 1. Preparamos todos los cargadores
prepareAudio();
prepareBallLoaders();
prepareUIResources();
prepareAimingResources(); // --- CORRECCIÓN: Añadir la llamada para cargar los recursos del taco.
loadTableTexture(); // --- NUEVO: Iniciar la carga de la textura de la mesa aquí.

// 2. Iniciamos la carga de los modelos, que es la operación principal que el LoadingManager rastreará.
// --- MODIFICACIÓN: Ya no se llama a setupBalls aquí. Se ha convertido en un paso de procesamiento.
loadBallModels();
