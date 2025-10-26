// --- Módulo de Controles de Potencia ---
import * as THREE from 'three';
import { cueBall } from './ballManager.js';
import { updatePowerUI } from './ui.js';

// --- Estado Interno ---
let isPullingBackState = false;
let powerPercentState = 0;
let isDraggingPowerState = false;

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

// --- Funciones para la Barra de Potencia Deslizable ---

export function startPowerDrag() {
    isDraggingPowerState = true;
}

export function dragPower({ clientX }) {
    if (!isDraggingPowerState) return;

    const powerBarContainer = document.getElementById('powerBarContainer');
    const rect = powerBarContainer.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    let newPower = relativeX / rect.width;
    newPower = Math.max(0, Math.min(1, newPower));

    powerPercentState = newPower;
    updatePowerUI(powerPercentState);
}

export function stopPowerDrag() {
    isDraggingPowerState = false;
    const finalPower = powerPercentState;
    powerPercentState = 0;
    updatePowerUI(powerPercentState);
    return finalPower;
}

// --- Getters de Estado ---

export const isPullingBack = () => isPullingBackState;
export const isDraggingPower = () => isDraggingPowerState;
export const getPowerPercent = () => powerPercentState;