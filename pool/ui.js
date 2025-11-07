// --- Módulo de Interfaz de Usuario y Eventos ---
import * as THREE from 'three'; // --- SOLUCIÓN: Importar THREE.js
import { areBallsMoving } from './fisicas.js';
import { getGameState, setCurrentPlayer } from './gameState.js';
import { balls, cueBall } from './ballManager.js';
import { prepareTableTexture, TABLE_WIDTH, BALL_RADIUS } from './config.js';
import { camera, zoomState, updateCameraPositionForResponsiveness } from './scene.js'; // --- NUEVO: Importar la cámara para proyecciones
import { loadingManager } from './loadingManager.js'; // --- SOLUCIÓN: Importar el gestor de carga
import { initializeAiming, updateAimingGuides, hideAimingGuides, cueMesh } from './aiming.js';
import { initializeInputManager, isPointerDown, isPullingBack, isMovingCueBall, getCurrentShotAngle } from './inputManager.js';
import { initializeSpinControls, wasDraggingSpin } from './spinControls.js'; // --- NUEVO: Importar el inicializador de los controles de efecto


// --- Referencias a elementos del DOM ---
const powerBarContainer = document.getElementById('newPowerBarContainer');

// --- Estado de la UI ---
// --- NUEVO: Variable para rastrear si las bolas se estaban moviendo en el frame anterior ---
window.ballsWereMoving = false; // --- CORRECCIÓN: Hacerla global para que pool.js pueda acceder a ella.
// El estado ahora se gestiona en módulos dedicados (inputManager, powerControls, etc.)

// --- NUEVO: Estado para el modo de edición de la UI ---
let isUIEditMode = false;
let activeDrag = { // Objeto para gestionar el arrastre/redimensión activo
    element: null,
    type: null
};
let ballInHandAnimationPlayed = false; // --- NUEVO: Para controlar la animación de "bola en mano"

// --- NUEVO: Exportar el estado del modo de edición para que otros módulos lo consulten ---
export const isUIEditModeActive = () => isUIEditMode;


/**
 * --- NUEVO: Actualiza la posición del botón del panel de opciones.
 * Se asegura de que el botón siempre esté pegado a la parte inferior del panel.
 */
function updateToggleBtnPosition() {
    const optionsPanel = document.getElementById('options-panel');
    const optionsToggleBtn = document.getElementById('options-toggle-btn');
    if (!optionsPanel || !optionsToggleBtn) return;

    if (optionsPanel.classList.contains('open')) {
        const panelHeight = optionsPanel.offsetHeight;
        optionsToggleBtn.style.transform = `translateY(${panelHeight}px)`;
    } else {
        optionsToggleBtn.style.transform = 'translateY(0)';
    }
}

