import * as THREE from 'three';
import { updateBallPositions, areBallsMoving, applyBallStatesFromServer } from './fisicas.js';
import TWEEN from 'https://unpkg.com/@tweenjs/tween.js@23.1.1/dist/tween.esm.js';
import { db, auth, onSnapshot, doc, onAuthStateChanged, updateDoc, getDoc } from './login/auth.js'; // --- CORRECCIÓN: Importar onSnapshot y doc
import { initializeHandles, handles, pockets, BALL_RADIUS, TABLE_WIDTH, TABLE_HEIGHT } from './config.js'; // Asegúrate que handles se exporta
import { scene, camera, renderer, loadTableTexture } from './scene.js'; // --- CORRECCIÓN: Importar showFoulMessage
import { balls, cueBall, setupBalls, loadBallModels, cueBallRedDot, prepareBallLoaders, getSceneBalls, updateBallModelAndTexture } from './ballManager.js'; // --- SOLUCIÓN: Quitar updateSafeArea
import { handleInput, initializeUI, updateUI, prepareUIResources, updateTurnTimerUI, updateActivePlayerUI } from './ui.js'; // --- SOLUCIÓN: Importar updateTurnTimerUI
import { initAudio, loadSound, prepareAudio } from './audioManager.js';
import { initFallPhysics, addBallToFallSimulation, updateFallPhysics } from './fallPhysics.js'; // --- CORRECCIÓN: Importar showFoulMessage
import { setOnLoadingComplete, setProcessingSteps } from './loadingManager.js';
import { initCueBallEffects, updateCueBallEffects, showShotEffect } from './cueBallEffects.js';
import { prepareAimingResources, updateAimingGuides, hideAimingGuides, cueMesh } from './aiming.js';
import { getGameState, handleTurnEnd, startShot, addPocketedBall, setGamePaused, areBallsAnimating, setPlacingCueBall, showFoulMessage, checkTurnTimer, isTurnTimerActive, turnStartTime, TURN_TIME_LIMIT, clearPocketedBalls, clearFirstHitBall, stopTurnTimer, setShotInProgress, getOnlineGameData } from './gameState.js';
import { getCurrentShotAngle } from './inputManager.js';
import { revisarEstado } from './revisar.js';
import { getPowerPercent } from './powerControls.js';

let lastTime;

// --- NUEVO: Variables para el efecto de vibración de la cámara ---
let gameRef = null; // --- NUEVO: Referencia global a la partida online
let localPlayerNumber = 0; // --- SOLUCIÓN: 1 o 2, para saber quiénes somos en esta partida
window.getGameRef = (gameId) => { // --- NUEVO: Función global para obtener la referencia
    if (!gameRef) gameRef = doc(db, "games", gameId);
    // --- NUEVO: Variables para sincronización de apuntado ---
    let opponentAimAngle = null;
    return gameRef;
};
let shakeIntensity = 0;
let shakeDuration = 0;
let originalCameraPosition = new THREE.Vector3();


// --- NUEVO: Variables y listener para sincronización de apuntado ---
let serverAimAngle = null; // --- CORRECCIÓN: Variable única para el ángulo del servidor.
let currentGameState = {}; // Guardará el estado del juego recibido
let serverPowerPercent = 0; // --- NUEVO: Variable para la potencia recibida del servidor.
let lastProcessedShotTimestamp = 0; // Para no aplicar el mismo tiro dos veces

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

    // --- NUEVO: Lógica para recibir y aplicar un tiro del servidor ---
    if (gameData.lastShot && gameData.lastShot.timestamp > lastProcessedShotTimestamp) {
        lastProcessedShotTimestamp = gameData.lastShot.timestamp;

        // --- CORRECCIÓN CRÍTICA: Limpiar el tiro del servidor INMEDIATAMENTE después de leerlo. ---
        // Esto evita que el tiro se vuelva a ejecutar si se recarga la página o hay un retraso.
        if (gameRef) {
            updateDoc(gameRef, { lastShot: null });
        }

        // Aplicamos el tiro (tanto el nuestro como el del oponente) desde el servidor
        // para asegurar que ambos juegos estén perfectamente sincronizados.
        const { angle, power, spin, cueBallStartPos } = gameData.lastShot;
        
        // Llamamos a una nueva función que encapsula la lógica de aplicar el tiro
        applyServerShot(angle, power, spin, cueBallStartPos);
    }

    // --- NUEVO: Sincronización del estado de las bolas en tiempo real ---
    if (gameData.liveBallState && currentGameState.currentPlayerUid !== auth.currentUser?.uid) {
        // Si hay un estado de bolas en vivo y NO somos el jugador activo, aplicamos ese estado.
        applyBallStatesFromServer(gameData.liveBallState, balls);
    }

    // --- NUEVO: Lógica para recibir el estado de "bola en mano" y la posición ---
    const myUid = auth.currentUser?.uid;
    if (gameData.ballInHandFor === myUid) {
        // Si es mi turno de colocar la bola, activo el modo localmente.
        setPlacingCueBall(true);
    } else if (gameData.ballInHandFor) {
        // Si alguien tiene bola en mano, pero no soy yo, desactivo el modo localmente.
        setPlacingCueBall(false); // Yo no puedo colocarla.
    }

    // --- CORRECCIÓN: Lógica de dibujado unificada basada en el servidor ---
    // Si el servidor indica una posición para la bola blanca (durante "bola en mano"), la aplicamos.
    if (gameData.cueBallPosition && cueBall && cueBall.mesh) {
        cueBall.mesh.position.x = gameData.cueBallPosition.x;
        cueBall.mesh.position.y = gameData.cueBallPosition.y;
        if (cueBall.shadowMesh) {
            cueBall.shadowMesh.position.set(gameData.cueBallPosition.x, gameData.cueBallPosition.y, 0.1);
        }
    }
});

