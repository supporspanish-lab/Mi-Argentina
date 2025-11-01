// --- Módulo de Configuración ---

import { loadingManager } from './loadingManager.js';
// Dimensiones de la mesa (un estándar es una relación 2:1)
export const TABLE_WIDTH = 1000;
export const TABLE_HEIGHT = 500;

// --- SOLUCIÓN: Definir y exportar la relación de aspecto de la mesa ---
export const TABLE_ASPECT_RATIO = TABLE_WIDTH / TABLE_HEIGHT;

// Radio de la bola
export const BALL_RADIUS = 14; // --- CORRECCIÓN: Aumentamos el radio para que coincida con el tamaño visual

// Espaciado para el rack inicial
export const RACK_SPACING_DIAMETER = 28; // --- CORRECCIÓN: Ajustado al nuevo radio (12 * 2)

// Puntos de control para los bordes de la mesa
export let handles = [];

export function prepareTableTexture() {
    // Esta función se llama desde ui.js para asegurar que la textura de la mesa se cargue
    // a través del loadingManager centralizado.
}

export const pockets = [
    { points: [ { x: 51.49, y: 22.55 }, { x: 86.90, y: 57.13 }, { x: 83.40, y: 65.78 }, { x: 76.40, y: 73.81 }, { x: 61.58, y: 79.98 }, { x: 24.12, y: 48.90 } ] },
    { points: [ { x: 949.54, y: 21.94 }, { x: 909.41, y: 56.52 }, { x: 913.52, y: 65.16 }, { x: 921.34, y: 75.04 }, { x: 938.22, y: 81.01 }, { x: 975.00, y: 49.00 } ] },
    { points: [ { x: 69.81, y: 469.73 }, { x: 32.35, y: 470.24 }, { x: 21.03, y: 449.86 }, { x: 64.67, y: 415.18 }, { x: 80.10, y: 420.33 }, { x: 98.63, y: 436.79 } ] },
    { points: [ { x: 949.54, y: 479.09 }, { x: 973.62, y: 459.54 }, { x: 936.58, y: 419.81 }, { x: 923.61, y: 424.34 }, { x: 914.35, y: 432.78 }, { x: 911.26, y: 442.25 } ] },
    { points: [ { x: 474.89, y: 57.34 }, { x: 479.21, y: 23.38 }, { x: 514.41, y: 22.55 }, { x: 525.73, y: 56.10 }, { x: 503.50, y: 63.51 }, { x: 487.86, y: 62.07 } ] },
    { points: [ { x: 478.19, y: 474.56 }, { x: 520.38, y: 475.39 }, { x: 527.17, y: 443.89 }, { x: 507.21, y: 436.89 }, { x: 483.54, y: 437.92 }, { x: 471.80, y: 444.72 } ] }
].map(p => ({
    // Asegurarse de que cada array de puntos sea una copia para evitar referencias compartidas
    points: p.points.map(pt => ({...pt})),
    // --- NUEVO: Pre-calcular el centro y el radio de cada tronera para una detección más fácil.
    center: p.points.reduce((acc, pt) => ({ x: acc.x + pt.x, y: acc.y + pt.y }), { x: 0, y: 0 }),
    radius: 0 // Se calculará a continuación
})).map(p => {
    // Calcular el centro real
    p.center.x /= p.points.length;
    p.center.y /= p.points.length;
    // Calcular el radio como la distancia máxima desde el centro a cualquiera de sus puntos.
    p.radius = Math.max(...p.points.map(pt => Math.hypot(pt.x - p.center.x, pt.y - p.center.y)));
    return p;
});

