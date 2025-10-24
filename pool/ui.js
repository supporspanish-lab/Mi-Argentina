// --- Módulo de Interfaz de Usuario y Eventos ---
import * as THREE from 'three';
import { areBallsMoving } from './fisicas.js';
import { getGameState, startShot, setPlacingCueBall } from './gameState.js';
import { playSound } from './audioManager.js';
import { balls, cueBall, setupBalls, cueBallRedDot } from './ballManager.js';
import { handles, pockets, TABLE_WIDTH, TABLE_HEIGHT, BALL_RADIUS, prepareTableTexture } from './config.js';
import { camera, canvas, zoomState, updateCameraPositionForResponsiveness } from './scene.js';
import { initializeAiming, updateAimingGuides, animateCueShot, hideAimingGuides, cueMesh } from './aiming.js';

// --- Referencias a elementos del DOM ---
const spinSelectorContainer = document.getElementById('spinSelectorContainer');
const spinSelectorDot = document.getElementById('spinSelectorDot');
const powerBarContainer = document.getElementById('powerBarContainer');
let isValidPlacement = true; // --- NUEVO: Estado para la colocación de la bola blanca

// --- Estado de la UI ---
export let spinOffset = { x: 0, y: 0 };
let isDraggingSpin = false;
let mouse = { x: 0, y: 0 };
let isMouseDown = false;
let isMovingCueBall = false; // Para colocar la bola blanca
export let currentShotAngle = 0; // El ángulo del apuntado
let isPullingBack = false; // --- NUEVO: true cuando se está jalando el taco
let pullBackDistance = 0; // --- NUEVO: Distancia de jalado
let initialPullBackProjection = 0; // --- CORRECCIÓN: Guardar la proyección inicial del ratón al empezar a jalar
let isDraggingPower = false; // --- NUEVO: true cuando se está deslizando el handle de potencia
let powerPercent = 0; // --- NUEVO: Porcentaje de potencia (0 a 1), estado unificado

// --- NUEVO: Estado para el modo de edición de UI ---
let isUIEditingMode = false;
let draggedUIElement = null;
let dragOffset = { x: 0, y: 0 };
let isResizing = false;
let resizedUIElement = null;
let initialMousePos = { x: 0, y: 0 };
let initialSize = { width: 0, height: 0 };
let isRotating = false;
let rotatedUIElement = null;
let initialElementAngle = 0; // --- CORRECCIÓN: Guardar el ángulo inicial del elemento
let initialMouseAngle = 0; // --- CORRECCIÓN: Guardar el ángulo inicial del ratón



export function initializeUI() {
    initializeAiming();
    addEventListeners();
}

export function prepareUIResources() {
    prepareTableTexture();
}

export function handleInput() {
    if (isUIEditingMode) return;

    // --- CORRECCIÓN: Asegurarse de que la bola blanca exista antes de continuar ---
    if (!cueBall) return;

    const isPlacing = getGameState().isPlacingCueBall;
    const canShoot = !areBallsMoving(balls) && !isMovingCueBall && !cueBall.isPocketed && !isPlacing; // Condición base para poder disparar
    const isPlacingWithoutDragging = isPlacing && !isMovingCueBall;
    const shouldShowGuides = (canShoot || isPlacingWithoutDragging) || isPullingBack; // --- CORRECCIÓN: Mantener guías visibles mientras se carga la potencia

    // --- MODIFICADO: La barra de potencia y el selector de efecto son visibles cuando se puede disparar ---
    spinSelectorContainer.style.display = (canShoot && !isPullingBack) ? 'block' : 'none';
    powerBarContainer.style.display = canShoot ? 'block' : 'none';


    if (shouldShowGuides) {
        // El ángulo solo debe cambiar si no estamos en medio de un tiro
        // --- CORRECCIÓN: El ángulo ahora solo se actualiza si el ratón está presionado ---
        if (isMouseDown && !isPullingBack) {
            const dx = mouse.x - cueBall.mesh.position.x;
            const dy = mouse.y - cueBall.mesh.position.y;
            currentShotAngle = Math.atan2(dy, dx);
        }
        // --- CORRECCIÓN DEFINITIVA: La visibilidad del taco se controla aquí ---
        if (cueMesh) cueMesh.visible = true;
        updateAimingGuides(currentShotAngle, getGameState(), pullBackDistance);
    } else {
        hideAimingGuides();
        // --- CORRECCIÓN: La bola blanca debe estar siempre visible, a menos que esté entronerada. ---
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
    if (isUIEditingMode) return;
}

/**
 * Calcula la posición del ratón en el mundo 3D intersectando un plano en una altura Z específica.
 * @param {MouseEvent|TouchEvent} e - El evento del ratón o táctil.
 * @param {number} [targetZ=0] - La coordenada Z del plano con el que se debe intersectar.
 * @returns {{x: number, y: number}} - Las coordenadas X e Y en el mundo 3D.
 */
function getMousePos(e, targetZ = 0) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const mouseVector = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouseVector, camera);
    
    // --- CORRECCIÓN DEFINITIVA: Usar el targetZ proporcionado para crear el plano de intersección.
    // El segundo argumento de Plane es la distancia negativa desde el origen a lo largo de la normal del plano.
    // Como nuestra normal es (0,0,1), esto es -Z.
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -targetZ); // El segundo argumento es la distancia negativa desde el origen
    
    const intersectionPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectionPoint);
    return { x: intersectionPoint.x, y: intersectionPoint.y };
}

