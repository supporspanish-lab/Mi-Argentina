
// --- Módulo de Medidor de Potencia ---

let powerPercent = 0;
let isDragging = false;
let dragStartY = 0;

export function initializePowerBar() {
    const powerBarContainer = document.getElementById('newPowerBarContainer');
    const powerBarHandle = document.getElementById('newPowerBarHandle');

    if (!powerBarContainer || !powerBarHandle) {
        console.error('Elementos de la barra de potencia no encontrados');
        return;
    }

    const updatePowerBar = (newPower) => {
        powerPercent = Math.max(0, Math.min(1, newPower));
        const displayPercent = powerPercent;
        const containerHeight = powerBarContainer.offsetHeight;
        const startPosition = containerHeight * 1.4;
        const topPosition = startPosition - (displayPercent * containerHeight);
        powerBarHandle.style.top = `${topPosition}px`;

        const percentageDisplay = document.getElementById('powerPercentageDisplay');
        if (percentageDisplay) {
            percentageDisplay.textContent = `${Math.round(displayPercent * 100)}%`;
        }

        // Enviar la actualización de la potencia al servidor
        window.dispatchEvent(new CustomEvent('sendpower', { detail: { power: powerPercent } }));
    };

    const onPointerDown = (e) => {
        isDragging = true;
        powerBarContainer.setPointerCapture(e.pointerId);
        e.preventDefault();
        dragStartY = e.clientY; // Guardar la posición Y inicial
        updatePowerBar(0);
    };

    const onPointerMove = (e) => {
        if (!isDragging) return;
        const rect = powerBarContainer.getBoundingClientRect();
        const containerHeight = rect.height;

        // Calcular la potencia en función de la distancia de arrastre
        const dragDistance = e.clientY - dragStartY;
        let newPower = dragDistance / containerHeight; // Arrastrar hacia abajo aumenta la potencia

        // Limitar el valor entre 0 y 1
        newPower = Math.max(0, Math.min(1, newPower));

        updatePowerBar(newPower);
    };

    const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        powerBarContainer.releasePointerCapture(e.pointerId);
        
        // Disparar con la potencia final
        window.shoot(powerPercent);

        // Animar la barra de vuelta a 0%
        powerBarHandle.style.transition = 'top 0.3s ease-out';
        updatePowerBar(0);
        setTimeout(() => {
            powerBarHandle.style.transition = '';
        }, 300);
    };

    powerBarContainer.addEventListener('pointerdown', onPointerDown);
    powerBarContainer.addEventListener('pointermove', onPointerMove);
    powerBarContainer.addEventListener('pointerup', onPointerUp);

    // Inicializar la barra de potencia
    updatePowerBar(0);
}

export function getPowerPercent() {
    return powerPercent;
}
