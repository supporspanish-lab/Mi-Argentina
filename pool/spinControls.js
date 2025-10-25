// --- Módulo de Controles de Efecto (Spin) ---

// --- Estado Interno ---
let spinOffsetState = { x: 0, y: 0 };
let isDraggingSpinState = false;

// --- MODIFICACIÓN: Referencias a los elementos del nuevo modal ---
const spinModalOverlay = document.getElementById('spinModalOverlay');
const largeSpinSelector = document.getElementById('largeSpinSelector');
const spinSelectorDot = document.getElementById('spinSelectorDot'); // El punto del modal grande
const smallSpinSelectorDot = document.getElementById('smallSpinSelectorDot'); // --- NUEVO: El punto de la miniatura

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
    if (!largeSpinSelector || !spinSelectorDot || !smallSpinSelectorDot) {
        return;
    }

    const rect = largeSpinSelector.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = clientX - centerX;
    let dy = clientY - centerY;

    const radius = rect.width / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > radius) {
        dx = (dx / dist) * radius;
        dy = (dy / dist) * radius;
    }

    spinOffsetState.x = dx / radius;
    spinOffsetState.y = -dy / radius; // Invertir Y porque en la UI +Y es hacia abajo

    // 1. Mover el punto del modal grande (usando transform para un movimiento suave)
    spinSelectorDot.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;

    // --- SOLUCIÓN: Mover el punto de la miniatura usando 'top' y 'left' para mayor precisión ---
    // Calculamos la posición como un porcentaje del contenedor padre.
    // 50% es el centro. Sumamos/restamos el offset (de -1 a 1) multiplicado por 50.
    smallSpinSelectorDot.style.left = `${50 + spinOffsetState.x * 50}%`;
    smallSpinSelectorDot.style.top = `${50 - spinOffsetState.y * 50}%`;
}

export function stopSpinDrag() {
    isDraggingSpinState = false;
    // --- NUEVO: Ocultar el modal cuando se suelta el clic ---
    hideSpinModal();
}

// --- Getters de Estado ---

export const isDraggingSpin = () => isDraggingSpinState;
export const getSpinOffset = () => spinOffsetState;