window.addEventListener('sendsingleplayer', (event) => {
    // Este listener es solo para el modo offline, si se implementa en el futuro.
});

async function gameLoop(time) { // --- SOLUCIÓN 1: Marcar la función como asíncrona
    // --- LOG: Indica el inicio de un nuevo fotograma en el bucle del juego.
    // console.log('[GameLoop] Iniciando nuevo fotograma...');

    // --- CORRECCIÓN: Definir si es el turno del jugador local al inicio del bucle. ---
    const isMyTurn = currentGameState.currentPlayerUid === auth.currentUser?.uid;

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

        // --- CORRECCIÓN CRÍTICA: Lógica de simulación autoritativa ---

        if (isMyTurn || !gameRef) { // Simular si es mi turno O si es una partida local
            const pocketedInFrame = updateBallPositions(dt, balls, pockets, handles, BALL_RADIUS);
            
            // --- SOLUCIÓN: Enviar actualización en tiempo real al entronerar una bola ---
            if (pocketedInFrame.length > 0) {
                // --- SOLUCIÓN 2: Cambiar forEach por un bucle for...of para poder usar await ---
                for (const ball of pocketedInFrame) {
                    addPocketedBall(ball); // Añadir a la lista local para la revisión de fin de turno.

                    // Si es una partida online y es mi turno, actualizo el estado de la bola en el servidor.
                    if (gameRef && isMyTurn) {
                        const gameState = getOnlineGameData();
                        const ballStates = gameState.balls || [];
                        const ballToUpdate = ballStates.find(b => b.number === ball.number);
                
                        if (ballToUpdate) {
                            ballToUpdate.isActive = false; // Marcar como inactiva
                
                            // --- SOLUCIÓN: Lógica de asignación de bolas en tiempo real ---
                            if (!gameState.ballsAssigned && ball.number !== null && ball.number !== 8) {
                                const { assignPlayerTypes } = await import('./gameState.js');
                                const type = (ball.number >= 1 && ball.number <= 7) ? 'solids' : 'stripes';
                                // Asignamos los tipos de bola localmente
                                assignPlayerTypes(currentGameState.currentPlayerUid, type);
                                // Actualizamos el estado del juego con la nueva asignación
                                gameState.ballsAssigned = true;
                                gameState.playerAssignments = getGameState().playerAssignments;
                            }
                
                            // Enviar el estado actualizado al servidor
                            window.dispatchEvent(new CustomEvent('sendballstates', { detail: ballStates }));
                            // Disparar el evento para que la UI local se actualice al instante con el estado completo
                            window.dispatchEvent(new CustomEvent('updateassignments', { detail: gameState }));
                        }
                    }
                }
            }

            // Si es mi turno y las bolas se mueven, envío el estado al servidor
            if (isMyTurn && areBallsMoving(balls)) {
                const ballStates = balls.map(b => ({ number: b.number, x: b.mesh.position.x, y: b.mesh.position.y, isActive: b.isActive }));
                window.dispatchEvent(new CustomEvent('sendballstates', { detail: ballStates }));
            }
        } else {
            // Si NO es mi turno de simular, mi juego simplemente espera y recibe las posiciones del servidor.
            // La función applyBallStatesFromServer ya se encarga de mover las bolas.
        }

        // --- MODIFICACIÓN: El turno solo termina si no hay bolas moviéndose NI animándose ---
        // --- SOLUCIÓN: Usar una variable de estado para asegurar que la revisión se haga una sola vez ---
        const ballsHaveStopped = !areBallsMoving(balls) && !areBallsAnimating(balls);
        // --- CORRECCIÓN: La revisión del estado debe ocurrir si las bolas se acaban de detener.
        // Se usa una variable externa (importada de ui.js) para saber si en el frame anterior se estaban moviendo.
        // Esta es la forma más fiable de detectar el fin de un tiro.
        if (window.ballsWereMoving && ballsHaveStopped) {
            // --- CORRECCIÓN: Lógica de Cliente Autoritativo ---
            // Solo el jugador cuyo turno acaba de terminar es responsable de actualizar el estado.
            if (gameRef && currentGameState.currentPlayerUid === auth.currentUser?.uid) {
                // Este jugador actúa como el árbitro: revisa el estado y actualiza el servidor.
                // --- CORRECCIÓN: Pasar el estado actual del juego para evitar el error de UID indefinido. ---
                revisarEstado(false, gameRef, currentGameState);
            }
            handleTurnEnd(); // Limpiar estado local para ambos jugadores.
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
            revisarEstado(true, gameRef);
        }
    }
    renderer.render(scene, camera);
    
    // --- NUEVO: Disparar evento para enviar el ángulo si es mi turno y estoy apuntando ---

    // --- CORRECCIÓN: Lógica de dibujado con Predicción del Lado del Cliente ---
    if (!areBallsMoving(balls)) {
        if (isMyTurn) {
            // Si es mi turno, uso mis datos locales para una respuesta instantánea.
            const localAngle = getCurrentShotAngle();
            const localPower = getPowerPercent();

            // --- CORRECCIÓN: Enviar el ángulo Y LA POTENCIA al servidor para sincronización en tiempo real ---
            window.dispatchEvent(new CustomEvent('sendaim', { detail: { angle: localAngle, power: localPower } }));

            updateAimingGuides(localAngle, getGameState(), localPower, true);
            if (cueMesh) cueMesh.visible = true;
        } else {
            // Si es el turno del oponente, uso los datos del servidor.
            if (serverAimAngle !== null) {
                updateAimingGuides(serverAimAngle, getGameState(), serverPowerPercent, true);
                if (cueMesh) cueMesh.visible = true;
            } else {
                hideAimingGuides();
            }
        }
    } else {
        // Si no, ocultar todas las guías.
        hideAimingGuides();
    }

    // --- CORRECCIÓN: Actualizar la posición del punto de efecto (spin) en cada frame ---
    // Esta lógica se ejecuta para ambos jugadores, basándose en los datos del servidor.
    if (currentGameState.aimingSpin) {
        const spin = currentGameState.aimingSpin;

        // 1. Actualizar el punto rojo en la bola 3D
        if (cueBallRedDot && cueBall) {
            cueBallRedDot.position.x = spin.x * (cueBall.radius * 0.8);
            cueBallRedDot.position.y = spin.y * (cueBall.radius * 0.8);
        }

        // 2. Actualizar el punto en la miniatura de la UI
        const miniSpinSelectorDot = document.getElementById('miniSpinSelectorDot');
        if (miniSpinSelectorDot) {
            miniSpinSelectorDot.style.left = `${50 + (spin.x * 40)}%`;
            miniSpinSelectorDot.style.top = `${50 - (spin.y * 40)}%`;
        }

        // 3. Actualizar el punto en el modal grande
        const spinSelectorDot = document.getElementById('spinSelectorDot');
        const largeSpinSelector = document.getElementById('largeSpinSelector');
        if (spinSelectorDot && largeSpinSelector) {
            const rect = largeSpinSelector.getBoundingClientRect();
            // Solo actualizar si el modal es visible (tiene dimensiones)
            if (rect.width > 0) {
                const selectorRadius = rect.width / 2;
                const dx = spin.x * selectorRadius;
                const dy = -spin.y * selectorRadius;
                spinSelectorDot.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
            }
        }
    }

    // --- NUEVO: Actualizar la UI de la barra de potencia desde el servidor ---
    // Esta lógica se ejecuta para ambos jugadores.
    const powerBarFill = document.getElementById('powerBarFill');
    const powerBarHandle = document.getElementById('powerBarHandle');
    if (powerBarFill && powerBarHandle) {
        let displayPower = serverPowerPercent;
        if (isMyTurn) {
            // Si es mi turno, usamos la potencia local para una respuesta instantánea.
            // La potencia local ya se actualiza en powerControls.js y se envía al servidor.
            displayPower = getPowerPercent();
        }
        powerBarFill.style.width = `${displayPower * 100}%`;
        powerBarHandle.style.left = `${displayPower * 100}%`;
    }

}

