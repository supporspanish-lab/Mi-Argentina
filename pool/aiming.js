// --- Módulo de Lógica de Apuntado ---
import * as THREE from 'three';
import { balls, cueBall } from './ballManager.js';
import { handles, BALL_RADIUS } from './config.js';
import { loadingManager, addPendingResource, resolvePendingResource } from './loadingManager.js';
import { scene } from './scene.js';

// --- Estado de las Mallas de Apuntado ---
let aimingLine = null;
let secondaryAimingLine = null;
let cueBallPathLine = null;
let cueBallPathEndCircle = null;
let cueBallDeflectionLine = null; // --- NUEVO: Línea para la trayectoria de la bola blanca tras el choque
let invalidTargetX = null;
export let cueMesh = null;
let cueShadowMesh = null; // --- NUEVO: Malla para la sombra del taco

export function initializeAiming() {
    // La carga real se dispara desde pool.js a través del loadingManager.
    // Aquí solo configuramos la lógica que se ejecutará cuando la textura esté lista.
}

export function prepareAimingResources() {
    addPendingResource(); // 1. Notificar que empezamos a cargar el taco.
    new THREE.TextureLoader(loadingManager).load('imajenes/taco.png', (cueTexture) => {
        const imageAspectRatio = cueTexture.image.width / cueTexture.image.height;
        // --- NUEVO: Corregir el espacio de color para que coincida con la imagen original ---
        // Esto evita que la textura se vea "lavada" o con un color incorrecto debido a la gestión de color de Three.js.
        cueTexture.colorSpace = THREE.SRGBColorSpace;
        cueTexture.needsUpdate = true;
        const cueLength = 300;
        const cueHeight = cueLength / imageAspectRatio;

        const cueGeometry = new THREE.PlaneGeometry(cueLength, cueHeight);
        const cueMaterial = new THREE.MeshBasicMaterial({
            map: cueTexture,
            transparent: true,
            // alphaTest: 0.5 // Eliminado para suavizar los bordes del taco
        });
        const cueStickMesh = new THREE.Mesh(cueGeometry, cueMaterial);

        // --- NUEVO: Crear la sombra para el taco ---
        const shadowTexture = new THREE.TextureLoader(loadingManager).load('imajenes/zombra.png');
        // Hacemos la sombra un poco más ancha y larga que el taco para el efecto de desenfoque
        const shadowGeometry = new THREE.PlaneGeometry(cueLength * 1.05, cueHeight * 1.5);
        const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.4 });
        cueShadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);

        cueMesh = new THREE.Group();
        cueMesh.add(cueStickMesh);
        cueMesh.add(cueShadowMesh); // Añadimos la sombra al mismo grupo que el taco
        cueShadowMesh.position.z = -0.5; // La ponemos ligeramente debajo del taco

        cueMesh.position.z = BALL_RADIUS + 0.5; // Posicionamos el grupo entero
        scene.add(cueMesh);
        resolvePendingResource(); // 2. Notificar que el taco está completamente creado y añadido a la escena.
    });
}