export function initializeHandles() {
    handles.length = 0; // Limpiar handles existentes
    const initialHandles = [
        { x: TABLE_WIDTH * 0.0809, y: TABLE_HEIGHT * 0.0817 },
        { x: TABLE_WIDTH * 0.1001, y: TABLE_HEIGHT * 0.1182 },
        { x: TABLE_WIDTH * 0.4686, y: TABLE_HEIGHT * 0.1220 },
        { x: TABLE_WIDTH * 0.4745, y: TABLE_HEIGHT * 0.0863 },
        { x: TABLE_WIDTH * 0.4763, y: TABLE_HEIGHT * 0.0550 },
        { x: TABLE_WIDTH * 0.4837, y: TABLE_HEIGHT * 0.0369 },
        { x: TABLE_WIDTH * 0.5004, y: TABLE_HEIGHT * 0.0311 },
        { x: TABLE_WIDTH * 0.5105, y: TABLE_HEIGHT * 0.0393 },
        { x: TABLE_WIDTH * 0.5173, y: TABLE_HEIGHT * 0.0447 },
        { x: TABLE_WIDTH * 0.5206, y: TABLE_HEIGHT * 0.0521 },
        { x: TABLE_WIDTH * 0.5216, y: TABLE_HEIGHT * 0.0542 },
        { x: TABLE_WIDTH * 0.5231, y: TABLE_HEIGHT * 0.0702 },
        { x: TABLE_WIDTH * 0.5251, y: TABLE_HEIGHT * 0.0916 },
        { x: TABLE_WIDTH * 0.5312, y: TABLE_HEIGHT * 0.1216 },
        { x: TABLE_WIDTH * 0.9002, y: TABLE_HEIGHT * 0.1223 },
        { x: TABLE_WIDTH * 0.9127, y: TABLE_HEIGHT * 0.0894 },
        { x: TABLE_WIDTH * 0.9312, y: TABLE_HEIGHT * 0.0585 },
        { x: TABLE_WIDTH * 0.9413, y: TABLE_HEIGHT * 0.0542 },
        { x: TABLE_WIDTH * 0.9454, y: TABLE_HEIGHT * 0.0455 },
        { x: TABLE_WIDTH * 0.9493, y: TABLE_HEIGHT * 0.0365 },
        { x: TABLE_WIDTH * 0.9539, y: TABLE_HEIGHT * 0.0389 },
        { x: TABLE_WIDTH * 0.9640, y: TABLE_HEIGHT * 0.0451 },
        { x: TABLE_WIDTH * 0.9742, y: TABLE_HEIGHT * 0.0554 },
        { x: TABLE_WIDTH * 0.9747, y: TABLE_HEIGHT * 0.0710 },
        { x: TABLE_WIDTH * 0.9769, y: TABLE_HEIGHT * 0.0982 },
        { x: TABLE_WIDTH * 0.9664, y: TABLE_HEIGHT * 0.1163 },
        { x: TABLE_WIDTH * 0.9300, y: TABLE_HEIGHT * 0.1828 },
        { x: TABLE_WIDTH * 0.9292, y: TABLE_HEIGHT * 0.8201 },
        { x: TABLE_WIDTH * 0.9500, y: TABLE_HEIGHT * 0.8577 },
        { x: TABLE_WIDTH * 0.9609, y: TABLE_HEIGHT * 0.8767 },
        { x: TABLE_WIDTH * 0.9718, y: TABLE_HEIGHT * 0.8964 },
        { x: TABLE_WIDTH * 0.9759, y: TABLE_HEIGHT * 0.9150 },
        { x: TABLE_WIDTH * 0.9738, y: TABLE_HEIGHT * 0.9421 },
        { x: TABLE_WIDTH * 0.9607, y: TABLE_HEIGHT * 0.9582 },
        { x: TABLE_WIDTH * 0.9454, y: TABLE_HEIGHT * 0.9652 },
        { x: TABLE_WIDTH * 0.9161, y: TABLE_HEIGHT * 0.9099 },
        { x: TABLE_WIDTH * 0.8993, y: TABLE_HEIGHT * 0.8777 },
        { x: TABLE_WIDTH * 0.5311, y: TABLE_HEIGHT * 0.8813 },
        { x: TABLE_WIDTH * 0.5259, y: TABLE_HEIGHT * 0.9080 },
        { x: TABLE_WIDTH * 0.5253, y: TABLE_HEIGHT * 0.9405 },
        { x: TABLE_WIDTH * 0.5163, y: TABLE_HEIGHT * 0.9615 },
        { x: TABLE_WIDTH * 0.5045, y: TABLE_HEIGHT * 0.9701 },
        { x: TABLE_WIDTH * 0.4901, y: TABLE_HEIGHT * 0.9689 },
        { x: TABLE_WIDTH * 0.4720, y: TABLE_HEIGHT * 0.9475 },
        { x: TABLE_WIDTH * 0.4697, y: TABLE_HEIGHT * 0.9117 },
        { x: TABLE_WIDTH * 0.4635, y: TABLE_HEIGHT * 0.8769 },
        { x: TABLE_WIDTH * 0.0993, y: TABLE_HEIGHT * 0.8766 },
        { x: TABLE_WIDTH * 0.0741, y: TABLE_HEIGHT * 0.9239 },
        { x: TABLE_WIDTH * 0.0661, y: TABLE_HEIGHT * 0.9431 },
        { x: TABLE_WIDTH * 0.0502, y: TABLE_HEIGHT * 0.9642 },
        { x: TABLE_WIDTH * 0.0319, y: TABLE_HEIGHT * 0.9400 },
        { x: TABLE_WIDTH * 0.0200, y: TABLE_HEIGHT * 0.8985 },
        { x: TABLE_WIDTH * 0.0350, y: TABLE_HEIGHT * 0.8709 },
        { x: TABLE_WIDTH * 0.0470, y: TABLE_HEIGHT * 0.8532 },
        { x: TABLE_WIDTH * 0.0681, y: TABLE_HEIGHT * 0.8196 },
        { x: TABLE_WIDTH * 0.0684, y: TABLE_HEIGHT * 0.1791 },
        { x: TABLE_WIDTH * 0.0389, y: TABLE_HEIGHT * 0.1311 },
        { x: TABLE_WIDTH * 0.0229, y: TABLE_HEIGHT * 0.1044 },
        { x: TABLE_WIDTH * 0.0221, y: TABLE_HEIGHT * 0.0768 },
        { x: TABLE_WIDTH * 0.0340, y: TABLE_HEIGHT * 0.0480 },
        { x: TABLE_WIDTH * 0.0466, y: TABLE_HEIGHT * 0.0336 },
        { x: TABLE_WIDTH * 0.0567, y: TABLE_HEIGHT * 0.0373 },
        { x: TABLE_WIDTH * 0.0656, y: TABLE_HEIGHT * 0.0488 },
        { x: TABLE_WIDTH * 0.0729, y: TABLE_HEIGHT * 0.0605 }
    ];
    handles.push(...initialHandles);
}