// --- NUEVO: Función para aplicar un tiro recibido del servidor ---
function applyServerShot(angle, powerPercent, spin, cueBallStartPos) {
    if (areBallsMoving(balls)) return; // No hacer nada si las bolas ya se están moviendo

    const maxPower = 300 * 25;
    const power = powerPercent * maxPower;
    const velocityFactor = 2.5;

    // --- CORRECCIÓN CRÍTICA: Colocar la bola blanca en su posición inicial ANTES de disparar ---
    if (cueBallStartPos) {
        cueBall.mesh.position.x = cueBallStartPos.x;
        cueBall.mesh.position.y = cueBallStartPos.y;
        if (cueBall.shadowMesh) cueBall.shadowMesh.position.set(cueBallStartPos.x, cueBallStartPos.y, 0.1);
    }

    // Aplicar el impulso a la bola blanca
    cueBall.vx = Math.cos(angle) * (power / 1000) * velocityFactor;
    cueBall.vy = Math.sin(angle) * (power / 1000) * velocityFactor;
    cueBall.initialVx = cueBall.vx;
    cueBall.initialVy = cueBall.vy;
    cueBall.spin = { ...spin };

    // Iniciar la animación del taco y los efectos visuales/sonoros
    import('./aiming.js').then(({ animateCueShot }) => {
        animateCueShot(angle, powerPercent, () => {});
    });

    const shakeIntensity = Math.pow(powerPercent, 2) * 2.5;
    window.triggerScreenShake(shakeIntensity, 0.15);

    if ('vibrate' in navigator) {
        navigator.vibrate(Math.max(50, Math.floor(powerPercent * 150)));
    }

    startShot(); // Marcar que un tiro está en progreso
    import('./audioManager.js').then(({ playSound }) => playSound('cueHit', Math.pow(powerPercent, 2) * 0.9));
}

