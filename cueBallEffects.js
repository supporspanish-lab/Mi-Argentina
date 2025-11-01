// --- Módulo de Efectos de la Bola Blanca ---
import * as THREE from 'three';
import { scene } from './scene.js';
import { cueBall } from './ballManager.js';

let trailParticles = [];
let trailGroup;
let trailMaterial;
const MAX_PARTICLES = 100; // Límite para no sobrecargar la escena
const PARTICLE_LIFESPAN = 0.4; // en segundos

/**
 * --- NUEVO: Crea una textura de brillo usando un canvas 2D.
 * @returns {THREE.CanvasTexture} La textura generada.
 */
function createGlowTexture() {
    const canvas = document.createElement('canvas');
    const size = 128; // Tamaño de la textura
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2;

    // Crear un gradiente radial para el efecto de brillo
    const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');   // Centro blanco opaco
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)'); // Transición suave
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');   // Borde totalmente transparente

    // Dibujar el gradiente en el canvas
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    return new THREE.CanvasTexture(canvas);
}

/**
 * Inicializa el sistema de efectos para la bola blanca.
 */
export function initCueBallEffects() {
    // --- CORRECCIÓN: Generar la textura de brillo mediante canvas en lugar de cargar una imagen. ---
    const glowTexture = createGlowTexture();
    trailMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xffffff, // Tinte blanco para el efecto de aurora
        transparent: true,
        blending: THREE.AdditiveBlending, // Efecto de brillo al superponerse
        depthWrite: false, // Para que las partículas no se oculten entre sí
    });

    trailGroup = new THREE.Group();
    scene.add(trailGroup);
}

/**
 * Crea una nueva partícula de estela en la posición actual de la bola.
 */
function emitParticle() {
    // --- CORRECCIÓN: La guarda ahora también comprueba el grupo ---
    if (!trailMaterial || !trailGroup) return;

    // --- MEJORA: Sistema de reutilización de partículas (pooling) más eficiente ---
    let particle;
    const inactiveParticle = trailParticles.find(p => !p.visible);

    if (inactiveParticle) {
        particle = inactiveParticle;
        particle.visible = true;
    } else if (trailParticles.length < MAX_PARTICLES) {
        particle = new THREE.Sprite(trailMaterial);
        trailGroup.add(particle);
        trailParticles.push(particle);
    } else {
        return; // No crear más partículas si se alcanza el límite y no hay inactivas.
    }

    // Configurar la nueva partícula
    particle.position.copy(cueBall.mesh.position);
    particle.position.z = cueBall.mesh.position.z - 5; // Un poco detrás de la bola
    particle.userData.creationTime = performance.now();

    // El tamaño de la partícula depende de la velocidad de la bola
    const speed = Math.sqrt(cueBall.vx ** 2 + cueBall.vy ** 2);
    const baseScale = 20;
    const scale = baseScale + Math.min(speed / 80, baseScale * 2);
    particle.scale.set(scale, scale, 1);
}

/**
 * Actualiza el estado de la estela en cada fotograma.
 * @param {number} dt - Delta time.
 */
export function updateCueBallEffects(dt) {
    if (!cueBall || !trailGroup || trailParticles.length === 0) return;

    const now = performance.now();

    // Actualizar todas las partículas existentes
    for (let i = trailParticles.length - 1; i >= 0; i--) {
        const particle = trailParticles[i];
        const age = (now - particle.userData.creationTime) / 1000; // Edad en segundos

        if (age > PARTICLE_LIFESPAN) {
            // Si la partícula ha expirado, simplemente la ocultamos. Será reutilizada.
            particle.visible = false;
        } else {
            // Desvanecer la partícula a medida que envejece
            const lifePercent = age / PARTICLE_LIFESPAN;
            particle.material.opacity = 1 - lifePercent;
        }
    }
}

/**
 * Activa la emisión de partículas para la estela.
 * Se llama en el bucle del juego mientras la bola se mueve.
 */
export function showShotEffect() {
    // Solo emitir si la bola se está moviendo rápido
    const speed = Math.sqrt(cueBall.vx ** 2 + cueBall.vy ** 2);
    if (speed > 15) { // --- CORRECCIÓN: Reducir el umbral de velocidad a un valor alcanzable
        emitParticle();
    }
}

/**
 * Oculta todas las partículas de la estela inmediatamente.
 */
export function clearShotEffect() {
    if (!trailParticles) return;
    for (const particle of trailParticles) {
        particle.visible = false;
    }
}