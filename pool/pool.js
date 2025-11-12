import * as THREE from 'three';
import { updateBallPositions, areBallsMoving, applyBallStatesFromServer } from './fisicas.js';
import TWEEN from 'https://unpkg.com/@tweenjs/tween.js@23.1.1/dist/tween.esm.js';
import { db, auth, onSnapshot, doc, onAuthStateChanged, updateDoc, getDoc } from './login/auth.js'; // --- CORRECCIÓN: Importar onSnapshot y doc
import { arrayUnion } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { initializeHandles, handles, pockets, BALL_RADIUS, TABLE_WIDTH, TABLE_HEIGHT } from './config.js'; // Asegúrate que handles se exporta
import { scene, camera, renderer, loadTableTexture } from './scene.js'; // --- CORRECCIÓN: Importar showFoulMessage
import { balls, cueBall, setupBalls, loadBallModels, cueBallRedDot, prepareBallLoaders, getSceneBalls, updateBallModelAndTexture } from './ballManager.js'; // --- SOLUCIÓN: Quitar updateSafeArea
import { handleInput, initializeUI, updateUI, prepareUIResources, updateTurnTimerUI, updateActivePlayerUI, updatePlayerInfoUI } from './ui.js'; // --- SOLUCIÓN: Importar updateTurnTimerUI
import { initAudio, loadSound, prepareAudio } from './audioManager.js';
import { initFallPhysics, addBallToFallSimulation, updateFallPhysics } from './fallPhysics.js'; // --- CORRECCIÓN: Importar showFoulMessage
import { setOnLoadingComplete, setProcessingSteps } from './loadingManager.js';
import { initCueBallEffects, updateCueBallEffects, showShotEffect } from './cueBallEffects.js';
import { prepareAimingResources, updateAimingGuides, hideAimingGuides, cueMesh } from './aiming.js';
import { getGameState, handleTurnEnd, startShot, addPocketedBall, setGamePaused, areBallsAnimating, setPlacingCueBall, showFoulMessage, checkTurnTimer, isTurnTimerActive, turnStartTime, TURN_TIME_LIMIT, INACTIVITY_TIME_LIMIT, clearPocketedBalls, clearFirstHitBall, stopTurnTimer, setShotInProgress, getOnlineGameData, setOnlineGameData } from './gameState.js';
import { getCurrentShotAngle, isMovingCueBall } from './inputManager.js';
import { revisarEstado } from './revisar.js';
import { initializePowerBar, getPowerPercent } from './powerBar.js';
import { shoot } from './shooting.js';

// --- Variables para el bucle de juego con timestep fijo ---
const FIXED_DT = 1 / 60.0; // Paso de tiempo fijo para la simulación de física (60 FPS).
const MAX_STEPS_PER_FRAME = 5; // Límite de pasos de simulación por frame para evitar la "espiral de la muerte".
let lastFrameTime = performance.now(); // Tiempo del último frame renderizado.
let accumulator = 0.0; // Acumula el tiempo entre frames para alimentar la simulación de física.

// --- NUEVO: Variables para el efecto de vibración de la cámara ---
let gameRef = null; // --- NUEVO: Referencia global a la partida online
let localPlayerNumber = 0; // --- SOLUCIÓN: 1 o 2, para saber quiénes somos en esta partida
export function getGameRef(gameId) { // --- NUEVO: Función global para obtener la referencia
    if (!gameRef) gameRef = doc(db, "games", gameId);
    // --- NUEVO: Variables para sincronización de apuntado ---
    let opponentAimAngle = null;
    return gameRef;
}

// --- NEW: Throttle function (moved from index.html) ---
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// --- NEW: Function to send spin update to Firestore (moved from index.html) ---
export const sendSpinUpdate = throttle(async (spin) => {
    // gameRef is already available globally in pool.js
    if (gameRef) { // Check if gameRef is initialized
        try {
            await updateDoc(gameRef, { aimingSpin: spin });
        } catch (error) {
            console.error("Error al sincronizar el efecto:", error);
        }
    }
}, 100); // Reduced throttle limit for smoother updates

