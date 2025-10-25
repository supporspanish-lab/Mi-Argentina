// --- Módulo de Gestión de Entradas ---
import * as THREE from 'three';
import { camera, canvas, renderer } from './scene.js';
import { getGameState, setPlacingCueBall } from './gameState.js';
import { cueBall, balls, cueBallRedDot } from './ballManager.js'; 
import { cueMesh } from './aiming.js';
import { BALL_RADIUS } from './config.js'; // --- SOLUCIÓN: Importar BALL_RADIUS desde su fuente original
import * as spinControls from './spinControls.js';
import * as powerControls from './powerControls.js'; // --- SOLUCIÓN: Volver a importar powerControls
import * as cuePlacement from './cuePlacement.js';
import { shoot } from './shooting.js';

// --- Estado Interno ---
let isMouseDown = false;
let audioContextResumed = false; // --- NUEVO: Bandera para reanudar el audio solo una vez

// --- NUEVO: Estado para el nuevo sistema de apuntado por arrastre ---
let isAimingDrag = false;
let initialAimAngle = 0;
let initialPointerPosForAim = { x: 0, y: 0 };
let lastPointerPosForAim = { x: 0, y: 0 }; // --- SOLUCIÓN: Guardar la posición del frame anterior

/**
 * Calcula la posición del puntero en el mundo 3D.
 * @param {MouseEvent|TouchEvent} e - El evento del puntero.
 * @returns {{x: number, y: number}} - Las coordenadas en el mundo 3D.
 */
function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const mouseVector = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouseVector, camera);

    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersectionPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectionPoint);
    return { x: intersectionPoint.x, y: intersectionPoint.y };
}

/**
 * Inicializa todos los listeners de eventos para el juego.
 */
