import * as CANNON from 'cannon-es';
import { pockets, BALL_RADIUS, TABLE_WIDTH, TABLE_HEIGHT } from './config.js';

export let fallWorld;
const fallBodies = []; // Almacena las bolas del juego que están cayendo

const timeStep = 1 / 120; // --- CORRECCIÓN: Un paso de tiempo más pequeño para mayor precisión (120 Hz)
let lastCallTime; // Para el bucle de tiempo fijo
const maxSubSteps = 20; // --- CORRECCIÓN: Más sub-pasos para evitar el "tunneling" a altas velocidades

let ballMaterial; // --- CORRECCIÓN: Definir materiales a nivel de módulo para que sean accesibles
let wallMaterial;

/**
 * Inicializa el mundo de la física 3D para la caída de las bolas.
 */
export function initFallPhysics() {
    fallWorld = new CANNON.World();
    fallWorld.gravity.set(0, 0, -981 * 2); // Gravedad en el eje Z
    fallWorld.allowSleep = true; // Permitir que los objetos "duerman" para optimizar
    fallWorld.broadphase = new CANNON.NaiveBroadphase(); // Fase amplia simple y efectiva
    fallWorld.solver.iterations = 100; // --- CORRECCIÓN DEFINITIVA: Aumento masivo de iteraciones para máxima precisión.
    fallWorld.defaultContactMaterial.contactEquationStiffness = 1e8; // --- CORRECCIÓN: Aumenta aún más la rigidez de los contactos.

    // Materiales para la física
    ballMaterial = new CANNON.Material('ballMaterial');
    wallMaterial = new CANNON.Material('wallMaterial');

    const ballWallContactMaterial = new CANNON.ContactMaterial(ballMaterial, wallMaterial, {
        friction: 0.1,
        restitution: 0.6, // Coeficiente de rebote
    });
    fallWorld.addContactMaterial(ballWallContactMaterial);

    // Crear los "túneles" de las troneras como cuerpos estáticos
    pockets.forEach(pocket => {
        const pocketCenter = pocket.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
        pocketCenter.x /= pocket.points.length;
        pocketCenter.y /= pocket.points.length;

        // --- CORRECCIÓN: Construir las paredes del túnel con cajas estáticas ---
        const tunnelHeight = 300; // Más alto para asegurar que la bola no se salga
        const tunnelRadius = 38; // Un poco más ancho que el radio de la tronera visual
        const numWallSegments = 12; // Número de cajas para formar la pared del túnel
        const wallThickness = 10; // Grosor de las paredes

        for (let i = 0; i < numWallSegments; i++) {
            const angle = (i / numWallSegments) * Math.PI * 2;
            const wallWidth = 2 * tunnelRadius * Math.tan(Math.PI / numWallSegments);

            const wallBody = new CANNON.Body({
                mass: 0, // Estático
                shape: new CANNON.Box(new CANNON.Vec3(wallThickness / 2, wallWidth / 2, tunnelHeight / 2)),
                material: wallMaterial
            });

            // Posicionar y rotar cada segmento de pared para formar un cilindro
            const x = pocketCenter.x + (tunnelRadius + wallThickness / 2) * Math.cos(angle);
            const y = pocketCenter.y + (tunnelRadius + wallThickness / 2) * Math.sin(angle);
            wallBody.position.set(x, y, -tunnelHeight / 2 + BALL_RADIUS);
            wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angle);

            // Añadir la pared al mundo físico
            fallWorld.addBody(wallBody);
        }
    }); 
}

/**
 * Añade una bola al mundo de la física 3D para que comience a caer.
 * @param {object} ball - El objeto de la bola del juego.
 */
