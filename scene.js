// --- Módulo de Escena ---
import * as THREE from 'three';
import { loadingManager, addPendingResource, resolvePendingResource } from './loadingManager.js';
import { TABLE_WIDTH, TABLE_HEIGHT } from './config.js';


export const canvas = document.getElementById("poolCanvas");

// --- Configuración de la escena 3D ---
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 5000);

// --- NUEVO: Establecer un color de fondo oscuro para el entorno 3D ---
scene.background = new THREE.Color('#051021'); // Un azul muy oscuro, casi negro

// --- Variables de Zoom ---
export let zoomState = {
    isZooming: false,
    level: 1,
    centerX: TABLE_WIDTH / 2,
    centerY: TABLE_HEIGHT / 2,
};

// --- NUEVO: Restauración de las luces para dar volumen a las bolas ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // Luz suave general
scene.add(ambientLight);

export const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Luz principal que proyecta sombras
directionalLight.position.set(TABLE_WIDTH / 2, 1000, 500);
directionalLight.castShadow = false; // --- MODIFICACIÓN: Desactivamos la sombra real para usar la falsa (zombra.png)
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.bias = -0.0005;
directionalLight.shadow.normalBias = 0.05;

const lightTarget = new THREE.Object3D();
lightTarget.position.set(TABLE_WIDTH / 2, TABLE_HEIGHT / 2, 0);
scene.add(lightTarget);
directionalLight.target = lightTarget;
scene.add(directionalLight);

// --- Renderizador ---
export const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
// --- SOLUCIÓN: Ajustar el renderizador a la densidad de píxeles del dispositivo ---
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limitar a 2 para no afectar el rendimiento en dispositivos de muy alta gama.
// --- MODIFICACIÓN: Reactivar las sombras ---
renderer.shadowMap.enabled = true;

// --- CORRECCIÓN: La geometría de la mesa debe usar las dimensiones lógicas del juego ---
const tableGeometry = new THREE.PlaneGeometry(TABLE_WIDTH, TABLE_HEIGHT);
// --- MODIFICACIÓN: Usar MeshBasicMaterial para que la textura no se vea afectada por las luces ---
// Esto asegura que la mesa se vea con los colores y el brillo exactos de la imagen original.
const tableVisualMaterial = new THREE.MeshBasicMaterial({ transparent: true }); // --- CORRECCIÓN: Se crea sin mapa de textura inicial
export const tableMesh = new THREE.Mesh(tableGeometry, tableVisualMaterial);
tableMesh.position.set(TABLE_WIDTH / 2, TABLE_HEIGHT / 2, -1); // Centrar la mesa en el área de juego
tableMesh.receiveShadow = true; // La mesa debe recibir las sombras de las bolas.
scene.add(tableMesh);

// --- NUEVO: Función para cargar la textura de la mesa bajo demanda ---
export function loadTableTexture() {
    addPendingResource(); // 1. Notificar que empezamos a cargar la mesa.
    new THREE.TextureLoader(loadingManager).load('imajenes/mesa.png', (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.anisotropy = maxAnisotropy;
        tableMesh.material.map = texture; // Asignar la textura una vez cargada
        tableMesh.material.needsUpdate = true;
        resolvePendingResource(); // 2. Notificar que la mesa está lista.
    });
}

// Función para calcular la posición Z de la cámara para que la mesa se ajuste a la pantalla
export function updateCameraPositionForResponsiveness({ availableWidth, availableHeight, topUiOffset } = {}) {
    // --- SOLUCIÓN: La función ahora recibe el área segura calculada desde ui.js ---

    // --- SOLUCIÓN DEFINITIVA: Añadir un padding directamente al tamaño de la mesa para el cálculo del zoom ---
    const PADDING_FACTOR = 1.0; // Ya no necesitamos padding, el área segura lo gestiona.
    const effectiveWidth = (TABLE_WIDTH / zoomState.level) * PADDING_FACTOR;
    const effectiveHeight = (TABLE_HEIGHT / zoomState.level) * PADDING_FACTOR;

    // Usar el aspect ratio del área de juego disponible.
    // --- SOLUCIÓN: Usar el ancho y alto del área segura para un cálculo de aspecto correcto ---
    // Si alguno de los valores no está disponible (en la carga inicial), usamos los de la ventana como fallback.
    const safeWidth = availableWidth || window.innerWidth;
    const safeHeight = availableHeight || window.innerHeight;
    const aspect = safeWidth / safeHeight;
    const tableAspect = effectiveWidth / effectiveHeight;

    let cameraZ;
    if (aspect < tableAspect) {
        // El ancho limita el zoom.
        cameraZ = (effectiveWidth / 2) / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect);
    } else {
        // El alto limita el zoom.
        cameraZ = (effectiveHeight / 2) / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    }

    // 1. Calcular el centro del área visible en coordenadas del mundo.
    const visibleWorldHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * cameraZ;
    const worldUnitsPerPixel = visibleWorldHeight / safeHeight;
    // El centro del área visible está desplazado hacia abajo en la pantalla por la mitad de la altura de la UI.
    // --- SOLUCIÓN: Centrar la cámara en el centro de la mesa y luego desplazarla hacia abajo ---
    // El desplazamiento necesario es la mitad de la altura de la UI, convertida a unidades del mundo.
    const yOffset = (topUiOffset * worldUnitsPerPixel) / 2;
    const targetY = (TABLE_HEIGHT / 2.17) + yOffset; // --- SOLUCIÓN: Sumar el offset para bajar la mesa

    // 2. Establecer la posición y el punto de mira finales de la cámara.
    camera.position.set(TABLE_WIDTH / 2, targetY, cameraZ);
    camera.lookAt(TABLE_WIDTH / 2, targetY, 0);

    // --- NUEVO: Ajustar los límites de la sombra dinámicamente con el zoom ---
    directionalLight.shadow.camera.left = zoomState.centerX - (effectiveWidth / 2) * 1.20;
    directionalLight.shadow.camera.right = zoomState.centerX + (effectiveWidth / 2) * 1.20;
    directionalLight.shadow.camera.top = zoomState.centerY + (effectiveHeight / 2) * 1.20;
    directionalLight.shadow.camera.bottom = zoomState.centerY - (effectiveHeight / 2) * 1.20;
    directionalLight.shadow.camera.near = camera.near;
    directionalLight.shadow.camera.far = camera.far;
    directionalLight.shadow.camera.updateProjectionMatrix();
}

// Llamar al inicio para configurar la cámara
updateCameraPositionForResponsiveness();

// --- NUEVO: Manejo de redimensionamiento de la ventana para responsividad ---
function onWindowResize() {
    // --- SOLUCIÓN: La lógica de redimensionamiento ahora se centraliza en updateSafeArea (llamado desde pool.js) ---
    // Esta función solo se encarga de actualizar las propiedades del renderizador y la cámara.

    // Actualizar el aspect ratio de la cámara
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    // Actualizar el tamaño del renderizador
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener('resize', onWindowResize, false); // Mantenemos el listener para el renderizador, pero el principal es el de pool.js