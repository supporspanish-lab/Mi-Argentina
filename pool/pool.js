import * as THREE from 'three';
import { updateBallPositions, areBallsMoving } from './fisicas.js';
import { initializeHandles, handles, pockets, BALL_RADIUS, TABLE_WIDTH, TABLE_HEIGHT } from './config.js'; // Asegúrate que handles se exporta
import { scene, camera, renderer, updateCameraPositionForResponsiveness, loadTableTexture } from './scene.js';
import { balls, cueBall, setupBalls, loadBallModels, cueBallRedDot, prepareBallLoaders } from './ballManager.js';
import { handleInput, initializeUI, spinOffset, updateUI, prepareUIResources } from './ui.js'; // ui.js importa powerBar.js
import { initAudio, loadSound, prepareAudio } from './audioManager.js';
import { initFallPhysics, addBallToFallSimulation, updateFallPhysics } from './fallPhysics.js';
import { setOnLoadingComplete, setProcessingSteps } from './loadingManager.js';
import { prepareAimingResources } from './aiming.js';
import { getGameState, handleTurnEnd, startShot, addPocketedBall, setGamePaused, areBallsAnimating, setPlacingCueBall } from './gameState.js';

let lastTime;

// --- NUEVO: Variables para el efecto de vibración de la cámara ---
let shakeIntensity = 0;
let shakeDuration = 0;
let originalCameraPosition = new THREE.Vector3();

