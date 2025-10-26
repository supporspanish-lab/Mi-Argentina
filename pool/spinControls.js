// --- Módulo de Controles de Efecto (Spin) ---

import { isUIEditModeActive } from './ui.js'; // --- NUEVO: Para no interferir con la edición de la UI
// --- Estado Interno ---
let spinOffsetState = { x: 0, y: 0 };
let isDraggingSpinState = false;
let wasDraggingSpinFlag = false; // --- CORRECCIÓN: Renombrada para evitar conflicto de nombres

// --- MODIFICACIÓN: Referencias a los elementos del nuevo modal ---
const spinModalOverlay = document.getElementById('spinModalOverlay');
const largeSpinSelector = document.getElementById('largeSpinSelector');
const spinSelectorDot = document.getElementById('spinSelectorDot'); // El punto del modal grande
const miniSpinSelector = document.getElementById('miniSpinSelector'); // --- SOLUCIÓN: Añadir referencia que faltaba
const miniSpinSelectorDot = document.getElementById('miniSpinSelectorDot'); // --- NUEVO: El punto de la miniatura

// --- SOLUCIÓN: Añadir la función de inicialización que faltaba ---
export function initializeSpinControls() {
    if (!spinModalOverlay || !largeSpinSelector || !miniSpinSelector) return;

    // --- Eventos para la miniatura ---
    const handleMiniSelectorInteraction = (e) => {
        if (isUIEditModeActive()) return; // No hacer nada si se está editando la UI
        e.preventDefault();
        e.stopPropagation();
        showSpinModal();
    };
    miniSpinSelector.addEventListener('mousedown', handleMiniSelectorInteraction);
    miniSpinSelector.addEventListener('touchstart', handleMiniSelectorInteraction, { passive: false });

    // --- CORRECCIÓN: Cerrar el modal si se hace clic fuera de él ---
    spinModalOverlay.addEventListener('mousedown', (e) => {
        // Si el clic es en el fondo oscuro (overlay) y no en el selector grande...
        if (e.target === spinModalOverlay) {
            e.stopPropagation();
            hideSpinModal(); // No necesita cambio
        }
    });

    // --- Eventos para el modal grande (arrastre) ---
    const handleDragStart = (e) => {
        if (isUIEditModeActive()) return;
        e.preventDefault();
        e.stopPropagation();
        startSpinDrag();
        // Para el primer toque/clic, calcular la posición inmediatamente
        const eventCoord = e.touches ? e.touches[0] : e;
        dragSpin(eventCoord);
    };

    const handleDragMove = (e) => {
        if (!isDraggingSpinState || isUIEditModeActive()) return;
        e.preventDefault();
        e.stopPropagation();
        const eventCoord = e.touches ? e.touches[0] : e;
        dragSpin(eventCoord);
    };

    const handleDragEnd = (e) => {
        if (!isDraggingSpinState || isUIEditModeActive()) return;
        e.preventDefault();
        e.stopPropagation();
        stopSpinDrag();
        // --- CORRECCIÓN: Ya no se oculta aquí, se oculta al hacer clic fuera.
    };

    largeSpinSelector.addEventListener('mousedown', handleDragStart);
    largeSpinSelector.addEventListener('touchstart', handleDragStart, { passive: false });

    // Escuchar el movimiento y el fin del arrastre en todo el documento para no perder el control si el dedo se sale
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('touchmove', handleDragMove, { passive: false });

    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchend', handleDragEnd);
}

// --- NUEVO: Función para mostrar el modal de efecto ---
export function showSpinModal() {
    if (spinModalOverlay) {
        spinModalOverlay.classList.add('visible');
    }
}

// --- NUEVO: Función para ocultar el modal de efecto ---
export function hideSpinModal() {
    if (spinModalOverlay) {
        spinModalOverlay.classList.remove('visible');
    }
}

export function startSpinDrag() {
    isDraggingSpinState = true;
    // --- NUEVO: Asegurarse de que el modal esté visible al empezar a arrastrar ---
    // Esto es un fallback por si se llama desde otro sitio.
    showSpinModal();
}

export function dragSpin({ clientX, clientY }) {
    if (!isDraggingSpinState) return;

    // --- CORRECCIÓN: Añadir validación para evitar errores si los elementos no existen ---
    // Esto elimina las advertencias (errores amarillos) de un posible null pointer.
    if (!largeSpinSelector || !spinSelectorDot) {
        return;
    }

    const rect = largeSpinSelector.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = clientX - centerX;
    let dy = clientY - centerY;

    // --- SOLUCIÓN: Restar el radio del propio punto para que no se salga de los límites ---
    const selectorRadius = rect.width / 2;
    const dotRadius = spinSelectorDot.offsetWidth / 2;
    const maxDistance = selectorRadius - dotRadius;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > maxDistance) {
        dx = (dx / dist) * maxDistance;
        dy = (dy / dist) * maxDistance;
    }

    // El offset se sigue calculando sobre el radio total para que el valor vaya de -1 a 1.
    spinOffsetState.x = dx / selectorRadius;
    spinOffsetState.y = -dy / selectorRadius; // Invertir Y porque en la UI +Y es hacia abajo

    // 1. Mover el punto del modal grande (usando transform para un movimiento suave)
    const transformValue = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
    spinSelectorDot.style.transform = transformValue;

    // --- NUEVO: 2. Mover el punto de la miniatura (usando porcentajes para que sea responsivo) ---
    if (miniSpinSelectorDot) {
        // --- SOLUCIÓN: Ajustar el rango de movimiento para compensar el área transparente de la imagen.
        // El punto se moverá en un rango del 40% desde el centro (del 10% al 90% del contenedor),
        // lo que lo mantiene dentro de la parte visible de la bola.
        miniSpinSelectorDot.style.left = `${50 + (spinOffsetState.x * 40)}%`;
        miniSpinSelectorDot.style.top = `${50 - (spinOffsetState.y * 40)}%`;
    }
}

export function stopSpinDrag() {
    isDraggingSpinState = false;
    wasDraggingSpinFlag = true; // Marcar que la acción de arrastre ha terminado
}

// --- NUEVO: Función para resetear el efecto al centro ---
export function resetSpin() {
    spinOffsetState = { x: 0, y: 0 };

    // --- CORRECCIÓN: Validar ambos elementos ---
    if (!spinSelectorDot || !miniSpinSelectorDot) {
        return;
    }

    // 1. Resetear el punto del modal grande
    spinSelectorDot.style.transform = `translate(-50%, -50%) translate(0px, 0px)`;

    // --- NUEVO: 2. Resetear el punto de la miniatura ---
    miniSpinSelectorDot.style.left = '50%';
    miniSpinSelectorDot.style.top = '50%';
}

// --- Getters de Estado ---

export const isDraggingSpin = () => isDraggingSpinState;
export const getSpinOffset = () => spinOffsetState;

/**
 * --- NUEVO: Comprueba si la última acción completada fue un arrastre de efecto.
 * Resetea el estado después de la comprobación.
 */
export function wasDraggingSpin() {
    const was = wasDraggingSpinFlag;
    wasDraggingSpinFlag = false; // Resetear para la próxima interacción
    return was;
}