// --- Módulo de Física ---
import * as THREE from 'three';
import { playSound } from './audioManager.js';
import { shotStartTime, getGameState, setFirstHitBall } from './gameState.js'; // --- NUEVO: Importar el tiempo de inicio del tiro
import { initSpatialManager, updateGrid, getNearbyObjects } from './spatialManager.js';
import { BALL_RADIUS } from './config.js';

let physicsInitialized = false;

/**
 * Actualiza la posición de todas las bolas basándose en la física 2D simple.
 * @param {number} dt - Delta time, el tiempo transcurrido desde el último frame.
 * @param {Array} balls - El array de todos los objetos de bola.
 * @param {Array} pockets - El array de los objetos de tronera.
 * @param {Array} handles - El array de los puntos que definen los bordes.
 * @param {number} BALL_RADIUS - El radio de las bolas.
 */
export function updateBallPositions(dt, balls, pockets, handles, BALL_RADIUS) {
    // --- LOG: Indica el inicio de la actualización de la física. Es muy frecuente, por lo que está comentado.
    // console.log('[Fisica] Llamando a updateBallPositions()...');

    // --- MODIFICADO: Inicializar el gestor espacial en la primera ejecución ---
    if (!physicsInitialized) {
        initSpatialManager(BALL_RADIUS);
        physicsInitialized = true;
    }

    // --- MEJORADO: Modelo de fricción más realista y coeficiente de restitución ---
    const SLIDING_FRICTION = 0.010;  // --- CORRECCIÓN: Reducida para que las bolas deslicen más
    const ROLLING_FRICTION = 0.010; // --- CORRECCIÓN: Reducida para que las bolas rueden más
    const SPIN_FRICTION_THRESHOLD = 0.1; // Velocidad por debajo de la cual el deslizamiento se convierte en rodadura
    const CUSHION_RESTITUTION = 0.80; // Coeficiente de restitución para los bordes (80% de la energía se conserva).
    const BALL_RESTITUTION = 0.95;    // Coeficiente de restitución para colisiones entre bolas. 0.98 es casi perfectamente elástico. Un valor más bajo como 0.95 disipará más energía.
    const IMPACT_THRESHOLD = 0.01;    // Umbral mínimo de fuerza de impacto para reproducir un sonido.
    const MAX_BALL_SPEED = 12.0;      // --- CORRECCIÓN: Aumentamos el límite para que los rebotes sean más realistas.

    const pocketedInFrame = []; // --- NUEVO: Array para registrar las bolas entroneradas en este frame

    const timeStep = dt * 100; // Multiplicador para ajustar la velocidad

    // --- NUEVO: Lógica de Sub-pasos (Sub-stepping) para evitar el "túnel" ---
    const maxSpeed = Math.max(...balls.map(b => Math.sqrt(b.vx**2 + b.vy**2)));
    const maxMovement = maxSpeed * timeStep;
    
    // Si el movimiento máximo en un frame es mayor que una fracción del radio de la bola,
    // dividimos el frame en sub-pasos para evitar que las bolas atraviesen las paredes.
    const numSubSteps = Math.ceil(maxMovement / (BALL_RADIUS * 0.1)); // --- MEJORA: Mayor granularidad para los sub-pasos para evitar tunneling
    const subTimeStep = timeStep / numSubSteps;

    // --- LOG: Bucle de sub-pasos de la física.
    // if (numSubSteps > 1) console.log(`[Fisica] Bucle de sub-pasos activo: ${numSubSteps} pasos.`);

    for (let step = 0; step < numSubSteps; step++) {
        // --- MODIFICADO: Actualizar la rejilla espacial con las posiciones actuales ---
        updateGrid(balls, handles);

        // 1. Mover bolas, aplicar fricción y detectar colisiones con bordes
        balls.forEach(ball => {
            if (ball.isActive) {

                // --- MEJORADO: Lógica de Fricción Dual (Deslizamiento y Rodadura) ---
                const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                if (speed > 0) {
                    const frictionCoefficient = speed > SPIN_FRICTION_THRESHOLD ? SLIDING_FRICTION : ROLLING_FRICTION;
                    const frictionForce = frictionCoefficient * subTimeStep;

                    if (speed > frictionForce) {
                        ball.vx -= (ball.vx / speed) * frictionForce;
                        ball.vy -= (ball.vy / speed) * frictionForce;
                    } else {
                        ball.vx = 0;
                        ball.vy = 0;
                    }

                    // --- NUEVO: Disipación gradual del efecto (spin) con el tiempo ---
                    if (ball.spin) {
                        const SPIN_DECAY = 0.005; // Factor de decaimiento del spin por sub-paso
                        ball.spin.x *= (1 - SPIN_DECAY * subTimeStep);
                        ball.spin.y *= (1 - SPIN_DECAY * subTimeStep);
                    }
                }

                const dx = ball.vx * subTimeStep;
                const dy = ball.vy * subTimeStep;
                ball.mesh.position.x += dx;
                ball.mesh.position.y += dy;
                // --- NUEVO: Acumular la distancia recorrida ---
                ball.distanceTraveled += Math.sqrt(dx**2 + dy**2);

                // --- NUEVO: Actualizar la posición de la sombra suave ---
                if (ball.shadowMesh) {
                    ball.shadowMesh.position.set(ball.mesh.position.x, ball.mesh.position.y, 0);
                }

                // --- OPTIMIZADO: Colisión con bordes usando la rejilla espacial ---
                const nearby = getNearbyObjects(ball);
                for (const segment of nearby.segments) {
                    const { p1, p2 } = segment;

                    // Ignorar colisiones con bordes si la bola ya está entrando en una tronera
                    if (ball.pocketedState === 'entering_pocket') continue;

                    // Ignorar colisiones con los bordes que forman la apertura de las troneras
                    if (isSegmentNearPocket(p1, p2, pockets)) continue;

                    const ballPos = { x: ball.mesh.position.x, y: ball.mesh.position.y };
                    const wallVec = { x: p2.x - p1.x, y: p2.y - p1.y };
                    const wallLenSq = wallVec.x * wallVec.x + wallVec.y * wallVec.y;
                    const ballToP1 = { x: ballPos.x - p1.x, y: ballPos.y - p1.y };

                    let t = (ballToP1.x * wallVec.x + ballToP1.y * wallVec.y) / wallLenSq;
                    t = Math.max(0, Math.min(1, t));

                    const closestPoint = { x: p1.x + t * wallVec.x, y: p1.y + t * wallVec.y };
                    const distVec = { x: ballPos.x - closestPoint.x, y: ballPos.y - closestPoint.y };
                    const distanceSq = distVec.x * distVec.x + distVec.y * distVec.y;

                    if (distanceSq < BALL_RADIUS * BALL_RADIUS) {
                        const distance = Math.sqrt(distanceSq);
                        const overlap = BALL_RADIUS - distance;
                        const collisionNormal = { x: distVec.x / distance, y: distVec.y / distance };

                        ball.mesh.position.x += collisionNormal.x * overlap;
                        ball.mesh.position.y += collisionNormal.y * overlap;

                        const v_normal = ball.vx * collisionNormal.x + ball.vy * collisionNormal.y;
                        const v_tangent = ball.vx * collisionNormal.y - ball.vy * collisionNormal.x;

                        // --- SOLUCIÓN: Aplicar efecto vertical y lateral en el rebote con la banda ---
                        let spinFactor = 0;
                        if (ball === balls[0] && ball.spin) {
                            // --- CORRECCIÓN: El efecto lateral estaba invertido. Se corrige invirtiendo el signo. ---
                            // El efecto lateral (side spin) depende de la velocidad normal al impacto con la banda.
                            const sideSpin = -ball.spin.x * v_normal * 0.5;
                            // El efecto vertical (follow/draw) se aplica a la velocidad normal para que "muerda" la banda.
                            const verticalSpin = -ball.spin.y * Math.abs(v_normal) * 0.6; // --- SOLUCIÓN: Invertir el signo del efecto vertical
                            // --- NUEVO: Consumir parte del efecto lateral utilizado ---
                            ball.spin.x *= 0.85; // Se consume un 15% del efecto lateral en el impacto
                            spinFactor = sideSpin;
                            ball.vx += collisionNormal.x * verticalSpin;
                            ball.vy += collisionNormal.y * verticalSpin;
                        }

                        const new_v_normal = -v_normal * CUSHION_RESTITUTION - (ball.spin.y * Math.abs(v_normal) * 0.6); // --- SOLUCIÓN: Invertir el signo aquí también
                        const new_v_tangent = v_tangent - spinFactor;

                        const impactSpeed = Math.abs(v_normal);
                        if (impactSpeed > IMPACT_THRESHOLD) {
                            const normalizedImpact = Math.min(impactSpeed / 10, 1.0);
                            let volume = Math.pow(normalizedImpact, 2);
                            // --- CORRECCIÓN: Asegurarse de que el volumen sea un número finito ---
                            if (!isFinite(volume)) volume = 0;

                            playSound('cushionHit', volume * 0.8);

                            // --- NUEVO: Vibración sutil si es la bola blanca ---
                            if (ball.number === null && 'vibrate' in navigator) {
                                navigator.vibrate(50);
                            }
                        }

                        ball.vx = new_v_normal * collisionNormal.x + new_v_tangent * collisionNormal.y;
                        ball.vy = new_v_normal * collisionNormal.y - new_v_tangent * collisionNormal.x;

                        // --- SOLUCIÓN: Limitar la velocidad después del rebote en la banda para controlar el efecto de spin ---
                        const speed = Math.sqrt(ball.vx**2 + ball.vy**2);
                        if (speed > MAX_BALL_SPEED) { ball.vx *= MAX_BALL_SPEED / speed; ball.vy *= MAX_BALL_SPEED / speed; }

                    }
                }

                // --- CORRECCIÓN: Comprobar si la bola ha caído en una tronera DESPUÉS de las colisiones con los bordes ---
                for (let pocketIndex = 0; pocketIndex < pockets.length; pocketIndex++) {
                    const pocket = pockets[pocketIndex];
                    const ballPos = ball.mesh.position;
                    let isInside = false;
                    // Algoritmo de Ray-Casting para saber si un punto está dentro de un polígono
                    for (let i = 0, j = pocket.points.length - 1; i < pocket.points.length; j = i++) {
                        const pi = pocket.points[i];
                        const pj = pocket.points[j];
                        const intersect = ((pi.y > ballPos.y) !== (pj.y > ballPos.y))
                            && (ballPos.x < (pj.x - pi.x) * (ballPos.y - pi.y) / (pj.y - pi.y) + pi.x);
                        if (intersect) {
                            isInside = !isInside;
                        }
                    }

                    // --- MODIFICACIÓN: Lógica de entronerado en dos fases ---
                    if (isInside) {
                        // --- MODIFICACIÓN: La bola se entronera instantáneamente ---
                        // --- FIX: Usar 'pocketedState' para una guarda más robusta y evitar dobles entronerados.
                        if (ball.pocketedState !== 'collected') {
                            ball.isPocketed = true; // Marcar como entronerada para no procesarla de nuevo
                            pocketedInFrame.push({ number: ball.number }); // Añadir a la lista del turno
                            playSound('pocket', 0.7); // Reproducir sonido
                            // Marcar para ser eliminada inmediatamente
                            ball.pocketedState = 'collected';
                            ball.isActive = false;
                            if (ball.shadowMesh) ball.shadowMesh.visible = false;
                            ball.mesh.visible = false;
                        }
                        break; // Salir del bucle de troneras, la bola ya ha caído
                    }
                }
            }
        });

        // 2. Resolver colisiones entre bolas
        const checkedPairs = new Set();
        for (const ball1 of balls) {
            if (!ball1.isActive) continue;

            const nearbyBalls = getNearbyObjects(ball1).balls;
            for (const ball2 of nearbyBalls) {
                // Evitar procesar el mismo par dos veces (ej. 1-2 y 2-1)
                const pairKey = ball1.number < ball2.number ? `${ball1.number}-${ball2.number}` : `${ball2.number}-${ball1.number}`;
                if (checkedPairs.has(pairKey)) continue;
                checkedPairs.add(pairKey);

                const dx = ball2.mesh.position.x - ball1.mesh.position.x;
                const dy = ball2.mesh.position.y - ball1.mesh.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const totalRadius = BALL_RADIUS * 2;

                if (distance < totalRadius) {
                    const nx = dx / distance;
                    const ny = dy / distance;

                    const overlap = totalRadius - distance;
                    ball1.mesh.position.x -= overlap * nx / 2;
                    ball1.mesh.position.y -= overlap * ny / 2;
                    ball2.mesh.position.x += overlap * nx / 2;
                    ball2.mesh.position.y += overlap * ny / 2;

                    const k = -(1 + BALL_RESTITUTION) * ((ball2.vx - ball1.vx) * nx + (ball2.vy - ball1.vy) * ny) / 2;
                    ball1.vx -= k * nx; ball1.vy -= k * ny;
                    ball2.vx += k * nx; ball2.vy += k * ny;

                    // --- NUEVO: Registrar la primera bola golpeada en el turno ---
                    const cueBall = ball1.number === null ? ball1 : (ball2.number === null ? ball2 : null);
                    const objectBall = ball1.number === null ? ball2 : (ball2.number === null ? ball1 : null);

                    if (cueBall && objectBall) {
                        setFirstHitBall(objectBall);
                    }

                    const impactForce = Math.abs(k);
                    if (impactForce > IMPACT_THRESHOLD) {
                        const normalizedImpact = Math.min(impactForce / 25, 1.0);
                        const volume = normalizedImpact * 0.8; // Volumen proporcional a la fuerza del impacto
                        playSound('ball_hit', volume, 1.0);

                        // --- NUEVO: Vibración cuando la bola blanca golpea otra bola ---
                        if (cueBall && 'vibrate' in navigator) {
                            navigator.vibrate(50);
                        }
                    }

                    // --- NUEVO: Aplicar efecto de corrido (follow) y retroceso (draw) ---
                    // Esta lógica solo se aplica si una de las bolas es la bola blanca.
                    if (cueBall && cueBall.spin && cueBall.spin.y !== 0) {
                        const speedAfterCollision = Math.sqrt(cueBall.vx ** 2 + cueBall.vy ** 2);
                        // --- SOLUCIÓN: El efecto ahora depende de la potencia inicial del tiro ---
                        // Calculamos la potencia inicial del tiro (0 a 1) basándonos en la velocidad inicial guardada.
                        const initialSpeed = Math.sqrt(cueBall.initialVx ** 2 + cueBall.initialVy ** 2);
                        const maxInitialSpeed = 120; // Un valor de referencia para la velocidad máxima de un tiro potente.
                        const shotPowerFactor = Math.min(initialSpeed / maxInitialSpeed, 1.0);

                        if (speedAfterCollision > 0.01) {
                            // --- SOLUCIÓN: Aplicar efecto vertical (corrido/retroceso) ---
                            if (cueBall.spin.y !== 0) {
                                const verticalSpinForce = cueBall.spin.y * impactForce * 0.1 * shotPowerFactor;
                                const dirX = cueBall.vx / speedAfterCollision;
                                const dirY = cueBall.vy / speedAfterCollision;
                                cueBall.vx += dirX * verticalSpinForce;
                                cueBall.vy += dirY * verticalSpinForce;
                                cueBall.spin.y *= 0.7; // Consumir efecto vertical
                            }

                            // --- SOLUCIÓN: Aplicar efecto lateral, también dependiente de la potencia ---
                            if (cueBall.spin.x !== 0) {
                                const sideSpinForce = cueBall.spin.x * impactForce * 0.1 * shotPowerFactor;
                                // La fuerza se aplica de forma perpendicular a la dirección del movimiento
                                const perpDirX = -cueBall.vy / speedAfterCollision;
                                const perpDirY = cueBall.vx / speedAfterCollision;
                                cueBall.vx += perpDirX * sideSpinForce;
                                cueBall.vy += perpDirY * sideSpinForce;
                                cueBall.spin.x *= 0.7; // Consumir efecto lateral
                            }
                        }
                    }
                }
            }
        };
    }

    // --- LOG: Indica que el bucle de sub-pasos ha terminado.
    // if (numSubSteps > 1) console.log(`%c[Fisica]%c Bucle de sub-pasos detenido.`, 'color: #e67e22; font-weight: bold;', 'color: inherit;');

    return pocketedInFrame; // --- NUEVO: Devolver las bolas entroneradas
}