function gameLoop(time) {
    // Vuelve a llamar a gameLoop para el siguiente fotograma
    requestAnimationFrame(gameLoop);

    // --- NUEVO: Log para verificar el estado de pausa ---
    // console.log(`Juego Pausado: ${getGameState().gamePaused}`);

    // --- NUEVO: Si el juego está pausado, no se actualiza la lógica, solo se renderiza. ---
    if (getGameState().gamePaused) {
        renderer.render(scene, camera); // Renderizar la escena
        return; // Detener la ejecución del resto del bucle
    }

    // --- NUEVO: Lógica para la vibración de la cámara ---
    if (shakeDuration > 0 && lastTime !== undefined) {
        const dt = (time - lastTime) / 1000;
        // Aplicar el desplazamiento aleatorio
        camera.position.x = originalCameraPosition.x + (Math.random() - 0.5) * shakeIntensity;
        camera.position.y = originalCameraPosition.y + (Math.random() - 0.5) * shakeIntensity;

        // Reducir la duración y la intensidad
        shakeDuration -= dt;
        shakeIntensity *= 0.95; // Decaimiento suave de la intensidad

        if (shakeDuration <= 0) {
            camera.position.copy(originalCameraPosition); // Restaurar la posición original
        }
    }
    let dt = 0;
    if (lastTime !== undefined) {
        dt = (time - lastTime) / 1000; // Delta time en segundos
        const pocketedInFrame = updateBallPositions(dt, balls, pockets, handles, BALL_RADIUS);

        if (pocketedInFrame.length > 0) {
            pocketedInFrame.forEach(ball => addPocketedBall(ball));
        }

        // --- MODIFICACIÓN: El turno solo termina si no hay bolas moviéndose NI animándose ---
        if (getGameState().shotInProgress && !areBallsMoving(balls) && !areBallsAnimating(balls)) {
            handleTurnEnd();
            // --- MEJORA: Restablecer la rotación visual de la bola blanca para el siguiente tiro ---
            if (cueBall && cueBall.mesh) {
                cueBall.mesh.quaternion.set(0, 0, 0, 1); // Resetea a la rotación identidad
            }
        }
    }
    lastTime = time;

    // --- CORREGIDO: Lógica para la rotación visual de las bolas ---
    if (dt > 0) {
        const timeStep = dt * 100; // Usamos el mismo multiplicador que en fisicas.js

        // --- CORRECCIÓN: Iterar hacia atrás para poder eliminar elementos de forma segura ---
        for (let i = balls.length - 1; i >= 0; i--) {
            const ball = balls[i];
            // --- NUEVO: Animación de caída y rodadura para bolas entroneradas ---
            if (ball.isPocketed && !ball.physicsBody) { // Si está entronerada pero no en la simulación 3D
                if (ball.pocketedState === 'falling') { // Cuando se marca para caer
                    addBallToFallSimulation(ball); // Añadirla al motor de física 3D
                }
            }

            // --- CORRECCIÓN: Reestructurar la lógica de estados para que sea más clara ---

            // Estado 1: La bola está siendo simulada por el motor de física 3D (Cannon-es)
            if (ball.physicsBody) { // Si la bola está siendo simulada por Cannon-es
                if (ball.mesh.position.z < -150) { // Umbral cuando la bola ha caído lo suficiente
                    ball.physicsBody.world.removeBody(ball.physicsBody);
                    ball.physicsBody = null;

                    // Si es la bola blanca, la ocultamos y pausamos para reposicionarla
                    if (ball === cueBall) {
                        ball.mesh.visible = false;
                        ball.pocketedState = 'collected'; // Marcar como gestionada
                        // --- CORRECCIÓN: Activar "bola en mano" inmediatamente ---
                        // En lugar de pausar el juego, activamos el modo de colocación.
                        setPlacingCueBall(true);
                        // --- CORRECCIÓN: Reiniciar el estado de la bola blanca para que pueda ser colocada ---
                        ball.isPocketed = false;
                        ball.isActive = false; // Se activará al hacer clic para colocarla
                        ball.vx = 0;
                        ball.vy = 0;
                        // --- CORRECCIÓN: Reposicionar la bola en su punto de partida inicial ---
                        ball.mesh.position.set(TABLE_WIDTH / 4, TABLE_HEIGHT / 2, BALL_RADIUS);
                        ball.mesh.visible = true;
                        if (ball.shadowMesh) ball.shadowMesh.visible = true;
                        console.log("Bola en mano. Coloca la bola blanca detrás de la línea de saque.");
                    } else {
                        // Para otras bolas, iniciamos la fase de rodadura
                        ball.pocketedState = 'rolling';
                        ball.vx = 0;
                        ball.vy = 0;
                        ball.mesh.position.z = -BALL_RADIUS * 2; // Posicionarla bajo la mesa
                    }
                }
            } 
            // Estado 2: La bola ha caído y ahora rueda por debajo de la mesa
            else if (ball.pocketedState === 'rolling') {
                // --- SOLUCIÓN DEFINITIVA: Implementar sub-pasos para la animación de rodadura ---
                // Esto evita que la bola atraviese las paredes a altas velocidades.
                const speed = Math.sqrt(ball.vx**2 + ball.vy**2);
                const maxMovement = speed * dt;
                const numSubSteps = Math.ceil(maxMovement / (BALL_RADIUS * 0.5)) || 1;
                const subDt = dt / numSubSteps;

                for (let step = 0; step < numSubSteps; step++) {
                    const targetPos = new THREE.Vector2(TABLE_WIDTH / 2, TABLE_HEIGHT / 2);
                    const currentPos = new THREE.Vector2(ball.mesh.position.x, ball.mesh.position.y);
                    const acceleration = 1000; // --- CORRECCIÓN: Reducimos la aceleración para que la fricción domine.
                    const frictionDeceleration = 1500; // --- CORRECCIÓN: Aumentamos drásticamente la fricción para que la bola se frene rápidamente.
                    const MAX_ROLLING_SPEED = 250; // --- CORRECCIÓN: Reducimos la velocidad máxima para evitar que atraviese los límites

                    const direction = targetPos.sub(currentPos);
                    if (direction.length() > 1) { // Evitar aceleración loca en el centro
                        direction.normalize();
                        ball.vx += direction.x * acceleration * subDt;
                        ball.vy += direction.y * acceleration * subDt;
                    }

                    // --- CORRECCIÓN: Aplicar fricción por deceleración y límite de velocidad ---
                    const currentSpeed = Math.sqrt(ball.vx**2 + ball.vy**2);
                    if (currentSpeed > frictionDeceleration * subDt) {
                        ball.vx -= (ball.vx / currentSpeed) * frictionDeceleration * subDt;
                        ball.vy -= (ball.vy / currentSpeed) * frictionDeceleration * subDt;
                    } else {
                        ball.vx = 0;
                        ball.vy = 0;
                    }
                    if (currentSpeed > MAX_ROLLING_SPEED) {
                        ball.vx = (ball.vx / currentSpeed) * MAX_ROLLING_SPEED;
                        ball.vy = (ball.vy / currentSpeed) * MAX_ROLLING_SPEED;
                    }

                    let nextX = ball.mesh.position.x + ball.vx * subDt;
                    let nextY = ball.mesh.position.y + ball.vy * subDt;

                    if (nextX < BALL_RADIUS) {
                        nextX = BALL_RADIUS;
                        ball.vx *= -0.7;
                    } else if (nextX > TABLE_WIDTH - BALL_RADIUS) {
                        nextX = TABLE_WIDTH - BALL_RADIUS;
                        ball.vx *= -0.7;
                    }
                    if (nextY < BALL_RADIUS) {
                        nextY = BALL_RADIUS;
                        ball.vy *= -0.7;
                    } else if (nextY > TABLE_HEIGHT - BALL_RADIUS) {
                        nextY = TABLE_HEIGHT - BALL_RADIUS;
                        ball.vy *= -0.7;
                    }

                    ball.mesh.position.x = nextX;
                    ball.mesh.position.y = nextY;
                }

                // --- CORRECCIÓN: Comprobar si la bola sale de los límites en CADA frame de la rodadura ---
                const pos = ball.mesh.position;
                const margin = 1; // Un margen pequeño es suficiente aquí
                if (pos.x < -margin || pos.x > TABLE_WIDTH + margin || pos.y < -margin || pos.y > TABLE_HEIGHT + margin) {
                    console.error(`¡ALERTA! Bola #${ball.number} ha salido de los límites durante la rodadura.`, {
                        position: pos.clone()
                    });
                }
                
                const distToCenter = ball.mesh.position.distanceTo(new THREE.Vector3(TABLE_WIDTH / 2, TABLE_HEIGHT / 2, ball.mesh.position.z));
                if (distToCenter < 10) {
                    scene.remove(ball.mesh);
                    if (ball.shadowMesh) scene.remove(ball.shadowMesh);
                    balls.splice(i, 1);
                }
            }
        }

        balls.forEach(ball => {
            if (ball.isActive && (ball.vx !== 0 || ball.vy !== 0)) {
                // La distancia recorrida en este frame es la velocidad (en unidades/tick) * ticks
                const distance = Math.sqrt(Math.pow(ball.vx * timeStep, 2) + Math.pow(ball.vy * timeStep, 2));
                const rotationAngle = distance / BALL_RADIUS;

                // El eje de rotación es perpendicular a la dirección del movimiento (vx, vy)
                const rotationAxis = new THREE.Vector3(-ball.vy, ball.vx, 0).normalize();

                const deltaQuaternion = new THREE.Quaternion();
                deltaQuaternion.setFromAxisAngle(rotationAxis, rotationAngle);

                ball.mesh.quaternion.premultiply(deltaQuaternion);
            }
        });
    }

    // --- NUEVO: Actualizar la simulación de física 3D para las bolas que caen ---
    updateFallPhysics(dt);

    // --- MEJORA: Mover el punto rojo según el efecto (spin) seleccionado ---
    if (cueBallRedDot) {
        // La posición base es en la parte superior de la bola.
        // Movemos el punto en X e Y según el spinOffset, escalado por el radio de la bola.
        cueBallRedDot.position.x = -spinOffset.x * BALL_RADIUS * 0.7;
        cueBallRedDot.position.y = -spinOffset.y * BALL_RADIUS * 0.7;

        // --- CORRECCIÓN: Contrarrestar la rotación de la bola para que el punto siempre apunte al taco ---
        // La rotación del punto ahora se controla por la dirección del apuntado.
        // Hacemos que el punto "mire" en la dirección opuesta a la que apunta el taco.
        // Esto se logra copiando la rotación del contenedor de la bola, que ya se alinea con la mira.
        if (cueBall && cueBall.mesh) {
            cueBallRedDot.quaternion.copy(cueBall.mesh.quaternion);
        }
    }

    handleInput();
    updateUI(); // --- NUEVO: Actualizar la UI (incluyendo el taco)
    renderer.render(scene, camera);
}