export function initializeUI() {
    initializeAiming();
    initializeInputManager();
    initializeSpinControls(); // --- NUEVO: Inicializar los eventos para el control de efecto

    // --- SOLUCIÓN: Reintroducir los listeners para la barra de potencia deslizable ---
    if (powerBarContainer) {
        // --- NUEVO: Establecer una posición inicial por defecto si no hay un layout guardado
        if (!localStorage.getItem('poolUILayout')) {
            powerBarContainer.style.top = '50%';
            powerBarContainer.style.left = '10px';
            powerBarContainer.style.transform = 'translateY(-50%)';
            powerBarContainer.style.right = 'auto';
        }
    }

    // --- NUEVO: Lógica para el panel de opciones deslizable ---
    const optionsPanel = document.getElementById('options-panel');
    const optionsToggleBtn = document.getElementById('options-toggle-btn');

    if (optionsToggleBtn && optionsPanel) {
        optionsToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita que el clic se propague al canvas
            const isOpen = optionsPanel.classList.toggle('open');
            optionsToggleBtn.classList.toggle('open', isOpen);

            updateToggleBtnPosition(); // --- MODIFICACIÓN: Usar la nueva función centralizada
        });

        // --- NUEVO: Cerrar el panel si se hace clic fuera de él ---
        document.addEventListener('click', (e) => {
            // Si el panel está abierto y el clic no fue dentro del panel ni en el botón de abrir/cerrar...
            if (optionsPanel.classList.contains('open') && !optionsPanel.contains(e.target) && e.target !== optionsToggleBtn) {
                optionsPanel.classList.remove('open');
                optionsToggleBtn.classList.remove('open');
                updateToggleBtnPosition(); // Reposicionar el botón
            }
        });

        // --- SOLUCIÓN: Evitar que los clics dentro del panel afecten al juego ---
        // Detiene la propagación de eventos de clic o toque para que no lleguen al canvas.
        optionsPanel.addEventListener('mousedown', (e) => e.stopPropagation());
        optionsPanel.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

        // --- MODIFICACIÓN: Lógica para cambiar entre vistas del panel de opciones ---
        const mainOptionsView = document.getElementById('main-options-view');
        // --- SOLUCIÓN: No activar ningún jugador al inicio. La activación se hará después de la carga.
        updateActivePlayerUI(getGameState().currentPlayer);

        const editUiOptionsView = document.getElementById('edit-ui-options-view');
        const modifyUiBtn = document.getElementById('modify-ui-btn');
        const exitEditModeBtn = document.getElementById('exit-edit-mode-btn');
        const resetUiBtn = document.getElementById('reset-ui-btn');
        const pocketsSizeSlider = document.getElementById('player-pockets-size');
        const powerBarSizeSlider = document.getElementById('power-bar-size');
        const powerBarHeightSlider = document.getElementById('power-bar-height');
        // --- NUEVO: Referencias al modal de confirmación ---
        const confirmResetModal = document.getElementById('confirm-reset-modal');
        const confirmResetYesBtn = document.getElementById('confirm-reset-yes');
        const confirmResetNoBtn = document.getElementById('confirm-reset-no');

        const enterEditMode = () => {
            isUIEditMode = true;
            toggleUIEditMode(true);
            mainOptionsView.style.display = 'none';
            editUiOptionsView.style.display = 'block';

            // --- SOLUCIÓN: Actualizar el valor de los sliders al entrar en modo edición ---
            const pocketContainer = document.querySelector('.pocketed-balls-container');
            if (pocketContainer) pocketsSizeSlider.value = pocketContainer.offsetWidth;
            if (powerBarContainer) powerBarSizeSlider.value = powerBarContainer.offsetWidth;
            if (powerBarContainer) powerBarHeightSlider.value = powerBarContainer.offsetHeight;

            updateToggleBtnPosition(); // --- SOLUCIÓN: Actualizar la posición del botón
        };

        const exitEditMode = () => {
            isUIEditMode = false;
            toggleUIEditMode(false);
            mainOptionsView.style.display = 'block';
            editUiOptionsView.style.display = 'none';
            saveUILayout(); // Guardar al salir
            updateToggleBtnPosition(); // --- SOLUCIÓN: Actualizar la posición del botón
        };

        modifyUiBtn.addEventListener('click', (e) => { e.stopPropagation(); enterEditMode(); });
        exitEditModeBtn.addEventListener('click', (e) => { e.stopPropagation(); exitEditMode(); });

        resetUiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // --- MODIFICACIÓN: Mostrar el modal personalizado en lugar de la alerta nativa ---
            confirmResetModal.classList.add('visible');
        });

        // --- SOLUCIÓN: Evitar que los clics dentro del modal afecten al juego ---
        confirmResetModal.addEventListener('mousedown', (e) => e.stopPropagation()); // No necesita cambio
        confirmResetModal.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

        // --- NUEVO: Lógica para los botones del modal de confirmación ---
        confirmResetNoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmResetModal.classList.remove('visible');
        });

        confirmResetYesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            localStorage.removeItem('poolUILayout');
            window.location.reload(); // Recargar para aplicar los estilos por defecto
        });

        pocketsSizeSlider.addEventListener('input', (e) => {
            const newSize = e.target.value;
            const pocketContainers = document.querySelectorAll('.pocketed-balls-container');
            pocketContainers.forEach(container => {
                container.style.width = `${newSize}px`;
                // La altura se ajustará automáticamente por el flex-direction: column y el aspect-ratio de los hijos
            });
            // No guardamos en cada cambio para mejor rendimiento, solo al salir.
        });

        powerBarSizeSlider.addEventListener('input', (e) => {
            const newSize = e.target.value;
            powerBarContainer.style.width = `${newSize}px`;
        });

        powerBarHeightSlider.addEventListener('input', (e) => {
            const newSize = e.target.value;
            powerBarContainer.style.height = `${newSize}px`;
        });
    }

    // --- NUEVO: Cargar la disposición de la UI guardada al iniciar ---
    loadUILayout();
    setupAssignmentsListener(); // --- NUEVO: Iniciar el listener para la asignación de bolas.
    setupUIEditListeners();
}

