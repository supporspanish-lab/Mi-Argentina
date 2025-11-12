import { getGameState, setPlacingCueBall, showFoulMessage, clearPocketedBalls, clearFirstHitBall, assignPlayerTypes, setBallsAssigned, completeFirstTurn, setShotInProgress } from './gameState.js';
import { handlePlayerSwitch } from './CambioDeJugador.js';
import { cueBall, balls, resetBall, getBallByNumber } from './ballManager.js';
import { updateGameData } from './login/home-ecensiales/firebaseService.js';

// Variable para asegurar que la revisión se ejecute solo una vez por turno.
let revisionInProgress = false;

/**
 * Revisa el estado del juego al final de un tiro para determinar faltas,
 * asignación de bolas y cambio de turno.
 */
export async function revisarFinDeTiro() {
    if (revisionInProgress) return;
    revisionInProgress = true;

    const {
        gameId,
        myUid,
        currentPlayer,
        playerAssignments,
        ballsAssigned,
        firstBallHitThisTurn,
        pocketedThisTurn,
        isFirstTurn
    } = getGameState();

    let foulCommitted = false;
    let foulReason = "";
    let playerPocketedOwnBall = false;
    let turnData = {};

    const myPlayerNumber = getGameState().player1.uid === myUid ? 1 : 2;

    // Si no es mi turno, no proceso las faltas.
    if (currentPlayer !== myPlayerNumber) {
        revisionInProgress = false;
        return;
    }

    // --- Lógica de Faltas ---

    // 1. Falta: Golpear la bola 8 prematuramente.
    if (firstBallHitThisTurn && firstBallHitThisTurn.number === 8 && ballsAssigned) {
        const playerBallsLeft = balls.filter(b =>
            b.type === playerAssignments[currentPlayer] && !b.isPocketed
        ).length;
        if (playerBallsLeft > 0) {
            foulCommitted = true;
            foulReason = "Falta: No se puede golpear la bola 8 primero.";
        }
    }

    // 2. Falta: No golpear ninguna bola.
    if (!firstBallHitThisTurn && !foulCommitted) {
        foulCommitted = true;
        foulReason = "Falta: No se golpeó ninguna bola.";
    }

    // 3. Falta: Golpear primero una bola que no es tuya.
    if (firstBallHitThisTurn && ballsAssigned && !foulCommitted) {
        const playerBallType = playerAssignments[currentPlayer];
        if (firstBallHitThisTurn.type !== playerBallType && firstBallHitThisTurn.number !== 8) {
            foulCommitted = true;
            foulReason = "Falta: Golpeaste una bola del oponente primero.";
        }
    }

    // --- Revisión de Bolas Metidas ---
    const pocketedMyBalls = [];
    const pocketedOpponentBalls = [];
    let pocketed8Ball = false;
    let pocketedCueBall = false;

    for (const ball of pocketedThisTurn) {
        if (ball.number === 0) {
            pocketedCueBall = true;
            continue;
        }
        if (ball.number === 8) {
            pocketed8Ball = true;
            continue;
        }

        if (ballsAssigned) {
            if (ball.type === playerAssignments[currentPlayer]) {
                pocketedMyBalls.push(ball);
            } else {
                pocketedOpponentBalls.push(ball);
            }
        }
    }

    // --- NUEVA REGLA DE FALTA (Añadida por solicitud) ---
    // 4. Falta: Meter bola del oponente sin meter una propia.
    if (pocketedOpponentBalls.length > 0 && pocketedMyBalls.length === 0 && !foulCommitted) {
        foulCommitted = true;
        foulReason = "Falta: Metiste una bola del oponente sin meter una tuya.";
    }

    // 5. Falta: Meter bola propia Y bola del oponente en el mismo tiro.
    if (pocketedMyBalls.length > 0 && pocketedOpponentBalls.length > 0 && !foulCommitted) {
        foulCommitted = true;
        foulReason = "Falta: Metiste una bola tuya y del oponente.";
    }


    // 6. Falta: Meter la bola blanca.
    if (pocketedCueBall && !foulCommitted) {
        foulCommitted = true;
        foulReason = "Falta: Metiste la bola blanca.";
    }

    // --- Lógica de Fin de Partida por Bola 8 ---
    if (pocketed8Ball) {
        const playerBallsLeft = balls.filter(b =>
            b.type === playerAssignments[currentPlayer] && !b.isPocketed
        ).length;

        if (foulCommitted || playerBallsLeft > 0) {
            // Pierde el jugador actual
            turnData.winner = currentPlayer === 1 ? 2 : 1;
            foulReason = foulCommitted ? `Perdiste: Metiste la bola 8 cometiendo falta (${foulReason})` : "Perdiste: Metiste la bola 8 antes de tiempo.";
        } else {
            // Gana el jugador actual
            turnData.winner = currentPlayer;
        }
        turnData.gameOver = true;
        foulCommitted = true; // Para forzar el cambio de turno y fin de juego
    }


    // --- Consecuencias de la Falta ---
    if (foulCommitted) {
        showFoulMessage(foulReason);
        if (!turnData.gameOver) {
            setPlacingCueBall(true); // El oponente tiene bola en mano
            resetBall(cueBall); // Coloca la bola blanca en su posición inicial para ser movida
            turnData.cueBallPosition = { x: cueBall.x, y: cueBall.y };
            turnData.isPlacingCueBall = true;
        }
    }

    // Determinar si el jugador metió una de sus bolas para saber si continúa el turno
    playerPocketedOwnBall = pocketedMyBalls.length > 0;

    // --- Asignación de Bolas (si no están asignadas) ---
    if (!ballsAssigned && pocketedThisTurn.length > 0 && !pocketedCueBall) {
        const firstPocketed = pocketedThisTurn.find(b => b.number > 0 && b.number < 8 || b.number > 8);
        if (firstPocketed) {
            const type = firstPocketed.type;
            const assignment = assignPlayerTypes(currentPlayer, type, playerAssignments, ballsAssigned);
            turnData.playerAssignments = assignment.playerAssignments;
            turnData.ballsAssigned = assignment.ballsAssigned;
        }
    }

    // --- Cambio de Jugador ---
    handlePlayerSwitch(foulCommitted, playerPocketedOwnBall);
    const nextPlayer = (foulCommitted || !playerPocketedOwnBall) ? (currentPlayer === 1 ? 2 : 1) : currentPlayer;
    turnData.currentPlayerUid = getGameState()[`player${nextPlayer}`].uid;


    // Limpiar estado para el próximo turno
    clearPocketedBalls();
    clearFirstHitBall();
    if (isFirstTurn) completeFirstTurn();

    // Actualizar estado en Firebase
    if (gameId) {
        await updateGameData(gameId, turnData);
    }

    // Permitir la siguiente revisión
    revisionInProgress = false;
    setShotInProgress(false);
}