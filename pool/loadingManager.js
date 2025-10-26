// --- Módulo de Gestión de Carga ---
import * as THREE from 'three';
import { startFirstTurn, setLoadingState } from './gameState.js';

const loadingScreen = document.getElementById('loading-screen');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');

// --- SOLUCIÓN: Traducciones para los pasos de carga ---
const stepTranslations = {
    'init_game': 'Iniciando juego',
    'init_ui': 'Preparando interfaz', // --- NUEVO: Añadir traducción para el nuevo paso
    'setup_balls': 'Colocando bolas',
    'warmup_physics': 'Calentando físicas',
    'super_warmup': 'Optimizando motor'
};

let onLoadingCompleteCallback = () => {};

// --- MODIFICADO: Sistema de gestión de carga por pasos ---
let pendingResources = 0;
let managerLoaded = false;

let processingSteps = []; // Pasos de inicialización post-descarga (ej: 'init_game', 'warmup_physics')
let completedSteps = 0;

export const loadingManager = new THREE.LoadingManager();

loadingManager.onStart = function (url, itemsLoaded, itemsTotal) {
    loadingScreen.style.display = 'flex';
};

loadingManager.onLoad = function () {
    managerLoaded = true;
    // Intentar iniciar el juego. Si aún hay recursos pendientes, no hará nada.
    tryStartGame();
};

loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
    // El progreso total ahora considera los archivos Y los pasos de procesamiento.
    const totalTasks = itemsTotal + processingSteps.length;
    const completedTasks = itemsLoaded + completedSteps;
    const progress = (completedTasks / totalTasks) * 100;

    progressBar.style.width = `${Math.min(progress, 100)}%`; // Asegurarse de no pasar del 100%
    progressText.textContent = `${Math.round(progress)}%`;
};

loadingManager.onError = function (url) {
    console.error(`Hubo un error al cargar ${url}`);
};

export function setOnLoadingComplete(callback) {
    onLoadingCompleteCallback = callback;
}

// --- MODIFICADO: Funciones para gestionar el contador de recursos y pasos ---

/**
 * Registra los pasos de procesamiento que se ejecutarán después de la descarga.
 * @param {string[]} steps - Un array con los nombres de los pasos.
 */
export function setProcessingSteps(steps) {
    processingSteps = steps;
}

/**
 * Registra que un recurso ha comenzado a cargarse y necesitará procesamiento.
 */
export function addPendingResource() {
    pendingResources++;
}

/**
 * Marca un recurso como completamente procesado y listo.
 */
export function resolvePendingResource() {
    pendingResources--;
    tryStartGame();
}

/**
 * Marca un paso de procesamiento como completado y actualiza la UI.
 */
function resolveProcessingStep() {
    // --- SOLUCIÓN: Asegurar que la actualización de la barra y el siguiente paso se ejecuten en el siguiente frame ---
    // Esto da tiempo al navegador a repintar la pantalla y mostrar el progreso actualizado.
    requestAnimationFrame(() => {
        completedSteps++;
        loadingManager.onProgress('', loadingManager.itemsLoaded, loadingManager.itemsTotal);
        tryStartGame();
    });
}

/**
 * Comprueba si todo está listo y, de ser así, inicia el juego.
 */
function tryStartGame() {
    if (managerLoaded && pendingResources === 0 && completedSteps === processingSteps.length) {
        progressText.textContent = '100%';
        progressBar.style.width = '100%';

        // --- MODIFICADO: Iniciar el juego directamente al finalizar la carga ---
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            setTimeout(() => { 
                loadingScreen.style.display = 'none'; 
                // --- SOLUCIÓN: Retrasar la selección del jugador para el efecto visual ---
                // --- CORRECCIÓN: Llamar a revisar.js para iniciar la partida.
                // Esto activará la lógica que elige al jugador inicial.
                setLoadingState(false);
                import('./revisar.js').then(({ revisarEstado }) => revisarEstado());
            }, 500);
        }, 250); // Pequeña pausa en 100% para que se vea que ha terminado.
    } else if (managerLoaded && pendingResources === 0 && completedSteps < processingSteps.length) {
        // Si los archivos están listos, ejecutamos el siguiente paso de procesamiento.
        const nextStep = processingSteps[completedSteps];
        // --- SOLUCIÓN: Usar las traducciones en español ---
        progressText.textContent = `${stepTranslations[nextStep] || nextStep}...`;
        onLoadingCompleteCallback(nextStep, resolveProcessingStep);
    }
}