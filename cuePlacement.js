// --- Módulo de Colocación de la Bola Blanca ---
import { cueBall, balls } from './ballManager.js';
import { handles, pockets, BALL_RADIUS } from './config.js';

let isMovingCueBallState = false;

export function startCueBallMove() {
    isMovingCueBallState = true;
}

export function moveCueBall(position) {
    if (!isMovingCueBallState) return;
    cueBall.mesh.position.set(position.x, position.y, BALL_RADIUS);
    if (cueBall.shadowMesh) {
        cueBall.shadowMesh.position.set(position.x, position.y, 0.1);
    }
}

export function stopCueBallMove() {
    if (isMovingCueBallState) {
        isMovingCueBallState = false;
    }
}

/**
 * Comprueba si una posición es válida para colocar la bola blanca.
 * @param {{x: number, y: number}} point - La posición a comprobar.
 * @returns {boolean} - True si la posición es válida.
 */
export function isValidPlacement(point) {
    // 1. Comprobar si está dentro de los bordes (handles)
    if (!isPointInPolygon(point, handles)) return false;

    // 2. Comprobar si está dentro de alguna tronera (pockets)
    for (const pocket of pockets) {
        if (isPointInPolygon(point, pocket.points)) return false;
    }

    // 3. Comprobar si colisiona con otra bola
    for (const ball of balls) {
        if (ball === cueBall || !ball.isActive) continue;
        const distSq = (point.x - ball.mesh.position.x) ** 2 + (point.y - ball.mesh.position.y) ** 2;
        if (distSq < (BALL_RADIUS * 2) ** 2) return false;
    }

    return true;
}

function isPointInPolygon(point, polygon) {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}

export const isMovingCueBall = () => isMovingCueBallState;