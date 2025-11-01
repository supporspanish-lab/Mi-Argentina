// --- Módulo de Revisión ---
import { getGameState, showFoulMessage, setCurrentPlayer, setPlacingCueBall, clearPocketedBalls, clearFirstHitBall, handleTurnEnd, isTurnTimerActive, startTurnTimer, setGameOver, setBallsAssigned, assignPlayerTypes, completeFirstTurn } from './gameState.js';
import { balls, cueBall } from './ballManager.js';
import { updateActivePlayerUI } from './ui.js';
import { playSound } from './audioManager.js';
import { TABLE_WIDTH, TABLE_HEIGHT, BALL_RADIUS } from './config.js';

/**
 * Función de prueba para revisar el estado antes de mostrar la UI.
 */
export function revisarEstado(faltaPorTiempo = false, gameRef = null) {
    // --- SOLUCIÓN: Obtener el estado inicial y mantenerlo separado.
    const estadoInicialJuego = getGameState();
    const { 
        currentPlayer: jugadorActual, 
        pocketedThisTurn: bolasEntroneradasEsteTurno, 
        firstBallHitThisTurn: primeraBolaGolpeadaEsteTurno, 
        ballsAssigned: bolasAsignadasAlInicioTurno, 
        isLoading: estaCargando, 
        gameOver: juegoTerminado, // --- NUEVO: Obtener el estado de fin de partida
        isFirstTurn: esPrimerTurno // --- NUEVO: Obtener la bandera del primer turno.
    } = estadoInicialJuego;
   
    // Muestra si el turno terminó porque el contador llegó a cero.
    console.log("Variable 'faltaPorTiempo':", faltaPorTiempo);
    // --- SOLUCIÓN: Procesar la asignación de bolas ANTES de comprobar las faltas.
    // Si la mesa está abierta y se ha metido una bola de color, se asignan los grupos inmediatamente.
    if (!bolasAsignadasAlInicioTurno && bolasEntroneradasEsteTurno.length > 0) {
        const primeraBolaObjetivoEntronerada = bolasEntroneradasEsteTurno.find(b => b.number !== null && b.number !== 8);
        if (primeraBolaObjetivoEntronerada) {
            const tipo = (primeraBolaObjetivoEntronerada.number >= 1 && primeraBolaObjetivoEntronerada.number <= 7) ? 'solids' : 'stripes';
            assignPlayerTypes(jugadorActual, tipo);
        }
    }

    // --- NUEVO: Detección de Faltas ---
    let faltaCometida = false; // Falta que solo cambia el turno
    let faltaConBolaEnMano = false; // Falta que da "bola en mano" al oponente
    let motivoFalta = ""; // --- NUEVO: Variable para almacenar la razón de la falta

    // --- FALTA AÑADIDA: Tiempo agotado ---
    if (faltaPorTiempo) {
        faltaCometida = true;
        // En modo offline, sí da bola en mano.
        faltaConBolaEnMano = true;
        motivoFalta = "Se agotó el tiempo";
    }

    // --- FALTA AÑADIDA: No golpear ninguna bola ---
    // Se comprueba solo si no se ha cometido otra falta antes.
    if (!primeraBolaGolpeadaEsteTurno && !faltaConBolaEnMano) {
        faltaCometida = true;
        faltaConBolaEnMano = true; // No golpear ninguna bola da "bola en mano".
        motivoFalta = "No se golpeó ninguna bola";
    }

    // --- FALTA AÑADIDA: Meter la bola blanca ---
    const bolaBlancaEntronerada = bolasEntroneradasEsteTurno.some(ball => ball.number === null);
    if (bolaBlancaEntronerada) {
        faltaCometida = true;
        faltaConBolaEnMano = true;
        motivoFalta = "Metiste la bola blanca";

        // Lógica para "bola en mano": reposicionar la bola blanca.
        setPlacingCueBall(true);
        if (cueBall) {
            cueBall.isPocketed = false;
            cueBall.pocketedState = null;
            cueBall.isActive = true; // Se activa para poder colocarla.
            cueBall.mesh.visible = true; // Asegurar que vuelva a ser blanca
            // --- CORRECCIÓN: Frenar la bola blanca completamente al reposicionarla.
            cueBall.vx = 0;
            cueBall.vy = 0;
            if (cueBall.shadowMesh) cueBall.shadowMesh.visible = true;
            // La bola aparece en la zona de saque inicial.
            cueBall.mesh.position.set(TABLE_WIDTH / 4, TABLE_HEIGHT / 2, BALL_RADIUS);
            if (cueBall.shadowMesh) cueBall.shadowMesh.position.set(TABLE_WIDTH / 4, TABLE_HEIGHT / 2, 0.1);
        }
    }

    // --- CORRECCIÓN: Volver a obtener el estado actualizado DESPUÉS de la posible asignación de bolas.
    const estadoActualJuego = getGameState();

    // --- FALTA AÑADIDA: Golpear primero una bola del oponente ---
    // Esta regla solo se aplica si las bolas ya han sido asignadas y no se ha cometido otra falta con bola en mano.
    // --- CORRECCIÓN: La falta solo aplica si las bolas ya estaban asignadas ANTES del turno actual.
    const bolasYaEstabanAsignadas = bolasAsignadasAlInicioTurno === true;
    if (bolasYaEstabanAsignadas && primeraBolaGolpeadaEsteTurno && primeraBolaGolpeadaEsteTurno.number !== 8 && !faltaConBolaEnMano) {
        // Determinar el tipo de la primera bola golpeada
        const tipoBolaGolpeada = (primeraBolaGolpeadaEsteTurno.number >= 1 && primeraBolaGolpeadaEsteTurno.number <= 7) ? 'solids' : 'stripes';
        
        // Comprobar si no coincide con el tipo asignado al jugador actual
        if (tipoBolaGolpeada !== estadoActualJuego.playerAssignments[jugadorActual]) {
            faltaCometida = true;
            faltaConBolaEnMano = true;
            motivoFalta = "Golpeaste una bola del oponente primero";
        }
    }

    // --- NUEVA FALTA: Golpear la bola 8 primero (si no es la última) ---
    if (primeraBolaGolpeadaEsteTurno && primeraBolaGolpeadaEsteTurno.number === 8 && !faltaConBolaEnMano) {
        // Comprobar si al jugador todavía le quedan bolas en la mesa.
        const tipoBolaJugador = estadoActualJuego.playerAssignments[jugadorActual];
        let jugadorTieneBolasRestantes = false;

        if (estadoActualJuego.ballsAssigned && tipoBolaJugador) {
            jugadorTieneBolasRestantes = balls.some(ball => {
                if (!ball.isActive || ball.number === null || ball.number === 8) return false;
                const tipoBola = (ball.number >= 1 && ball.number <= 7) ? 'solids' : 'stripes';
                return tipoBola === tipoBolaJugador;
            });
        }

        // Es falta golpear la bola 8 si la mesa está abierta o si al jugador aún le quedan bolas.
        if (!estadoActualJuego.ballsAssigned || jugadorTieneBolasRestantes) {
            faltaCometida = true;
            faltaConBolaEnMano = true;
            motivoFalta = "Golpeaste la bola 8 antes de tiempo";
        }
    }

   
    // --- SOLUCIÓN: Lógica de Victoria/Derrota al meter la bola 8 ---
    const bola8Entronerada = bolasEntroneradasEsteTurno.some(ball => ball.number === 8);
    if (bola8Entronerada) {
        if (faltaCometida) {
            // Si se comete cualquier falta al meter la bola 8, se pierde la partida.
            setGameOver(true);
            showFoulMessage(`¡Has perdido! Metiste la bola 8 y cometiste una falta.`);
        } else {
            // No hay falta. Comprobar si el jugador tenía derecho a meter la 8.
            const tipoBolaJugador = estadoActualJuego.playerAssignments[jugadorActual];
            let jugadorTieneBolasRestantes = false;
            if (estadoActualJuego.ballsAssigned && tipoBolaJugador) {
                jugadorTieneBolasRestantes = balls.some(ball => {
                    if (!ball.isActive || ball.number === null || ball.number === 8) return false;
                    const tipoBola = (ball.number >= 1 && ball.number <= 7) ? 'solids' : 'stripes';
                    return tipoBola === tipoBolaJugador;
                });
            }
            if (jugadorTieneBolasRestantes || !estadoActualJuego.ballsAssigned) {
                // Si aún le quedaban bolas o la mesa estaba abierta, pierde.
                setGameOver(true);
                showFoulMessage(`¡Has perdido! Metiste la bola 8 antes de tiempo.`);
            } else {
                // ¡El jugador ha ganado!
                setGameOver(true);
                showFoulMessage(`¡Felicidades, has ganado la partida!`);
            }
        }
    }

    // --- Lógica de cambio de turno ---
    const jugadorEntroneroSuBola = bolasEntroneradasEsteTurno.some(ball => {
        // Ignorar la bola blanca y la bola 8 para esta comprobación
        if (ball.number === null || ball.number === 8) return false;

        // --- CORRECCIÓN: Lógica para mesa abierta ---
        // Si las bolas aún no están asignadas, cualquier bola de color que se meta
        // permite al jugador continuar su turno.
        if (!bolasAsignadasAlInicioTurno) {
            return true;
        }

        // Si las bolas ya están asignadas, comprobar que la bola metida es del tipo del jugador
        const tipoBola = (ball.number >= 1 && ball.number <= 7) ? 'solids' : 'stripes';
        return tipoBola === estadoActualJuego.playerAssignments[jugadorActual];
    });

    // --- LÓGICA DE CAMBIO DE TURNO ---

    // --- NUEVO: Si es el inicio de la partida, elegir un jugador al azar.
    // Se detecta el inicio si no se ha golpeado ninguna bola y no se ha entronerado ninguna.
    // --- CORRECCIÓN: Usar la nueva bandera 'esPrimerTurno' para asegurar que solo se ejecute una vez.
    if (esPrimerTurno) {
        const jugadorInicial = Math.random() < 0.5 ? 1 : 2;
        // --- MODIFICADO: En online, el creador de la partida ya decidió quién empieza.
        if (gameRef && onlineGameData) {
            // En online, el estado ya está en el servidor, solo lo leemos.
            // La UI se actualizará automáticamente desde pool.js
        } else {
            // En offline, sí asignamos el jugador inicial.
            setCurrentPlayer(jugadorInicial);
            updateActivePlayerUI(jugadorInicial);
        }
        completeFirstTurn(); // Marcar que el primer turno ya ha sido asignado.
    } else {
        // Lógica normal de cambio de turno para el resto de la partida.
        let cambiarTurno = false;
        // El turno cambia si se cometió una falta O si no se metió una bola propia.
        if (faltaCometida || !jugadorEntroneroSuBola) {
            cambiarTurno = true;
        }

        if (cambiarTurno) {
            const siguienteJugador = jugadorActual === 1 ? 2 : 1;
            setCurrentPlayer(siguienteJugador);
            updateActivePlayerUI(siguienteJugador);
        } else {
            // Si el jugador no cambia, solo actualizamos las posiciones de las bolas
            // --- CORRECCIÓN: Al continuar el turno, nos aseguramos de que no haya "bola en mano" ---
            startTurnTimer(); // Reiniciar temporizador en modo offline
        }
    }

    // --- CORRECCIÓN: Mostrar el mensaje de falta DESPUÉS de haber procesado el cambio de turno.
    if (faltaCometida && motivoFalta) { // Solo mostrar localmente en modo offline
        showFoulMessage(`Falta: ${motivoFalta}`);
    }

    // --- CORRECCIÓN: La bola en mano solo se activa si la falta lo requiere ---
    if (faltaConBolaEnMano && !bolaBlancaEntronerada) { // Si no se metió la blanca, pero es falta con bola en mano
        setPlacingCueBall(true);
    }

    // --- CORRECCIÓN: Limpiar el estado del tiro DESPUÉS de haberlo revisado todo.
    // Esto asegura que la información del turno (como la primera bola golpeada) esté disponible durante toda la función.
    handleTurnEnd();

    // --- SOLUCIÓN: Limpiar el array de bolas entroneradas para el siguiente turno ---
    clearPocketedBalls();
    clearFirstHitBall();
}