let shakeIntensity = 0;
let shakeDuration = 0;
let originalCameraPosition = new THREE.Vector3();


// --- NUEVO: Variables y listener para sincronización de apuntado ---
let serverAimAngle = null, smoothedAimAngle = null; // --- CORRECCIÓN: Variable única para el ángulo del servidor.
let currentGameState = {}; // Guardará el estado del juego recibido
let serverPowerPercent = 0; // --- NUEVO: Variable para la potencia recibida del servidor.
let lastProcessedShotTimestamp = 0; // Para no aplicar el mismo tiro dos veces
let lastFoulTimestamp = 0; // Para no mostrar el mismo mensaje de falta dos veces

window.addEventListener('receiveaim', (event) => {
    const gameData = event.detail;
    if (!gameData) return;

    currentGameState = gameData; // Guardar siempre el estado más reciente.

    // --- SOLUCIÓN: Disparar el evento para que la UI actualice las bolas entroneradas ---
    window.dispatchEvent(new CustomEvent('updateassignments', { detail: gameData }));

    if (typeof gameData.aimingAngle !== 'undefined') {
        serverAimAngle = gameData.aimingAngle; // Guardar el ángulo del servidor, sin importar de quién sea el turno.
    } else {
        serverAimAngle = null; // Limpiar si no hay ángulo en los datos.
    }

    // --- NUEVO: Leer la potencia del servidor ---
    if (typeof gameData.aimingPower !== 'undefined') {
        serverPowerPercent = gameData.aimingPower;
    }

    // --- NUEVO: Leer el estado del modal de efecto y enviarlo a la UI ---
    if (typeof gameData.isSpinModalOpen !== 'undefined') {
        window.dispatchEvent(new CustomEvent('updatespinmodal', { detail: { visible: gameData.isSpinModalOpen } }));
    }

    // --- NUEVO: Manejar bolas entroneradas enviadas por el otro jugador ---
    if (gameData.pocketedBalls && gameData.pocketedBalls.length > 0) {
        gameData.pocketedBalls.forEach(ballNumber => {
            const localBall = balls.find(b => b.number === ballNumber);
            if (localBall && localBall.isActive) {
                localBall.isActive = false;
                localBall.mesh.visible = false;
                if (localBall.shadowMesh) localBall.shadowMesh.visible = false;
                addPocketedBall(localBall);
            }
        });
    }

    // --- NUEVO: Lógica para recibir y aplicar un tiro del servidor ---
    if (gameData.lastShot && gameData.lastShot.timestamp > lastProcessedShotTimestamp) {
        lastProcessedShotTimestamp = gameData.lastShot.timestamp;

        // ---
        // Aplicamos el tiro (tanto el nuestro como el del oponente) desde el servidor
        // para asegurar que ambos juegos estén perfectamente sincronizados.
        const { angle, power, spin, cueBallStartPos } = gameData.lastShot;

        // Llamamos a una nueva función que encapsula la lógica de aplicar el tiro
        applyServerShot(angle, power, spin, cueBallStartPos);

        // Limpiar las bolas entroneradas del turno anterior
        if (gameRef) {
            updateDoc(gameRef, { pocketedBalls: [] }).catch(err => console.error("Error limpiando pocketedBalls:", err));
        }
    }



    // --- NUEVO: Lógica para recibir y aplicar información de falta ---
    if (gameData.foulInfo && gameData.foulInfo.timestamp > lastFoulTimestamp) {
        lastFoulTimestamp = gameData.foulInfo.timestamp;

        // Solo mostrar el mensaje de falta si no es mi turno y la falta es para el otro jugador
        // O si es mi turno y la falta es para mí (aunque mi cliente ya la habría mostrado)
        const myUid = auth.currentUser?.uid;
        const foulPlayerUid = gameData.currentPlayerUid; // El jugador que tiene el turno después de la falta

        // Si la falta es para el jugador que acaba de terminar su turno (el que la cometió)
        // y el turno ha cambiado al otro jugador, entonces el otro jugador ve el mensaje.
        // Si la falta es para el jugador actual (porque el turno no cambió), entonces él ve el mensaje.
        if (gameData.foulInfo.reason && gameData.currentPlayerUid !== myUid) {
            // Si el turno cambió y no soy el jugador actual, muestro la falta del otro.
            showFoulMessage(`Falta: ${gameData.foulInfo.reason}`);
        } else if (gameData.foulInfo.reason && gameData.currentPlayerUid === myUid) {
            // Si el turno no cambió y soy el jugador actual, muestro mi propia falta.
            showFoulMessage(`Falta: ${gameData.foulInfo.reason}`);
        }

        if (gameData.foulInfo.ballInHand) {
            // Si la falta implica bola en mano, el jugador actual (que recibió el turno) la tiene.
            setPlacingCueBall(true);
        }
    } else {
        // Si no hay foulInfo, asegurarse de que no haya bola en mano activa por una falta anterior.
        // Esto es importante si el foulInfo se limpia en el servidor después de un tiempo.
        // setPlacingCueBall(false); // Esto podría interferir si el jugador actual tiene bola en mano por otras razones.
    }

    // --- NUEVO: Lógica para recibir el estado de "bola en mano" y la posición ---
    const myUid = auth.currentUser?.uid;
    if (gameData.cueBallPosition && cueBall && cueBall.mesh) {
        // Si el servidor indica una posición para la bola blanca, la aplicamos.
        // La comprobación de isMovingCueBall() (en inputManager) evitará que esto sobreescriba la posición
        // mientras el jugador arrastra la bola.
        if (!isMovingCueBall()) {
            // --- SOLUCIÓN: Asegurar que la bola esté activa y visible al recibir una posición del servidor ---
            cueBall.isActive = true;
            cueBall.isPocketed = false;
            cueBall.pocketedState = null;
            cueBall.mesh.visible = true;
            
            cueBall.mesh.position.x = gameData.cueBallPosition.x;
            cueBall.mesh.position.y = gameData.cueBallPosition.y;
            
            if (cueBall.shadowMesh) {
                cueBall.shadowMesh.visible = true;
                cueBall.shadowMesh.position.set(gameData.cueBallPosition.x, gameData.cueBallPosition.y, 0.1);
            }
        }

        // Si el servidor indica que YO tengo bola en mano, me aseguro de que la bola esté activa y visible.
        if (gameData.ballInHandFor === myUid) {
            cueBall.isPocketed = false;
            cueBall.pocketedState = null;
            cueBall.isActive = true;
            cueBall.mesh.visible = true;
            if (cueBall.shadowMesh) cueBall.shadowMesh.visible = true;
            setPlacingCueBall(true); // Asegurarse de que el estado de colocación esté activo.
        }
    }

});