export function updateAimingGuides(shotAngle, gameState, pullBackDistance = 0) {
    const { currentPlayer, ballsAssigned, playerAssignments } = gameState;

    if (cueMesh) {
        const cueLength = cueMesh.children[0].geometry.parameters.width;
        // --- MODIFICADO: Añadir la distancia de pull-back al offset del taco ---
        const cueOffset = (cueLength / 2) + BALL_RADIUS + 5 + pullBackDistance;
        cueMesh.position.x = cueBall.mesh.position.x - Math.cos(shotAngle) * cueOffset; 
        cueMesh.position.y = cueBall.mesh.position.y - Math.sin(shotAngle) * cueOffset;
        cueMesh.rotation.z = shotAngle;
    }

    // 2. Calcular Rayo y Colisiones
    const maxLineLength = 400;
    const rayOrigin = new THREE.Vector2(cueBall.mesh.position.x, cueBall.mesh.position.y);
    const rayDirection = new THREE.Vector2(Math.cos(shotAngle), Math.sin(shotAngle));

    // Colisión con bordes
    let closestBoundaryIntersectionDistance = Infinity;
    let boundaryEndPoint = null;
    let boundaryNormal = null;

    for (let i = 0; i < handles.length; i++) {
        const p1 = new THREE.Vector2(handles[i].x, handles[i].y);
        const p2 = new THREE.Vector2(handles[(i + 1) % handles.length].x, handles[(i + 1) % handles.length].y);
        const segmentDirection = new THREE.Vector2().subVectors(p2, p1);
        const v1 = new THREE.Vector2().subVectors(p1, rayOrigin);
        const crossProduct = rayDirection.x * segmentDirection.y - rayDirection.y * segmentDirection.x;

        if (Math.abs(crossProduct) < 1e-6) continue;

        const t = (v1.x * segmentDirection.y - v1.y * segmentDirection.x) / crossProduct;
        const u = (v1.x * rayDirection.y - v1.y * rayDirection.x) / crossProduct;

        if (t >= 0 && u >= 0 && u <= 1 && t < closestBoundaryIntersectionDistance) {
            closestBoundaryIntersectionDistance = t;
            boundaryEndPoint = { x: rayOrigin.x + t * rayDirection.x, y: rayOrigin.y + t * rayDirection.y };
            const wallNormal = new THREE.Vector2(segmentDirection.y, -segmentDirection.x).normalize();
            if (wallNormal.dot(rayDirection) > 0) wallNormal.negate();
            boundaryNormal = wallNormal;
        }
    }

    // Colisión con bolas
    let closestIntersection = Infinity;
    let hitBall = null;
    for (const ball of balls) {
        if (ball === cueBall || !ball.isActive) continue;
        const ballCenter = new THREE.Vector2(ball.mesh.position.x, ball.mesh.position.y);
        const oc = ballCenter.clone().sub(rayOrigin);
        const tca = oc.dot(rayDirection);
        if (tca < 0) continue;
        const d2 = oc.lengthSq() - tca * tca;
        const radius2 = (BALL_RADIUS * 2) ** 2;
        if (d2 > radius2) continue;
        const thc = Math.sqrt(radius2 - d2);
        const t0 = tca - thc;
        if (t0 < closestIntersection) {
            closestIntersection = t0;
            hitBall = ball;
        }
    }

    // 3. Dibujar Línea Principal (Blanca)
    let aimingLineEndPoint = boundaryEndPoint || { x: rayOrigin.x + maxLineLength * rayDirection.x, y: rayOrigin.y + maxLineLength * rayDirection.y };
    if (hitBall && closestIntersection < closestBoundaryIntersectionDistance) {
        aimingLineEndPoint = { x: rayOrigin.x + closestIntersection * rayDirection.x, y: rayOrigin.y + closestIntersection * rayDirection.y };
    }

    if (!aimingLine) {
        const points = [new THREE.Vector3(rayOrigin.x, rayOrigin.y, BALL_RADIUS + 0.1), new THREE.Vector3(aimingLineEndPoint.x, aimingLineEndPoint.y, BALL_RADIUS + 0.1)];
        aimingLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 10, gapSize: 5 }));
        scene.add(aimingLine);
    }
    const positions = aimingLine.geometry.attributes.position.array;
    positions[0] = rayOrigin.x; positions[1] = rayOrigin.y;
    positions[3] = aimingLineEndPoint.x; positions[4] = aimingLineEndPoint.y;
    aimingLine.geometry.attributes.position.needsUpdate = true;
    aimingLine.computeLineDistances();
    aimingLine.visible = true;

    // 4. Dibujar Guías Secundarias (Colisión o Rebote)
    const showCollisionGuides = hitBall && closestIntersection < closestBoundaryIntersectionDistance;

    // --- CORRECCIÓN: Asegurarse de que la línea de desviación esté oculta por defecto ---
    // Solo se mostrará si se entra en el bloque de 'showCollisionGuides'.
    if (cueBallDeflectionLine) cueBallDeflectionLine.visible = false;

    if (showCollisionGuides) {
        if (secondaryAimingLine) secondaryAimingLine.visible = false; // Ocultar línea de rebote si existe
        if (cueBallDeflectionLine) cueBallDeflectionLine.visible = true; // --- NUEVO: Mostrar la línea de desviación

        const collisionPoint = new THREE.Vector2(aimingLineEndPoint.x, aimingLineEndPoint.y);

        // Lógica de bola oponente
        let isOpponentBall = false;
        if (ballsAssigned && hitBall.number !== 8) {
            const isSolid = hitBall.number >= 1 && hitBall.number <= 7;
            const isStripe = hitBall.number >= 9 && hitBall.number <= 15;
            if ((isSolid && playerAssignments[currentPlayer] === 'stripes') || (isStripe && playerAssignments[currentPlayer] === 'solids')) {
                isOpponentBall = true;
            }
        }

        // Línea de la bola objetivo
        const objectBallDir = new THREE.Vector2(hitBall.mesh.position.x - collisionPoint.x, hitBall.mesh.position.y - collisionPoint.y).normalize();
        const endPoint2 = { x: hitBall.mesh.position.x + objectBallDir.x * 35, y: hitBall.mesh.position.y + objectBallDir.y * 35 };
        if (!cueBallPathLine) { // Reutilizamos la malla, la renombramos mentalmente
            cueBallPathLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xffa500, dashSize: 8, gapSize: 6 }));
            scene.add(cueBallPathLine);
        }
        cueBallPathLine.geometry.setFromPoints([new THREE.Vector3(hitBall.mesh.position.x, hitBall.mesh.position.y, BALL_RADIUS + 0.1), new THREE.Vector3(endPoint2.x, endPoint2.y, BALL_RADIUS + 0.1)]);
        cueBallPathLine.computeLineDistances();
        cueBallPathLine.visible = true;

        // --- NUEVO: Línea de desviación de la bola blanca (tangente) ---
        const cueBallCenterAtImpact = new THREE.Vector2(collisionPoint.x - rayDirection.x * BALL_RADIUS, collisionPoint.y - rayDirection.y * BALL_RADIUS);
        const lineOfCenters = new THREE.Vector2().subVectors(new THREE.Vector2(hitBall.mesh.position.x, hitBall.mesh.position.y), cueBallCenterAtImpact).normalize();
        
        // La dirección de la tangente es perpendicular a la línea de centros.
        let tangentDir = new THREE.Vector2(-lineOfCenters.y, lineOfCenters.x);
        
        // Asegurarnos de que la tangente elegida sea la que sigue el flujo del movimiento.
        if (rayDirection.dot(tangentDir) < 0) {
            tangentDir.negate();
        }

        const deflectionEndPoint = { x: collisionPoint.x + tangentDir.x * 50, y: collisionPoint.y + tangentDir.y * 50 };
        if (!cueBallDeflectionLine) {
            cueBallDeflectionLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 5, gapSize: 5, opacity: 0.8, transparent: true }));
            scene.add(cueBallDeflectionLine);
        }
        cueBallDeflectionLine.geometry.setFromPoints([new THREE.Vector3(collisionPoint.x, collisionPoint.y, BALL_RADIUS + 0.1), new THREE.Vector3(deflectionEndPoint.x, deflectionEndPoint.y, BALL_RADIUS + 0.1)]);
        cueBallDeflectionLine.computeLineDistances();

        // Círculo en el punto de impacto
        if (!cueBallPathEndCircle) {
            cueBallPathEndCircle = new THREE.Mesh(new THREE.RingGeometry(BALL_RADIUS - 2, BALL_RADIUS, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
            scene.add(cueBallPathEndCircle);
        }
        cueBallPathEndCircle.position.set(collisionPoint.x, collisionPoint.y, BALL_RADIUS + 0.1);
        cueBallPathEndCircle.material.color.set(isOpponentBall ? 0xe74c3c : 0xffffff);
        cueBallPathEndCircle.visible = true;

        // "X" de objetivo inválido
        if (isOpponentBall) {
            if (!invalidTargetX) {
                const xShape = new THREE.Shape();
                const xSize = BALL_RADIUS * 0.7;
                xShape.moveTo(-xSize, -xSize); xShape.lineTo(xSize, xSize);
                xShape.moveTo(-xSize, xSize); xShape.lineTo(xSize, -xSize);
                invalidTargetX = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(xShape.getPoints()), new THREE.LineBasicMaterial({ color: 0xe74c3c, linewidth: 2 }));
                scene.add(invalidTargetX);
            }
            invalidTargetX.position.set(collisionPoint.x, collisionPoint.y, BALL_RADIUS + 0.2);
            invalidTargetX.visible = true;
        } else if (invalidTargetX) {
            invalidTargetX.visible = false;
        }

    } else { // No hay colisión con bola, mostrar rebote en pared si aplica
        if (cueBallPathLine) cueBallPathLine.visible = false;
        if (invalidTargetX) invalidTargetX.visible = false;
        if (cueBallDeflectionLine) cueBallDeflectionLine.visible = false; // --- NUEVO: Ocultar la línea de desviación

        if (boundaryEndPoint && boundaryNormal) {
            // Círculo en el punto de impacto con la pared
            if (!cueBallPathEndCircle) {
                cueBallPathEndCircle = new THREE.Mesh(new THREE.RingGeometry(BALL_RADIUS - 2, BALL_RADIUS, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
                scene.add(cueBallPathEndCircle);
            }
            cueBallPathEndCircle.position.set(boundaryEndPoint.x, boundaryEndPoint.y, BALL_RADIUS + 0.1);
            cueBallPathEndCircle.material.color.set(0xffffff);
            cueBallPathEndCircle.visible = true;

            // Línea de rebote
            const incidentVector = rayDirection.clone();
            const dotProduct = incidentVector.dot(boundaryNormal);
            const reflectionDirection = incidentVector.sub(boundaryNormal.clone().multiplyScalar(2 * dotProduct));
            const reflectionEndPoint = { x: boundaryEndPoint.x + reflectionDirection.x * 35, y: boundaryEndPoint.y + reflectionDirection.y * 35 };

            if (!secondaryAimingLine) {
                secondaryAimingLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 5, gapSize: 5 }));
                scene.add(secondaryAimingLine);
            }
            secondaryAimingLine.geometry.setFromPoints([new THREE.Vector3(boundaryEndPoint.x, boundaryEndPoint.y, BALL_RADIUS + 0.1), new THREE.Vector3(reflectionEndPoint.x, reflectionEndPoint.y, BALL_RADIUS + 0.1)]);
            secondaryAimingLine.computeLineDistances();
            secondaryAimingLine.visible = true;

        } else { // Ocultar todo si no hay ni colisión ni rebote
            if (secondaryAimingLine) secondaryAimingLine.visible = false;
            if (cueBallPathEndCircle) cueBallPathEndCircle.visible = false;
        }
    }
}