/**
 * Comprueba si un segmento de pared está cerca de alguna tronera para evitar colisiones falsas.
 */
function isSegmentNearPocket(p1, p2, pockets) {
    // --- LOG: Indica que se está comprobando si un segmento está cerca de una tronera.
    // console.log('[Fisica] Llamando a isSegmentNearPocket()...');
    for (const pocket of pockets) {
        const pocketCenter = pocket.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
        pocketCenter.x /= pocket.points.length;
        pocketCenter.y /= pocket.points.length;

        // --- CORRECCIÓN: Lógica mejorada para detectar si un segmento pertenece a la apertura de una tronera ---
        const distToP1 = Math.sqrt(Math.pow(p1.x - pocketCenter.x, 2) + Math.pow(p1.y - pocketCenter.y, 2));
        const distToP2 = Math.sqrt(Math.pow(p2.x - pocketCenter.x, 2) + Math.pow(p2.y - pocketCenter.y, 2));

        // Si ambos puntos del segmento están cerca del centro de una tronera, es probable que sea la apertura.
        const pocketRadiusApproximation = 40; // Un radio aproximado para la zona de la tronera
        if (distToP1 < pocketRadiusApproximation && distToP2 < pocketRadiusApproximation) {
            return true;
        }
    }
    // --- LOG: Indica que el bucle de comprobación de troneras ha terminado.
    // console.log('%c[Fisica]%c isSegmentNearPocket() finalizado.', 'color: #e67e22; font-weight: bold;', 'color: inherit;');
    return false;
}

