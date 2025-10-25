// --- Módulo de Controles de Potencia ---
import * as THREE from 'three';
import { cueBall } from './ballManager.js';
import { updatePowerUI } from './ui.js';

// --- Estado Interno ---
let isPullingBackState = false;
let pullBackDistanceState = 0;
let initialPullBackProjection = 0;
let isDraggingPowerState = false;
let powerPercentState = 0;

const MAX_PULL_DISTANCE = 150;

// --- Funciones para el "Pull-Back" del Taco ---

export function startPullBack(pointerPos) {
    isPullingBackState = true;
    const shotAngle = window.currentShotAngle || 0;
    const shotAxis = new THREE.Vector2(Math.cos(shotAngle), Math.sin(shotAngle));
    const mouseVec = new THREE.Vector2(pointerPos.x, pointerPos.y);
    const cueBallPos = new THREE.Vector2(cueBall.mesh.position.x, cueBall.mesh.position.y);
    const mouseToCueBallVec = mouseVec.sub(cueBallPos);
    initialPullBackProjection = -mouseToCueBallVec.dot(shotAxis);
}

export function dragPullBack(pointerPos, shotAngle) {
    if (!isPullingBackState) return;

    const shotAxis = new THREE.Vector2(Math.cos(shotAngle), Math.sin(shotAngle));
    const mouseVec = new THREE.Vector2(pointerPos.x, pointerPos.y);
    const cueBallPos = new THREE.Vector2(cueBall.mesh.position.x, cueBall.mesh.position.y);
    const mouseToCueBallVec = mouseVec.sub(cueBallPos);

    const currentProjection = -mouseToCueBallVec.dot(shotAxis);
    pullBackDistanceState = currentProjection - initialPullBackProjection;
    pullBackDistanceState = Math.max(0, pullBackDistanceState);
    pullBackDistanceState = Math.min(pullBackDistanceState, MAX_PULL_DISTANCE);

    powerPercentState = Math.min(pullBackDistanceState / MAX_PULL_DISTANCE, 1.0);
    updatePowerUI(powerPercentState);
}

export function stopPullBack() {
    isPullingBackState = false;
    const finalPower = powerPercentState;
    pullBackDistanceState = 0;
    initialPullBackProjection = 0;
    powerPercentState = 0;
    // --- CORRECCIÓN: Actualizar la UI para que refleje el reseteo de la potencia ---
    updatePowerUI(powerPercentState);
    return finalPower;
}

// --- Funciones para la Barra de Potencia Deslizable ---

export function startPowerDrag() {
    isDraggingPowerState = true;
}

export function dragPower({ clientY }) {
    if (!isDraggingPowerState) return;

    const powerBarContainer = document.getElementById('powerBarContainer');
    const rect = powerBarContainer.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    // --- CORRECCIÓN: Invertir la lógica para que arrastrar hacia abajo aumente la potencia ---
    let newPower = relativeY / rect.height;
    newPower = Math.max(0, Math.min(1, newPower));

    powerPercentState = newPower;
    updatePowerUI(powerPercentState);
}

export function stopPowerDrag() {
    isDraggingPowerState = false;
    const finalPower = powerPercentState;
    powerPercentState = 0;
    // --- CORRECCIÓN: Actualizar la UI para que refleje el reseteo de la potencia ---
    updatePowerUI(powerPercentState);
    return finalPower;
}

// --- Getters de Estado ---

export const isPullingBack = () => isPullingBackState;
export const isDraggingPower = () => isDraggingPowerState;
export const getPullBackDistance = () => pullBackDistanceState;
export const getPowerPercent = () => powerPercentState;