export function animateCueShot(shotAngle, onHit) {
    if (!cueMesh || !cueMesh.children.length) {
        onHit(); // Si el taco no está listo, ejecuta la acción de golpeo inmediatamente
        return;
    }

    // --- MODIFICADO: La animación ahora es un rápido movimiento hacia adelante ---
    // La posición hacia atrás ya se gestiona en updateAimingGuides.
    // Aquí solo animamos el golpe final.
    const cueLength = cueMesh.children[0].geometry.parameters.width;
    const finalOffset = (cueLength / 2) + BALL_RADIUS - 10; // Posición final después del golpe

    setTimeout(() => {
        // Mover el taco a su posición final para simular el golpe
        cueMesh.position.x = cueBall.mesh.position.x - Math.cos(shotAngle) * finalOffset;
        cueMesh.position.y = cueBall.mesh.position.y - Math.sin(shotAngle) * finalOffset;

        onHit();
    }, 50); // Un retraso muy corto para la animación del golpe
}

export function hideAimingGuides() {
    if (aimingLine) aimingLine.visible = false;
    if (secondaryAimingLine) secondaryAimingLine.visible = false;
    if (cueBallPathLine) cueBallPathLine.visible = false;
    if (cueBallPathEndCircle) cueBallPathEndCircle.visible = false;
    if (cueBallDeflectionLine) cueBallDeflectionLine.visible = false; // --- NUEVO: Ocultar al esconder todo
    if (cueMesh) cueMesh.visible = false;
    if (invalidTargetX) invalidTargetX.visible = false;
}