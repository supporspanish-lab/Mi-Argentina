// --- IA MEJORADA para Pool ---
import { pockets, BALL_RADIUS, TABLE_WIDTH, TABLE_HEIGHT } from './config.js';
import { areBallsMoving } from './fisicas.js';
import { updateDoc } from './login/auth.js';

const pocketCenters = pockets.map(p => p.center);

// --- CONSTANTES DE CONFIGURACIÓN ---
const AI_DIFFICULTY = {
    EASY: { accuracy: 0.7, maxPower: 0.6, thinkTime: 1500 },
    MEDIUM: { accuracy: 0.85, maxPower: 0.75, thinkTime: 1000 },
    HARD: { accuracy: 0.95, maxPower: 1.0, thinkTime: 500 }
};

const CURRENT_DIFFICULTY = { accuracy: 1.0, maxPower: 1.0, thinkTime: 500 };

// --- FUNCIONES DE GEOMETRÍA MEJORADAS ---

function getDistanceBetween(p1, p2) {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

function isPathBlocked(start, end, balls, radius, ignoreBalls = []) {
    const path = [];
    const pathLength = getDistanceBetween(start, end);
    
    for (const ball of balls) {
        if (ignoreBalls.includes(ball.number) || !ball.isActive || ball.number === null) continue;
        if (ball.number === start.number) continue;
        
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = pathLength;
        
        if (length === 0) continue;
        
        const t = Math.max(0, Math.min(1, ((ball.x - start.x) * dx + (ball.y - start.y) * dy) / (length * length)));
        const projX = start.x + t * dx;
        const projY = start.y + t * dy;
        const dist = getDistanceBetween(ball, { x: projX, y: projY });
        
        if (dist < radius * 2.2) { // Margen de seguridad aumentado
            return { blocked: true, blocker: ball, distance: getDistanceBetween(start, ball) };
        }
    }
    return { blocked: false, blocker: null, distance: 0 };
}

// --- CÁLCULO DE ÁNGULO DE CORTE ---
function calculateCutAngle(cueBall, targetBall, pocket) {
    const targetToPocket = Math.atan2(pocket.y - targetBall.y, pocket.x - targetBall.x);
    const cueToTarget = Math.atan2(targetBall.y - cueBall.y, targetBall.x - cueBall.x);
    let cutAngle = Math.abs(targetToPocket - cueToTarget);
    
    if (cutAngle > Math.PI) cutAngle = 2 * Math.PI - cutAngle;
    return cutAngle;
}

// --- EVALUACIÓN DE DIFICULTAD DE DISPARO ---
function evaluateShotDifficulty(cueBall, targetBall, pocket, balls) {
    let difficulty = 0;
    
    // 1. Distancia al objetivo
    const distToTarget = getDistanceBetween(cueBall, targetBall);
    difficulty += distToTarget / 10;
    
    // 2. Distancia del objetivo a la tronera
    const targetToPocket = getDistanceBetween(targetBall, pocket);
    difficulty += targetToPocket / 8;
    
    // 3. Ángulo de corte (cortes cerrados son más difíciles)
    const cutAngle = calculateCutAngle(cueBall, targetBall, pocket);
    difficulty += Math.abs(cutAngle) * 50;
    
    // 4. Obstrucciones
    const pathCheck = isPathBlocked(cueBall, targetBall, balls, BALL_RADIUS);
    if (pathCheck.blocked) difficulty += 100;
    
    const pocketCheck = isPathBlocked(targetBall, pocket, balls, BALL_RADIUS, [targetBall.number]);
    if (pocketCheck.blocked) difficulty += 80;
    
    // 5. Ángulo extremo (muy recto o muy oblicuo)
    if (cutAngle < Math.PI / 12 || cutAngle > Math.PI * 5 / 6) difficulty += 30;
    
    return difficulty;
}

// --- CÁLCULO DE PUNTO DE IMPACTO MEJORADO ---
function calculateHitPoint(cueBall, targetBall, pocket) {
    const dx = pocket.x - targetBall.x;
    const dy = pocket.y - targetBall.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist === 0) return null;
    
    const normX = dx / dist;
    const normY = dy / dist;
    
    // Punto de impacto: posición de la bola objetivo menos el radio en dirección a la tronera
    const hitX = targetBall.x - normX * (BALL_RADIUS * 2);
    const hitY = targetBall.y - normY * (BALL_RADIUS * 2);
    
    return { x: hitX, y: hitY };
}