export function prepareUIResources() {
    prepareTableTexture();
}

export async function handleInput() { // --- SOLUCIÓN: Marcar la función como asíncrona
    // --- CORRECCIÓN: Asegurarse de que la bola blanca exista antes de continuar ---
    if (!cueBall) return;
    if (isUIEditMode) return; // --- NUEVO: No procesar input del juego si estamos editando la UI
    const { isPlacingCueBall: isPlacing, isLoading } = getGameState();

    // --- CORRECCIÓN: No ejecutar la lógica de revisión si el juego está cargando ---
    if (isLoading) return;

    const ballsAreCurrentlyMoving = areBallsMoving(balls);

    // --- CORRECCIÓN: La revisión del estado ahora se gestiona centralmente en pool.js ---
    // Se elimina la llamada a revisarEstado desde aquí para evitar duplicados y conflictos.
    window.ballsWereMoving = ballsAreCurrentlyMoving; // Actualizar el estado para el siguiente frame

    // --- MODIFICACIÓN: Simplificar la condición para poder disparar y apuntar.
    // Se puede disparar si las bolas no se mueven y la bola blanca no está entronerada.
    const canShoot = !ballsAreCurrentlyMoving && !cueBall.isPocketed;
    
    // --- MODIFICACIÓN: Las guías solo se muestran si se puede disparar Y NO se está en modo "bola en mano".
    // --- CORRECCIÓN: Las guías deben mostrarse si se puede disparar, excepto cuando se está arrastrando activamente la bola.
    const shouldShowGuides = (canShoot || isPullingBack()) && !isMovingCueBall();

    powerBarContainer.style.display = canShoot ? 'block' : 'none';


    if (shouldShowGuides) {
        // El ángulo de tiro ahora se actualiza dentro de onPointerMove en inputManager.js

        if (cueMesh) cueMesh.visible = true;
        // --- CORRECCIÓN CRÍTICA: Eliminar la llamada a updateAimingGuides de aquí. ---
        // Esta línea estaba dibujando la guía basándose en el input local, creando un conflicto
        // con la lógica del servidor en pool.js. Al eliminarla, solo la lógica del servidor
        // podrá dibujar la línea, asegurando la sincronización.
    } else {
        hideAimingGuides();
        if (cueBall && cueBall.mesh && !cueBall.isPocketed) {
            cueBall.mesh.visible = true;
            if (cueBall.shadowMesh) cueBall.shadowMesh.visible = true; // También su sombra
        }
    }

    // --- Lógica para el indicador de "bola en mano" ---
    const moveIndicator = document.getElementById('move-indicator');
    if (moveIndicator) {
        if (isPlacing) {
            moveIndicator.style.display = 'block';
            moveIndicator.style.animation = 'fade-pulse 1s ease-in-out infinite'; // Animación infinita

            // Actualizar la posición del indicador en cada frame
            if (cueBall && cueBall.mesh) { // --- Guarda para asegurar que la bola blanca exista
                const screenPos = toScreenPosition(cueBall.mesh, camera);
                moveIndicator.style.left = `${screenPos.x}px`;
                moveIndicator.style.top = `${screenPos.y+50}px`;
            }
        } else {
            moveIndicator.style.display = 'none';
            moveIndicator.style.animation = ''; // Detener animación
        }
    }
}

/**
 * --- SOLUCIÓN: Actualiza la UI para resaltar al jugador activo.
 * @param {number} activePlayer - El número del jugador actual (1 o 2).
 */