/**
 * --- NUEVO: Aplica directamente el estado de las bolas recibido del servidor.
 * Se usa en el cliente no autoritativo para sincronizar la mesa.
 * @param {Array} serverBalls - El array con el estado de las bolas del servidor.
 * @param {Array} localBalls - El array de las bolas locales.
 */
export function applyBallStatesFromServer(serverBalls, localBalls) {
    serverBalls.forEach(serverBall => {
        const localBall = localBalls.find(b => b.number === serverBall.number);
        if (localBall) {
            // Interpolar suavemente hacia la posición del servidor para evitar saltos bruscos
            const oldX = localBall.mesh.position.x;
            const oldY = localBall.mesh.position.y;
            const lerpFactor = 0.5; // Un valor más alto hace que la corrección sea más rápida
            localBall.mesh.position.x += (serverBall.x - localBall.mesh.position.x) * lerpFactor;
            localBall.mesh.position.y += (serverBall.y - localBall.mesh.position.y) * lerpFactor;

            // --- CORRECCIÓN: Calcular y aplicar la rotación visual en el cliente no autoritativo ---
            const dx = localBall.mesh.position.x - oldX;
            const dy = localBall.mesh.position.y - oldY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0.01) { // Solo rotar si hay un movimiento significativo
                const rotationAngle = distance / BALL_RADIUS;
                const rotationAxis = new THREE.Vector3(-dy, dx, 0).normalize();

                const deltaQuaternion = new THREE.Quaternion();
                deltaQuaternion.setFromAxisAngle(rotationAxis, rotationAngle);

                // Aplicar la rotación a la malla interna de la bola
                localBall.mesh.children[0].quaternion.premultiply(deltaQuaternion);
            }

            localBall.mesh.visible = serverBall.isActive;
            if (localBall.shadowMesh) localBall.shadowMesh.visible = serverBall.isActive;

            // --- CORRECCIÓN: Actualizar también la posición de la sombra ---
            if (localBall.shadowMesh) {
                localBall.shadowMesh.position.set(serverBall.x, serverBall.y, 0.1);
            }
        }
    });
}

/**
 * Comprueba si alguna de las bolas está actualmente en movimiento.
 * @param {Array} balls - El array de todos los objetos de bola.
 * @returns {boolean} - True si alguna bola se está moviendo, false en caso contrario.
 */
export function areBallsMoving(balls) {
    // --- LOG: Indica que se está comprobando si las bolas se mueven. Es muy frecuente.
    // console.log('[Fisica] Llamando a areBallsMoving()...');
    for (const ball of balls) {
        // --- CORRECCIÓN: Comprobar solo las bolas activas ---
        if (ball.isActive && (Math.abs(ball.vx) > 1e-6 || Math.abs(ball.vy) > 1e-6)) {
            return true;
        }
    }
    return false;
    // --- LOG: Indica que el bucle de comprobación de movimiento ha terminado.
    // console.log('%c[Fisica]%c areBallsMoving() finalizado. Resultado: false.', 'color: #e67e22; font-weight: bold;', 'color: inherit;');
}