window.addEventListener('sendsingleplayer', (event) => {
    // Este listener es solo para el modo offline, si se implementa en el futuro.
});

async function gameLoop(currentTime) {
    // 1. Sincronización del bucle y cálculo del tiempo
    requestAnimationFrame(gameLoop);
    TWEEN.update(currentTime);
    const deltaTime = (currentTime - lastFrameTime) / 1000.0; // Delta time en segundos
    lastFrameTime = currentTime;

    // 2. Lógica de pausa
    if (getGameState().gamePaused) {
        renderer.render(scene, camera); // Renderizar incluso en pausa
        return;
    }

    // 3. Bucle de simulación de física con timestep fijo
    accumulator += deltaTime;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
        // Simulación de física
        const pocketedInFrame = updateBallPositions(FIXED_DT, balls, pockets, handles, BALL_RADIUS);

        // Lógica de bolas entroneradas (consecuencia directa de la física)
        if (pocketedInFrame.length > 0) {
            const isMyTurn = currentGameState.currentPlayerUid === auth.currentUser?.uid;
            const { pocketedThisTurn } = getGameState();
            for (const ball of pocketedInFrame) {
                const alreadyPocketed = pocketedThisTurn.some(p => p.number === ball.number);
                const localBall = balls.find(b => b.number === ball.number);
                if (localBall) {
                    localBall.isActive = false;
                }

                if (!alreadyPocketed) {
                    addPocketedBall(ball);
                    if (localBall) {
                        localBall.isActive = false;
                        localBall.mesh.visible = false;
                        if (localBall.shadowMesh) localBall.shadowMesh.visible = false;
                    }
                    if (gameRef && isMyTurn) {
                        updateDoc(gameRef, { pocketedBalls: arrayUnion(ball.number) })
                            .catch(err => console.error("Error enviando bola entronerada:", err));

                        const gameState = getGameState();
                        if (gameState && gameState.playerAssignments) {
                            if (!gameState.ballsAssigned && ball.number !== null && ball.number !== 8) {
                                const { assignPlayerTypes } = await import('./gameState.js');
                                const type = (ball.number >= 1 && ball.number <= 7) ? 'solids' : 'stripes';
                                const currentPlayerNumber = currentGameState.currentPlayerUid === currentGameState.player1?.uid ? 1 : 2;
                                const { playerAssignments: newPlayerAssignments, ballsAssigned: newBallsAssigned } = assignPlayerTypes(
                                    currentPlayerNumber, type, gameState.playerAssignments, gameState.ballsAssigned
                                );
                                gameState.ballsAssigned = newBallsAssigned;
                                gameState.playerAssignments = newPlayerAssignments;
                                if (gameRef) {
                                    await updateDoc(gameRef, {
                                        ballsAssigned: newBallsAssigned,
                                        playerAssignments: newPlayerAssignments
                                    });
                                }
                            }
                            const currentPlayerNumber = currentGameState.currentPlayerUid === currentGameState.player1?.uid ? 1 : 2;
                            window.dispatchEvent(new CustomEvent('updateassignments', { detail: gameState }));
                        }
                    }
                }
            }
        }
        accumulator -= FIXED_DT;
        steps++;
    }

    // 4. Lógica de fin de turno (se ejecuta una vez por frame si las bolas se detienen)
    const ballsHaveStopped = !areBallsMoving(balls) && !areBallsAnimating(balls);
    if (window.ballsWereMoving && ballsHaveStopped) {
        if (gameRef) {
            if (currentGameState.currentPlayerUid === auth.currentUser?.uid) {
                await revisarEstado(false, gameRef, currentGameState);
            }
        } else {
            await revisarEstado(false, null, getGameState());
        }
        handleTurnEnd();
    }

    // 5. Actualizaciones visuales (se ejecutan una vez por frame)
    // Efecto de vibración de la cámara
    if (shakeDuration > 0) {
        camera.position.x = originalCameraPosition.x + (Math.random() - 0.5) * shakeIntensity;
        camera.position.y = originalCameraPosition.y + (Math.random() - 0.5) * shakeIntensity;
        shakeDuration -= deltaTime;
        shakeIntensity *= 0.95;
        if (shakeDuration <= 0) {
            camera.position.copy(originalCameraPosition);
        }
    }

    // Rotación visual de las bolas y gestión de bolas entroneradas
    if (deltaTime > 0) {
        const timeStep = deltaTime * 100;
        for (let i = balls.length - 1; i >= 0; i--) {
            const ball = balls[i];
            if (ball.pocketedState === 'collected') {
                if (ball.number === null) {
                    ball.isActive = false;
                    ball.vx = 0; ball.vy = 0;
                    addPocketedBall(ball);
                } else {
                    ball.isActive = false;
                    ball.vx = 0; ball.vy = 0;
                    addPocketedBall(ball);
                    scene.remove(ball.mesh);
                    if (ball.shadowMesh) scene.remove(ball.shadowMesh);
                }
            }
        }

        balls.forEach(ball => {
            if (ball.isActive && (ball.vx !== 0 || ball.vy !== 0)) {
                const distance = Math.sqrt((ball.vx * timeStep)**2 + (ball.vy * timeStep)**2);
                const rotationAngle = distance / BALL_RADIUS;
                const rotationAxis = new THREE.Vector3(-ball.vy, ball.vx, 0).normalize();
                const deltaQuaternion = new THREE.Quaternion().setFromAxisAngle(rotationAxis, rotationAngle);
                ball.mesh.children[0].quaternion.premultiply(deltaQuaternion);

                if (ball === cueBall && (ball.spin.x !== 0 || ball.spin.y !== 0)) {
                    const sideSpinAxis = new THREE.Vector3(0, 1, 0);
                    const sideSpinAngle = -ball.spin.x * 0.05 * timeStep;
                    ball.mesh.children[0].rotateOnWorldAxis(sideSpinAxis, sideSpinAngle);

                    const verticalSpinAxis = new THREE.Vector3(1, 0, 0);
                    const verticalSpinAngle = ball.spin.y * 0.05 * timeStep;
                    if (ball === cueBall) {
                        showShotEffect();
                    }
                    ball.mesh.children[0].rotateOnWorldAxis(verticalSpinAxis, verticalSpinAngle);
                }
            }
        });
    }

    // Actualización de controles y UI
    handleInput();
    updateCueBallEffects(deltaTime);
    updateUI();

    // Lógica del temporizador de turno
    if (isTurnTimerActive()) {
        const elapsedTime = performance.now() - turnStartTime;
        const timeRemainingPercent = Math.max(0, 1 - (elapsedTime / TURN_TIME_LIMIT));
        updateTurnTimerUI(getGameState().currentPlayer, timeRemainingPercent);
        if (checkTurnTimer()) {
            stopTurnTimer();
            await revisarEstado(true, gameRef, currentGameState);
        }
    }

    // 6. Renderizado final
    renderer.render(scene, camera);

    // 7. Actualización de guías de apuntado y otros elementos de UI en tiempo real
    const isMyTurn = currentGameState.currentPlayerUid === auth.currentUser?.uid;
    if (!areBallsMoving(balls)) {
        if (isMyTurn) {
            const localAngle = getCurrentShotAngle();
            const localPower = getPowerPercent();
            window.dispatchEvent(new CustomEvent('sendaim', { detail: { angle: localAngle, power: localPower } }));
            updateAimingGuides(localAngle, getGameState(), localPower, true);
            if (cueMesh) cueMesh.visible = true;
        } else {
            if (serverAimAngle !== null) {
                if (smoothedAimAngle === null) smoothedAimAngle = serverAimAngle;
                smoothedAimAngle += (serverAimAngle - smoothedAimAngle) * 0.1;
                updateAimingGuides(smoothedAimAngle, getGameState(), serverPowerPercent, true);
                if (cueMesh) cueMesh.visible = true;
            } else {
                smoothedAimAngle = null;
                hideAimingGuides();
            }
        }
    }

    // Actualización del control de efecto (spin)
    import('./spinControls.js').then(({ isDraggingSpin }) => {
        if (currentGameState.aimingSpin && !isDraggingSpin()) {
            const spin = currentGameState.aimingSpin;
            if (cueBallRedDot && cueBall) {
                cueBallRedDot.position.x = spin.x * (cueBall.radius * 0.8);
                cueBallRedDot.position.y = spin.y * (cueBall.radius * 0.8);
            }
            const miniSpinSelectorDot = document.getElementById('miniSpinSelectorDot');
            if (miniSpinSelectorDot) {
                miniSpinSelectorDot.style.left = `${50 + (spin.x * 40)}%`;
                miniSpinSelectorDot.style.top = `${50 - (spin.y * 40)}%`;
            }
            const spinSelectorDot = document.getElementById('spinSelectorDot');
            const largeSpinSelector = document.getElementById('largeSpinSelector');
            if (spinSelectorDot && largeSpinSelector) {
                const rect = largeSpinSelector.getBoundingClientRect();
                if (rect.width > 0) {
                    const selectorRadius = rect.width / 2;
                    const dx = spin.x * selectorRadius;
                    const dy = -spin.y * selectorRadius;
                    spinSelectorDot.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
                }
            }
        }
    });

    // Actualización de la barra de potencia
    const powerBarFill = document.getElementById('powerBarFill');
    const powerBarHandle = document.getElementById('powerBarHandle');
    if (powerBarFill && powerBarHandle) {
        let displayPower = serverPowerPercent;
        if (isMyTurn) {
            displayPower = getPowerPercent();
        }
        powerBarFill.style.width = `${displayPower * 100}%`;
        powerBarHandle.style.left = `${displayPower * 100}%`;
    }
}