export function updateActivePlayerUI(activePlayer) {
    const player1Container = document.getElementById('player1PocketedContainer');
    const player2Container = document.getElementById('player2PocketedContainer');
    const turnIndicator = document.getElementById('turnIndicator'); // --- NUEVO: Referencia al indicador de turno

    if (!player1Container || !player2Container || !turnIndicator) return;

    const avatar1 = player1Container.querySelector('.player-avatar');
    const avatar2 = player2Container.querySelector('.player-avatar');

    avatar1.classList.toggle('active', activePlayer === 1);
    avatar2.classList.toggle('active', activePlayer === 2);

    // --- NUEVO: Mostrar/ocultar el indicador de turno ---
    if (activePlayer === 1 || activePlayer === 2) {
        // turnIndicator.style.opacity = '1';
        // turnIndicator.style.transform = 'translate(-50%, -50%)'; // Resetear la posición si estaba animada
        // turnIndicator.textContent = `Turno del Jugador ${activePlayer}`; // Actualizar texto
    } else {
        turnIndicator.style.opacity = '0';
    }

    // --- SOLUCIÓN: Reiniciar el temporizador circular del jugador inactivo ---
    const timerLine1 = avatar1 ? avatar1.querySelector('.timer-line') : null;
    const timerLine2 = avatar2 ? avatar2.querySelector('.timer-line') : null;

    if (activePlayer === 1) {
        if (timerLine1) timerLine1.style.strokeDashoffset = 0; // Activar el temporizador del jugador 1
        if (timerLine2) timerLine2.style.strokeDashoffset = 100; // Reiniciar el temporizador del jugador 2 (inactivo)
    } else {
        if (timerLine1) timerLine1.style.strokeDashoffset = 100; // Reiniciar el temporizador del jugador 1 (inactivo)
        if (timerLine2) timerLine2.style.strokeDashoffset = 0; // Activar el temporizador del jugador 2
    }
}

/**
 * --- SOLUCIÓN (MODIFICADA): Actualiza el borde-temporizador del jugador actual.
 * @param {number} player - El jugador cuya barra de tiempo se actualizará.
 * @param {number} percent - El porcentaje restante (0 a 1).
 */
export function updateTurnTimerUI(player, percent) {
    const container = document.getElementById(`player${player}PocketedContainer`);
    if (container) {
        const timerLine = container.querySelector('.timer-line');
        if (timerLine) {
            // El offset va de 100 (vacío) a 0 (lleno). `percent` va de 1 (lleno) a 0 (vacío).
            timerLine.style.strokeDashoffset = 100 - (percent * 100);
        }
    }
}

/**
 * --- NUEVO: Convierte una posición del mundo 3D a coordenadas de pantalla 2D.
 * @param {THREE.Object3D} object - El objeto 3D cuya posición se convertirá.
 * @param {THREE.Camera} camera - La cámara de la escena.
 * @returns {{x: number, y: number}} - Las coordenadas X e Y en la pantalla.
 */
function toScreenPosition(object, camera) {
    const vector = new THREE.Vector3();

    // Forzar la actualización de las matrices del objeto y sus ancestros
    object.updateWorldMatrix(true, false);
    // Forzar la actualización de las matrices de la cámara
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    // Obtener la posición mundial del objeto
    object.getWorldPosition(vector);
    // Proyectar la posición 3D en el espacio 2D de la cámara
    vector.project(camera);

    // Convertir de coordenadas de dispositivo normalizadas (-1 a 1) a coordenadas de píxeles
    const x = (vector.x + 1) * window.innerWidth / 2;
    const y = -(vector.y - 1) * window.innerHeight / 2;
    return { x, y };
}

/**
 * Función principal para actualizar todos los elementos de la UI en cada frame.
 */
export function updateUI() {
    // La función updateUI se mantiene por si se necesita en el futuro, pero ahora está vacía.
}



/**
 * --- NUEVO: Inicia el listener para actualizar la UI de asignación de bolas.
 */