// --- NUEVO: Hacer que la función de aplicar tiro sea accesible globalmente ---
window.applyLocalShot = applyServerShot;

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
            localUsername = userProfileDoc.exists() ? userProfileDoc.data().username : user.email;
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
        const unsubscribe = onSnapshot(gameRef, (docSnap) => {
            if (!docSnap.exists()) {
                console.error("La partida no existe o fue eliminada.");
                if (unsubscribe) unsubscribe();
                return;
            }

            const gameData = docSnap.data() || {}; // --- SOLUCIÓN: Evitar error si gameData es undefined
            const player1NameEl = document.getElementById('player1-name');
            const player2NameEl = document.getElementById('player2-name');

            // Si el puesto de jugador 2 está libre y nosotros no somos el jugador 1, lo reclamamos.
            if (gameData.player2 === null && gameData.player1?.uid !== localUserId) {
                updateDoc(gameRef, {
                    player2: { uid: localUserId, username: localUsername }
                }).catch(err => console.error("Error al unirse como jugador 2:", err));
                return; // Esperar al siguiente snapshot con la info actualizada.
            }

            // Determinar si somos el jugador 1 o 2.
            if (gameData.player1 && gameData.player1.uid === localUserId) {
                localPlayerNumber = 1;
            } else if (gameData.player2 && gameData.player2.uid === localUserId) {
                localPlayerNumber = 2;
            } else {
                localPlayerNumber = 0; // Somos espectadores
            }

            // Actualizar la UI con los nombres de la base de datos.
            if (player1NameEl) {
                player1NameEl.textContent = gameData.player1 ? gameData.player1.username : 'Jugador 1';
            }
            if (player2NameEl) {
                player2NameEl.textContent = gameData.player2 ? gameData.player2.username : 'Esperando...';
            }

            // Actualizar el indicador de turno activo
            const activePlayerNumber = gameData.currentPlayerUid === gameData.player1?.uid ? 1 : 2;
            updateActivePlayerUI(activePlayerNumber);
        });
    });
}

/**
 * --- NUEVO: Sincroniza el estado de las bolas con los datos del servidor.
 * Se usa al cargar la partida para colocar las bolas en su posición correcta.
 * @param {Array} serverBalls - El array de bolas con sus posiciones desde Firestore.
 */
export function syncBallPositionsFromServer(serverBalls) {
    if (!serverBalls || serverBalls.length === 0) return;

    serverBalls.forEach(serverBall => {
        const localBall = balls.find(b => b.number === serverBall.number);
        if (localBall) {
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
            break;

        case 'setup_balls':
            // --- MODIFICADO: Solo colocar las bolas si no es una partida online ---
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