function addEventListeners() {
    // --- MODIFICADO: Función unificada para manejar tanto mousedown como touchstart ---
    const onPointerDown = (e) => {
        // Prevenir comportamiento por defecto en eventos táctiles (como scroll)
        if (e.type === 'touchstart') {
            e.preventDefault();
        }
        // Ignorar clics en el canvas si estamos en modo edición
        if (isUIEditingMode) return;

        const initialTargetZ = 0;
        mouse = getMousePos(e, initialTargetZ);

        isMouseDown = true;

        // --- NUEVO: Lógica para colocar la bola blanca ---
        if (getGameState().isPlacingCueBall) {
            // --- MODIFICACIÓN: Iniciar el arrastre de la bola blanca ---
            const distSq = (mouse.x - cueBall.mesh.position.x)**2 + (mouse.y - cueBall.mesh.position.y)**2;
            if (distSq < BALL_RADIUS**2) {
                isMovingCueBall = true;
            }
        }

        // --- MODIFICADO: Iniciar el modo de "jalar" para disparar ---
        // --- CORRECCIÓN: Solo se activa si se hace clic en el taco ---
        if (!areBallsMoving(balls) && !isMovingCueBall && !cueBall.isPocketed && cueMesh && cueMesh.visible) {
            const raycaster = new THREE.Raycaster();
            const mouseVector = new THREE.Vector2(((e.clientX - canvas.getBoundingClientRect().left) / canvas.width) * 2 - 1, -((e.clientY - canvas.getBoundingClientRect().top) / canvas.height) * 2 + 1);
            raycaster.setFromCamera(mouseVector, camera);

            const intersects = raycaster.intersectObject(cueMesh, true);

            if (intersects.length > 0) {
                isPullingBack = true;
                // --- CORRECCIÓN: Guardar la proyección inicial del ratón en el eje de tiro ---
                // Esto asegura que la carga de potencia siempre comience desde 0.
                const shotAxis = new THREE.Vector2(Math.cos(currentShotAngle), Math.sin(currentShotAngle));
                const mouseVec = new THREE.Vector2(mouse.x, mouse.y);
                const cueBallPos = new THREE.Vector2(cueBall.mesh.position.x, cueBall.mesh.position.y);
                const mouseToCueBallVec = mouseVec.sub(cueBallPos);
                initialPullBackProjection = -mouseToCueBallVec.dot(shotAxis);
            }
        }

        if (zoomState.isZooming) {
            if (zoomState.level > 1) {
                zoomState.level = 1;
                zoomState.centerX = TABLE_WIDTH / 2;
                zoomState.centerY = TABLE_HEIGHT / 2;
            } else {
                const clickPos = getMousePos(e);
                zoomState.level = 3;
                zoomState.centerX = clickPos.x;
                zoomState.centerY = clickPos.y;
            }
            updateCameraPositionForResponsiveness();
            return;
        }
    };

    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('touchstart', onPointerDown, { passive: false });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // --- MODIFICADO: Eventos de spin para ratón y táctil ---
    const onSpinStart = (e) => {
        e.stopPropagation();
        isDraggingSpin = true;
    };
    spinSelectorContainer.addEventListener('mousedown', onSpinStart);
    spinSelectorContainer.addEventListener('touchstart', onSpinStart);

    // --- NUEVO: Eventos para el handle de la barra de potencia ---
    const onPowerDragStart = (e) => {
        e.stopPropagation();
        isDraggingPower = true;
    };
    document.getElementById('powerBarHandle').addEventListener('mousedown', onPowerDragStart);
    document.getElementById('powerBarHandle').addEventListener('touchstart', onPowerDragStart);

    // --- CORRECCIÓN: Reintroducir la lógica del modo de edición de UI y la declaración de draggableElements ---
    const editUIModeButton = document.getElementById('editUIModeButton');
    const copyConfigButton = document.getElementById('copyConfigButton');
    const draggableElements = [
        spinSelectorContainer,
        document.getElementById('player1PocketedContainer'),
        document.getElementById('player2PocketedContainer')
    ];

    editUIModeButton.addEventListener('click', () => {
        isUIEditingMode = !isUIEditingMode; // Alternar el modo

        if (isUIEditingMode) {
            editUIModeButton.textContent = 'Guardar UI';
            editUIModeButton.style.backgroundColor = '#2ecc71'; // Verde
            copyConfigButton.style.display = 'block'; // Mostrar el botón de copiar
            draggableElements.forEach(el => {
                el.classList.add('ui-draggable');
            });
        } else {
            editUIModeButton.textContent = 'Editar UI';
            editUIModeButton.style.backgroundColor = ''; // Color por defecto
            copyConfigButton.style.display = 'none'; // Ocultar el botón de copiar
            draggableElements.forEach(el => {
                el.classList.remove('ui-draggable');
            });
        }
    });

    copyConfigButton.addEventListener('click', async () => {
        const config = {};
        draggableElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const transform = style.transform;
            let rotation = 0;
            if (transform && transform !== 'none') {
                const matrix = transform.match(/matrix\((.+)\)/);
                if (matrix) {
                    const values = matrix[1].split(', ').map(parseFloat);
                    rotation = Math.round(Math.atan2(values[1], values[0]) * (180 / Math.PI));
                }
            }
            config[el.id] = { left: rect.left, top: rect.top, width: rect.width, height: rect.height, rotation: rotation };
        });
        try {
            await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
            copyConfigButton.textContent = '¡Copiado!';
            setTimeout(() => { copyConfigButton.textContent = 'Copiar Configuración'; }, 2000);
        } catch (err) {
            console.error('Error al copiar la configuración: ', err);
            copyConfigButton.textContent = 'Error al copiar';
        }
    });

    draggableElements.forEach(el => {
        el.addEventListener('mousedown', (e) => {
            if (!isUIEditingMode) return;
            e.preventDefault();
            e.stopPropagation();

            draggedUIElement = el;
            // Guardamos el desfase entre el clic y la esquina superior izquierda del elemento
            dragOffset.x = e.clientX - draggedUIElement.getBoundingClientRect().left;
            dragOffset.y = e.clientY - draggedUIElement.getBoundingClientRect().top;
        });
    });

    // --- NUEVO: Lógica para redimensionar elementos ---
    document.querySelectorAll('.resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            if (!isUIEditingMode) return;
            e.preventDefault();
            e.stopPropagation(); // Evita que se active el arrastre del elemento padre

            isResizing = true;
            resizedUIElement = handle.parentElement; // El elemento a redimensionar es el padre del handle
            initialMousePos = { x: e.clientX, y: e.clientY };
            const rect = resizedUIElement.getBoundingClientRect();
            initialSize = { width: rect.width, height: rect.height };
        });
    });

    // --- NUEVO: Lógica para rotar elementos ---
    document.querySelectorAll('.rotate-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            if (!isUIEditingMode) return;
            e.preventDefault();
            e.stopPropagation();

            isRotating = true;
            rotatedUIElement = handle.parentElement; // --- CORRECCIÓN: Lógica de rotación mejorada ---
            handle.style.cursor = 'grabbing';

            const rect = rotatedUIElement.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // 1. Calcular el ángulo inicial del ratón
            initialMouseAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

            // 2. Obtener la rotación actual del elemento desde su 'transform'
            const currentTransform = window.getComputedStyle(rotatedUIElement).transform;
            if (currentTransform && currentTransform !== 'none') {
                const matrix = new DOMMatrix(currentTransform);
                initialElementAngle = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
            } else {
                initialElementAngle = 0;
            }
        });
    });


    // --- MODIFICADO: Función unificada para mousemove y touchmove ---
    const onPointerMove = (e) => {
        // Prevenir comportamiento por defecto en eventos táctiles
        if (e.type === 'touchmove') {
            e.preventDefault();
        }
        // --- CORRECCIÓN: Unificar toda la lógica de 'mousemove' aquí ---

        // 1. Obtener la posición del ratón en el mundo del juego.
        // Usamos el evento 'e' que viene del listener de 'window'.
        mouse = getMousePos(e, 0);

        // 2. Lógica de apuntado y movimiento de la bola blanca (antes en el listener del canvas).
        if (!isUIEditingMode) {
            handleInput(); // Actualiza las guías de apuntado.

            if (isMovingCueBall && getGameState().isPlacingCueBall) {
                moveCueBallTo(mouse);
                isValidPlacement = isPositionValidForCueBall(mouse);
                const dotMaterial = cueBallRedDot.material;
                dotMaterial.color.set(isValidPlacement ? 0xe74c3c : 0x888888);
            }

            // --- NUEVO: Lógica para jalar el taco ---
            if (isPullingBack) {
                const shotAxis = new THREE.Vector2(Math.cos(currentShotAngle), Math.sin(currentShotAngle));
                const mouseVec = new THREE.Vector2(mouse.x, mouse.y);
                const cueBallPos = new THREE.Vector2(cueBall.mesh.position.x, cueBall.mesh.position.y);
                const mouseToCueBallVec = mouseVec.sub(cueBallPos);

                // --- CORRECCIÓN: Calcular la distancia de arrastre relativa a la posición inicial ---
                const currentProjection = -mouseToCueBallVec.dot(shotAxis);
                pullBackDistance = currentProjection - initialPullBackProjection;
                pullBackDistance = Math.max(0, pullBackDistance); // No permitir valores negativos (empujar)

                // Actualizar la barra de potencia
                const MAX_PULL_DISTANCE = 150;
                // --- CORRECCIÓN: Limitar la distancia de retroceso al máximo definido ---
                pullBackDistance = Math.min(pullBackDistance, MAX_PULL_DISTANCE);

                powerPercent = Math.min(pullBackDistance / MAX_PULL_DISTANCE, 1.0);
                updatePowerUI(powerPercent);
            }
        }

        // --- CORRECCIÓN: Mover la lógica de arrastre del spin aquí ---
        if (isDraggingSpin) {
            const rect = spinSelectorContainer.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            let dx = e.clientX - centerX;
            let dy = e.clientY - centerY;

            const radius = rect.width / 2;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > radius) {
                dx = (dx / dist) * radius;
                dy = (dy / dist) * radius;
            }

            spinOffset.x = dx / radius;
            spinOffset.y = -dy / radius; // Invertir Y porque en la UI +Y es hacia abajo
            spinSelectorDot.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
        }

        // --- NUEVO: Lógica para deslizar la barra de potencia ---
        if (isDraggingPower) {
            const rect = powerBarContainer.getBoundingClientRect();
            // La posición Y del ratón relativa a la parte superior de la barra
            const relativeY = e.clientY - rect.top;
            // Calcular el porcentaje de potencia (invertido, porque 0 está arriba)
            let newPower = 1 - (relativeY / rect.height);
            // Limitar entre 0 y 1
            newPower = Math.max(0, Math.min(1, newPower));

            powerPercent = newPower;
            updatePowerUI(powerPercent);
        }

        // 4. Lógica para el modo de edición de la UI.
        if (isUIEditingMode) {
            if (draggedUIElement) {
                e.preventDefault();

                // Calculamos la nueva posición
                let newX = e.clientX - dragOffset.x;
                let newY = e.clientY - dragOffset.y;

                // Actualizamos el estilo del elemento
                draggedUIElement.style.left = `${newX}px`;
                draggedUIElement.style.top = `${newY}px`;

                // IMPORTANTE: Como la barra de fuerza usa 'transform', lo eliminamos para que 'top' funcione correctamente.
            }

            if (isResizing) {
                const dx = e.clientX - initialMousePos.x;
                const dy = e.clientY - initialMousePos.y;
                const newWidth = initialSize.width + dx;
                const newHeight = initialSize.height + dy;
                resizedUIElement.style.width = `${newWidth}px`;
                resizedUIElement.style.height = `${newHeight}px`;
            }

            if (isRotating) {
                const rect = rotatedUIElement.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                // 1. Calcular el ángulo actual del ratón
                const currentMouseAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
                // 2. Calcular el cambio en el ángulo
                const angleDelta = currentMouseAngle - initialMouseAngle;
                // 3. Aplicar el cambio al ángulo inicial del elemento
                rotatedUIElement.style.transform = `rotate(${initialElementAngle + angleDelta}deg)`;
            }

        }
    };
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: false });

    // --- MODIFICADO: Función unificada para mouseup y touchend ---
    const onPointerUp = (e) => {
        // --- CORRECCIÓN: Mover la lógica de disparo aquí para que funcione fuera del canvas ---
        if (!isUIEditingMode) {
            const wasPullingBack = isPullingBack;
            const wasMovingCueBall = isMovingCueBall;

            if (wasMovingCueBall && getGameState().isPlacingCueBall) {
                isMovingCueBall = false;
                console.log("Posición de la bola blanca actualizada. Arrástrala de nuevo o dispara para confirmar.");
            } else if (wasPullingBack) {
                // Disparar con la potencia acumulada al jalar el taco
                shoot(powerPercent);
                pullBackDistance = 0; // Resetear para el próximo tiro
                initialPullBackProjection = 0; // Resetear para el próximo tiro
                powerPercent = 0; // Resetear la potencia
            }

            // Resetear estados de acción
            isPullingBack = false;
            isMouseDown = false;
        }
        // --- FIN DE LA CORRECCIÓN ---


        // Lógica para el modo de edición de UI y el selector de efecto
        if (isDraggingSpin) {
            isDraggingSpin = false;
        }

        // --- NUEVO: Finalizar el arrastre de la barra de potencia ---
        if (isDraggingPower) {
            // --- NUEVO: Disparar al soltar la barra de potencia (control móvil) ---
            shoot(powerPercent);
            powerPercent = 0; // Resetear la potencia
            isDraggingPower = false;
        }

        if (isResizing) {
            isResizing = false;
            resizedUIElement = null;
        }

        if (draggedUIElement) {
            // Soltamos el elemento
            draggedUIElement = null;
        }

        if (isRotating) {
            isRotating = false;
            // --- CORRECCIÓN: Asegurarse de que el cursor se restaure correctamente ---
            if (rotatedUIElement) {
                rotatedUIElement.querySelector('.rotate-handle').style.cursor = 'grab';
            }
            rotatedUIElement = null;
        }

        // --- MODIFICADO: Actualizar la UI de potencia al soltar el ratón ---
        // Si no se está jalando el taco, la barra vuelve a reflejar el 'powerPercent' guardado.
        if (!isPullingBack && !isDraggingPower) {
            updatePowerUI(powerPercent);
        }

    };
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);
}