function setupAssignmentsListener() {
    window.addEventListener('updateassignments', (event) => {
        const gameData = event.detail;
        const { playerAssignments, ballsAssigned, balls: serverBalls, player1, player2 } = gameData;

        if (!playerAssignments || !serverBalls) return;

        const player1Container = document.getElementById('player1PocketedContainer');
        const player2Container = document.getElementById('player2PocketedContainer');
        
        // Limpiar ambos contenedores (excepto el nombre y el avatar)
        [player1Container, player2Container].forEach(container => {
            const icons = container.querySelectorAll('.player-ball-icon, .pocketed-ball-placeholder');
            icons.forEach(icon => icon.remove());
        });

        // Crear los 7 placeholders de nuevo
        for (let i = 0; i < 7; i++) {
            const p1_placeholder = document.createElement('div');
            p1_placeholder.className = 'pocketed-ball-placeholder';
            player1Container.appendChild(p1_placeholder);

            const p2_placeholder = document.createElement('div');
            p2_placeholder.className = 'pocketed-ball-placeholder';
            player2Container.appendChild(p2_placeholder);
        }

        // Volver a añadir las bolas entroneradas en el contenedor correcto
        serverBalls.forEach(serverBall => {
            if (!serverBall.isActive && serverBall.number !== null && serverBall.number !== 8) {
                const ballType = (serverBall.number >= 1 && serverBall.number <= 7) ? 'solids' : 'stripes';
                let targetContainer = null;

                // Check player 1's assignment
                if (gameData.playerAssignments && gameData.playerAssignments[1] === ballType) {
                    targetContainer = player1Container;
                }
                // Check player 2's assignment
                else if (gameData.playerAssignments && gameData.playerAssignments[2] === ballType) {
                    targetContainer = player2Container;
                }

                if (targetContainer) {
                    addPocketedBallToUI(serverBall, targetContainer);
                }
            }
        });
    });
}

/**
 * --- NUEVO: Añade una bola entronerada a la UI del jugador correspondiente.
 * @param {object} ball - La bola que se ha entronerado.
 * @param {HTMLElement} targetContainer - El contenedor del jugador.
 */
function addPocketedBallToUI(ball, targetContainer) {
    if (!targetContainer) return;

    // Crear el icono de la bola
    const ballIcon = document.createElement('div');
    ballIcon.className = 'player-ball-icon';
    const imageUrl = `imajenes/BolasMetidas/${ball.number}.png`;
    ballIcon.style.backgroundImage = `url('${imageUrl}')`;

    // Buscar el primer placeholder disponible y reemplazarlo
    const placeholder = targetContainer.querySelector('.pocketed-ball-placeholder');
    if (placeholder) {
        // Usamos 'before' para insertar la bola y luego eliminamos el placeholder.
        // Esto asegura que las bolas se añadan en orden.
        placeholder.before(ballIcon);
        placeholder.remove();
    } else {
        // Si no hay placeholders, simplemente la añadimos al final (fallback).
        targetContainer.appendChild(ballIcon);
    }
}

// --- NUEVO: Funciones para el modo de edición de la UI ---

function toggleUIEditMode(isEditing) {
    const editableElements = document.querySelectorAll('.editable-ui');
    editableElements.forEach(el => {
        el.classList.toggle('editing', isEditing);
    });

    // --- MEJORA: Ocultar las guías de apuntado al entrar en modo edición ---
    if (isEditing) {
        hideAimingGuides();
        document.body.style.cursor = 'grab';
    } else {
        document.body.style.cursor = 'default';
    }
}

function saveUILayout() {
    const layout = {};
    const editableElements = document.querySelectorAll('.editable-ui');
    editableElements.forEach(el => {
        layout[el.id] = {
            left: el.style.left,
            right: el.style.right,
            top: el.style.top,
            bottom: el.style.bottom,
            width: el.style.width,
            height: el.style.height,
        };
    });
    // --- NUEVO: Guardar el estado de la cámara (pan y zoom) ---
    layout.cameraState = {
        level: zoomState.level,
        centerX: zoomState.centerX,
        centerY: zoomState.centerY
    };
    localStorage.setItem('poolUILayout', JSON.stringify(layout));
}

function loadUILayout() {
    const layout = JSON.parse(localStorage.getItem('poolUILayout'));
    if (layout) {
        Object.keys(layout).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                Object.assign(el.style, layout[id]);
            }
        });
        // --- NUEVO: Asegurar que la barra de potencia esté siempre a la izquierda ---
        const powerBar = document.getElementById('newPowerBarContainer');
        if (powerBar) {
            powerBar.style.left = '10px';
            powerBar.style.transform = 'none';
            powerBar.style.right = 'auto'; // Asegurarse de que no haya conflicto con 'right'
        }
        // --- NUEVO: Cargar el estado de la cámara ---
        if (layout.cameraState) {
            zoomState.level = layout.cameraState.level;
            zoomState.centerX = layout.cameraState.centerX;
            zoomState.centerY = layout.cameraState.centerY;
            updateCameraPositionForResponsiveness();
        }
    }
}

