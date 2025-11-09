// --- Módulo de Disparo ---
import * as THREE from 'three';
import { areBallsMoving, updateBallPositions } from './fisicas.js';
import { getGameState, startShot, setPlacingCueBall, getOnlineGameData } from './gameState.js';
import { playSound } from './audioManager.js';
import { cueBall, getSceneBalls } from './ballManager.js';
import { animateCueShot } from './aiming.js';
import { getCurrentShotAngle } from './inputManager.js';
import { auth } from './login/auth.js';

let isShooting = false;

/**
 * Función centralizada para realizar el disparo.
 * @param {number} powerPercent - La potencia del tiro, de 0 a 1.
 */
export function shoot(powerPercent) {
    // --- LOG: Indica el inicio de la función de disparo.
    if (isShooting) return;

    startShot(); // --- FIX: Reiniciar el estado del tiro aquí.

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
    const maxPower = 100 * 112.5; // --- AJUSTE: Aumentado de 37.5 a 112.5 para triplicar la fuerza máxima.
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

        // --- NUEVO: Verificar si es el turno del jugador actual antes de enviar el tiro al servidor ---
        const onlineGameData = getOnlineGameData();
        const myUid = auth.currentUser?.uid;
        if (onlineGameData.currentPlayerUid !== myUid) {
            console.warn("Intento de disparo de un jugador que no tiene el turno. Tiro no enviado al servidor.");
            isShooting = false; // Reseteamos el estado de disparo
            return; // No enviar el tiro al servidor
        }

        // --- MODIFICADO: No aplicar el tiro localmente, esperar al servidor ---
        // window.applyLocalShot(shotData.angle, shotData.power, shotData.spin, shotData.cueBallStartPos);

        // --- Enviar los datos del tiro al servidor para el oponente ---
        window.dispatchEvent(new CustomEvent('sendShot', { 
            detail: {
                ...shotData,
                gameState: gameState
            } 
        }));

        isShooting = false; // Reseteamos el estado de disparo
    });
}