export function addBallToFallSimulation(ball) {
    // --- CORRECCIÓN: Limitar la velocidad de entrada para evitar el efecto túnel ---
    const MAX_ENTRY_SPEED = 100; // --- CORRECCIÓN: Reducimos la velocidad máxima de entrada para mayor estabilidad
    let entryVx = ball.vx * 100;
    let entryVy = ball.vy * 100;
    const speed = Math.sqrt(entryVx * entryVx + entryVy * entryVy);
    if (speed > MAX_ENTRY_SPEED) {
        entryVx = (entryVx / speed) * MAX_ENTRY_SPEED;
        entryVy = (entryVy / speed) * MAX_ENTRY_SPEED;
    }

    // --- SOLUCIÓN DEFINITIVA: Asegurar que la bola siempre inicie DENTRO del túnel físico ---
    // A veces, la física 2D puede dejar la bola justo fuera del radio del túnel al entrar.
    // Aquí corregimos su posición si es necesario para evitar que se escape.
    const pocket = pockets[ball.pocketIndex];
    const pocketCenter = pocket.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    pocketCenter.x /= pocket.points.length;
    pocketCenter.y /= pocket.points.length;
    const tunnelRadius = 38; // El mismo radio usado para construir el túnel

    const distFromCenter = Math.sqrt((ball.mesh.position.x - pocketCenter.x)**2 + (ball.mesh.position.y - pocketCenter.y)**2);
    if (distFromCenter > tunnelRadius - BALL_RADIUS) {
        // Si la bola está fuera, la movemos al borde interior.
        ball.mesh.position.x = pocketCenter.x + (ball.mesh.position.x - pocketCenter.x) / distFromCenter * (tunnelRadius - BALL_RADIUS);
        ball.mesh.position.y = pocketCenter.y + (ball.mesh.position.y - pocketCenter.y) / distFromCenter * (tunnelRadius - BALL_RADIUS);
        // --- SOLUCIÓN DEFINITIVA: Anulamos su velocidad lateral para evitar que atraviese la pared.
        entryVx = 0;
        entryVy = 0;
    }

    const ballBody = new CANNON.Body({
        mass: 1, // Masa de la bola
        shape: new CANNON.Sphere(BALL_RADIUS), // La forma física de la bola
        position: new CANNON.Vec3(ball.mesh.position.x, ball.mesh.position.y, ball.mesh.position.z),
        velocity: new CANNON.Vec3(entryVx, entryVy, 0), // Usar la velocidad limitada
        material: ballMaterial,
        // --- CORRECCIÓN DEFINITIVA: Activar Detección Continua de Colisiones (CCD) ---
        // Esto evita el "efecto túnel" al calcular colisiones para objetos rápidos.
        ccdSpeedThreshold: 1, // --- CORRECCIÓN: Activar CCD antes para mayor seguridad.
        ccdSweptSphereRadius: BALL_RADIUS * 0.5, // Radio de barrido para la predicción de colisión
        allowSleep: false // No permitir que esta bola "duerma" mientras cae
    });

    ball.physicsBody = ballBody; // Guardar referencia al cuerpo físico
    fallWorld.addBody(ballBody);
    fallBodies.push(ball);
}

/**
 * Actualiza el mundo de la física de caída y sincroniza las mallas.
 * @param {number} dt - Delta time.
 */
export function updateFallPhysics(dt) {
    if (!fallWorld) return;

    // --- CORRECCIÓN DEFINITIVA: Implementar un bucle de tiempo fijo real y desacoplado ---
    // Este es el método estándar y más robusto para la física en juegos.
    if (lastCallTime === undefined) {
        lastCallTime = performance.now() / 1000;
    }
    const time = performance.now() / 1000;
    let timeSinceLastCall = time - lastCallTime;
    lastCallTime = time;

    // Evitar la "espiral de la muerte" si el dt es muy grande
    if (timeSinceLastCall > 0.2) {
        timeSinceLastCall = 0.2;
    }

    fallWorld.step(timeStep, timeSinceLastCall, maxSubSteps);

    for (let i = fallBodies.length - 1; i >= 0; i--) {
        const ball = fallBodies[i];
        if (ball.physicsBody) {
            ball.mesh.position.copy(ball.physicsBody.position);
            ball.mesh.quaternion.copy(ball.physicsBody.quaternion);

            // --- NUEVO: Log de alerta si la bola sale de los límites ---
            const pos = ball.mesh.position;
            const margin = 100; // Un margen de seguridad generoso
            if (pos.x < -margin || pos.x > TABLE_WIDTH + margin || pos.y < -margin || pos.y > TABLE_HEIGHT + margin) {
                console.error(`¡ALERTA! Bola #${ball.number} ha salido de los límites durante la caída 3D.`, {
                    position: pos.clone(),
                    velocity: ball.physicsBody.velocity.clone()
                });
            }

            // --- SOLUCIÓN DEFINITIVA: "Gobernador" de velocidad para evitar explosiones ---
            // Si la velocidad de la bola en la simulación 3D se dispara, la limitamos.
            const MAX_FALL_SPEED = 500; // Límite de velocidad dentro del túnel
            const velocity = ball.physicsBody.velocity;
            const speed = velocity.length();

            if (speed > MAX_FALL_SPEED) {
                velocity.scale(MAX_FALL_SPEED / speed, velocity);
            }

            // Comprobar si la bola ha caído lo suficiente para ser eliminada de esta simulación
            if (ball.mesh.position.z < -150) { // Umbral de "recolección"
                // Eliminar el cuerpo físico del mundo de Cannon
                fallWorld.removeBody(ball.physicsBody);
                ball.physicsBody = null;
                
                // Eliminar la bola del array de simulación de caída
                fallBodies.splice(i, 1);
            }
        } else {
            // Si por alguna razón una bola en esta lista ya no tiene cuerpo físico, la eliminamos
            fallBodies.splice(i, 1);
        }
    }
}