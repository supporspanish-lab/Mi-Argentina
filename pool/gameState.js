// --- Módulo de Estado del Juego ---
import { TABLE_WIDTH, TABLE_HEIGHT, BALL_RADIUS } from './config.js';
import { cueBall, balls } from './ballManager.js';
import { scene } from './scene.js';

// --- Estado del Juego ---
export let currentPlayer = 1;
export let playerAssignments = { 1: null, 2: null }; // 'solids' (lisas) o 'stripes' (rayadas)
export let ballsAssigned = false;
export let shotInProgress = false;
export let firstBallHitThisTurn = null; // --- NUEVO: Para registrar la primera bola golpeada
export let pocketedThisTurn = [];
export let shotStartTime = 0; // --- NUEVO: Timestamp del inicio del tiro
export let isPlacingCueBall = false; // --- NUEVO: Estado para cuando el jugador está colocando la bola blanca
export let isDampingEnabled = true; // --- NUEVO: Controla si el frenado en la tronera está activo
export let gamePaused = false;

export function startShot() {
    shotInProgress = true;
    shotStartTime = performance.now(); // --- NUEVO: Registrar el tiempo de inicio
    firstBallHitThisTurn = null; // --- NUEVO: Reiniciar en cada tiro
}

export function setPlacingCueBall(isPlacing) { // --- NUEVO: Función para controlar el estado de colocación
    isPlacingCueBall = isPlacing;
}

export function toggleDamping() { // --- NUEVO: Función para alternar el estado del frenado
    isDampingEnabled = !isDampingEnabled;
}

export function setGamePaused(isPaused) {
    gamePaused = isPaused;
}

// --- NUEVO: Función para registrar la primera bola golpeada en un turno ---
export function setFirstHitBall(ball) {
    if (!firstBallHitThisTurn) { // Solo registrar la primera
        firstBallHitThisTurn = ball;
        console.log(`DEBUG: Primera bola golpeada en este tiro: #${ball.number}`);
    }
}

export function addPocketedBall(ball) {
    pocketedThisTurn.push(ball);

    // --- CORRECCIÓN: Asignar bolas en tiempo real en lugar de al final del turno ---
    if (!ballsAssigned && ball.number !== null && ball.number !== 8) {
        const type = (ball.number >= 1 && ball.number <= 7) ? 'solids' : 'stripes';
        playerAssignments[currentPlayer] = type;
        playerAssignments[currentPlayer === 1 ? 2 : 1] = (type === 'solids' ? 'stripes' : 'solids');
        ballsAssigned = true;
        const typeToSpanish = (t) => t === 'solids' ? 'Lisas (1-7)' : 'Rayadas (9-15)';
        console.log("----------------------------------------");
        console.log(`¡Bolas asignadas! Jugador 1 tiene las ${typeToSpanish(playerAssignments[1])}. Jugador 2 tiene las ${typeToSpanish(playerAssignments[2])}.`);
        console.log("----------------------------------------");
    }

    addPocketedBallToUI(ball);
}

// --- Lógica de UI de Estado ---

function addPocketedBallToUI(ball) {
    if (ball.number === null || ball.number === 8) return;

    const ballType = (ball.number >= 1 && ball.number <= 7) ? 'solids' : 'stripes';
    let targetContainerId = null;

    if (ballsAssigned) {
        if (playerAssignments[1] === ballType) {
            targetContainerId = 'player1PocketedContainer';
        } else if (playerAssignments[2] === ballType) {
            targetContainerId = 'player2PocketedContainer';
        }
    } else {
        targetContainerId = (currentPlayer === 1) ? 'player1PocketedContainer' : 'player2PocketedContainer';
    }

    const container = document.getElementById(targetContainerId);
    if (!container) return;

    const ballIcon = document.createElement('div');
    ballIcon.className = 'player-ball-icon';
    const imageUrl = `imajenes/BolasMetidas/${ball.number}.png`;
    ballIcon.style.backgroundImage = `url('${imageUrl}')`;

    const placeholder = container.querySelector('.pocketed-ball-placeholder');
    if (placeholder) {
        container.replaceChild(ballIcon, placeholder);
    } else {
        container.appendChild(ballIcon);
    }
}

// --- NUEVO: Función para reorganizar las bolas en la UI después de la asignación ---
function updatePocketedBallsUI() {
    const player1Container = document.getElementById('player1PocketedContainer');
    const player2Container = document.getElementById('player2PocketedContainer');

    // Recoger todos los iconos de bolas de ambos contenedores
    const allIcons = [
        ...Array.from(player1Container.querySelectorAll('.player-ball-icon')),
        ...Array.from(player2Container.querySelectorAll('.player-ball-icon'))
    ];

    // Limpiar ambos contenedores y rellenarlos con placeholders
    [player1Container, player2Container].forEach(container => {
        container.innerHTML = ''; // Limpiar completamente
        for (let i = 0; i < 7; i++) {
            const placeholder = document.createElement('div');
            placeholder.className = 'pocketed-ball-placeholder';
            container.appendChild(placeholder);
        }
        // Añadir los handles de edición de UI de nuevo
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'rotate-handle';
        container.appendChild(resizeHandle);
        container.appendChild(rotateHandle);
    });

    // Volver a añadir cada icono al contenedor correcto
    allIcons.forEach(icon => {
        // Extraer el número de la bola desde la URL de la imagen
        const url = icon.style.backgroundImage;
        const match = url.match(/(\d+)\.png/);
        if (match) {
            const ballNumber = parseInt(match[1], 10);
            addPocketedBallToUI({ number: ballNumber }); // Reutilizar la lógica de inserción
        }
    });
}
// --- Lógica de Fin de Turno ---