/**
 * --- NUEVO: Actualiza los elementos visuales de la barra de potencia.
 * @param {number} newPowerPercent - El nuevo porcentaje de potencia (0 a 1).
 */
function updatePowerUI(newPowerPercent) {
    const powerBarFill = document.getElementById('powerBarFill');
    const powerBarHandle = document.getElementById('powerBarHandle');

    powerBarFill.style.height = `${newPowerPercent * 100}%`;
    powerBarHandle.style.bottom = `${newPowerPercent * 100}%`;

    if (newPowerPercent >= 0.98) {
        powerBarFill.classList.add('rounding-edge');
    } else {
        powerBarFill.classList.remove('rounding-edge');
    }
}

/**
 * --- NUEVO: Función centralizada para realizar el disparo.
 * @param {number} powerPercent - La potencia del tiro, de 0 a 1.
 */
function shoot(powerPercent) {
    // --- MODIFICADO: Si no se ha especificado potencia al llamar, usar la del estado.
    // Esto permite disparar con la potencia fijada por el slider.
    const finalPower = powerPercent;
    if (finalPower <= 0.01) {
        console.log("Potencia demasiado baja para disparar.");
        return; // No disparar si no hay potencia
    }

    // Si estamos colocando la bola, este disparo confirma la posición.
    if (getGameState().isPlacingCueBall) {
        if (!isValidPlacement) {
            console.warn("No se puede disparar desde una posición inválida.");
            return;
        }
        setPlacingCueBall(false);
        cueBall.isActive = true;
    }

    // Amortiguar la potencia en tiros extremos para evitar inestabilidad.
    const maxPower = 300 * 40;
    const SAFE_POWER_THRESHOLD = maxPower * 0.9; // Aumentado ligeramente el umbral
    let power = finalPower * maxPower;

    if (power > SAFE_POWER_THRESHOLD && finalPower < 1.0) { // No amortiguar el tiro al 100%
        const excessPower = power - SAFE_POWER_THRESHOLD;
        power = SAFE_POWER_THRESHOLD + Math.log1p(excessPower) * (maxPower / 50);
    }

    const impulseDirection = new THREE.Vector2(Math.cos(currentShotAngle), Math.sin(currentShotAngle));
    const velocityFactor = 2.5;

    animateCueShot(currentShotAngle, () => {
        if (areBallsMoving(balls)) return;

        cueBall.vx = impulseDirection.x * (power / 1000) * velocityFactor;
        cueBall.vy = impulseDirection.y * (power / 1000) * velocityFactor;
        // --- NUEVO: Guardar la velocidad inicial para calcular el efecto correctamente ---
        cueBall.initialVx = cueBall.vx;
        cueBall.initialVy = cueBall.vy;
        // --- NUEVO: Transferir el efecto seleccionado a la bola blanca ---
        cueBall.spin = { ...spinOffset };

        // --- NUEVO: Activar la vibración de la cámara al golpear ---
        const shakeIntensity = Math.pow(finalPower, 2) * 2.5; // La vibración es más fuerte con más potencia
        const shakeDuration = 0.15; // Duración corta y contundente
        window.triggerScreenShake(shakeIntensity, shakeDuration);

        // --- NUEVO: Activar vibración en móviles al golpear ---
        if ('vibrate' in navigator) {
            // La duración de la vibración es proporcional a la potencia del tiro.
            const vibrationDuration = Math.max(50, Math.floor(finalPower * 150));
            navigator.vibrate(vibrationDuration);
        }
        startShot();
        playSound('cueHit', Math.pow(finalPower, 2) * 0.9);

        // --- NUEVO: Resetear la potencia después de disparar ---
        powerPercent = 0;
    });
}