// --- CÁLCULO DE POTENCIA ADAPTATIVA ---
function calculateOptimalPower(distance, cutAngle, hasClearPath) {
    let basePower = 0.5;
    
    // Ajustar por distancia
    if (distance < 150) basePower = 0.35;
    else if (distance < 300) basePower = 0.5;
    else if (distance < 500) basePower = 0.65;
    else basePower = 0.8;
    
    // Reducir potencia para cortes difíciles
    if (cutAngle > Math.PI / 3) basePower *= 0.85;
    
    // Aumentar si no hay camino claro (necesita más potencia para superar obstáculos)
    if (!hasClearPath) basePower *= 1.1;
    
    return Math.min(CURRENT_DIFFICULTY.maxPower, Math.max(0.3, basePower));
}

// --- CÁLCULO DE EFECTO ESTRATÉGICO ---
function calculateStrategicSpin(cueBall, targetBall, pocket, cutAngle) {
    let spinX = 0;
    let spinY = 0;

    // Usar efecto lateral solo para cortes cerrados
    if (Math.abs(cutAngle) > Math.PI / 4) {
        const pocketDir = Math.atan2(pocket.y - targetBall.y, pocket.x - targetBall.x);
        const cueDir = Math.atan2(targetBall.y - cueBall.y, targetBall.x - cueBall.x);

        if (Math.sin(pocketDir - cueDir) > 0) {
            spinX = 0.3; // Efecto a la derecha
        } else {
            spinX = -0.3; // Efecto a la izquierda
        }
    }

    // Usar retroceso solo si es necesario para posicionamiento
    const distToPocket = getDistanceBetween(targetBall, pocket);
    if (distToPocket < 200) {
        spinY = -0.4; // Retroceso para no seguir a la bola
    }
    // No aplicar avance suave por defecto

    return { x: spinX, y: spinY };
}

// --- REBOTES MEJORADOS ---
function calculateBankShot(cueBall, targetBall, pocket, cushion, balls) {
    let bankPoint = null;
    const margin = BALL_RADIUS * 2;
    
    if (cushion === 'top') {
        const mirrorY = -pocket.y;
        const dy = mirrorY - targetBall.y;
        if (dy === 0) return null;
        const t = (margin - targetBall.y) / dy;
        const ix = targetBall.x + t * (pocket.x - targetBall.x);
        if (ix >= margin && ix <= TABLE_WIDTH - margin) {
            bankPoint = { x: ix, y: margin };
        }
    } else if (cushion === 'bottom') {
        const mirrorY = 2 * TABLE_HEIGHT - pocket.y;
        const dy = mirrorY - targetBall.y;
        if (dy === 0) return null;
        const t = (TABLE_HEIGHT - margin - targetBall.y) / dy;
        const ix = targetBall.x + t * (pocket.x - targetBall.x);
        if (ix >= margin && ix <= TABLE_WIDTH - margin) {
            bankPoint = { x: ix, y: TABLE_HEIGHT - margin };
        }
    } else if (cushion === 'left') {
        const mirrorX = -pocket.x;
        const dx = mirrorX - targetBall.x;
        if (dx === 0) return null;
        const t = (margin - targetBall.x) / dx;
        const iy = targetBall.y + t * (pocket.y - targetBall.y);
        if (iy >= margin && iy <= TABLE_HEIGHT - margin) {
            bankPoint = { x: margin, y: iy };
        }
    } else if (cushion === 'right') {
        const mirrorX = 2 * TABLE_WIDTH - pocket.x;
        const dx = mirrorX - targetBall.x;
        if (dx === 0) return null;
        const t = (TABLE_WIDTH - margin - targetBall.x) / dx;
        const iy = targetBall.y + t * (pocket.y - targetBall.y);
        if (iy >= margin && iy <= TABLE_HEIGHT - margin) {
            bankPoint = { x: TABLE_WIDTH - margin, y: iy };
        }
    }
    
    if (!bankPoint) return null;
    
    // Verificar que el rebote no esté bloqueado
    const pathToBankCheck = isPathBlocked(targetBall, bankPoint, balls, BALL_RADIUS);
    if (pathToBankCheck.blocked) return null;
    
    return bankPoint;
}

