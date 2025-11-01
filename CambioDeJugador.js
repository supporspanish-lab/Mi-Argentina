// --- Módulo de Cambio de Jugador ---
import { getGameState, setCurrentPlayer, startTurnTimer } from './gameState.js';
import { updateActivePlayerUI } from './ui.js';

/**
 * Decide si el turno debe cambiar y ejecuta las acciones necesarias.
 * @param {boolean} foulCommitted - True si se cometió una falta en el turno.
 * @param {boolean} playerPocketedOwnBall - True si el jugador metió una de sus bolas.
 */
export function handlePlayerSwitch(foulCommitted, playerPocketedOwnBall) {
    const { currentPlayer } = getGameState();

    let switchTurn = false;
    if (foulCommitted || !playerPocketedOwnBall) {
        switchTurn = true;
    }

    if (switchTurn) {
        const nextPlayer = currentPlayer === 1 ? 2 : 1;
        setCurrentPlayer(nextPlayer);
        updateActivePlayerUI(nextPlayer);
        // El temporizador se inicia automáticamente dentro de setCurrentPlayer.
    } else {
        // Si el jugador no cambia, simplemente se reinicia su temporizador para el siguiente tiro.
        startTurnTimer();
    }
}