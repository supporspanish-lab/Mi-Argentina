// --- Módulo de Disparo ---
import * as THREE from 'three';
import { areBallsMoving, updateBallPositions } from './fisicas.js';
import { getGameState, startShot, setPlacingCueBall } from './gameState.js';
import { playSound } from './audioManager.js';
import { cueBall, getSceneBalls } from './ballManager.js';
import { animateCueShot } from './aiming.js';
import { getCurrentShotAngle } from './inputManager.js';

let isShooting = false;

/**
 * Función centralizada para realizar el disparo.
 * @param {number} powerPercent - La potencia del tiro, de 0 a 1.
 */
export function shoot(powerPercent) {
    // --- LOG: Indica el inicio de la función de disparo.
    if (isShooting) return;

    if (!isFinite(powerPercent) || powerPercent < 0) {
        // console.warn(`Intento de disparo con potencia inválida: ${powerPercent}. Se usará 0.`);
        powerPercent = 0;
    }

    const shotPower = powerPercent;
    if (shotPower <= 0.01) {
        return; // No disparar si no hay potencia
    }

    const gameState = getGameState();
    if (gameState.isPlacingCueBall) {
        // La validación de posición se hace en cuePlacement.js
        // Aquí asumimos que si se dispara, la posición es válida.
        setPlacingCueBall(false);
        cueBall.isActive = true;
    }

    // Amortiguar la potencia en tiros extremos para evitar inestabilidad.
    const maxPower = 300 * 25; // --- AJUSTE: Reducido de 40 a 32 para bajar la fuerza máxima.
    const SAFE_POWER_THRESHOLD = maxPower * 0.9;
    let power = shotPower * maxPower;

    if (power > SAFE_POWER_THRESHOLD && shotPower < 1.0) {
        const excessPower = power - SAFE_POWER_THRESHOLD;
        power = SAFE_POWER_THRESHOLD + Math.log1p(excessPower) * (maxPower / 50);
    }

    const currentShotAngle = getCurrentShotAngle();
    const impulseDirection = new THREE.Vector2(Math.cos(currentShotAngle), Math.sin(currentShotAngle));
    const velocityFactor = 2.5;
    isShooting = true;

    // --- CORRECCIÓN: Enviar los datos del tiro al servidor en lugar de aplicarlos localmente ---
    import('./spinControls.js').then(({ getSpinOffset }) => {
        const spin = getSpinOffset();

        const shotData = {
            angle: currentShotAngle,
            power: shotPower,
            spin: spin,
            cueBallStartPos: { x: cueBall.mesh.position.x, y: cueBall.mesh.position.y }
        };

        // --- CORRECCIÓN: Aplicar el tiro localmente de inmediato (Client-Side Prediction) ---
        // Esto elimina el lag para el jugador que dispara.
        window.applyLocalShot(shotData.angle, shotData.power, shotData.spin, shotData.cueBallStartPos);

        // --- Enviar los datos del tiro al servidor para el oponente ---
        window.dispatchEvent(new CustomEvent('sendsingleplayer', { detail: shotData }));

        isShooting = false; // Reseteamos el estado de disparo
    });
}