// --- DETECCIÓN DE COMBOS ---
function findComboShots(cueBall, targetBalls, balls) {
    const comboShots = [];
    
    for (const target of targetBalls) {
        // Buscar bolas intermedias
        for (const intermediate of balls) {
            if (!intermediate.isActive || intermediate.number === null || intermediate.number === target.number) continue;
            
            // Verificar si intermediate puede golpear target hacia alguna tronera
            for (const pocket of pocketCenters) {
                const dist = getDistanceBetween(intermediate, target);
                if (dist > BALL_RADIUS * 4 || dist < BALL_RADIUS * 1.5) continue;
                
                const hitPoint = calculateHitPoint(intermediate, target, pocket);
                if (!hitPoint) continue;
                
                // Verificar si el camino del combo es válido
                const pathCheck1 = isPathBlocked(cueBall, intermediate, balls, BALL_RADIUS);
                const pathCheck2 = isPathBlocked(intermediate, target, balls, BALL_RADIUS, [intermediate.number]);
                const pathCheck3 = isPathBlocked(target, pocket, balls, BALL_RADIUS, [target.number, intermediate.number]);
                
                if (!pathCheck1.blocked && !pathCheck2.blocked && !pathCheck3.blocked) {
                    const difficulty = evaluateShotDifficulty(cueBall, intermediate, pocket, balls) + 50;
                    comboShots.push({
                        type: 'combo',
                        target,
                        intermediate,
                        pocket,
                        difficulty
                    });
                }
            }
        }
    }
    
    return comboShots;
}