/**
 * --- NUEVO: Mueve la bola blanca a una posición y la hace visible si es necesario.
 * @param {{x: number, y: number}} position - La posición a la que mover la bola.
 */
function moveCueBallTo(position) {
    cueBall.mesh.position.set(position.x, position.y, BALL_RADIUS);
    if (cueBall.shadowMesh) {
        cueBall.shadowMesh.position.set(position.x, position.y, 0.1);
    }

    if (!cueBall.mesh.visible) {
        cueBall.mesh.visible = true;
        if (cueBall.shadowMesh) cueBall.shadowMesh.visible = true;
        cueBall.mesh.scale.set(1, 1, 1);
    }
}

/**
 * --- NUEVO: Comprueba si una posición es válida para colocar la bola blanca.
 * @param {{x: number, y: number}} point - La posición a comprobar.
 * @returns {boolean} - True si la posición es válida.
 */
function isPositionValidForCueBall(point) {
    // 1. Comprobar si está dentro de los bordes (handles)
    if (!isPointInPolygon(point, handles)) return false;

    // 2. Comprobar si está dentro de alguna tronera (pockets)
    for (const pocket of pockets) {
        if (isPointInPolygon(point, pocket.points)) return false;
    }

    // 3. Comprobar si colisiona con otra bola
    for (const ball of balls) {
        if (ball === cueBall || !ball.isActive) continue;
        const distSq = (point.x - ball.mesh.position.x)**2 + (point.y - ball.mesh.position.y)**2;
        if (distSq < (BALL_RADIUS * 2)**2) return false;
    }

    return true;
}

function isPointInPolygon(point, polygon) {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}