// --- NUEVO: Función para aplicar un tiro recibido del servidor ---
function applyServerShot(angle, powerPercent, spin, cueBallStartPos) {
    if (areBallsMoving(balls)) return; // No hacer nada si las bolas ya se están moviendo

    const maxPower = 5;
    const power = powerPercent * maxPower;
    const velocityFactor = 2.5;

    // --- CORRECCIÓN CRÍTICA: Colocar la bola blanca en su posición inicial ANTES de disparar ---
    if (cueBallStartPos) {
        cueBall.mesh.position.x = cueBallStartPos.x;
        cueBall.mesh.position.y = cueBallStartPos.y;
        if (cueBall.shadowMesh) cueBall.shadowMesh.position.set(cueBallStartPos.x, cueBallStartPos.y, 0.1);
    }

    // Aplicar el impulso a la bola blanca
    cueBall.vx = Math.cos(angle) * power * velocityFactor;
    cueBall.vy = Math.sin(angle) * power * velocityFactor;
    cueBall.initialVx = cueBall.vx;
    cueBall.initialVy = cueBall.vy;
    cueBall.spin = { ...spin };

    // Iniciar la animación del taco y los efectos visuales/sonoros
    import('./aiming.js').then(({ animateCueShot, hideAimingGuides }) => {
        animateCueShot(angle, powerPercent, () => {
            hideAimingGuides(); // Ocultar las guías después de la animación del taco
        });
    });

    if ('vibrate' in navigator) {
        navigator.vibrate(Math.max(100, Math.floor(powerPercent * 200)));
    }

    startShot(); // Marcar que un tiro está en progreso
    import('./audioManager.js').then(({ playSound }) => playSound('cueHit', Math.pow(powerPercent, 2) * 0.9));
}