// --- FUNCIÓN PRINCIPAL DE CÁLCULO ---
function calculateAIShot(gameState, balls) {
    console.log('[IA] calculateAIShot: balls total:', balls.length);
    const cueBall = balls.find(b => b.number === null);
    console.log('[IA] cueBall:', cueBall ? 'encontrado' : 'no encontrado');
    if (!cueBall) return null;

    const aiPlayerNumber = 2;
    const playerType = gameState.playerAssignments?.[aiPlayerNumber];
    console.log('[IA] playerType:', playerType);

    let targetBalls = [];
    if (playerType === 'solids') {
        targetBalls = balls.filter(b => b.number >= 1 && b.number <= 7 && b.isActive);
    } else if (playerType === 'stripes') {
        targetBalls = balls.filter(b => b.number >= 9 && b.number <= 15 && b.isActive);
    } else {
        targetBalls = balls.filter(b => b.number !== null && b.number !== 8 && b.isActive);
    }
    console.log('[IA] targetBalls iniciales:', targetBalls.length);

    if (targetBalls.length === 0) {
        const blackBall = balls.find(b => b.number === 8 && b.isActive);
        console.log('[IA] blackBall:', blackBall ? 'encontrada' : 'no encontrada');
        if (blackBall) targetBalls = [blackBall];
        else {
            console.log('[IA] No targetBalls, retornando null');
            return null;
        }
    }

    const allShots = [];

    // 1. DISPAROS DIRECTOS
    for (const target of targetBalls) {
        for (const pocket of pocketCenters) {
            const hitPoint = calculateHitPoint(cueBall, target, pocket);
            if (!hitPoint) continue;

            const cutAngle = calculateCutAngle(cueBall, target, pocket);
            const difficulty = evaluateShotDifficulty(cueBall, target, pocket, balls);

            if (difficulty < 600) { // Filtrar disparos imposibles
                allShots.push({
                    type: 'direct',
                    target,
                    pocket,
                    hitPoint,
                    cutAngle,
                    difficulty,
                    distance: getDistanceBetween(cueBall, target)
                });
            }
        }
    }

    // 2. DISPAROS CON REBOTE
    for (const target of targetBalls) {
        for (const pocket of pocketCenters) {
            const cushions = ['top', 'bottom', 'left', 'right'];
            for (const cushion of cushions) {
                const bankPoint = calculateBankShot(cueBall, target, pocket, cushion, balls);
                if (bankPoint) {
                    const difficulty = evaluateShotDifficulty(cueBall, target, pocket, balls) + 60;
                    if (difficulty < 600) {
                        allShots.push({
                            type: 'bank',
                            target,
                            pocket,
                            bankPoint,
                            cushion,
                            difficulty: difficulty + 120, // Penalización mayor para preferir directos
                            distance: getDistanceBetween(cueBall, target)
                        });
                    }
                }
            }
        }
    }

    // 3. DISPAROS COMBO
    const comboShots = findComboShots(cueBall, targetBalls, balls);
    allShots.push(...comboShots);

    // Ordenar por dificultad (menor es mejor)
    allShots.sort((a, b) => a.difficulty - b.difficulty);
    console.log(`[IA] allShots total: ${allShots.length}`);

    const bestShot = allShots[0];
    if (!bestShot) {
        console.log('[IA] No bestShot, retornando null');
        return null;
    }

    let angle, power, spin;

    if (bestShot.type === 'direct') {
        const dx = bestShot.hitPoint.x - cueBall.x;
        const dy = bestShot.hitPoint.y - cueBall.y;
        angle = Math.atan2(dy, dx);
        
        const pathCheck = isPathBlocked(cueBall, bestShot.target, balls, BALL_RADIUS);
        power = calculateOptimalPower(bestShot.distance, bestShot.cutAngle, !pathCheck.blocked);
        spin = calculateStrategicSpin(cueBall, bestShot.target, bestShot.pocket, bestShot.cutAngle);
        
    } else if (bestShot.type === 'bank') {
        const dx = bestShot.bankPoint.x - cueBall.x;
        const dy = bestShot.bankPoint.y - cueBall.y;
        angle = Math.atan2(dy, dx);
        power = 0.7;
        
        // Efecto para rebotes
        spin = { x: bestShot.cushion === 'left' ? 0.4 : bestShot.cushion === 'right' ? -0.4 : 0, y: 0 };
        
    } else if (bestShot.type === 'combo') {
        const hitPoint = calculateHitPoint(cueBall, bestShot.intermediate, bestShot.target);
        const dx = hitPoint.x - cueBall.x;
        const dy = hitPoint.y - cueBall.y;
        angle = Math.atan2(dy, dx);
        power = 0.75;
        spin = { x: 0, y: 0 };
    }

    // Aplicar variación según dificultad (simular imperfección)
    const variation = 0; // Deshabilitado para precisión
    angle += variation;

    return {
        angle,
        power,
        spin,
        cueBallStartPos: { x: cueBall.mesh.position.x, y: cueBall.mesh.position.y },
        shotInfo: bestShot // Para debugging
    };
}