function setupUIEditListeners() {
    // --- MODIFICACIÓN: Unificar la lógica de inicio de arrastre para ratón y táctil ---
                    const onEditStart = (e) => {
                        if (!isUIEditMode) return;
            
                        const target = e.target;
                        const editableEl = target.closest('.editable-ui.editing');
                        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            // --- NUEVO: Lógica de Panning de la mesa ---
        if (!editableEl) {
            if (e.touches && e.touches.length === 2) { // Gesto de pellizcar para zoom
                e.preventDefault();
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                activeDrag = {
                    ...activeDrag,
                    type: 'pinch',
                    initialPinchDist: Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY),
                    initialZoom: zoomState.level,
                };
                return;
            }

            document.body.style.cursor = 'grabbing';
            activeDrag = {
                element: null,
                type: 'pan',
                initialX: clientX,
                initialY: clientY,
                initialCamX: zoomState.centerX,
                initialCamY: zoomState.centerY
            };
            return;
        }

        // --- NUEVO: Lógica de redimensión por pellizco en un elemento ---
        if (e.touches && e.touches.length === 2) {
            e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const rect = editableEl.getBoundingClientRect();
            activeDrag = {
                ...activeDrag,
                element: editableEl,
                type: 'pinch-resize',
                initialPinchDist: Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY),
                initialWidth: rect.width,
                initialHeight: rect.height,
            };
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const rect = editableEl.getBoundingClientRect();
        activeDrag = {
            ...activeDrag,
            element: editableEl,
            type: 'move',
            initialX: clientX,
            initialY: clientY,
            initialLeft: rect.left,
            initialTop: rect.top,
            initialRight: window.innerWidth - rect.right,
            initialBottom: window.innerHeight - rect.bottom,
            initialWidth: rect.width,
            initialHeight: rect.height,
            initialTransformX: 0, // Default
            initialTransformY: -50, // Default for translateY(-50%)
        };

        // If the element has a transform, parse it to get initial translate values
        if (editableEl.id === 'newPowerBarContainer' && editableEl.style.transform) {
            const transformMatch = editableEl.style.transform.match(/translateY\(([-+]?\d*\.?\d+)(%|px)\)/);
            if (transformMatch && transformMatch[2] === '%') {
                activeDrag.initialTransformY = parseFloat(transformMatch[1]);
            }
        }

        if (target.classList.contains('resize-handle')) {
            activeDrag.type = target.classList.contains('br') ? 'resize-br' : 'resize-tl';
        }

    };

    // --- MODIFICACIÓN: Unificar la lógica de movimiento para ratón y táctil ---
    const onEditMove = (e) => {
        if (!activeDrag || !activeDrag.type) return;

        e.preventDefault();
        e.stopPropagation();

        const clientX = e.touches ? (e.touches[0] ? e.touches[0].clientX : activeDrag.initialX) : e.clientX;
        const clientY = e.touches ? (e.touches[0] ? e.touches[0].clientY : activeDrag.initialY) : e.clientY;

        // --- NUEVO: Lógica para el gesto de pellizcar para redimensionar un elemento ---
        if (activeDrag.type === 'pinch-resize') {
            if (e.touches && e.touches.length === 2) {
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const currentPinchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                const resizeRatio = currentPinchDist / activeDrag.initialPinchDist;
                const el = activeDrag.element;
                el.style.width = `${Math.max(30, activeDrag.initialWidth * resizeRatio)}px`;
                el.style.height = `${Math.max(30, activeDrag.initialHeight * resizeRatio)}px`;
            }
            // --- CORRECCIÓN: Si el elemento es el selector de efecto, también guardamos el layout.
            if (activeDrag.element && activeDrag.element.id === 'miniSpinSelector') {
                saveUILayout();
            }
            return;
        }

        if (activeDrag.type === 'pinch') {
            if (e.touches && e.touches.length === 2) {
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const currentPinchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                const zoomRatio = currentPinchDist / activeDrag.initialPinchDist;
                zoomState.level = activeDrag.initialZoom * zoomRatio;
                zoomState.level = Math.max(0.5, Math.min(zoomState.level, 5)); // Limitar zoom
                updateCameraPositionForResponsiveness();
            }
            return;
        }

        const dx = clientX - activeDrag.initialX;
        const dy = clientY - activeDrag.initialY;

        if (activeDrag.type === 'pan') {
            const panFactor = (1 / zoomState.level) * (camera.position.z / 1000);
            zoomState.centerX = activeDrag.initialCamX - dx * panFactor;
            zoomState.centerY = activeDrag.initialCamY + dy * panFactor;
            updateCameraPositionForResponsiveness();
            return;
        }

        const el = activeDrag.element;
        if (activeDrag.type === 'move') {
            // --- SOLUCIÓN: Lógica de arrastre mejorada para elementos centrados con transform ---
            // Si el elemento está centrado (como la barra de potencia), ajustamos el 'left'
            // pero mantenemos la transformación para que siga centrado respecto a su nueva posición.
            // --- CORRECCIÓN: La miniatura del selector de efecto necesita un tratamiento especial.
            if (el.id === 'newPowerBarContainer') {
                const newTop = activeDrag.initialTop + dy;
                el.style.top = `${newTop}px`;
                el.style.left = `${activeDrag.initialLeft + dx}px`;
                el.style.right = 'auto';
            } else if (el.style.left !== 'auto') {
                el.style.left = `${activeDrag.initialLeft + dx}px`;
                el.style.right = 'auto';
            } else {
                // --- CORRECCIÓN: Asegurarse de que el 'left' se ponga en 'auto' si se está moviendo desde la derecha.
                // Esto es importante para el miniSpinSelector.
                el.style.right = `${activeDrag.initialRight - dx}px`;
                el.style.left = 'auto';
            }

            // La lógica para la posición vertical no cambia
            if (el.style.top !== 'auto' && el.style.bottom === 'auto') {
                el.style.top = `${activeDrag.initialTop + dy}px`;
            } else {
                el.style.bottom = `${activeDrag.initialBottom - dy}px`;
                el.style.top = 'auto';
            }
        } else if (activeDrag.type === 'resize-br') {
            el.style.width = `${Math.max(50, activeDrag.initialWidth + dx)}px`;
            el.style.height = `${Math.max(50, activeDrag.initialHeight + dy)}px`;
        } else if (activeDrag.type === 'resize-tl') {
            el.style.width = `${Math.max(50, activeDrag.initialWidth - dx)}px`;
            el.style.height = `${Math.max(50, activeDrag.initialHeight - dy)}px`;
            el.style.left = `${activeDrag.initialLeft + dx}px`;
            el.style.top = `${activeDrag.initialTop + dy}px`;
            el.style.right = 'auto';
            el.style.bottom = 'auto';
        }
    };

    // --- MODIFICACIÓN: Unificar la lógica de fin de arrastre para ratón y táctil ---
    const onEditEnd = (e) => {
        if (activeDrag && activeDrag.type) {
            saveUILayout();
            activeDrag.type = null;
            activeDrag.element = null;
            if (isUIEditMode) {
                document.body.style.cursor = 'grab';
            }
        }
    };

    // Asignar los nuevos manejadores a los eventos de ratón y táctiles
    document.addEventListener('mousedown', onEditStart);
    document.addEventListener('touchstart', onEditStart, { passive: false });
    document.addEventListener('mousemove', onEditMove);
    document.addEventListener('touchmove', onEditMove, { passive: false });
    document.addEventListener('mouseup', onEditEnd);
    document.addEventListener('touchend', onEditEnd); 

    // --- NUEVO: Listener para el zoom de la mesa ---
    document.addEventListener('wheel', (e) => {
        if (!isUIEditMode) return;

        e.preventDefault();
        e.stopPropagation();

        const zoomFactor = 1.1;
        if (e.deltaY < 0) { // Rueda hacia arriba = zoom in
            zoomState.level *= zoomFactor;
        } else { // Rueda hacia abajo = zoom out
            zoomState.level /= zoomFactor;
        }
        zoomState.level = Math.max(0.5, Math.min(zoomState.level, 5)); // Limitar zoom
        updateCameraPositionForResponsiveness();
        saveUILayout(); // Guardar el zoom inmediatamente
    }, { passive: false });
}

