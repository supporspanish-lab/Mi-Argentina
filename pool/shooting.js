// --- Módulo de Disparo ---
import * as THREE from 'three';
import { areBallsMoving, updateBallPositions } from './fisicas.js';
import { getGameState, startShot, setPlacingCueBall, getOnlineGameData } from './gameState.js';
import { playSound } from './audioManager.js';
import { cueBall, getSceneBalls } from './ballManager.js';
import { animateCueShot } from './aiming.js';
import { getCurrentShotAngle } from './inputManager.js';
import { auth, updateDoc, doc } from './login/auth.js'; // Importar auth, updateDoc, doc
import { getGameRef } from './pool.js'; // Importar getGameRef desde pool.js

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
    const maxPower = 7; // Potencia máxima ajustada a 1 para una fuerza mínima.
    const SAFE_POWER_THRESHOLD = maxPower * 0.9;
    let power = shotPower * maxPower;

   

    const currentShotAngle = getCurrentShotAngle();
    const impulseDirection = new THREE.Vector2(Math.cos(currentShotAngle), Math.sin(currentShotAngle));
    const velocityFactor = 2.5; // Use this factor
    isShooting = true;

    // Apply the shot locally for testing
    cueBall.vx = impulseDirection.x * power * velocityFactor;
    cueBall.vy = impulseDirection.y * power * velocityFactor;

    // Store initial velocities for spin calculations in fisicas.js
    cueBall.initialVx = cueBall.vx;
    cueBall.initialVy = cueBall.vy;

    // Apply spin if any
    import('./spinControls.js').then(({ getSpinOffset }) => {
        const spin = getSpinOffset();
        cueBall.spin = { x: spin.x, y: spin.y };

        // --- NUEVO: Enviar los datos del tiro a Firebase ---
        const gameRef = getGameRef(getOnlineGameData().gameId); // Obtener la referencia del juego
        if (gameRef && auth.currentUser) {
            const shotData = {
                angle: currentShotAngle,
                power: powerPercent,
                spin: spin,
                cueBallStartPos: { x: cueBall.mesh.position.x, y: cueBall.mesh.position.y },
                playerUid: auth.currentUser.uid,
                timestamp: Date.now()
            };
            updateDoc(gameRef, { lastShot: shotData }).catch(err => console.error("Error al enviar lastShot a Firebase:", err));
        }
    });

    playSound('cueHit', 1.0); // Play sound for local shot
    isShooting = false; // Reset shooting state
}