// --- NUEVO: Función para marcar que un tiro ha comenzado ---
window.startShot = () => { // --- CORRECCIÓN: Hacerla global para que ui.js pueda llamarla
    startShot();
}

// --- NUEVO: Función global para activar la vibración de la pantalla ---
window.triggerScreenShake = (intensity, duration) => {
    shakeIntensity = intensity;
    shakeDuration = duration;
    // Guardar la posición actual de la cámara para restaurarla después
    originalCameraPosition.copy(camera.position);
};


// --- 4. Iniciar el juego --- (Lógica de inicialización refactorizada)

function initGame() {
    initializeHandles(); // Inicializamos los puntos de los bordes
    initFallPhysics(); 

    // --- MODIFICACIÓN: La inicialización de audio y UI se hace aquí, pero la carga se dispara después ---
    initAudio(camera); 

    // --- CORRECCIÓN: setupBalls() ya no se llama aquí. Se pasa como callback a loadBallModels.
    initializeUI(); // Inicializamos los listeners y elementos de la UI
    gameLoop(); // Iniciar el bucle del juego

}

// --- MODIFICACIÓN: El juego se inicializa por pasos controlados por el loadingManager ---
setOnLoadingComplete((step, onStepComplete) => {
    // El loadingManager nos dice qué paso ejecutar.
    switch (step) {
        case 'init_game':
            initGame();
            // El bucle del juego ya está corriendo, pero la pantalla de carga sigue encima.
            break;

        case 'setup_balls':
            // Los modelos ya están cargados, ahora creamos las bolas en la escena.
            setupBalls(true); // El 'true' indica que es la configuración inicial.
            break;

        case 'warmup_physics':
            // Ejecuta una simulación muy breve para forzar la compilación JIT del navegador.
            console.log("Realizando calentamiento de la física para optimizar el primer tiro...");
            const warmUpFrames = 15; // Aumentamos un poco para asegurar la compilación
            for (let i = 0; i < warmUpFrames; i++) {
                updateBallPositions(1 / 60, balls, pockets, handles, BALL_RADIUS);
            }
            // Reseteamos cualquier posible micro-movimiento que se haya podido generar
            balls.forEach(ball => {
                ball.vx = 0;
                ball.vy = 0;
            });
            console.log("Calentamiento finalizado.");
            break;
        
        case 'super_warmup':
            // --- SOLUCIÓN DEFINITIVA: Simular un golpe real de forma invisible ---
            console.log("Iniciando Super Calentamiento (Física, Audio, Shaders)...");
            
            // 1. Silenciar todos los sonidos temporalmente.
            window.muteAllSounds(true);

            // 2. Simular un golpe potente a la bola blanca.
            if (cueBall) {
                cueBall.vx = 1500; // Impulso fuerte para asegurar colisiones.
                cueBall.vy = 50;
            }

            // 3. Ejecutar varios frames de la simulación completa.
            // Esto forzará la compilación JIT de las colisiones, la compilación de shaders
            // y la inicialización de los buffers de audio.
            for (let i = 0; i < 20; i++) {
                updateBallPositions(1 / 60, balls, pockets, handles, BALL_RADIUS);
            }

            // 4. Resetear completamente el estado del juego a su posición inicial.
            setupBalls(true); // Esto recoloca todas las bolas y resetea sus velocidades.
            window.muteAllSounds(false); // 5. Reactivar los sonidos.
            console.log("Super Calentamiento finalizado. El juego está 100% listo.");
            break;
    }

    // Notificamos al loadingManager que este paso ha terminado, para que pueda actualizar la barra
    // de progreso y decidir si empieza el siguiente paso o finaliza la carga.
    onStepComplete();
});

// --- MODIFICACIÓN: Centralizar el inicio de todas las cargas ---

// 0. Definimos los pasos de procesamiento que ocurrirán después de la descarga de archivos.
setProcessingSteps(['init_game', 'setup_balls', 'warmup_physics', 'super_warmup']);

// 1. Preparamos todos los cargadores
prepareAudio();
prepareBallLoaders();
prepareUIResources();
prepareAimingResources(); // --- CORRECCIÓN: Añadir la llamada para cargar los recursos del taco.
loadTableTexture(); // --- NUEVO: Iniciar la carga de la textura de la mesa aquí.

// 2. Iniciamos la carga de los modelos, que es la operación principal que el LoadingManager rastreará.
// --- MODIFICACIÓN: Ya no se llama a setupBalls aquí. Se ha convertido en un paso de procesamiento.
loadBallModels();
