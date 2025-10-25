// --- Módulo de Interfaz de Usuario y Eventos ---
import * as THREE from 'three'; // --- SOLUCIÓN: Importar THREE.js
import { areBallsMoving } from './fisicas.js';
import { revisarEstado } from './revisar.js'; // --- SOLUCIÓN: Importar la nueva función de revisión
import { getGameState } from './gameState.js';
import { balls, cueBall } from './ballManager.js';
import { prepareTableTexture, TABLE_WIDTH } from './config.js';
import { camera } from './scene.js'; // --- NUEVO: Importar la cámara para proyecciones
import { initializeAiming, updateAimingGuides, hideAimingGuides, cueMesh } from './aiming.js';
import { initializeInputManager, isPointerDown, isPullingBack, isMovingCueBall, getPullBackDistance, getCurrentShotAngle } from './inputManager.js';

// --- Referencias a elementos del DOM ---
const spinSelectorContainer = document.getElementById('spinSelectorContainer');
const powerBarContainer = document.getElementById('powerBarContainer');

// --- Estado de la UI ---
// --- NUEVO: Variable para rastrear si las bolas se estaban moviendo en el frame anterior ---
let ballsWereMoving = true; // Inicia en true para mostrar el mensaje al empezar la partida.
// El estado ahora se gestiona en módulos dedicados (inputManager, powerControls, etc.)
// `window.currentShotAngle` se usa como variable global temporal para el ángulo.
window.currentShotAngle = 0;


export function initializeUI() {
    initializeAiming();
    initializeInputManager();
}

export function prepareUIResources() {
    prepareTableTexture();
}

export function handleInput() {
    // --- CORRECCIÓN: Asegurarse de que la bola blanca exista antes de continuar ---
    if (!cueBall) return;

    const { isPlacingCueBall: isPlacing, isLoading } = getGameState();

    // --- CORRECCIÓN: No ejecutar la lógica de revisión si el juego está cargando ---
    if (isLoading) return;

    const ballsAreCurrentlyMoving = areBallsMoving(balls);

    if (ballsWereMoving && !ballsAreCurrentlyMoving && !isLoading) {
        revisarEstado();
    }
    ballsWereMoving = ballsAreCurrentlyMoving; // Actualizar el estado para el siguiente frame

    const isPlacingWithoutDragging = isPlacing && !isMovingCueBall();
    // --- CORRECCIÓN: La condición para poder disparar ahora incluye el estado de "bola en mano" (cuando no se está arrastrando). ---
    const canShoot = (!ballsAreCurrentlyMoving && !cueBall.isPocketed) && (!isPlacing || isPlacingWithoutDragging);

    const shouldShowGuides = (canShoot || isPlacingWithoutDragging) || isPullingBack();

    // --- CORRECCIÓN: Usar la nueva lógica de 'canShoot' para mostrar los controles. ---
    spinSelectorContainer.style.display = (canShoot && !isPullingBack() && !isMovingCueBall()) ? 'block' : 'none';
    powerBarContainer.style.display = canShoot ? 'block' : 'none';

    // --- NUEVO: Lógica para redimensionar dinámicamente el selector de efecto ---
    if (spinSelectorContainer.style.display === 'block') {
        // 1. Proyectar el borde derecho de la mesa a coordenadas de pantalla.
        const tableRightEdgeWorld = new THREE.Vector3(TABLE_WIDTH, 0, 0);
        tableRightEdgeWorld.project(camera); // Convierte a Coordenadas de Dispositivo Normalizadas (-1 a 1)

        // 2. Convertir la coordenada X de NDC a píxeles de pantalla.
        const tableRightEdgeScreenX = (tableRightEdgeWorld.x + 1) / 2 * window.innerWidth;

        // 3. Obtener la posición del selector de efecto.
        const selectorRect = spinSelectorContainer.getBoundingClientRect();

        // 4. Comprobar si hay superposición.
        if (selectorRect.left < tableRightEdgeScreenX) {
            // Hay superposición. Calcular el espacio disponible.
            const availableSpace = window.innerWidth - tableRightEdgeScreenX;
            // --- CORRECCIÓN: Usar todo el espacio disponible sin márgenes.
            const newSize = Math.max(20, availableSpace); // Tamaño mínimo de 20px

            // Aplicar el nuevo tamaño.
            spinSelectorContainer.style.width = `${newSize}px`;
            spinSelectorContainer.style.height = `${newSize}px`;
        } else {
            // No hay superposición, restaurar el tamaño por defecto (8vw).
            // Esto es importante para cuando se redimensiona la ventana y vuelve a haber espacio.
            spinSelectorContainer.style.width = '8vw';
            spinSelectorContainer.style.height = '8vw';
        }
    }


    if (shouldShowGuides) {
        // El ángulo de tiro ahora se actualiza dentro de onPointerMove en inputManager.js
        // cuando el puntero está presionado.

        if (cueMesh) cueMesh.visible = true;
        updateAimingGuides(getCurrentShotAngle(), getGameState(), getPullBackDistance());
    } else {
        hideAimingGuides();
        if (cueBall && cueBall.mesh && !cueBall.isPocketed) {
            cueBall.mesh.visible = true;
            if (cueBall.shadowMesh) cueBall.shadowMesh.visible = true; // También su sombra
        }
    }
}

/**
 * Función principal para actualizar todos los elementos de la UI en cada frame.
 */
export function updateUI() {
    // La función updateUI se mantiene por si se necesita en el futuro, pero ahora está vacía.
}

/**
 * --- NUEVO: Actualiza los elementos visuales de la barra de potencia.
 * @param {number} newPowerPercent - El nuevo porcentaje de potencia (0 a 1).
 */
export function updatePowerUI(newPowerPercent) {
    // --- CORRECCIÓN DE RENDIMIENTO: Usar requestAnimationFrame para evitar lag ---
    // Esto asegura que las actualizaciones del DOM se hagan en el momento óptimo del ciclo de renderizado.
    requestAnimationFrame(() => {
    const powerBarFill = document.getElementById('powerBarFill');
    const powerBarHandle = document.getElementById('powerBarHandle');

    powerBarFill.style.height = `${newPowerPercent * 100}%`;
        // --- CORRECCIÓN DE RENDIMIENTO: Usar 'transform' en lugar de 'top' para un movimiento suave ---
        // 'transform' es mucho más eficiente y evita el "lag" al mover el handle rápidamente.
        powerBarHandle.style.transform = `translateY(${newPowerPercent * powerBarContainer.offsetHeight}px) translate(-50%, -0%)`;

    if (newPowerPercent >= 0.98) {
        powerBarFill.classList.add('rounding-edge');
    } else {
        powerBarFill.classList.remove('rounding-edge');
    }
}
    );
}