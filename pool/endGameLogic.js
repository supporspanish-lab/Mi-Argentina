import { setGameOver, showFoulMessage } from './gameState.js';
import { db, doc, getDoc, updateDoc, addDoc, collection } from './login/auth.js';

/**
 * Guarda el resultado de la partida para ambos jugadores en la colección 'gameResults'.
 * @param {string} winnerUid - UID del ganador.
 * @param {string} loserUid - UID del perdedor.
 * @param {number} betAmount - Monto de la apuesta.
 * @param {object} onlineGameData - Datos de la partida.
 */
async function guardarResultadoDePartida(winnerUid, loserUid, betAmount, onlineGameData) {
    console.log('guardarResultadoDePartida llamado con winnerUid:', winnerUid, 'loserUid:', loserUid);
    if (!winnerUid || !loserUid) {
        console.error("No se puede guardar el resultado: falta el UID del ganador o del perdedor.");
        return;
    }

    const winnerPlayerObject = (winnerUid === onlineGameData.player1?.uid) ? onlineGameData.player1 : onlineGameData.player2;
    const loserPlayerObject = (loserUid === onlineGameData.player1?.uid) ? onlineGameData.player1 : onlineGameData.player2;

    const winnerUsername = winnerPlayerObject?.username || 'Desconocido';
    const loserUsername = loserPlayerObject?.username || 'Desconocido';

    const winnerAvatar = winnerPlayerObject?.profileImageName ? `../imajenes/perfil/${winnerPlayerObject.profileImageName}` : '';
    const loserAvatar = loserPlayerObject?.profileImageName ? `../imajenes/perfil/${loserPlayerObject.profileImageName}` : '';

    const totalWinnings = betAmount * 2;
    const actualWinnerAmount = totalWinnings * 0.95; // 5% para la casa

    const resultData = {
        winnerUsername: winnerUsername,
        winnerAvatar: winnerAvatar,
        winnerAmount: actualWinnerAmount.toLocaleString('es-ES', { style: 'currency', currency: 'USD' }),
        loserUsername: loserUsername,
        loserAvatar: loserAvatar,
        loserAmount: betAmount.toLocaleString('es-ES', { style: 'currency', currency: 'USD' }),
        timestamp: Date.now()
    };

    console.log('Información del ganador obtenida:', resultData);

    try {
        await addDoc(collection(db, "gameResults"), { ...resultData, userUid: winnerUid });
        console.log("Resultado de la partida guardado para el ganador:", winnerUid);

        await addDoc(collection(db, "gameResults"), { ...resultData, userUid: loserUid });
        console.log("Resultado de la partida guardado para el perdedor:", loserUid);
    } catch (error) {
        console.error("Error al guardar los resultados de la partida:", error);
    }
}

/**
 * Maneja la lógica de fin de partida cuando se mete la bola 8.
 * @param {boolean} faltaCometida - Si se cometió una falta en el mismo tiro.
 * @param {object} gameRef - Referencia al documento del juego en Firestore.
 * @param {object} onlineGameData - Datos actuales de la partida.
 * @param {object} estadoInicialJuego - Estado del juego al inicio del turno.
 * @param {Array} balls - Array de todas las bolas del juego.
 */