// --- NUEVO: Hacer que la función de aplicar tiro sea accesible globalmente ---
window.applyLocalShot = applyServerShot;

// --- NUEVO: Exponer funciones y variables globales para el control de disparo local ---
window.getCurrentShotAngle = getCurrentShotAngle;
window.getCurrentAimingSpin = () => currentGameState.aimingSpin || { x: 0, y: 0 }; // Asegurar que siempre devuelve un objeto válido
window.shoot = shoot;


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
    initializePowerBar(); // --- NUEVO: Inicializar la barra de potencia

    // --- MODIFICACIÓN: La inicialización de audio y UI se hace aquí, pero la carga se dispara después ---
    initAudio(camera);
    initCueBallEffects(); // --- SOLUCIÓN: Inicializar el sistema de efectos de la bola blanca

    // --- ELIMINADO: Lógica para modo online vs offline ---
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('gameId');
    if (gameId) connectToGame(gameId);

    gameLoop(); // Iniciar el bucle del juego en ambos modos
}

// --- SOLUCIÓN: Recrear la función para conectar a una partida online ---
function connectToGame(gameId) {
    gameRef = doc(db, "games", gameId);

    // --- SOLUCIÓN: Lógica unificada para usuarios reales e invitados ---
    onAuthStateChanged(auth, async (user) => {
        let localUserId, localUsername;

        if (user && user.uid) { // --- SOLUCIÓN: Asegurarse de que el usuario tiene un UID
            // Usuario autenticado
            localUserId = user.uid;
            const userProfileDoc = await getDoc(doc(db, "saldo", user.uid));
            localUsername = userProfileDoc.exists() && userProfileDoc.data().username ? userProfileDoc.data().username : 'Jugador Invitado'; // Usar un nombre genérico si el username no está disponible
        } else {
            // Usuario invitado
            localUserId = sessionStorage.getItem('guestId');
            if (!localUserId) {
                localUserId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                sessionStorage.setItem('guestId', localUserId);
            }
            localUsername = "Invitado";
        }

        // Escuchar los cambios en la partida en tiempo real.
        let previousTurnTimestamp = null; // Para detectar inicio/cambio de turno
        const unsubscribe = onSnapshot(gameRef, async (docSnap) => {
            if (!docSnap.exists()) {
                console.error("La partida no existe o fue eliminada.");
                if (unsubscribe) unsubscribe();
                // window.location.reload(); // Recargar la página - REMOVED TO PREVENT INFINITE RELOAD IN IFRAME
                return;
            }

            const gameData = docSnap.data() || {};
            if (gameData.juegoTerminado) {
                window.location.href = 'login/home.html';
                return;
            }
            setOnlineGameData(gameData);

            // --- NUEVO: Lógica de detección de inactividad del oponente ---
            const myUid = auth.currentUser?.uid;
            if (gameData.status !== "ended" && gameData.currentPlayerUid !== myUid && gameData.turnTimestamp) {
                const elapsedTimeSinceTurn = Date.now() - gameData.turnTimestamp;
                if (elapsedTimeSinceTurn > INACTIVITY_TIME_LIMIT) {
                    console.log("Oponente inactivo. Declarando victoria.");
                    const winnerUid = myUid;
                    const loserUid = gameData.currentPlayerUid;
                    const betAmount = gameData.betAmount || 0;
                    const totalWinnings = betAmount * 2;

                    // Actualizar el saldo del ganador
                    if (winnerUid) {
                        const winnerDocRef = doc(db, "saldo", winnerUid);
                        const winnerSnap = await getDoc(winnerDocRef);
                        if (winnerSnap.exists()) {
                            const currentBalance = winnerSnap.data().balance || 0;
                            await updateDoc(winnerDocRef, {
                                balance: currentBalance + totalWinnings
                            });
                            console.log(`Winner ${winnerUid} received ${totalWinnings} due to inactivity. New balance: ${currentBalance + totalWinnings}`);
                        }
                    }

                    // Actualizar el estado del juego en Firestore
                    await updateDoc(gameRef, {
                        status: "ended",
                        winner: winnerUid,
                        winnerUsername: winnerUsername,
                        loser: loserUid,
                        loserUsername: loserUsername,
                        endedAt: Date.now(),
                        juegoTerminado: true,
                        endReason: "Oponente inactivo"
                    });
                    showFoulMessage(`¡Has ganado! El oponente se desconectó o estuvo inactivo.`, winnerUid);
                    return; // Salir para evitar procesar más el estado del juego si ya terminó
                }
            }

            // --- NUEVO: Asegurar que el username del jugador 1 esté correctamente establecido ---
            if (gameData.player1 && gameData.player1.uid === localUserId && gameData.player1.username !== localUsername) {
                updateDoc(gameRef, {
                    'player1.username': localUsername
                }).catch(err => console.error("Error al actualizar username de jugador 1:", err));
            }

            if (gameData.balls && !areBallsMoving(balls)) {
                syncBallPositionsFromServer(gameData.balls, gameData, localUserId);
            }

            // Si el puesto de jugador 2 está libre y nosotros no somos el jugador 1, lo reclamamos.
            if (gameData.player2 === null && gameData.player1?.uid !== localUserId) {
                updateDoc(gameRef, {
                    player2: { uid: localUserId, username: localUsername }
                }).catch(err => console.error("Error al unirse como jugador 2:", err));
                return; // Esperar al siguiente snapshot con la info actualizada.
            }

            // --- FETCH PLAYER PROFILES ---
            let player1Profile = null;
            if (gameData.player1 && gameData.player1.uid) {
                const p1Doc = await getDoc(doc(db, "saldo", gameData.player1.uid));
                if (p1Doc.exists()) {
                    player1Profile = p1Doc.data();
                }
            }

            let player2Profile = null;
            if (gameData.player2 && gameData.player2.uid) {
                const p2Doc = await getDoc(doc(db, "saldo", gameData.player2.uid));
                if (p2Doc.exists()) {
                    player2Profile = p2Doc.data();
                }
            }

            // Update the entire player UI (name + avatar)
            updatePlayerInfoUI(player1Profile, player2Profile);

            // Determinar si somos el jugador 1 o 2.
            if (gameData.player1 && gameData.player1.uid === localUserId) {
                localPlayerNumber = 1;
            } else if (gameData.player2 && gameData.player2.uid === localUserId) {
                localPlayerNumber = 2;
            } else {
                localPlayerNumber = 0; // Somos espectadores
            }

            // Actualizar el indicador de turno activo
            const activePlayerNumber = gameData.currentPlayerUid === gameData.player1?.uid ? 1 : 2;
            
            // --- NUEVO: Detectar nuevo turno (o continuación) y reiniciar temporizador ---
            if (gameData.turnTimestamp && gameData.turnTimestamp !== previousTurnTimestamp) {
                import('./gameState.js').then(({ setCurrentPlayer }) => {
                    setCurrentPlayer(activePlayerNumber); // Esto resetea el temporizador de turno
                });
            }
            previousTurnTimestamp = gameData.turnTimestamp; // Guardar el timestamp para la próxima comparación

            updateActivePlayerUI(activePlayerNumber);

            // --- NUEVO: Disparar el evento receiveaim aquí para que pool.js procese los datos del servidor ---
            window.dispatchEvent(new CustomEvent('receiveaim', { detail: gameData }));
        });

        // --- NUEVO: Listener para enviar la posición de la bola blanca al servidor ---
        window.addEventListener('sendcueballmove', (event) => {
            const { position } = event.detail;
            if (gameRef) {
                updateDoc(gameRef, {
                    cueBallPosition: { x: position.x, y: position.y }
                }).catch(err => console.error("Error al actualizar cueBallPosition:", err));
            }
        });

        // --- NUEVO: Listener para limpiar la posición de la bola blanca en el servidor ---
        window.addEventListener('clearcueballpositionrequest', () => {
            if (gameRef) {
                updateDoc(gameRef, {
                    cueBallPosition: null // O FieldValue.delete() si se prefiere eliminar el campo
                }).catch(err => console.error("Error al limpiar cueBallPosition:", err));
            }
        });
    });
}

