// --- Módulo de Gestión de Carga ---
import * as THREE from 'three';
import { randomizeStartingPlayer } from './gameState.js';

const loadingScreen = document.getElementById('loading-screen');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');

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
    completedSteps++;
    // Actualizamos la barra de progreso manualmente, ya que onProgress no se dispara aquí.
    const totalItems = loadingManager.itemsTotal || 1; // Evitar división por cero si no hay items
    loadingManager.onProgress('', totalItems, totalItems);
    tryStartGame();
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
            setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);
            randomizeStartingPlayer();
        }, 250); // Pequeña pausa en 100% para que se vea que ha terminado.
    } else if (managerLoaded && pendingResources === 0 && completedSteps < processingSteps.length) {
        // Si los archivos están listos, ejecutamos el siguiente paso de procesamiento.
        const nextStep = processingSteps[completedSteps];
        progressText.textContent = `Inicializando: ${nextStep.replace('_', ' ')}...`;
        onLoadingCompleteCallback(nextStep, resolveProcessingStep);
    }
}