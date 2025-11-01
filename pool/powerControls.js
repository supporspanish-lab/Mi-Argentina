// --- Módulo de Controles de Potencia ---
import * as THREE from 'three';
import { cueBall } from './ballManager.js';


// --- Estado Interno ---
let isPullingBackState = false;
let powerPercentState = 0;
let isDraggingPowerState = false;
let powerChargeInterval = null; // --- NUEVO: Para el intervalo de carga de potencia

// --- Constantes ---
const POWER_CHARGE_RATE = 1.5; // Velocidad a la que se carga la barra (1.5 = 150% por segundo)

// --- Funciones para el "Pull-Back" del Taco ---

export function startPullBack(pointerPos) {
    isPullingBackState = true;
    const shotAngle = window.currentShotAngle || 0;
    const shotAxis = new THREE.Vector2(Math.cos(shotAngle), Math.sin(shotAngle));
    const mouseVec = new THREE.Vector2(pointerPos.x, pointerPos.y);
    const cueBallPos = new THREE.Vector2(cueBall.mesh.position.x, cueBall.mesh.position.y);
    const mouseToCueBallVec = mouseVec.sub(cueBallPos);
}

export function dragPullBack(pointerPos, shotAngle) {
    if (!isPullingBackState) return;
}

export function stopPullBack() {
    isPullingBackState = false;
    return 0; // Ya no devuelve potencia
}

// --- NUEVO: Funciones para la carga de potencia al mantener presionado ---

/**
 * Inicia la carga de la barra de potencia.
 */
export function startPowerCharge() {
    if (powerChargeInterval) clearInterval(powerChargeInterval);
    powerPercentState = 0;
    const startTime = performance.now();

    powerChargeInterval = setInterval(() => {
        const elapsedTime = (performance.now() - startTime) / 1000; // en segundos
        powerPercentState = Math.min(elapsedTime * POWER_CHARGE_RATE, 1);
    }, 16); // Actualizar ~60 veces por segundo
}

/**
 * Detiene la carga de la barra de potencia.
 */
export function stopPowerCharge() {
    if (powerChargeInterval) {
        clearInterval(powerChargeInterval);
        powerChargeInterval = null;
    }
}
// --- Funciones para la Barra de Potencia Deslizable ---

export function startPowerDrag() {
    // Esta función ahora se llama por un evento desde index.html
    isDraggingPowerState = true;
}

export function dragPower(powerPercent, logicalY, visualY) {
    // Esta función ahora se llama por un evento desde index.html
    if (!isDraggingPowerState) return; // Doble chequeo por si acaso

    powerPercentState = powerPercent;

    // --- NUEVO: Enviar la actualización de la potencia al servidor ---
    // Disparamos un evento para que index.html lo capture y lo envíe a Firestore.
    window.dispatchEvent(new CustomEvent('sendpower', { detail: { power: powerPercent } }));
}

export function stopPowerDrag() {
    isDraggingPowerState = false;
    const finalPower = powerPercentState;
    powerPercentState = 0;
    return finalPower;
}

// --- NUEVO: Listeners para los eventos de la barra de potencia ---
window.addEventListener('startpowerdrag', () => {
    startPowerDrag();
});

window.addEventListener('dragpower', (event) => {
    const { powerPercent, logicalY, visualY } = event.detail;
    dragPower(powerPercent, logicalY, visualY);
});

window.addEventListener('stoppowerdrag', () => {
    // La lógica de 'stopPowerDrag' ya se llama desde ui.js al soltar el ratón,
    // así que este listener es principalmente para asegurar que el estado se limpie.
    isDraggingPowerState = false;
});
// --- Getters de Estado ---

export const isPullingBack = () => isPullingBackState;
export const isDraggingPower = () => isDraggingPowerState;
export const getPowerPercent = () => powerPercentState;