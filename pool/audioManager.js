// --- Módulo de Gestión de Audio ---
import * as THREE from 'three';
import { loadingManager } from './loadingManager.js';

let listener;
const audioLoader = new THREE.AudioLoader(loadingManager);
let isMutedGlobally = false; // --- NUEVO: Estado de silencio global
const sounds = {};

/**
 * Inicializa el listener de audio y lo adjunta a la cámara.
 * Debe ser llamado una vez al inicio.
 * @param {THREE.Camera} camera - La cámara principal de la escena.
 */
export function initAudio(camera) {
    listener = new THREE.AudioListener();
    camera.add(listener);
}

// --- NUEVO: Función global para silenciar/reactivar todos los sonidos ---
window.muteAllSounds = (mute) => {
    isMutedGlobally = mute;
};

export function prepareAudio() {
    loadSound('ball_hit', 'audio/ballHit2.wav');
    loadSound('cushionHit', 'audio/cushionHit.wav');
    loadSound('pocket', 'audio/EntrarPelotaTronera.mp3');
    loadSound('cueHit', 'audio/cueHit.wav');
    // loadSound('foul', 'audio/error.mp3'); // --- NUEVO: Sonido para las faltas
}

/**
 * Carga un sonido y lo almacena para su uso posterior.
 * @param {string} name - El nombre clave para este sonido (ej. 'hit').
 * @param {string} path - La ruta al archivo de audio (ej. 'audio/ball_hit.mp3').
 */
export function loadSound(name, path) {
    audioLoader.load(path, (buffer) => {
        sounds[name] = buffer; // El sonido se carga silenciosamente.
    }, undefined, (error) => {
        console.error(`Error al cargar el sonido '${name}' desde ${path}:`, error);
    });
}

/**
 * Reproduce un sonido previamente cargado.
 * @param {string} name - El nombre clave del sonido a reproducir.
 * @param {number} [volume=0.5] - El volumen de reproducción (0.0 a 1.0).
 */
export function playSound(name, volume = 0.5) {
    if (!listener || !sounds[name] || isMutedGlobally) { // --- MODIFICACIÓN: No reproducir si está silenciado globalmente
        // console.warn(`El sonido '${name}' no se puede reproducir. ¿Está cargado y el audio inicializado?`);
        return;
    }

    // --- CORRECCIÓN: Asegurarse de que el volumen sea un número finito ---
    if (!isFinite(volume) || volume < 0) {
        console.warn(`Intento de reproducir sonido '${name}' con volumen inválido: ${volume}. Se usará 0.`);
        volume = 0;
    }

    // Creamos una nueva fuente de audio para cada reproducción para permitir sonidos superpuestos (polifonía)
    const sound = new THREE.Audio(listener);
    sound.setBuffer(sounds[name]);
    sound.setVolume(volume);
    sound.play();
}