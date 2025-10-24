// --- Módulo de Gestión Espacial (Spatial Grid) ---

import { TABLE_WIDTH, TABLE_HEIGHT } from './config.js';

let CELL_SIZE;
let grid;
let gridWidth, gridHeight;
let initialized = false;

/**
 * Inicializa la rejilla espacial. Debe llamarse una vez.
 * @param {number} ballRadius - El radio de las bolas, usado para determinar el tamaño de la celda.
 */
export function initSpatialManager(ballRadius) {
    if (initialized) return;
    CELL_SIZE = ballRadius * 2.5; // Un buen tamaño de celda es un poco más del diámetro de la bola.
    gridWidth = Math.ceil(TABLE_WIDTH / CELL_SIZE);
    gridHeight = Math.ceil(TABLE_HEIGHT / CELL_SIZE);
    grid = Array(gridWidth * gridHeight).fill(null).map(() => ({ balls: [], segments: [] }));
    initialized = true;
    console.log(`Gestor espacial inicializado: ${gridWidth}x${gridHeight} celdas de ${CELL_SIZE.toFixed(2)}px`);
}

/**
 * Limpia y reconstruye la rejilla espacial con las posiciones actuales de bolas y segmentos.
 * @param {Array} balls - El array de todas las bolas activas.
 * @param {Array} handles - El array de puntos que definen los bordes de la mesa.
 */
export function updateGrid(balls, handles) {
    if (!initialized) return;

    // 1. Limpiar la rejilla
    for (let i = 0; i < grid.length; i++) {
        grid[i].balls.length = 0;
        grid[i].segments.length = 0; // Los segmentos se re-añaden por si la mesa cambia dinámicamente
    }

    // 2. Añadir bolas a la rejilla
    for (const ball of balls) {
        if (!ball.isActive) continue;
        const gridX = Math.floor(ball.mesh.position.x / CELL_SIZE);
        const gridY = Math.floor(ball.mesh.position.y / CELL_SIZE);
        if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
            const index = gridY * gridWidth + gridX;
            grid[index].balls.push(ball);
        }
    }

    // 3. Añadir segmentos de los bordes a la rejilla
    for (let i = 0; i < handles.length; i++) {
        const p1 = handles[i];
        const p2 = handles[(i + 1) % handles.length];
        const segment = { p1, p2, index: i };

        // Determinar el bounding box del segmento para saber en qué celdas insertarlo
        const minX = Math.floor(Math.min(p1.x, p2.x) / CELL_SIZE);
        const maxX = Math.floor(Math.max(p1.x, p2.x) / CELL_SIZE);
        const minY = Math.floor(Math.min(p1.y, p2.y) / CELL_SIZE);
        const maxY = Math.floor(Math.max(p1.y, p2.y) / CELL_SIZE);

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
                    const index = y * gridWidth + x;
                    grid[index].segments.push(segment);
                }
            }
        }
    }
}

/**
 * Obtiene los objetos (bolas y segmentos) cercanos a una bola dada.
 * @param {object} ball - La bola para la que se buscan vecinos.
 * @returns {{balls: Array, segments: Array}} - Un objeto con arrays de bolas y segmentos cercanos.
 */
export function getNearbyObjects(ball) {
    if (!initialized || !ball.isActive) return { balls: [], segments: [] };

    const nearby = { balls: [], segments: [] };
    const ballRadius = ball.radius;

    // Determinar el rango de celdas a comprobar alrededor de la bola
    const minX = Math.floor((ball.mesh.position.x - ballRadius) / CELL_SIZE);
    const maxX = Math.floor((ball.mesh.position.x + ballRadius) / CELL_SIZE);
    const minY = Math.floor((ball.mesh.position.y - ballRadius) / CELL_SIZE);
    const maxY = Math.floor((ball.mesh.position.y + ballRadius) / CELL_SIZE);

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
                const index = y * gridWidth + x;
                const cell = grid[index];
                // Añadir solo bolas que no sean la propia bola y que no se hayan añadido ya
                for (const otherBall of cell.balls) {
                    if (otherBall !== ball && !nearby.balls.includes(otherBall)) {
                        nearby.balls.push(otherBall);
                    }
                }
                nearby.segments.push(...cell.segments);
            }
        }
    }
    // Eliminar segmentos duplicados
    nearby.segments = [...new Set(nearby.segments)];
    return nearby;
}