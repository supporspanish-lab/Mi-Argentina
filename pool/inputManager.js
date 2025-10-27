// --- Módulo de Gestión de Entradas (Ratón y Táctil) ---
import * as THREE from 'three';
import { cueBall, getSceneBalls } from './ballManager.js';
import { getGameState, setPlacingCueBall, startShot, getOnlineGameData, setShotInProgress } from './gameState.js';
import { auth, db } from './login/auth.js'; // --- NUEVO: Importar auth y db
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { camera, zoomState } from './scene.js';
import { TABLE_WIDTH, TABLE_HEIGHT, BALL_RADIUS } from './config.js';
import { animateCueShot, hideAimingGuides, isAimingAtBall } from './aiming.js';
import { playSound } from './audioManager.js';
import { areBallsMoving } from './fisicas.js';
import { updatePowerUI } from './ui.js';
import { getSpinOffset, wasDraggingSpin } from './spinControls.js';
import { isValidPlacement } from './cuePlacement.js'; // --- NUEVO: Importar la función de validación
import { startPowerCharge, stopPowerCharge, getPowerPercent } from './powerControls.js';

// --- Constantes ---
const MAX_SHOT_POWER = 80; // --- AJUSTE: Reducido de 100 a 80 para disminuir aún más la fuerza del tiro.

// --- Estado del Input ---
let pointerDown = false;
let pullingBack = false;
let movingCueBall = false;
let pointerStartPos = { x: 0, y: 0 };

// --- NUEVO: Variables para la sincronización del apuntado en tiempo real ---
let lastAimingUpdateTime = 0;
const AIMING_UPDATE_THROTTLE = 100; // ms (10 actualizaciones por segundo)

// --- NUEVO: Variable para el ID de la partida actual ---
let currentOnlineGameId = null;

let currentShotAngle = 0;
// --- NUEVO: Variables para un arrastre de ángulo relativo ---
let dragStartAngle = 0; // Ángulo del puntero al iniciar el arrastre
let angleOnDragStart = 0; // Ángulo de la línea guía al iniciar el arrastre
let lastPointerAngle = 0; // --- NUEVO: Ángulo del puntero en el frame anterior

/**
 * Inicializa todos los listeners de eventos para el input.
 */
export function initializeInputManager() {
    const canvas = document.getElementById('poolCanvas');

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp); // Tratar cancel como up

    // --- NUEVO: Obtener el ID de la partida desde la URL ---
    const urlParams = new URLSearchParams(window.location.search);
    currentOnlineGameId = urlParams.get('gameId');
}

function onPointerDown(e) {
    // --- ¡NUEVA PROTECCIÓN! ---
    // Comprobar si es una partida online y si es el turno del jugador actual.
    const onlineGameData = getOnlineGameData();
    const currentUser = auth.currentUser;

    // Si hay datos de partida online Y el UID del jugador actual NO coincide con mi UID...
    if (onlineGameData && currentUser && onlineGameData.currentPlayerUid !== currentUser.uid) {
        console.log("No es tu turno.");
        return; // ...no hacer nada.
    }
    // --- FIN DE LA PROTECCIÓN ---

    // Si la última acción fue arrastrar el punto de efecto, no iniciar un tiro.
    if (wasDraggingSpin()) {
        return;
    }

    const { isPlacingCueBall } = getGameState();
    const worldPos = getMouseWorldPosition(e.clientX, e.clientY);

    let startAiming = false;

    if (isPlacingCueBall) {
        // Comprobar si el clic está sobre la bola blanca para empezar a moverla
        const dist = Math.hypot(worldPos.x - cueBall.mesh.position.x, worldPos.y - cueBall.mesh.position.y);
        if (dist < BALL_RADIUS * 2) { // Un área de toque un poco más grande que la bola
            movingCueBall = true;
        } else {
            movingCueBall = false;
            startAiming = true; // --- SOLUCIÓN: Marcar para iniciar el apuntado
        }
        pointerDown = true; // El puntero está presionado en cualquier caso
    } else if (!getGameState().shotInProgress && !areBallsMoving(getSceneBalls())) {
        pointerDown = true;
        movingCueBall = false; // Asegurarse de que no estamos moviendo la bola
        startAiming = true; // --- SOLUCIÓN: Marcar para iniciar el apuntado
    }

    // --- SOLUCIÓN: Lógica de inicialización de apuntado unificada ---
    if (startAiming) {
        angleOnDragStart = currentShotAngle; // Guardar el ángulo actual de la línea guía
        const dx = worldPos.x - cueBall.mesh.position.x;
        const dy = worldPos.y - cueBall.mesh.position.y;
        dragStartAngle = Math.atan2(dy, dx);
        lastPointerAngle = dragStartAngle; // --- NUEVO: Inicializar el ángulo anterior
    }
}