export function handleTurnEnd() {
    shotInProgress = false;
    const pocketedBalls = [...pocketedThisTurn];
    pocketedThisTurn = []; // Limpiar para el siguiente turno

    // --- NUEVO: Comprobar si se ha cometido una falta al golpear la bola incorrecta ---
    let foulCommitted = false;
    let foulReason = "";

    // --- CORRECCIÓN: Asegurarse de que la bola golpeada es una bola de objeto válida ---
    if (ballsAssigned && firstBallHitThisTurn && firstBallHitThisTurn.number !== null) {
        const firstHitType = (firstBallHitThisTurn.number >= 1 && firstBallHitThisTurn.number <= 7) ? 'solids' : 'stripes';
        if (playerAssignments[currentPlayer] !== firstHitType) {
            // --- CORRECCIÓN: La falta es inmediata, a menos que la bola golpeada sea la 8.
            if (firstBallHitThisTurn.number === 8) {
                // Si se golpea la 8, solo es falta si al jugador aún le quedan bolas de su tipo.
                const playerBallsLeft = balls.some(b => b.isActive && playerAssignments[currentPlayer] === ((b.number >= 1 && b.number <= 7) ? 'solids' : 'stripes'));
                if (playerBallsLeft) {
                    foulCommitted = true;
                    foulReason = `¡Falta! No se puede golpear la bola 8 primero.`;
                    console.log(`FALTA: Jugador ${currentPlayer} golpeó la bola 8 primero cuando aún le quedaban bolas.`);
                }
            } else {
                // Si se golpea cualquier otra bola del oponente, es falta siempre.
                foulCommitted = true;
                foulReason = `¡Falta! La primera bola golpeada fue del oponente.`;
                console.log(`FALTA: Jugador ${currentPlayer} golpeó una bola del oponente (${firstBallHitThisTurn.number}) primero.`);
            }
        }
    }

    // --- CORRECCIÓN: Declarar cueBallPocketed ANTES de su primer uso ---
    const cueBallPocketed = pocketedBalls.some(ball => ball.number === null);

    const pocketedInfoEl = document.getElementById('pocketedInfo');

    if (cueBallPocketed) {
        foulCommitted = true; // Meter la blanca también es falta
        pocketedInfoEl.textContent = '¡Falta! Bola blanca entronerada.';
        pocketedInfoEl.style.display = 'block';
        // --- CORRECCIÓN: Eliminar el setTimeout para activar "bola en mano" inmediatamente ---
        // El retraso causaba que el estado del juego se bloqueara.
        isPlacingCueBall = true;
        console.log("Bola en mano. Coloca la bola blanca detrás de la línea de saque.");
    } else if (foulCommitted) {
        pocketedInfoEl.textContent = foulReason;
        pocketedInfoEl.style.display = 'block';
        isPlacingCueBall = true; // Bola en mano para el oponente
    } else if (pocketedBalls.some(b => b.number !== null)) {
        const ballNumbers = pocketedBalls.map(b => b.number).join(', ');
        pocketedInfoEl.textContent = `Bolas entroneradas: ${ballNumbers}`;
        pocketedInfoEl.style.display = 'block';
        setTimeout(() => { pocketedInfoEl.style.display = 'none'; }, 3000);
    } else {
        // --- CORRECCIÓN: Si no se metió ninguna bola, pero el turno cambia, ocultar el mensaje.
        // Esto evita que el mensaje del turno anterior persista.
        if (pocketedBalls.length === 0) {
            pocketedInfoEl.style.display = 'none';
        }
        pocketedInfoEl.style.display = 'none';
    }

    // --- CORRECCIÓN: Mover estas comprobaciones aquí, DESPUÉS de evaluar las faltas ---
    const playerPocketedOwnBall = pocketedBalls.some(ball => {
        if (!playerAssignments[currentPlayer] || ball.number === null) return false;
        const ballType = (ball.number >= 1 && ball.number <= 7) ? 'solids' : 'stripes';
        return ballType === playerAssignments[currentPlayer];
    });

    // --- CORRECCIÓN: Lógica de cambio de turno ---
    let switchTurn = false;

    // Condición 1: Si no se metió ninguna bola o se cometió una falta, se cambia de turno.
    if (pocketedBalls.length === 0 || foulCommitted) {
        switchTurn = true;
    }
    // Condición 2: Si se metieron bolas y no hubo falta, pero ninguna era del jugador actual, también se cambia.
    // (Esto cubre el caso de meter solo bolas del oponente).
    else if (ballsAssigned && !playerPocketedOwnBall) {
        switchTurn = true;
    }

    if (switchTurn) {
        currentPlayer = (currentPlayer === 1) ? 2 : 1;
        console.log(`Turno cambiado al Jugador ${currentPlayer}`);
    } else {
        console.log(`Jugador ${currentPlayer} continúa su turno.`);
    }
}

export function getGameState() {
    return {
        currentPlayer,
        playerAssignments,
        ballsAssigned, 
        isPlacingCueBall, // --- NUEVO: Exponer el estado
        isDampingEnabled, // --- NUEVO: Exponer el estado del frenado
        gamePaused // --- CORRECCIÓN: Exponer el estado de pausa
    };
}

/**
 * --- NUEVO: Comprueba si alguna bola está en medio de una animación de entronerado.
 * @param {Array} balls - El array de todas las bolas.
 * @returns {boolean} - True si alguna bola se está animando, false en caso contrario.
 */
export function areBallsAnimating(balls) {
    // El turno no debe terminar si una bola está cayendo o rodando bajo la mesa.
    return balls.some(ball => ball.isPocketed && (ball.pocketedState === 'falling' || ball.pocketedState === 'rolling'));
}