/**
 * --- NUEVO: Sincroniza el estado de las bolas con los datos del servidor.
 * Se usa al cargar la partida para colocar las bolas en su posición correcta.
 * @param {Array} serverBalls - El array de bolas con sus posiciones desde Firestore.
 */
export function syncBallPositionsFromServer(serverBalls, gameData = {}, myUid = null) {
    if (!serverBalls || serverBalls.length === 0) return;

    serverBalls.forEach(serverBall => {
        const localBall = balls.find(b => b.number === serverBall.number);
        if (localBall) {
            // Si es la bola blanca y el jugador local tiene bola en mano, no actualizar su posición desde el servidor.
            if (localBall.number === null && gameData && gameData.ballInHandFor === myUid) {
                return; 
            }
            localBall.mesh.position.x = serverBall.x;
            localBall.mesh.position.y = serverBall.y;
            localBall.isActive = serverBall.isActive;
            localBall.mesh.visible = serverBall.isActive;
            if (localBall.shadowMesh) {
                localBall.shadowMesh.visible = serverBall.isActive;
                // --- CORRECCIÓN: Actualizar también la posición de la sombra ---
                localBall.shadowMesh.position.set(serverBall.x, serverBall.y, 0.1);
            }
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
            // --- FIX: Reanudar el juego ahora que la UI está lista para recibir eventos ---
            import('./gameState.js').then(({ setGamePaused }) => {
                setGamePaused(false);
            });
            break;

        case 'setup_balls':
            // --- MODIFICADO: Solo colocar las bolas si no es una partida online ---
            // Los modelos ya están cargados, ahora creamos las bolas en la escena.
            const onlineGameId = getOnlineGameData().gameId;
            setupBalls(true, null, !!onlineGameId); // El 'true' indica que es la configuración inicial.
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