// --- Módulo de Revisión ---
import { getGameState, showFoulMessage, setCurrentPlayer, setPlacingCueBall, clearPocketedBalls, clearFirstHitBall, handleTurnEnd, isTurnTimerActive, startTurnTimer, setGameOver, setBallsAssigned, assignPlayerTypes, completeFirstTurn, getOnlineGameData, setOnlineGameData } from './gameState.js';
import { balls, cueBall } from './ballManager.js';
import { updateActivePlayerUI } from './ui.js';
import { playSound } from './audioManager.js';
import { TABLE_WIDTH, TABLE_HEIGHT, BALL_RADIUS } from './config.js';

/**
 * Función de prueba para revisar el estado antes de mostrar la UI.
 */
export async function revisarEstado(faltaPorTiempo = false, gameRef = null, onlineGameData = null) {
    // --- SOLUCIÓN: Obtener el estado inicial y mantenerlo separado.
    const estadoInicialJuego = getGameState();
        let {
            currentPlayer: jugadorActual, 
            pocketedThisTurn: bolasEntroneradasEsteTurno, 
            firstBallHitThisTurn: primeraBolaGolpeadaEsteTurno, 
            ballsAssigned: bolasAsignadasAlInicioTurno, 
            playerAssignments: playerAssignmentsAlInicioTurno,
            isLoading: estaCargando, 
            gameOver: juegoTerminado, // --- NUEVO: Obtener el estado de fin de partida
            isFirstTurn: esPrimerTurno // --- NUEVO: Obtener la bandera del primer turno.
            } = estadoInicialJuego;    // Muestra si el turno terminó porque el contador llegó a cero.

        const bolasAsignadasAntesDelTurno = bolasAsignadasAlInicioTurno; // Guardar el estado inicial de asignación de bolas.

            const playerAssignmentsAntesDelTurno = { ...playerAssignmentsAlInicioTurno }; // Guardar las asignaciones iniciales.

            let acabaDeAsignar = false; // --- FIX: Bandera para saber si la asignación ocurrió en ESTE turno.

        

            // --- CORRECCIÓN: Asegurar que bolasAsignadasAlInicioTurno sea false si no hay asignaciones.

            // Esto maneja el caso en que el estado de Firestore podría estar inconsistente.

            if (bolasAsignadasAlInicioTurno && Object.values(playerAssignmentsAlInicioTurno).every(assignment => assignment === null)) {

                bolasAsignadasAlInicioTurno = false;

            }

        

            // --- SOLUCIÓN: Procesar la asignación de bolas ANTES de comprobar las faltas.

            // Si la mesa está abierta y se ha metido una bola de color, se asignan los grupos inmediatamente.

            if (!bolasAsignadasAntesDelTurno && bolasEntroneradasEsteTurno.length > 0) {

                const primeraBolaObjetivoEntronerada = bolasEntroneradasEsteTurno.find(b => b.number !== null && b.number !== 8);

                if (primeraBolaObjetivoEntronerada) {

                    acabaDeAsignar = true; // --- FIX: Marcar que la asignación ocurrió ahora.

                    const tipo = (primeraBolaObjetivoEntronerada.number >= 1 && primeraBolaObjetivoEntronerada.number <= 7) ? 'solids' : 'stripes';

                    const { playerAssignments: nuevosPlayerAssignments, ballsAssigned: nuevasBolasAsignadas } = assignPlayerTypes(jugadorActual, tipo, playerAssignmentsAlInicioTurno, bolasAsignadasAlInicioTurno);

                    playerAssignmentsAlInicioTurno = nuevosPlayerAssignments;

                    bolasAsignadasAlInicioTurno = nuevasBolasAsignadas;

        

                    console.log(`Bola ${primeraBolaObjetivoEntronerada.number} entronerada. Jugador actual: ${jugadorActual}. Tu tipo de bola es: ${nuevosPlayerAssignments[jugadorActual]}.`);

                }

            }

        

            // --- NUEVO: Detección de Faltas ---

            let faltaCometida = false; // Falta que solo cambia el turno

            let faltaConBolaEnMano = false; // Falta que da "bola en mano" al oponente

            let motivoFalta = ""; // --- NUEVO: Variable para almacenar la razón de la falta

        

        

        

        

        

        

        

            // --- NUEVO: Detección de Falta por Tiempo Agotado ---

            if (faltaPorTiempo) {

                if (!faltaCometida) { // Solo establecer si no se ha cometido otra falta aún

                    faltaCometida = true;

                    faltaConBolaEnMano = true;

                    const currentUsernameForFoul = onlineGameData[`player${jugadorActual}`]?.username || `Jugador ${jugadorActual}`;

                    motivoFalta = `${currentUsernameForFoul} se quedó sin tiempo. Bola en mano para el oponente.`;

                }

            }

        

            // --- FALTA AÑADIDA: Meter la bola blanca ---

            const bolaBlancaEntronerada = bolasEntroneradasEsteTurno.some(ball => ball.number === null);

            if (bolaBlancaEntronerada) {

                if (!faltaCometida) { // Solo establecer si no se ha cometido otra falta aún

                    faltaCometida = true;

                    faltaConBolaEnMano = true;

                    const currentUsernameForFoul = onlineGameData[`player${jugadorActual}`]?.username || `Jugador ${jugadorActual}`;

                    motivoFalta = `${currentUsernameForFoul} metió la bola blanca y te da bola en mano`;

        

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

            }

        

           

        

            // --- NUEVO: Falta por no golpear ninguna bola ---

            if (!primeraBolaGolpeadaEsteTurno && !faltaCometida) {

                faltaCometida = true;

                faltaConBolaEnMano = true;

                const currentUsernameForFoul = onlineGameData[`player${jugadorActual}`]?.username || `Jugador ${jugadorActual}`;

                motivoFalta = `${currentUsernameForFoul} no golpeó ninguna bola. Bola en mano para el oponente.`;

            }

        

            // --- NUEVO: Falta por no entronar bola para asignar en mesa abierta ---

            const bolaDeColorEntronerada = bolasEntroneradasEsteTurno.some(b => b.number !== null && b.number !== 8);

            if (!bolasAsignadasAntesDelTurno && primeraBolaGolpeadaEsteTurno && !bolaDeColorEntronerada && !faltaCometida) {

                faltaCometida = true;

                faltaConBolaEnMano = true;

                const currentUsernameForFoul = onlineGameData[`player${jugadorActual}`]?.username || `Jugador ${jugadorActual}`;

                motivoFalta = `${currentUsernameForFoul} no entronó una bola en mesa abierta. Bola en mano para el oponente.`;

            }

        

            // --- Lógica de si el jugador entronó una bola válida ---

            const jugadorEntroneroSuBola = bolasEntroneradasEsteTurno.some(ball => {

                if (ball.number === null || ball.number === 8) return false;

                if (!bolasAsignadasAlInicioTurno) {

                    return true;

                }

                const tipoBola = (ball.number >= 1 && ball.number <= 7) ? 'solids' : 'stripes';

                return tipoBola === playerAssignmentsAlInicioTurno[jugadorActual];

            });

        

            // --- NUEVO: Falta por no entronar una bola válida ---

            if (bolasAsignadasAlInicioTurno && primeraBolaGolpeadaEsteTurno && !jugadorEntroneroSuBola && !faltaCometida) {

                console.log("No se ha entronado una bola válida.");

                faltaCometida = true;

                faltaConBolaEnMano = true;

                const currentUsernameForFoul = onlineGameData[`player${jugadorActual}`]?.username || `Jugador ${jugadorActual}`;

                motivoFalta = `${currentUsernameForFoul} no metió una bola válida. Bola en mano para el oponente.`;

            }

        

                        // --- NUEVO: Falta por no golpear primero una bola propia (o la 8 ilegalmente) ---

        

            

        

                        if (bolasAsignadasAntesDelTurno && !acabaDeAsignar && primeraBolaGolpeadaEsteTurno && !faltaCometida) {

        

                            const tipoBolaJugador = playerAssignmentsAntesDelTurno[jugadorActual];

        

            

        

                            if (tipoBolaJugador) {

        

                                const primeraBola = primeraBolaGolpeadaEsteTurno;

        

            

        

                                // Comprobar si al jugador todavía le quedan bolas de su tipo en la mesa.

        

                                const jugadorTieneBolasRestantes = balls.some(ball => {

        

                                    if (!ball.isActive || ball.number === null || ball.number === 8) return false;

        

                                    const tipoBola = (ball.number >= 1 && ball.number <= 7) ? 'solids' : 'stripes';

        

                                    return tipoBola === tipoBolaJugador;

        

                                });

        

            

        

                                // FALTA: Golpear la bola 8 primero cuando aún quedan bolas propias.

        

                                if (primeraBola.number === 8 && jugadorTieneBolasRestantes) {

        

                                    faltaCometida = true;

        

                                    faltaConBolaEnMano = true;

        

                                    const currentUsernameForFoul = onlineGameData[`player${jugadorActual}`]?.username || `Jugador ${jugadorActual}`;

        

                                    motivoFalta = `${currentUsernameForFoul} golpeó la bola 8 primero ilegalmente. Bola en mano para el oponente.`;

        

                                

        

                                // FALTA: Golpear una bola del oponente primero.

        

                                } else {

        

                                    const tipoPrimeraBola = (primeraBola.number >= 1 && primeraBola.number <= 7) ? 'solids' : 'stripes';

        

                                    if (primeraBola.number !== 8 && tipoPrimeraBola !== tipoBolaJugador) {

        

                                        const bolasEntroneradasNumeros = bolasEntroneradasEsteTurno.map(b => b.number).join(', ') || 'ninguna';

        

                                        console.log(`Falta detectada: Jugador ${jugadorActual} golpeó una bola incorrecta. Tipo asignado: ${tipoBolaJugador}. Bola golpeada: #${primeraBola.number} (tipo: ${tipoPrimeraBola}). Bolas entroneradas: ${bolasEntroneradasNumeros}.`);

        

                                        

        

                                        faltaCometida = true;

        

                                        faltaConBolaEnMano = true;

        

                                        const currentUsernameForFoul = onlineGameData[`player${jugadorActual}`]?.username || `Jugador ${jugadorActual}`;

        

                                        motivoFalta = `${currentUsernameForFoul} no golpeó primero una bola de su tipo. Bola en mano para el oponente.`;

        

                                    }

        

                                }

        

                            }

        

                        }

    // --- CORRECCIÓN: Volver a obtener el estado actualizado DESPUÉS de la posible asignación de bolas.
    const estadoActualJuego = getGameState();





   
    // --- SOLUCIÓN: Lógica de Victoria/Derrota al meter la bola 8 ---
    const currentUsername = onlineGameData[`player${jugadorActual}`]?.username || `Jugador ${jugadorActual}`;
    const bola8Entronerada = bolasEntroneradasEsteTurno.some(ball => ball.number === 8);
    if (bola8Entronerada) {
        if (faltaCometida) {
            // Si se comete cualquier falta al meter la bola 8, se pierde la partida.
            setGameOver(true);
            const currentPlayerUid = onlineGameData[`player${jugadorActual}`]?.uid;
            showFoulMessage(`Falta de ${currentUsername}: Metiste la bola 8 y cometiste una falta.`, currentPlayerUid);
        } else {
            // No hay falta. Comprobar si el jugador tenía derecho a meter la 8.
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
                // Si aún le quedaban bolas o la mesa estaba abierta, pierde.
                setGameOver(true);
                const currentPlayerUid = onlineGameData[`player${jugadorActual}`]?.uid;
                showFoulMessage(`Falta de ${currentUsername}: Metiste la bola 8 antes de tiempo.`, currentPlayerUid);
            } else {
                // ¡El jugador ha ganado!
                setGameOver(true);
                const currentPlayerUid = onlineGameData[`player${jugadorActual}`]?.uid;
                showFoulMessage(`¡Felicidades, ${currentUsername} has ganado la partida!`, currentPlayerUid);
            }
        }
    }

    // --- Lógica de cambio de turno ---

    // --- LÓGICA DE CAMBIO DE TURNO ---

    // --- NUEVO: Si es el inicio de la partida, elegir un jugador al azar.
    // Se detecta el inicio si no se ha golpeado ninguna bola y no se ha entronerado ninguna.
    // --- CORRECCIÓN: Declarar onlineGameData aquí para que esté disponible en toda la función.
    // --- CORRECCIÓN: Usar el parámetro si existe, si no, obtenerlo localmente.
    if (!onlineGameData) onlineGameData = getGameState();

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
    }

    // --- CORRECCIÓN: Mostrar el mensaje de falta DESPUÉS de haber procesado el cambio de turno.
    if (faltaCometida && motivoFalta && !gameRef) { // Solo mostrar localmente en modo offline
        const currentUsername = onlineGameData[`player${jugadorActual}`]?.username || `Jugador ${jugadorActual}`;
        showFoulMessage(`Falta de ${currentUsername}: ${motivoFalta}`);
    }

    // --- CORRECCIÓN: La bola en mano solo se activa si la falta lo requiere ---
    if (faltaConBolaEnMano) { // Si no se metió la blanca, pero es falta con bola en mano
        setPlacingCueBall(true);
        // --- NUEVO: Sincronizar el estado de "bola en mano" con el servidor ---
        // Esta lógica ahora se centraliza al final.
    }

    // --- CORRECCIÓN: Lógica de Cliente Autoritativo para actualizar el servidor ---
    if (gameRef) {
        const { updateDoc } = await import('./login/auth.js');        
        const finalGameState = getGameState();

        // --- CORRECCIÓN: Centralizar la lógica de cambio de turno aquí ---
        let shouldSwitchTurn = false;
        if (faltaCometida || !jugadorEntroneroSuBola) {
            shouldSwitchTurn = true;
        }

        const nextPlayerNumber = shouldSwitchTurn ? (jugadorActual === 1 ? 2 : 1) : jugadorActual;
        // Actualizar el estado local para el siguiente frame
        // setCurrentPlayer(nextPlayerNumber); // Deshabilitado para que el servidor sea la fuente de verdad

        // --- SOLUCIÓN DEFINITIVA: Lógica robusta para determinar el UID del siguiente jugador ---
        let nextPlayerUid;
        if (shouldSwitchTurn) {
            // Si el turno cambia, el siguiente jugador es el oponente.
            const opponentUid = (onlineGameData.currentPlayerUid === onlineGameData.player1?.uid) 
                                ? onlineGameData.player2?.uid 
                                : onlineGameData.player1?.uid;
            // Si el oponente no existe (es una partida de 1 jugador), el turno vuelve al jugador 1.
            nextPlayerUid = opponentUid || onlineGameData.player1?.uid;
        } else {
            // Si el turno no cambia, el jugador actual continúa.
            nextPlayerUid = onlineGameData.currentPlayerUid;
        }

        // --- SOLUCIÓN: Actualizar el estado local de onlineGameData inmediatamente.
        const currentOnlineData = getOnlineGameData();
        setOnlineGameData({
            ...currentOnlineData,
            playerAssignments: playerAssignmentsAlInicioTurno,
            ballsAssigned: bolasAsignadasAlInicioTurno,
            currentPlayerUid: nextPlayerUid, // Asegurarse de que el UID del jugador actual se actualice localmente
        });

        // Construir el paquete de actualización para Firestore
        const updatePayload = {
            balls: balls.map((b) => ({ // Posiciones finales de todas las bolas
                number: b.number,
                x: b.mesh.position.x,
                y: b.mesh.position.y,
                isActive: b.isActive,
            })),
            currentPlayerUid: nextPlayerUid,
            playerAssignments: playerAssignmentsAlInicioTurno,
            ballsAssigned: bolasAsignadasAlInicioTurno,
            foulInfo: faltaCometida ? { reason: motivoFalta, ballInHand: faltaConBolaEnMano } : null,
            ballInHandFor: faltaConBolaEnMano ? nextPlayerUid : null,
            // --- NUEVO: Incluir la posición inicial de la bola blanca si hay "bola en mano" ---
            cueBallPosition: faltaConBolaEnMano ? { x: TABLE_WIDTH / 4, y: TABLE_HEIGHT / 2 } : null,

            turnTimestamp: Date.now() // Marcar el momento de la actualización del turno
        };

        // --- SOLUCIÓN DEFINITIVA: Actualización de UI Optimista ---
        // Despachar el evento localmente de inmediato para evitar el retraso de la UI.
        // Esto asegura que el jugador que realizó el tiro vea el resultado (como la asignación de bolas) al instante.
        const optimisticGameData = { ...getOnlineGameData(), ...updatePayload };
        window.dispatchEvent(new CustomEvent('updateassignments', { detail: optimisticGameData }));

        // Enviar la actualización autoritativa al servidor
        updateDoc(gameRef, updatePayload).then(() => {
            // --- NUEVO: Limpiar foulInfo del servidor después de un breve retraso
            // para evitar que el mensaje se muestre repetidamente.
            if (faltaCometida) {
                setTimeout(() => {
                    updateDoc(gameRef, { foulInfo: null }).catch(err => console.error("Error al limpiar foulInfo:", err));
                }, 3000); // Limpiar después de 3 segundos
            }
        }).catch((err) =>
            console.error("Error al sincronizar el estado final del turno:", err),
        );
    }

    // --- CORRECCIÓN: Limpiar el estado del tiro DESPUÉS de haberlo revisado todo.
    // Esto asegura que la información del turno (como la primera bola golpeada) esté disponible durante toda la función.
    handleTurnEnd();

    // --- SOLUCIÓN: Limpiar el array de bolas entroneradas para el siguiente turno ---
    clearPocketedBalls();
    clearFirstHitBall();
}