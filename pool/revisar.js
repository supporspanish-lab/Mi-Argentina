// --- Módulo de Revisión ---
import { getGameState, showFoulMessage, setCurrentPlayer, setPlacingCueBall, clearPocketedBalls, clearFirstHitBall, handleTurnEnd } from './gameState.js';
import { balls, cueBall } from './ballManager.js';
import { playSound } from './audioManager.js';
import { TABLE_WIDTH, TABLE_HEIGHT, BALL_RADIUS } from './config.js';

/**
 * Función de prueba para revisar el estado antes de mostrar la UI.
 */
export function revisarEstado() {
    const gameState = getGameState();
    // --- CORRECCIÓN: Obtener el estado 'isLoading' ---
    const { currentPlayer, pocketedThisTurn, playerAssignments, firstBallHitThisTurn, ballsAssigned, isLoading } = gameState;

    // --- CORRECCIÓN: No revisar el estado si el juego todavía está en la fase de carga/calentamiento ---
    if (isLoading) return;

    // --- NUEVO: Detección de Faltas ---
    let foulCommitted = false; // Falta que solo cambia el turno
    let ballInHandFoul = false; // Falta que da "bola en mano" al oponente
    let foulReason = ""; // --- NUEVO: Variable para almacenar la razón de la falta

    // --- NUEVO: Falta 2: Meter la bola blanca ---
    const cueBallPocketed = pocketedThisTurn.some(ball => ball.number === null);
    if (cueBallPocketed) {
        foulCommitted = true; // Es una falta
        ballInHandFoul = true; // Y da bola en mano
        foulReason = "Has metido la bola blanca";
        // playSound('foul', 0.6);

        // Lógica para "bola en mano"
        setPlacingCueBall(true);
        if (cueBall) {
            cueBall.isPocketed = false;
            cueBall.pocketedState = null;
            cueBall.isActive = true; // Se activa para poder colocarla
            cueBall.mesh.visible = true;
            if (cueBall.shadowMesh) cueBall.shadowMesh.visible = true;
            cueBall.mesh.position.set(TABLE_WIDTH / 4, TABLE_HEIGHT / 2, BALL_RADIUS);
        }
    }

    // Falta 1: No se golpeó ninguna bola.
    if (!firstBallHitThisTurn && !ballInHandFoul) { // Evitar mostrar dos mensajes de falta
        foulCommitted = true;
        ballInHandFoul = true;
        foulReason = "La bola blanca no golpeó ninguna bola";
        // playSound('foul', 0.6); // --- NUEVO: Reproducir sonido de falta
    }

    // --- NUEVO: Falta 3: Golpear primero una bola del oponente ---
    // Esta regla solo se aplica si las bolas ya han sido asignadas.
    if (ballsAssigned && firstBallHitThisTurn && firstBallHitThisTurn.number !== 8 && !ballInHandFoul) {
        // Determinar el tipo de la primera bola golpeada
        const hitBallType = (firstBallHitThisTurn.number >= 1 && firstBallHitThisTurn.number <= 7) ? 'solids' : 'stripes';
        // Comprobar si no coincide con el tipo asignado al jugador actual
        if (hitBallType !== playerAssignments[currentPlayer]) {
            foulCommitted = true;
            ballInHandFoul = true;
            foulReason = "Golpeaste una bola del oponente primero";
            // playSound('foul', 0.6);
        }
    }

    // --- NUEVO: Falta 5: Golpear la bola 8 primero (si no es la última) ---
    if (firstBallHitThisTurn && firstBallHitThisTurn.number === 8 && !ballInHandFoul) {
        // Comprobar si al jugador todavía le quedan bolas en la mesa.
        const playerBallType = playerAssignments[currentPlayer];
        let playerHasBallsLeft = false;

        if (ballsAssigned && playerBallType) {
            playerHasBallsLeft = balls.some(ball => {
                if (!ball.isActive || ball.number === null || ball.number === 8) return false;
                const ballType = (ball.number >= 1 && ball.number <= 7) ? 'solids' : 'stripes';
                return ballType === playerBallType;
            });
        }

        // Es falta golpear la bola 8 si la mesa está abierta o si al jugador aún le quedan bolas.
        if (!ballsAssigned || playerHasBallsLeft) {
            foulCommitted = true;
            ballInHandFoul = true;
            foulReason = "Golpeaste la bola 8 antes de tiempo";
        }
    }

    // --- NUEVO: Falta 4: No meter ninguna bola tras un golpe legal ---
    // Si se ha golpeado una bola legalmente pero no se ha metido ninguna, es falta.
    // Esto se comprueba solo si no se ha cometido otra falta antes.
    if (!foulCommitted && !ballInHandFoul && firstBallHitThisTurn && pocketedThisTurn.length === 0) {
        foulCommitted = true;
        foulReason = "No has metido ninguna de tus bolas";
        // playSound('foul', 0.6);
    }

    // --- Lógica de cambio de turno ---
    const playerPocketedOwnBall = pocketedThisTurn.some(ball => {
        // Ignorar la bola blanca y la bola 8 para esta comprobación
        if (ball.number === null || ball.number === 8) return false;

        // --- CORRECCIÓN: Lógica para mesa abierta ---
        // Si las bolas aún no están asignadas, cualquier bola de color que se meta
        // permite al jugador continuar su turno.
        if (!ballsAssigned) {
            return true;
        }

        // Si las bolas ya están asignadas, comprobar que la bola metida es del tipo del jugador
        const ballType = (ball.number >= 1 && ball.number <= 7) ? 'solids' : 'stripes';
        return ballType === playerAssignments[currentPlayer];
    });

    let switchTurn = false;
    if (foulCommitted || !playerPocketedOwnBall) {
        switchTurn = true;
    }

    const nextPlayer = switchTurn ? (currentPlayer === 1 ? 2 : 1) : currentPlayer;

    if (switchTurn) {
        setCurrentPlayer(nextPlayer);
    }

    // --- NUEVO: Mostrar el mensaje de falta al final, si se cometió una ---
    if (foulCommitted && foulReason) {
        showFoulMessage(`Falta: ${foulReason}`);
    }

    // const turnIndicatorEl = document.getElementById('turnIndicator');
    // if (turnIndicatorEl) {
    //     turnIndicatorEl.textContent = `Turno del Jugador ${nextPlayer}`;
    //     turnIndicatorEl.style.borderColor = foulCommitted ? '#e74c3c' : '#3498db'; // Borde rojo si hay falta
    //     turnIndicatorEl.style.opacity = '1';
    //     turnIndicatorEl.style.transform = 'translate(-50%, -50%) scale(1)';

    //     setTimeout(() => {
    //         turnIndicatorEl.style.opacity = '0'; // Ocultar el indicador
    //         turnIndicatorEl.style.transform = 'translate(-50%, -50%) scale(0.8)';
    //     }, 2000);
    // }

    if (foulCommitted) {
        console.log(`%c[Revisar.js]%c ¡FALTA! ${foulReason}. Turno para Jugador ${nextPlayer}.`, 'background-color: #e74c3c; color: white; font-weight: bold; padding: 2px 6px; border-radius: 3px;', 'background-color: transparent; color: inherit;');
    } else {
        console.log(`%c[Revisar.js]%c ¡Revisando estado! Bolas quietas. Turno para Jugador ${nextPlayer}.`, 'background-color: #9b59b6; color: white; font-weight: bold; padding: 2px 6px; border-radius: 3px;', 'background-color: transparent; color: inherit;');
    }

    // --- CORRECCIÓN: La bola en mano solo se activa si la falta lo requiere ---
    if (ballInHandFoul && !cueBallPocketed) { // Si no se metió la blanca, pero es falta con bola en mano
        setPlacingCueBall(true);
    }

    // --- SOLUCIÓN: Limpiar el array de bolas entroneradas para el siguiente turno ---
    clearPocketedBalls();
    clearFirstHitBall();

    // --- SOLUCIÓN DEFINITIVA: Marcar el tiro como finalizado para desbloquear el siguiente turno ---
    handleTurnEnd();
}