function onPointerMove(e) {
    const { isPlacingCueBall } = getGameState();
    const worldPos = getMouseWorldPosition(e.clientX, e.clientY);

    // --- MODIFICACIÓN: Permitir apuntar siempre que el puntero esté presionado y no se esté moviendo la bola ---
    if (pointerDown && !movingCueBall) {
        // --- CORRECCIÓN: Calcular el ángulo incrementalmente para evitar saltos con sensibilidad variable ---

        // 1. Determinar la sensibilidad actual.
        const sensitivity = isAimingAtBall() ? 0.4 : 1.0; // 40% de sensibilidad al apuntar a una bola

        // 2. Calcular el ángulo actual del puntero.
        const dx = worldPos.x - cueBall.mesh.position.x;
        const dy = worldPos.y - cueBall.mesh.position.y;
        const currentPointerAngle = Math.atan2(dy, dx);

        // 3. Calcular la diferencia de ángulo solo desde el último frame.
        let angleDelta = currentPointerAngle - lastPointerAngle;

        // --- SOLUCIÓN: Normalizar el delta para evitar saltos al cruzar el límite de -180/180 grados ---
        // Si el cambio es mayor a 180 grados, tomamos el camino más corto en la otra dirección.
        if (angleDelta > Math.PI) {
            angleDelta -= 2 * Math.PI;
        } else if (angleDelta < -Math.PI) {
            angleDelta += 2 * Math.PI;
        }

        // 4. Aplicar esta pequeña diferencia (afectada por la sensibilidad) al ángulo de tiro actual.
        currentShotAngle += angleDelta * sensitivity;

        // 5. Guardar el ángulo actual del puntero para el siguiente frame.
        lastPointerAngle = currentPointerAngle;

        // --- NUEVO: Sincronizar el apuntado en tiempo real ---
        const now = performance.now();
        const onlineGameData = getOnlineGameData();
        if (onlineGameData && onlineGameData.currentPlayerUid === auth.currentUser?.uid && now - lastAimingUpdateTime > AIMING_UPDATE_THROTTLE) {
            updateOnlineAiming(currentShotAngle);
            lastAimingUpdateTime = now;
        }
    } else if (movingCueBall && isPlacingCueBall) {
        // --- MEJORA: La bola se queda trabada en el límite si se intenta mover a una posición inválida ---
        const newX = Math.max(BALL_RADIUS, Math.min(worldPos.x, TABLE_WIDTH - BALL_RADIUS));
        const newY = Math.max(BALL_RADIUS, Math.min(worldPos.y, TABLE_HEIGHT - BALL_RADIUS));
        const newPosition = { x: newX, y: newY };
        
        const placementIsValid = isValidPlacement(newPosition);
        const cueBallMaterial = cueBall.mesh.children[0].material;

        if (placementIsValid) {
            // Si la nueva posición es válida, mover la bola y ponerla blanca.
            cueBall.mesh.position.x = newX;
            cueBall.mesh.position.y = newY;
            if (cueBall.shadowMesh) cueBall.shadowMesh.position.set(newX, newY, 0.1);
            cueBallMaterial.color.set(0xffffff);
        } else {
            // Si es inválido, no mover la bola y mantenerla blanca.
            cueBallMaterial.color.set(0xffffff);
        }
    }
}

function onPointerUp(e) {
    if (!pointerDown) return;

    const { isPlacingCueBall } = getGameState();

    if (movingCueBall && isPlacingCueBall) {
        // Se ha terminado de colocar la bola blanca
        movingCueBall = false;
        // --- MODIFICACIÓN: Ya no se cambia el estado aquí. El modo "bola en mano" persiste hasta el disparo.
    }

    // Resetear estados de input
    // --- SOLUCIÓN: Al soltar el clic, simplemente se resetea el estado 'pointerDown'.
    pointerDown = false;
    pullingBack = false;
    movingCueBall = false;
}

/**
 * --- NUEVO: Envía la información del tiro a Firestore.
 * @param {number} power - La potencia del tiro (0 a 1).
 */
export async function shootOnline(power) {
    if (!currentOnlineGameId || !auth.currentUser) return;

    const gameRef = doc(db, "games", currentOnlineGameId);
    const spin = getSpinOffset();

    await updateDoc(gameRef, {
        lastShot: {
            playerId: auth.currentUser.uid,
            angle: getCurrentShotAngle(),
            power: power * MAX_SHOT_POWER,
            spin: { x: spin.x, y: spin.y },
            timestamp: Date.now(), // Para evitar procesar el mismo tiro dos veces
            ballInHand: false // --- NUEVO: Al disparar, se consume la "bola en mano"
        }
    });
}

/**
 * --- NUEVO: Actualiza el estado del apuntado en Firestore.
 * @param {number} angle - El ángulo actual de la mira.
 */
async function updateOnlineAiming(angle) {
    if (!currentOnlineGameId) return;
    const gameRef = doc(db, "games", currentOnlineGameId);
    // Usamos notación de puntos para actualizar solo un campo anidado
    await updateDoc(gameRef, {
        "aimingState.angle": angle
    });
}

/**
 * Convierte las coordenadas del puntero en la pantalla a coordenadas del mundo del juego.
 * @param {number} clientX - Coordenada X del puntero.
 * @param {number} clientY - Coordenada Y del puntero.
 * @returns {THREE.Vector3} - La posición en el mundo 3D.
 */
function getMouseWorldPosition(clientX, clientY) {
    // --- SOLUCIÓN DEFINITIVA: Corregir el cálculo de la posición del ratón teniendo en cuenta el zoom y el paneo.
    // 1. Normalizar las coordenadas del ratón a un rango de -1 a 1.
    const mouse = new THREE.Vector2(
        (clientX / window.innerWidth) * 2 - 1,
        - (clientY / window.innerHeight) * 2 + 1
    );

    // 2. Crear un rayo desde la cámara a través de la posición del ratón.
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // 3. Calcular la intersección de ese rayo con el plano de la mesa (z=0).
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersectionPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectionPoint);

    return intersectionPoint;
}

// --- Getters para que otros módulos consulten el estado ---
export const isPointerDown = () => pointerDown;
export const isPullingBack = () => pullingBack;
export const isMovingCueBall = () => movingCueBall;
export const getCurrentShotAngle = () => currentShotAngle;