export function initializeInputManager() {
    // --- LOG: Indica que se están inicializando los manejadores de eventos.
    // --- Eventos de Inicio (mousedown, touchstart) ---
    const onPointerDown = (e) => {
        if (e.type === 'touchstart') e.preventDefault();

        // --- SOLUCIÓN: Reanudar el AudioContext en la primera interacción del usuario ---
        if (!audioContextResumed) {
            const context = THREE.AudioContext.getContext();
            if (context.state === 'suspended') {
                context.resume();
            }
            audioContextResumed = true;
        }

        const pointerPos = getPointerPos(e);
        isMouseDown = true;

        // --- SOLUCIÓN: Separar la lógica de colocación y apuntado para que no sean excluyentes ---

        // 1. Comprobar si se debe iniciar el movimiento de la bola blanca.
        if (getGameState().isPlacingCueBall) {
            const cueBallPos = cueBall.mesh.position;
            const distSq = (pointerPos.x - cueBallPos.x)**2 + (pointerPos.y - cueBallPos.y)**2;
            
            if (distSq < (BALL_RADIUS * 1.5)**2) { 
                if (cueBall && cueBall.shadowMesh) cueBall.shadowMesh.visible = true;
                cuePlacement.startCueBallMove();
            }
        }

        // 2. Comprobar si se debe iniciar el apuntado por arrastre.
        // Esto puede ocurrir incluso con "bola en mano", siempre que no estemos ya moviendo la bola.
        if (!powerControls.isPullingBack() && !cuePlacement.isMovingCueBall()) {
            isAimingDrag = true;
            initialAimAngle = window.currentShotAngle || 0;
            initialPointerPosForAim = { ...pointerPos };
            lastPointerPosForAim = { ...pointerPos };
        }

        // Lógica para jalar el taco
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const raycaster = new THREE.Raycaster();
        const mouseVector = new THREE.Vector2(((clientX - canvas.getBoundingClientRect().left) / canvas.width) * 2 - 1, -((clientY - canvas.getBoundingClientRect().top) / canvas.height) * 2 + 1);
        raycaster.setFromCamera(mouseVector, camera);
        const intersects = raycaster.intersectObject(cueMesh, true);

        if (intersects.length > 0) {
            // --- LOG: Indica que se ha iniciado el arrastre del taco.
            powerControls.startPullBack(pointerPos);
        }
    };

    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Listeners para UI (Spin y Power)
    const spinSelectorContainer = document.getElementById('spinSelectorContainer');
    // --- MODIFICACIÓN: El clic en el selector pequeño ahora abre el modal ---
    spinSelectorContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        spinControls.showSpinModal();
    });

    const powerBarHandle = document.getElementById('powerBarHandle');
    powerBarHandle.addEventListener('mousedown', (e) => { e.stopPropagation(); powerControls.startPowerDrag(); });
    powerBarHandle.addEventListener('touchstart', (e) => { e.stopPropagation(); powerControls.startPowerDrag(); }, { passive: false });

    // --- NUEVO: Listeners para el nuevo modal de efecto ---
    const largeSpinSelector = document.getElementById('largeSpinSelector');
    largeSpinSelector.addEventListener('mousedown', (e) => { e.stopPropagation(); spinControls.startSpinDrag(); });
    largeSpinSelector.addEventListener('touchstart', (e) => { e.stopPropagation(); spinControls.startSpinDrag(); });
    // --- NUEVO: Cerrar el modal si se hace clic en el fondo oscuro ---
    document.getElementById('spinModalOverlay').addEventListener('click', spinControls.hideSpinModal);


    // --- Eventos de Movimiento (mousemove, touchmove) ---
    const onPointerMove = (e) => {
        if (e.type === 'touchmove') e.preventDefault();

        // --- LOG: Indica que el puntero se está moviendo. Es muy frecuente.
        // console.log('[Input] Evento onPointerMove detectado.');
        const pointerPos = getPointerPos(e);

        if (isAimingDrag) {
            // --- NUEVO: Lógica de apuntado por arrastre ---
            // --- SOLUCIÓN: Lógica de apuntado incremental para evitar saltos ---
            // 1. Vector perpendicular a la dirección de apuntado ACTUAL.
            const currentAngle = window.currentShotAngle || 0;
            const perpVector = { x: -Math.sin(currentAngle), y: Math.cos(currentAngle) };

            // 2. Vector del arrastre del ratón/dedo desde el ÚLTIMO frame.
            const dragVector = { x: pointerPos.x - lastPointerPosForAim.x, y: pointerPos.y - lastPointerPosForAim.y };

            // 3. Proyectar el arrastre incremental sobre el vector perpendicular.
            const incrementalProjectedDistance = dragVector.x * perpVector.x + dragVector.y * perpVector.y;

            // 4. Detección de colisión para ajustar la sensibilidad
            const rayOrigin = new THREE.Vector2(cueBall.mesh.position.x, cueBall.mesh.position.y);
            const rayDirection = new THREE.Vector2(Math.cos(currentAngle), Math.sin(currentAngle));
            
            let isHittingBall = false;
            let closestIntersection = Infinity;

            for (const ball of balls) {
                if (ball === cueBall || !ball.isActive) continue;
                const ballCenter = new THREE.Vector2(ball.mesh.position.x, ball.mesh.position.y);
                const oc = ballCenter.clone().sub(rayOrigin);
                const tca = oc.dot(rayDirection);
                if (tca < 0) continue;
                const d2 = oc.lengthSq() - tca * tca;
                const radius2 = (BALL_RADIUS * 2) ** 2;
                if (d2 > radius2) continue;
                const t0 = tca - Math.sqrt(radius2 - d2);
                if (t0 < closestIntersection) {
                    closestIntersection = t0;
                    isHittingBall = true;
                }
            }

            // 5. Aplicar la sensibilidad correcta al movimiento incremental
            const currentSensitivity = isHittingBall ? 0.0005 : 0.005;
            const angleChange = incrementalProjectedDistance * currentSensitivity;
            window.currentShotAngle += angleChange;

            // 6. Actualizar la última posición para el siguiente frame
            lastPointerPosForAim = { ...pointerPos };
        }

        // Arrastrar bola blanca
        if (cuePlacement.isMovingCueBall()) {
            cuePlacement.moveCueBall(pointerPos);
            const isValid = cuePlacement.isValidPlacement(pointerPos);
            cueBallRedDot.material.color.set(isValid ? 0xe74c3c : 0x888888);
        }

        // Arrastrar para potencia (pull back)
        if (powerControls.isPullingBack()) {
            powerControls.dragPullBack(pointerPos, window.currentShotAngle);
        }

        // Arrastrar selector de efecto
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        spinControls.dragSpin({ clientX, clientY });

        // Arrastrar barra de potencia
        powerControls.dragPower({ clientY });
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    // --- LOG: Indica el final del manejador de evento (se registraría constantemente).
    // console.log('%c[Input]%c onPointerMove() finalizado.', 'color: #e67e22; font-weight: bold;', 'color: inherit;');


    // --- Eventos de Finalización (mouseup, touchend) ---
    const onPointerUp = (e) => {
        const isTouchEvent = e.type === 'touchend';

        // Soltar la bola blanca
        if (cuePlacement.isMovingCueBall()) {
            // --- MODIFICACIÓN: Ya no finalizamos la colocación aquí ---
            // Ahora, el jugador puede soltar la bola y volver a moverla
            // si lo desea. El estado 'isPlacingCueBall' solo se pondrá
            // en 'false' cuando se realice el disparo (lógica en shooting.js).
            cuePlacement.stopCueBallMove(); // Simplemente dejamos de moverla
        }
        // Disparar al soltar el taco
        else if (powerControls.isPullingBack()) {
            const power = powerControls.stopPullBack();
            shoot(power);
        }

        // Finalizar arrastre de efecto
        spinControls.stopSpinDrag();

        // Finalizar y disparar con la barra de potencia
        if (powerControls.isDraggingPower()) {
            const power = powerControls.stopPowerDrag();
            shoot(power);
        }

        // --- NUEVO: Finalizar el arrastre de apuntado ---
        isAimingDrag = false;

        isMouseDown = false;
    };

    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);
}

// --- Funciones de estado exportadas para que otros módulos las consulten ---

export function isPointerDown() {
    return isMouseDown;
}

export function isPullingBack() {
    return powerControls.isPullingBack();
}

export function isMovingCueBall() {
    return cuePlacement.isMovingCueBall();
}

export function isDraggingPower() {
    return powerControls.isDraggingPower();
}

export function getPullBackDistance() {
    return powerControls.getPullBackDistance();
}

export function getCurrentShotAngle() {
    // El ángulo se almacena globalmente para simplicidad en este refactor.
    // En un futuro, podría ser parte de un módulo de estado de apuntado.
    return window.currentShotAngle || 0;
}