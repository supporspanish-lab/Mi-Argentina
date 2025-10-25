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

export let isLoading = true; // --- NUEVO: Estado para saber si el juego está cargando/calentando
export function startShot() {
    // --- LOG: Indica que se ha iniciado un tiro.
    shotInProgress = true;
    shotStartTime = performance.now(); // --- NUEVO: Registrar el tiempo de inicio
    firstBallHitThisTurn = null; // --- NUEVO: Reiniciar en cada tiro
}

/**
 * --- NUEVO: Selecciona aleatoriamente al jugador que comenzará la partida.
 */
export function randomizeStartingPlayer() {
    isLoading = false; // --- NUEVO: La carga termina cuando se asigna el primer jugador
    currentPlayer = Math.random() < 0.5 ? 1 : 2;
}

export function setPlacingCueBall(isPlacing) { // --- NUEVO: Función para controlar el estado de colocación
    // --- LOG: Indica un cambio en el estado de colocación de la bola blanca.
    isPlacingCueBall = isPlacing;
}

export function toggleDamping() { // --- NUEVO: Función para alternar el estado del frenado
    // --- LOG: Indica que se ha cambiado el estado del frenado en tronera.
    isDampingEnabled = !isDampingEnabled;
}

export function setGamePaused(isPaused) {
    // --- LOG: Indica un cambio en el estado de pausa del juego.
    gamePaused = isPaused;
}

/**
 * --- SOLUCIÓN: Añade la función que faltaba para establecer el jugador actual.
 * @param {number} player - El número del jugador (1 o 2).
 */
export function setCurrentPlayer(player) {
    currentPlayer = player;
}

/**
 * --- NUEVO: Muestra un mensaje de falta en el centro de la pantalla.
 * @param {string} reason - El texto que se mostrará como motivo de la falta.
 */
export function showFoulMessage(reason) {
    const foulMessageEl = document.getElementById('foulMessage');
    if (foulMessageEl) {
        foulMessageEl.textContent = reason;
        foulMessageEl.style.opacity = '1';
        foulMessageEl.style.transform = 'translate(-50%, -50%) scale(1)';
        setTimeout(() => { foulMessageEl.style.opacity = '0'; foulMessageEl.style.transform = 'translate(-50%, -50%) scale(0.8)'; }, 2500);
    }
}

// --- NUEVO: Función para registrar la primera bola golpeada en un turno ---
export function setFirstHitBall(ball) {
    // --- LOG: Indica que se está intentando registrar la primera bola golpeada.
    // console.log(`[GameState] Llamando a setFirstHitBall() para bola #${ball.number}`);
    if (!firstBallHitThisTurn) { // Solo registrar la primera
        firstBallHitThisTurn = ball;
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
    // --- SOLUCIÓN: La lógica de faltas y turno se ha movido a revisar.js ---
    // Esta función ahora solo marca el fin del tiro y limpia los arrays para la siguiente revisión.
    shotInProgress = false;
    if (cueBall) cueBall.spin = { x: 0, y: 0 };
}

/**
 * --- SOLUCIÓN: Limpia el array de bolas entroneradas.
 * Se llama después de que un turno ha sido completamente revisado.
 */
export function clearPocketedBalls() {
    pocketedThisTurn = [];
}

export function getGameState() {
    return {
        currentPlayer,
        playerAssignments,
        ballsAssigned, 
        isPlacingCueBall, // --- NUEVO: Exponer el estado
        isDampingEnabled, // --- NUEVO: Exponer el estado del frenado
        gamePaused, // --- CORRECCIÓN: Exponer el estado de pausa
        firstBallHitThisTurn, // --- SOLUCIÓN: Exponer la primera bola golpeada para que revisar.js pueda consultarla
        pocketedThisTurn // --- SOLUCIÓN: Exponer las bolas entroneradas para que revisar.js pueda consultarlas
    };
}

/**
 * --- NUEVO: Comprueba si alguna bola está en medio de una animación de entronerado.
 * @param {Array} balls - El array de todas las bolas.
 * @returns {boolean} - True si alguna bola se está animando, false en caso contrario.
 */
export function areBallsAnimating(balls) {
    // --- LOG: Indica que se está comprobando si hay bolas en animación.
    // console.log('[GameState] Llamando a areBallsAnimating()...');
    // --- CORRECCIÓN: Una bola solo está "animándose" si está cayendo. El estado 'rolling' ya no se usa y podría bloquear el turno.
    const animatingBall = balls.find(ball => ball.isPocketed && ball.pocketedState === 'falling');
    if (animatingBall) {
        return true;
    }
    // El turno no debe terminar si una bola está cayendo o rodando bajo la mesa.
    // --- LOG: Indica el final de la comprobación de animación.
    // console.log('%c[GameState]%c areBallsAnimating() finalizado. Resultado: false.', 'color: #e67e22; font-weight: bold;', 'color: inherit;');
    return false;
}