export function updatePlayerInfoUI(player1Data, player2Data) {
    const player1NameEl = document.getElementById('player1-name');
    const player1AvatarImg = document.getElementById('player1-avatar-img');
    const player1AvatarSvg = document.getElementById('player1-avatar-svg');
    const player1AvatarSvgBg = player1AvatarSvg ? player1AvatarSvg.querySelector('.avatar-icon-bg') : null;
    const player1AvatarSvgIcon = player1AvatarSvg ? player1AvatarSvg.querySelector('.avatar-icon') : null;

    const player2NameEl = document.getElementById('player2-name');
    const player2AvatarImg = document.getElementById('player2-avatar-img');
    const player2AvatarSvg = document.getElementById('player2-avatar-svg');
    const player2AvatarSvgBg = player2AvatarSvg ? player2AvatarSvg.querySelector('.avatar-icon-bg') : null;
    const player2AvatarSvgIcon = player2AvatarSvg ? player2AvatarSvg.querySelector('.avatar-icon') : null;

    if (player1Data) {
        if (player1NameEl) player1NameEl.textContent = player1Data.username || 'Jugador 1';
        if (player1AvatarImg && player1AvatarSvg) {
            if (player1Data.profileImageName) {
                player1AvatarImg.src = `./imajenes/perfil/${player1Data.profileImageName}`;
                player1AvatarImg.style.display = 'block';
                player1AvatarImg.classList.add('fade-in'); // Add fade-in class
                player1AvatarSvg.style.display = 'block'; // Keep SVG visible for timer
                if (player1AvatarSvgBg) player1AvatarSvgBg.style.display = 'none'; // Hide SVG background
                if (player1AvatarSvgIcon) player1AvatarSvgIcon.style.display = 'none'; // Hide SVG icon
            } else {
                player1AvatarImg.style.display = 'none';
                player1AvatarImg.classList.remove('fade-in'); // Remove fade-in class
                player1AvatarSvg.style.display = 'block';
                if (player1AvatarSvgBg) player1AvatarSvgBg.style.display = ''; // Show SVG background
                if (player1AvatarSvgIcon) player1AvatarSvgIcon.style.display = ''; // Show SVG icon
            }
        }
    }

    if (player2Data) {
        if (player2NameEl) player2NameEl.textContent = player2Data.username || 'Jugador 2';
        if (player2AvatarImg && player2AvatarSvg) {
            if (player2Data.profileImageName) {
                player2AvatarImg.src = `./imajenes/perfil/${player2Data.profileImageName}`;
                player2AvatarImg.style.display = 'block';
                player2AvatarImg.classList.add('fade-in'); // Add fade-in class
                player2AvatarSvg.style.display = 'block'; // Keep SVG visible for timer
                if (player2AvatarSvgBg) player2AvatarSvgBg.style.display = 'none'; // Hide SVG background
                if (player2AvatarSvgIcon) player2AvatarSvgIcon.style.display = 'none'; // Hide SVG icon
            } else {
                player2AvatarImg.style.display = 'none';
                player2AvatarImg.classList.remove('fade-in'); // Remove fade-in class
                player2AvatarSvg.style.display = 'block';
                if (player2AvatarSvgBg) player2AvatarSvgBg.style.display = ''; // Show SVG background
                if (player2AvatarSvgIcon) player2AvatarSvgIcon.style.display = ''; // Show SVG icon
            }
        }
    } else {
        if (player2NameEl) player2NameEl.textContent = 'Esperando...';
        if (player2AvatarImg && player2AvatarSvg) {
            player2AvatarImg.style.display = 'none';
            player2AvatarImg.classList.remove('fade-in'); // Remove fade-in class
            player2AvatarSvg.style.display = 'block';
            if (player2AvatarSvgBg) player2AvatarSvgBg.style.display = ''; // Show SVG background
            if (player2AvatarSvgIcon) player2AvatarSvgIcon.style.display = ''; // Show SVG icon
        }
    }
}