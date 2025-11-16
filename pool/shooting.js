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
    const gameState = getGameState();
    // --- CORRECCIÓN: No permitir disparar si no es el turno del jugador o si ya hay un tiro en progreso.
    if (isShooting || gameState.shotInProgress || gameState.currentPlayerUid !== auth.currentUser?.uid) {
        return;
    }


    if (!isFinite(powerPercent) || powerPercent < 0) {
        // console.warn(`Intento de disparo con potencia inválida: ${powerPercent}. Se usará 0.`);
        powerPercent = 0;
    }

    const shotPower = powerPercent;
    if (shotPower <= 0.01) {
        return; // No disparar si no hay potencia
    }

    if (gameState.isPlacingCueBall) {
        // La validación de posición se hace en cuePlacement.js
        // Aquí asumimos que si se dispara, la posición es válida.
        setPlacingCueBall(false);
        // --- CORRECCIÓN: No activar la bola aquí. El servidor lo hará.
    }

    const currentShotAngle = getCurrentShotAngle();
    isShooting = true;

    // --- SOLUCIÓN: En lugar de aplicar la física, disparamos un evento con los datos del tiro.
    // El listener en index.html se encargará de enviarlo a Firebase.
    import('./spinControls.js').then(({ getSpinOffset }) => {
        const spin = getSpinOffset();
        
        const shotData = {
            angle: currentShotAngle,
            power: powerPercent,
            spin: spin,
            // Enviar la posición de la bola blanca en el momento del disparo
            cueBallStartPos: { x: cueBall.mesh.position.x, y: cueBall.mesh.position.y }
        };

        // Disparamos un evento global que será capturado para enviar los datos al servidor.
        window.dispatchEvent(new CustomEvent('sendShot', { detail: { ...shotData, gameState: getGameState() } }));

        // Aplicar el disparo localmente para el jugador que dispara, para una respuesta inmediata.
        window.applyLocalShot(currentShotAngle, powerPercent, spin, { x: cueBall.mesh.position.x, y: cueBall.mesh.position.y });

        // Marcar el tiro como procesado para evitar que se aplique de nuevo desde el servidor.
        window.lastProcessedShotTimestamp = shotData.timestamp;

        // Reproducir sonido localmente para una respuesta inmediata al jugador que dispara.
        playSound('cueHit', 1.0);
        isShooting = false; // Resetear estado de disparo
    });
}