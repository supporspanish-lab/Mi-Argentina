// --- Módulo de Interfaz de Usuario y Eventos ---
import * as THREE from 'three'; // --- SOLUCIÓN: Importar THREE.js
import { areBallsMoving } from './fisicas.js';
import { revisarEstado } from './revisar.js'; // --- SOLUCIÓN: Importar la nueva función de revisión
import { getGameState } from './gameState.js';
import { balls, cueBall } from './ballManager.js';
import { prepareTableTexture, TABLE_WIDTH } from './config.js';
import { camera, zoomState, updateCameraPositionForResponsiveness } from './scene.js'; // --- NUEVO: Importar la cámara para proyecciones
import { loadingManager } from './loadingManager.js'; // --- SOLUCIÓN: Importar el gestor de carga
import { initializeAiming, updateAimingGuides, hideAimingGuides, cueMesh } from './aiming.js';
import { initializeInputManager, isPointerDown, isPullingBack, isMovingCueBall, getPullBackDistance, getCurrentShotAngle } from './inputManager.js';
import { getPowerPercent } from './powerControls.js';

// --- Referencias a elementos del DOM ---
const spinSelectorContainer = document.getElementById('spinSelectorContainer');
const powerBarContainer = document.getElementById('powerBarContainer');

// --- Estado de la UI ---
// --- NUEVO: Variable para rastrear si las bolas se estaban moviendo en el frame anterior ---
let ballsWereMoving = true; // Inicia en true para mostrar el mensaje al empezar la partida.
// El estado ahora se gestiona en módulos dedicados (inputManager, powerControls, etc.)

// --- NUEVO: Estado para el modo de edición de la UI ---
let isUIEditMode = false;
let activeDrag = { // Objeto para gestionar el arrastre/redimensión activo
    element: null,
    type: null
};

// `window.currentShotAngle` se usa como variable global temporal para el ángulo.
window.currentShotAngle = 0;


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

        // --- SOLUCIÓN: Evitar que los clics dentro del panel afecten al juego ---
        // Detiene la propagación de eventos de clic o toque para que no lleguen al canvas.
        optionsPanel.addEventListener('mousedown', (e) => e.stopPropagation());
        optionsPanel.addEventListener('touchstart', (e) => e.stopPropagation());

        // --- MODIFICACIÓN: Lógica para cambiar entre vistas del panel de opciones ---
        const mainOptionsView = document.getElementById('main-options-view');
        const editUiOptionsView = document.getElementById('edit-ui-options-view');
        const modifyUiBtn = document.getElementById('modify-ui-btn');
        const exitEditModeBtn = document.getElementById('exit-edit-mode-btn');
        const resetUiBtn = document.getElementById('reset-ui-btn');
        const pocketsSizeSlider = document.getElementById('player-pockets-size');
        const spinSelectorSizeSlider = document.getElementById('spin-selector-size');
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
            if (spinSelectorContainer) spinSelectorSizeSlider.value = spinSelectorContainer.offsetWidth;

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
        confirmResetModal.addEventListener('mousedown', (e) => e.stopPropagation());
        confirmResetModal.addEventListener('touchstart', (e) => e.stopPropagation());

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

        spinSelectorSizeSlider.addEventListener('input', (e) => {
            const newSize = e.target.value;
            spinSelectorContainer.style.width = `${newSize}px`;
            spinSelectorContainer.style.height = `${newSize}px`;
        });
    }

    // --- NUEVO: Cargar la disposición de la UI guardada al iniciar ---
    loadUILayout();
    setupUIEditListeners();
}

export function prepareUIResources() {
    prepareTableTexture();
    // --- SOLUCIÓN: Precargar la imagen del selector de efecto ---
    // Aunque la imagen se usa en CSS, la cargamos aquí para que el loadingManager
    // la rastree y se asegure de que esté lista antes de iniciar el juego.
    new THREE.TextureLoader(loadingManager).load('imajenes/bolasMetidas/blanca.png');
}

export function handleInput() {
    // --- CORRECCIÓN: Asegurarse de que la bola blanca exista antes de continuar ---
    if (!cueBall) return;
    if (isUIEditMode) return; // --- NUEVO: No procesar input del juego si estamos editando la UI
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
    if (spinSelectorContainer.style.display === 'block' && !isUIEditMode) {
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
        updateAimingGuides(getCurrentShotAngle(), getGameState(), getPowerPercent());
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
 * --- NUEVO: Actualiza los elementos visuales de la barra de potencia horizontal.
 * @param {number} newPowerPercent - El nuevo porcentaje de potencia (0 a 1).
 */
export function updatePowerUI(newPowerPercent) {
    requestAnimationFrame(() => {
        const powerBarFill = document.getElementById('powerBarFill');
        const powerBarHandle = document.getElementById('powerBarHandle');

        powerBarFill.style.width = `${newPowerPercent * 100}%`;
        powerBarHandle.style.left = `${newPowerPercent * 100}%`;
    });
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
        };

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
            if (el.style.left !== 'auto') {
                el.style.left = `${activeDrag.initialLeft + dx}px`;
                el.style.right = 'auto';
            } else {
                el.style.right = `${activeDrag.initialRight - dx}px`;
                el.style.left = 'auto';
            }
            if (el.style.top !== 'auto') {
                el.style.top = `${activeDrag.initialTop + dy}px`;
                el.style.bottom = 'auto';
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