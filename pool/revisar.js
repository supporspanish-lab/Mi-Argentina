// --- Módulo de Revisión ---
import { getGameState, showFoulMessage, setCurrentPlayer, clearPocketedBalls, clearFirstHitBall, handleTurnEnd, isTurnTimerActive, startTurnTimer, setGameOver, setBallsAssigned, assignPlayerTypes, completeFirstTurn, getOnlineGameData, setOnlineGameData, Bolaenmanoarrastre } from './gameState.js';
import { balls, cueBall } from './ballManager.js';
import { updateActivePlayerUI } from './ui.js';
import { playSound } from './audioManager.js';
import { TABLE_WIDTH, TABLE_HEIGHT, BALL_RADIUS } from './config.js';
import { db, doc, getDoc, updateDoc, addDoc, collection } from './login/auth.js';
import { handleEndGame } from './endGameLogic.js';


/**
 * Función de prueba para revisar el estado antes de mostrar la UI.
 */
export async function revisarEstado(faltaPorTiempo = false, gameRef = null, onlineGameData = null) {
    console.log("--- INICIO REVISAR ESTADO ---");
    const estadoInicialDebug = getGameState();
    console.log("Contenido de 'bolasEntroneradasEsteTurno' al iniciar la revisión:", JSON.parse(JSON.stringify(estadoInicialDebug.pocketedThisTurn)));

    // --- SOLUCIÓN: Obtener el estado inicial y mantenerlo separado.
    const estadoInicialJuego = getGameState();
        let {
            currentPlayer: jugadorActual,
            pocketedThisTurn: bolasEntroneradasEsteTurno,
            firstBallHitThisTurn: primeraBolaGolpeadaEsteTurno,
            ballsAssigned: bolasAsignadasAlInicioTurno,
            playerAssignments: playerAssignmentsAlInicioTurno,
            pocketedLastTurn: bolasEntroneradasTurnoAnterior, // --- NUEVO: Obtener las bolas entroneradas del turno anterior
            isLoading: estaCargando,
            gameOver: juegoTerminado, // --- NUEVO: Obtener el estado de fin de partida
            isFirstTurn: esPrimerTurno, // --- NUEVO: Obtener la bandera del primer turno.
            firstFoulForgiven: primeraFaltaPerdonada = false // --- NUEVO: Variable para perdonar la primera falta específica
            } = estadoInicialJuego;    // Muestra si el turno terminó porque el contador llegó a cero.

        const bolasAsignadasAntesDelTurno = bolasAsignadasAlInicioTurno; // Guardar el estado inicial de asignación de bolas.

            const playerAssignmentsAntesDelTurno = { ...playerAssignmentsAlInicioTurno }; // Guardar las asignaciones iniciales.

            let acabaDeAsignar = false; // --- FIX: Bandera para saber si la asignación ocurrió en ESTE turno.

            // --- NUEVO: Detección de Faltas ---
            let faltaCometida = false; // Falta que solo cambia el turno
            let motivoFalta = ""; // --- NUEVO: Variable para almacenar la razón de la falta

        

            // --- CORRECCIÓN: Asegurar que bolasAsignadasAlInicioTurno sea false si no hay asignaciones.

                        // Esto maneja el caso en que el estado de Firestore podría estar inconsistente.

                        if (bolasAsignadasAlInicioTurno && Object.values(playerAssignmentsAlInicioTurno).every(assignment => assignment === null)) {

                            console.warn("Inconsistencia detectada: ballsAssigned es true pero playerAssignments son null. Forzando ballsAssigned a false.");

                            bolasAsignadasAlInicioTurno = false;

                            // También corregir en Firestore si estamos en modo online

                            if (gameRef) {

                                import('./login/auth.js').then(({ db, doc, updateDoc }) => {

                                    updateDoc(gameRef, {

                                        playerAssignments: { 1: null, 2: null },

                                        ballsAssigned: false

                                    }).catch(err => console.error("Error al corregir asignaciones inconsistentes en Firestore:", err));

                                });

                            }

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

        



        

        

        

        

        

        

        

            // --- NUEVO: Detección de Falta por Tiempo Agotado ---

                        if (faltaPorTiempo) {

                            if (!faltaCometida) { // Solo establecer si no se ha cometido otra falta aún

                                faltaCometida = true;

                                const currentUsernameForFoul = onlineGameData[`player${jugadorActual}`]?.username || `Jugador ${jugadorActual}`;

                                motivoFalta = `${currentUsernameForFoul} se quedó sin tiempo.`;

                            }

                        }

        

                        // --- FALTA AÑADIDA: Meter la bola blanca ---

        

                        const bolaBlancaEntronerada = bolasEntroneradasEsteTurno.some(ball => ball.number === null);

        

                        if (bolaBlancaEntronerada) {

        

                            if (!faltaCometida) { // Solo establecer si no se ha cometido otra falta aún

        

                                faltaCometida = true;

        

                                // Ya no hay bola en mano, solo se reposiciona la bola blanca.

        

                                const currentUsernameForFoul = onlineGameData[`player${jugadorActual}`]?.username || `Jugador ${jugadorActual}`;

        

                                motivoFalta = `${currentUsernameForFoul} metió la bola blanca.`;

        

            

        

                                // Lógica para reposicionar la bola blanca.

        

                                if (cueBall) {

        

                                    cueBall.isPocketed = false;

        

                                    cueBall.pocketedState = null;

        

                                    cueBall.isActive = true; 

        

                                    cueBall.mesh.visible = true; // Asegurar que vuelva a ser blanca

        

                                    // --- CORRECCIÓN: Frenar la bola blanca completamente al reposicionarla.

        

                                    cueBall.vx = 0;

        

                                    cueBall.vy = 0;

        

                                    if (cueBall.shadowMesh) cueBall.shadowMesh.visible = true;

        

                                    // La bola aparece en la zona de saque inicial.

        

                                    // Reposicionar la bola en las coordenadas físicas
                                    cueBall.x = TABLE_WIDTH / 4;
                                    cueBall.y = TABLE_HEIGHT / 2;


        

                                    if (cueBall.shadowMesh) cueBall.shadowMesh.position.set(TABLE_WIDTH / 4, TABLE_HEIGHT / 2, 0.1);

                                    // Activar el modo de arrastre para el siguiente jugador
                                    Bolaenmanoarrastre();

                                }

        

                            }

        

                        }

        

           

        

                        // --- NUEVO: Falta por no golpear ninguna bola ---

        

           

        

                        if (!primeraBolaGolpeadaEsteTurno && !faltaCometida) {

        

           

        

                            faltaCometida = true;

        

           

        

                            const currentUsernameForFoul = onlineGameData[`player${jugadorActual}`]?.username || `Jugador ${jugadorActual}`;

        

           

        

                            motivoFalta = `${currentUsernameForFoul} no golpeó ninguna bola.`;

        

           

        

                        }

        



        

                        // --- Lógica de si el jugador entronó una bola válida ---

        



        

                                                console.log("DEBUG: Antes de calcular jugadorEntroneroSuBola:");

        



        

                                                console.log("DEBUG: bolasEntroneradasEsteTurno:", JSON.parse(JSON.stringify(bolasEntroneradasEsteTurno)));

        



        

                                                console.log("DEBUG: bolasAsignadasAlInicioTurno:", bolasAsignadasAlInicioTurno);

        



        

                                                console.log("DEBUG: playerAssignmentsAlInicioTurno:", JSON.parse(JSON.stringify(playerAssignmentsAlInicioTurno)));

        



        

                                                console.log("DEBUG: jugadorActual:", jugadorActual);

        



        

                                                console.log("DEBUG: acabaDeAsignar:", acabaDeAsignar); // Add this log

        



        

                                    

        



        

                                                const jugadorEntroneroSuBola = bolasEntroneradasEsteTurno.some(ball => {

        



        

                                    

        



        

                                                    if (ball.number === null || ball.number === 8) return false;

        



        

                                    

        



        

                                                    if (!bolasAsignadasAlInicioTurno) {

        



        

                                                        console.log(`DEBUG: Mesa abierta. Bola ${ball.number} entronerada. Se considera propia.`);

        



        

                                                        return true;

        



        

                                    

        



        

                                                    }

        



        

                                    

        



        

                                                    const tipoBola = (ball.number >= 1 && ball.number <= 7) ? 'solids' : 'stripes';

        



        

                                                    const isMyBall = tipoBola === playerAssignmentsAlInicioTurno[jugadorActual];

        



        

                                                    console.log(`DEBUG: Bola ${ball.number} entronerada. Tipo: ${tipoBola}. Tipo del jugador: ${playerAssignmentsAlInicioTurno[jugadorActual]}. ¿Es propia?: ${isMyBall}`);

        



        

                                                    return isMyBall;

        



        

                                    

        



        

                                                });

        



        

                                    

        



        

                                                console.log("DEBUG: Valor final de jugadorEntroneroSuBola:", jugadorEntroneroSuBola);

        



        

                                                

        



        

                                                // --- NUEVO: Falta por turno infinito (entronerar las mismas bolas) ---

        



        

                                                if (jugadorEntroneroSuBola && !faltaCometida) {

        



        

                                                    const currentPocketedNumbers = bolasEntroneradasEsteTurno.map(b => b.number).sort();

        



        

                                                    const lastPocketedNumbers = bolasEntroneradasTurnoAnterior.map(b => b.number).sort();

        



        

                        

        



        

                                                    // Comprobar si los arrays son idénticos (misma longitud y mismos elementos en orden)

        



        

                                                    if (currentPocketedNumbers.length > 0 &&

        



        

                                                        currentPocketedNumbers.length === lastPocketedNumbers.length &&

        



        

                                                        currentPocketedNumbers.every((val, index) => val === lastPocketedNumbers[index])) {

        



        

                                                        

        



        

                                                        faltaCometida = true;

        



        

                                                        const currentUsernameForFoul = onlineGameData[`player${jugadorActual}`]?.username || `Jugador ${jugadorActual}`;

        



        

                                                        motivoFalta = `${currentUsernameForFoul} ha entronerado las mismas bolas que en el turno anterior, lo que se considera una falta para evitar turnos infinitos.`;

        



        

                                                        console.log("Falta detectada: Turno infinito por entronerar las mismas bolas.");

        



        

                                                    }

        



        

                                                }

        



        

                        

        



        

                                                                                                // --- NUEVO: Falta por no entronar una bola válida ---

        



        

                        

        



        

                                                

        



        

                        

        



        

                                                                                                if (bolasAsignadasAlInicioTurno && primeraBolaGolpeadaEsteTurno && !jugadorEntroneroSuBola && !faltaCometida && !acabaDeAsignar) {

        



        

                        

        



        

                                                                            console.log("DEBUG: Falta por no entronar bola válida detectada.");

        



        

                        

        



        

                                                                            console.log(`DEBUG: primeraBolaGolpeadaEsteTurno: ${primeraBolaGolpeadaEsteTurno}, jugadorEntroneroSuBola: ${jugadorEntroneroSuBola}, faltaCometida (antes): ${faltaCometida}`);

        



        

                        

        



        

                                                                            faltaCometida = true;

        



        

                        

        



        

                                                                            const currentUsernameForFoul = onlineGameData[`player${jugadorActual}`]?.username || `Jugador ${jugadorActual}`;

        



        

                        

        



        

                                                                            motivoFalta = `${currentUsernameForFoul} no metió una bola válida.`;

        



        

                        

        



        

                                                                        }

        



        

                        

        



        

                                                

        



        

                        

        



        

                                                                                                                                                                                                                        // --- NUEVO: Falta por entronerar una bola del oponente ---

        



        

                        

        



        

                                                

        



        

                        

        



        

                                                                                                                                                                                                                        // --- CORRECCIÓN: La falta solo aplica si NO se entroneró también una bola propia.

        



        

                        

        



        

                                                

        



        

                        

        



        

                                                                                                                                                                                                                        if (bolasAsignadasAlInicioTurno && !faltaCometida && !jugadorEntroneroSuBola && bolasEntroneradasEsteTurno.length > 0) {

        



        

                        

        



        

                                                

        



        

                        

        



        

                                                                                                                                                                                                                            const tipoBolaJugador = playerAssignmentsAlInicioTurno[jugadorActual];

        



        

                        

        



        

                                                

        



        

                        

        



        

                                                                                                                                                                                                                            const bolaOponenteEntronerada = bolasEntroneradasEsteTurno.some(ball => {

        



        

                        

        



        

                                                

        



        

                        

        



        

                                                                                                                                                                                                                                if (ball.number === null || ball.number === 8) return false; // Ignorar blanca y 8

        



        

                        

        



        

                                                

        



        

                        

        



        

                                                                                                                                                                                                                                const tipoBola = (ball.number >= 1 && ball.number <= 7) ? 'solids' : 'stripes';

        



        

                        

        



        

                                                

        



        

                        

        



        

                                                                                                                                                                                                                                return tipoBola !== tipoBolaJugador;

        



        

                        

        



        

                                                

        



        

                        

        



        

                                                                                                                                                                                                                            });

        



        

                        

        



        

                                                

        



        

                        

        



        

                                                                                                                                                                                

        



        

                        

        



        

                                                

        



        

                        

        



        

                                                                                                                                                                                                                            if (bolaOponenteEntronerada) {

        



        

                        

        



        

                                                

        



        

                        

        



        

                                                                                                                                                                                                                                faltaCometida = true;

        



        

                        

        



        

                                                

        



        

                        

        



        

                                                                                                                                                                                                                                const currentUsernameForFoul = onlineGameData[`player${jugadorActual}`]?.username || `Jugador ${jugadorActual}`;

        



        

                        

        



        

                                                

        



        

                        

        



        

                                                                                                                                                                                                                                motivoFalta = `${currentUsernameForFoul} entroneró una bola del oponente.`;

        



        

                        

        



        

                                                

        



        

                        

        



        

                                                                                                                                                                                                                            }

        



        

                        

        



        

                                                

        



        

                        

        



        

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

        

            

        

                                                                    const currentUsernameForFoul = onlineGameData[`player${jugadorActual}`]?.username || `Jugador ${jugadorActual}`;

        

            

        

                                                                    motivoFalta = `${currentUsernameForFoul} golpeó la bola 8 primero ilegalmente.`;

        

            

        

                                                                

        

            

        

                                                                // FALTA: Golpear una bola del oponente primero.

        

            

        

                                                                } else {

        

                                                                        const tipoPrimeraBola = (primeraBola.number >= 1 && primeraBola.number <= 7) ? 'solids' : 'stripes';

        

                                                                        if (primeraBola.number !== 8 && tipoPrimeraBola !== tipoBolaJugador) {





                                                                            if (!primeraFaltaPerdonada) {

                                                                                primeraFaltaPerdonada = true;

                                                                            } else {

                                                                                const bolasEntroneradasNumeros = bolasEntroneradasEsteTurno.map(b => b.number).join(', ') || 'ninguna';





                                                                                console.log(`Falta detectada: Jugador ${jugadorActual} golpeó una bola incorrecta. Tipo asignado: ${tipoBolaJugador}. Bola golpeada: #${primeraBola.number} (tipo: ${tipoPrimeraBola}). Bolas entroneradas: ${bolasEntroneradasNumeros}.`);





                                                                                faltaCometida = true;





                                                                                const currentUsernameForFoul = onlineGameData[`player${jugadorActual}`]?.username || `Jugador ${jugadorActual}`;





                                                                                motivoFalta = `${currentUsernameForFoul} no golpeó primero una bola de su tipo.`;

                                                                            }





                                                                        }

        

                                }

        

                            }

        

                        }

    // --- CORRECCIÓN: Volver a obtener el estado actualizado DESPUÉS de la posible asignación de bolas.
    const estadoActualJuego = getGameState();





   
    // --- SOLUCIÓN: Lógica de Victoria/Derrota al meter la bola 8 ---
    const bola8Entronerada = bolasEntroneradasEsteTurno.some(ball => ball.number === 8);
    if (bola8Entronerada) {
        console.log('Partida terminada: bola 8 entronerada');
        return handleEndGame(faltaCometida, gameRef, onlineGameData, estadoInicialJuego, balls);
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

    // --- NUEVO: Activar arrastre de bola blanca para el oponente en faltas (excepto no meter bola válida y mismas bolas)
    if (faltaCometida && motivoFalta !== "no metió una bola válida." && !motivoFalta.includes("mismas bolas")) {
        Bolaenmanoarrastre();
    }

    // --- CORRECCIÓN: Lógica de Cliente Autoritativo para actualizar el servidor ---
    if (gameRef) {
        
        const finalGameState = getGameState();

        // --- CORRECCIÓN: Centralizar la lógica de cambio de turno aquí ---
        console.log(`DEBUG: Antes de shouldSwitchTurn - faltaCometida: ${faltaCometida}, jugadorEntroneroSuBola: ${jugadorEntroneroSuBola}`);
        // Determinar si el jugador realmente entroneró SU bola.
        // Esto significa que 'bolasEntroneradasEsteTurno' no debe estar vacío, Y el 'jugadorEntroneroSuBola' original debe ser true.
        const playerActuallyPocketedBall = bolasEntroneradasEsteTurno.length > 0 && jugadorEntroneroSuBola;

        let shouldSwitchTurn = false;
        if (faltaCometida || !playerActuallyPocketedBall) {
            shouldSwitchTurn = true;
        }
        console.log("DEBUG: 'jugadorEntroneroSuBola' se ha reseteado a false para la lógica de cambio de turno si no se entroneró ninguna bola.");

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
            firstFoulForgiven: primeraFaltaPerdonada, // --- NUEVO: Actualizar el estado local de falta perdonada
            currentPlayerUid: nextPlayerUid, // Asegurarse de que el UID del jugador actual se actualice localmente
        });

        // Construir el paquete de actualización para Firestore
        const updatePayload = {
            balls: balls.map((b) => {
                // --- SOLUCIÓN: Si la bola blanca fue entronerada, sobreescribir su estado en el payload ---
                if (b.number === null && bolaBlancaEntronerada) {
                    return {
                        number: null,
                        x: TABLE_WIDTH / 4,
                        y: TABLE_HEIGHT / 2,
                        isActive: true, // Forzar a que esté activa en la nueva posición
                    };
                }
                // Para todas las demás bolas, devolver su estado actual
                return {
                    number: b.number,
                    x: b.mesh.position.x,
                    y: b.mesh.position.y,
                    isActive: b.isActive,
                };
            }),
            currentPlayerUid: nextPlayerUid,
            playerAssignments: playerAssignmentsAlInicioTurno,
            ballsAssigned: bolasAsignadasAlInicioTurno,
            firstFoulForgiven: primeraFaltaPerdonada, // --- NUEVO: Actualizar el estado de falta perdonada
            foulInfo: faltaCometida ? { reason: motivoFalta, timestamp: Date.now() } : null,
            // --- MANTENIDO POR COMPATIBILIDAD: Aunque ahora es redundante, otros clientes pueden usarlo ---
            cueBallPosition: bolaBlancaEntronerada ? { x: TABLE_WIDTH / 4, y: TABLE_HEIGHT / 2 } : null,
            ballInHandFor: null, // Inicialmente null, se enviará con retraso

            turnTimestamp: Date.now(), // Marcar el momento de la actualización del turno
        };

        // --- SOLUCIÓN DEFINITIVA: Actualización de UI Optimista ---
        // Despachar el evento localmente de inmediato para evitar el retraso de la UI.
        // Esto asegura que el jugador que realizó el tiro vea el resultado (como la asignación de bolas) al instante.
        const optimisticGameData = { ...getOnlineGameData(), ...updatePayload };
        window.dispatchEvent(new CustomEvent('updateassignments', { detail: optimisticGameData }));

        // Enviar la actualización autoritativa al servidor
        updateDoc(gameRef, updatePayload).then(() => {
            // --- NUEVO: Enviar ballInHandFor con retraso de 1 segundo si la bola blanca fue entronerada
            if (bolaBlancaEntronerada) {
                setTimeout(() => {
                    updateDoc(gameRef, { ballInHandFor: nextPlayerUid }).catch(err => console.error("Error al enviar ballInHandFor:", err));
                }, 1000);
            }
            // --- NUEVO: Enviar ballInHandFor con retraso si hay falta (excepto no meter bola válida y mismas bolas)
            if (faltaCometida && motivoFalta !== "no metió una bola válida." && !motivoFalta.includes("mismas bolas")) {
                setTimeout(() => {
                    updateDoc(gameRef, { ballInHandFor: nextPlayerUid }).catch(err => console.error("Error al enviar ballInHandFor por falta:", err));
                }, 1000);
            }
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

        // Reproducir sonido de cambio de turno si el turno cambió
        if (shouldSwitchTurn) {
            playSound('turnoFinalizado');
        }
    }

    // --- LIMPIEZA Y FINALIZACIÓN DEL TURNO ---
    // Es crucial limpiar el estado del turno (bolas entroneradas, primera bola golpeada) DESPUÉS 
    // de que toda la lógica de revisión y actualización de Firebase se haya completado.
    handleTurnEnd();

    // Reiniciar variables locales para mayor claridad, aunque se reinician en cada llamada.
    faltaCometida = false;
    motivoFalta = "";
}