export async function handleEndGame(faltaCometida, gameRef, onlineGameData, estadoInicialJuego, balls) {
    console.log('handleEndGame llamado con faltaCometida:', faltaCometida, 'jugadorActual:', estadoInicialJuego.currentPlayer);
    const {
        currentPlayer: jugadorActual,
        playerAssignments: playerAssignmentsAlInicioTurno,
        ballsAssigned: bolasAsignadasAlInicioTurno,
    } = estadoInicialJuego;

    const currentUsername = onlineGameData[`player${jugadorActual}`]?.username || `Jugador ${jugadorActual}`;

    if (faltaCometida) {
        // DERROTA: Se mete la bola 8 y se comete una falta.
        const loserUid = onlineGameData[`player${jugadorActual}`]?.uid;
        const winnerUid = (loserUid === onlineGameData.player1?.uid) ? onlineGameData.player2?.uid : onlineGameData.player1?.uid;
        await processGameEnd(winnerUid, loserUid, onlineGameData, gameRef, `Falta de ${currentUsername}: Metiste la bola 8 y cometiste una falta.`);
        return;
    }

    // Comprobar si el jugador tenía derecho a meter la 8.
    const tipoBolaJugador = playerAssignmentsAlInicioTurno[jugadorActual];
    let jugadorTieneBolasRestantes = false;
    if (bolasAsignadasAlInicioTurno && tipoBolaJugador) {
        jugadorTieneBolasRestantes = balls.some(ball => {
            if (!ball.isActive || ball.number === null || ball.number === 8) return false;
            const tipoBola = (ball.number >= 1 && ball.number <= 7) ? 'solids' : 'stripes';
            return tipoBola === tipoBolaJugador;
        });
    }

    if (jugadorTieneBolasRestantes || !bolasAsignadasAlInicioTurno) {
        // DERROTA: Se mete la bola 8 antes de tiempo.
        const loserUid = onlineGameData[`player${jugadorActual}`]?.uid;
        const winnerUid = (loserUid === onlineGameData.player1?.uid) ? onlineGameData.player2?.uid : onlineGameData.player1?.uid;
        await processGameEnd(winnerUid, loserUid, onlineGameData, gameRef, `Falta de ${currentUsername}: Metiste la bola 8 antes de tiempo.`);
    } else {
        // VICTORIA: Se mete la bola 8 legalmente.
        const winnerUid = onlineGameData[`player${jugadorActual}`]?.uid;
        const loserUid = (winnerUid === onlineGameData.player1?.uid) ? onlineGameData.player2?.uid : onlineGameData.player1?.uid;
        await processGameEnd(winnerUid, loserUid, onlineGameData, gameRef, `¡Felicidades, ${currentUsername} has ganado la partida!`);
    }
}

/**
 * Procesa el final de la partida, actualiza saldos y guarda resultados.
 * @param {string} winnerUid 
 * @param {string} loserUid 
 * @param {object} onlineGameData 
 * @param {object} gameRef 
 * @param {string} message 
 */
async function processGameEnd(winnerUid, loserUid, onlineGameData, gameRef, message) {
    console.log('processGameEnd: Ganador UID:', winnerUid, 'Perdedor UID:', loserUid);
    setGameOver(true);
    showFoulMessage(message, winnerUid); // Muestra el mensaje al ganador/perdedor según corresponda

    // Reproducir sonido de fin de partida
    const audio = new Audio('../audio/terminado.mp3');
    audio.play().catch(e => console.warn("Could not play end game sound:", e));

    const betAmount = onlineGameData.betAmount || 0;
    const totalWinnings = betAmount * 2;

    // 1. Actualizar saldos
    console.log('Antes de actualizar saldo');
    if (winnerUid) {
        const winnerDocRef = doc(db, "saldo", winnerUid);
        const winnerSnap = await getDoc(winnerDocRef);
        if (winnerSnap.exists()) {
            const currentBalance = winnerSnap.data().balance || 0;
            const winningsAfterDeduction = totalWinnings * 0.95; // 5% house rake
            await updateDoc(winnerDocRef, { balance: currentBalance + winningsAfterDeduction });
        }
    }
    console.log('Después de actualizar saldo');
    // No es necesario deducir del perdedor, ya se hizo al inicio de la partida.

    // 2. Guardar resultado para el modal de home.html
    console.log('Antes de guardar resultado');
    await guardarResultadoDePartida(winnerUid, loserUid, betAmount, onlineGameData);
    console.log('Después de guardar resultado');

    // 3. Guardar en historial de partidas
    console.log('Antes de guardar en historial');
    await addDoc(collection(db, "gameHistory"), {
        winnerUid,
        loserUid,
        amountWon: totalWinnings * 0.95,
        amountLost: betAmount,
        date: Date.now(),
        gameId: gameRef ? gameRef.id : null
    });
    console.log('Después de guardar en historial');

    // 4. Actualizar estado de la partida
    console.log('Antes de actualizar estado de la partida');
    if (gameRef) {
        await updateDoc(gameRef, {
            status: "ended",
            winner: winnerUid,
            loser: loserUid,
            endedAt: Date.now(),
            juegoTerminado: true
        });
    }
    console.log('Después de actualizar estado de la partida');
}