// --- EJECUCIÓN DEL TURNO DE IA ---
async function executeAITurn(gameState, balls, applyServerShot, gameRef, revisarEstado) {
    console.log('[IA] executeAITurn iniciado');
    if (gameState.ballInHandFor === 'ai_player') {
        console.log('[IA] Bola en mano para IA');
        await placeCueBallForAI(gameState, balls, gameRef);
        return;
    }

    const aiShot = calculateAIShot(gameState, balls);
    if (!aiShot) {
        console.log('[IA] No aiShot, terminando');
        return;
    }
    console.log('[IA] aiShot válido, procediendo');

    // Solo abrir el modal si se aplica efecto (spin no es cero)
    const hasSpin = aiShot.spin.x !== 0 || aiShot.spin.y !== 0;

    await updateDoc(gameRef, {
        aimingSpin: aiShot.spin,
        isSpinModalOpen: hasSpin
    });

    if (hasSpin) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        await updateDoc(gameRef, {
            isSpinModalOpen: false
        });
    }

    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));

    applyServerShot(aiShot.angle, aiShot.power, aiShot.spin, aiShot.cueBallStartPos);

    if (gameRef) {
        console.log('[IA] Actualizando Firestore con lastShot');
        await updateDoc(gameRef, {
            lastShot: {
                playerUid: 'ai_player',
                angle: aiShot.angle,
                power: aiShot.power,
                spin: aiShot.spin,
                cueBallStartPos: aiShot.cueBallStartPos,
                timestamp: Date.now()
            },
            ballInHandFor: null,
            cueBallPosition: null,
            aimingSpin: { x: 0, y: 0 },
            isSpinModalOpen: false
        });
    } else {
        console.log('[IA] gameRef no disponible, no se actualiza Firestore');
    }

    console.log('[IA] Esperando a que las bolas se detengan');
    const waitForBallsToStop = () => {
        return new Promise((resolve) => {
            const checkBalls = () => {
                if (areBallsMoving(balls)) {
                    setTimeout(checkBalls, 100);
                } else {
                    resolve();
                }
            };
            checkBalls();
        });
    };

    await waitForBallsToStop();
    console.log('[IA] Bolas detenidas, llamando a revisarEstado');
    revisarEstado(false, gameRef, gameState);
}

// --- COLOCACIÓN INTELIGENTE DE BOLA BLANCA ---
async function placeCueBallForAI(gameState, balls, gameRef) {
    const cueBall = balls.find(b => b.number === null);
    if (!cueBall) return;

    const aiPlayerNumber = 2;
    const playerType = gameState.playerAssignments?.[aiPlayerNumber];

    let targetBalls = [];
    if (playerType === 'solids') {
        targetBalls = balls.filter(b => b.number >= 1 && b.number <= 7 && b.isActive);
    } else if (playerType === 'stripes') {
        targetBalls = balls.filter(b => b.number >= 9 && b.number <= 15 && b.isActive);
    } else {
        targetBalls = balls.filter(b => b.number !== null && b.number !== 8 && b.isActive);
    }

    let bestX = TABLE_WIDTH / 2;
    let bestY = TABLE_HEIGHT / 2;
    let maxScore = -Infinity;

    // Evaluar posiciones en una cuadrícula
    for (let x = TABLE_WIDTH * 0.2; x < TABLE_WIDTH * 0.8; x += TABLE_WIDTH / 10) {
        for (let y = TABLE_HEIGHT * 0.2; y < TABLE_HEIGHT * 0.8; y += TABLE_HEIGHT / 10) {
            let score = 0;
            const testPos = { x, y };
            
            // Verificar que no haya colisión con otras bolas
            let hasCollision = false;
            for (const ball of balls) {
                if (ball.isActive && ball.number !== null) {
                    if (getDistanceBetween(testPos, ball) < BALL_RADIUS * 3) {
                        hasCollision = true;
                        break;
                    }
                }
            }
            
            if (hasCollision) continue;
            
            // Evaluar calidad de la posición
            for (const target of targetBalls) {
                for (const pocket of pocketCenters) {
                    const tempCue = { ...testPos, number: null };
                    const difficulty = evaluateShotDifficulty(tempCue, target, pocket, balls);
                    if (difficulty < 150) {
                        score += (150 - difficulty);
                    }
                }
            }
            
            if (score > maxScore) {
                maxScore = score;
                bestX = x;
                bestY = y;
            }
        }
    }

    await new Promise(resolve => setTimeout(resolve, 800));

    if (gameRef) {
        await updateDoc(gameRef, {
            cueBallPosition: { x: bestX, y: bestY },
            ballInHandFor: null
        });
    }
}

export { calculateAIShot, executeAITurn, placeCueBallForAI };