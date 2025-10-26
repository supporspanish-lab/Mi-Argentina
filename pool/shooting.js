// --- Módulo de Disparo ---
import * as THREE from 'three';
import { areBallsMoving } from './fisicas.js';
import { getGameState, startShot, setPlacingCueBall } from './gameState.js';
import { playSound } from './audioManager.js';
import { cueBall, getSceneBalls } from './ballManager.js';
import { animateCueShot } from './aiming.js';
import { getSpinOffset } from './spinControls.js';

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
    const maxPower = 300 * 40;
    const SAFE_POWER_THRESHOLD = maxPower * 0.9;
    let power = shotPower * maxPower;

    if (power > SAFE_POWER_THRESHOLD && shotPower < 1.0) {
        const excessPower = power - SAFE_POWER_THRESHOLD;
        power = SAFE_POWER_THRESHOLD + Math.log1p(excessPower) * (maxPower / 50);
    }

    const currentShotAngle = window.currentShotAngle || 0;
    const impulseDirection = new THREE.Vector2(Math.cos(currentShotAngle), Math.sin(currentShotAngle));
    const velocityFactor = 2.5;

    isShooting = true;

    animateCueShot(currentShotAngle, shotPower, (powerForCallback = 0) => { // --- SOLUCIÓN: Añadir valor por defecto
        if (areBallsMoving(getSceneBalls())) return;

        cueBall.vx = impulseDirection.x * (power / 1000) * velocityFactor;
        cueBall.vy = impulseDirection.y * (power / 1000) * velocityFactor;
        cueBall.initialVx = cueBall.vx;
        cueBall.initialVy = cueBall.vy;
        cueBall.spin = { ...getSpinOffset() };

        const shakeIntensity = Math.pow(powerForCallback, 2) * 2.5;
        const shakeDuration = 0.15;
        window.triggerScreenShake(shakeIntensity, shakeDuration);

        if ('vibrate' in navigator) {
            const vibrationDuration = Math.max(50, Math.floor(powerForCallback * 150));
            navigator.vibrate(vibrationDuration);
        }

        startShot();
        playSound('cueHit', Math.pow(powerForCallback, 2) * 0.9);

        // Resetear estado
        isShooting = false;
    });
}