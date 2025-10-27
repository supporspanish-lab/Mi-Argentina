// --- Módulo de Gestión de Bolas ---
import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { TABLE_WIDTH, TABLE_HEIGHT, BALL_RADIUS, RACK_SPACING_DIAMETER, pockets } from './config.js';
import { loadingManager, addPendingResource, resolvePendingResource } from './loadingManager.js';
import { scene } from './scene.js';

export let balls = [];
export let cueBall = null;
export let cueBallRedDot = null; // --- NUEVO: Variable para el punto rojo
let ballModelsMap = {};
let loadedGltfScene = null;

// --- NUEVO: Textura para la sombra suave debajo de la bola ---
let shadowTextureLoader;
let shadowTexture;
let shadowMaterial;

export function prepareBallLoaders() {
    shadowTextureLoader = new THREE.TextureLoader(loadingManager);
    shadowTexture = shadowTextureLoader.load('imajenes/zombra.png');
    shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.5 });
}

// --- NUEVO: Rotaciones iniciales predefinidas para las bolas ---
const initialBallRotations = [
    { number: 'cue', x: 4.4331, y: 1.5359, z: 0.0000 },
    { number: 1, x: 4.4331, y: 1.5359, z: 0.0000 },
    { number: 14, x: 4.4331, y: 1.5359, z: 0.0000 },
    { number: 2, x: 4.4331, y: 1.5359, z: 0.0000 },
    { number: 15, x: 4.4331, y: 1.5359, z: 0.0000 },
    { number: 8, x: 4.4331, y: 1.5359, z: 0.0000 },
    { number: 3, x: 4.4331, y: 1.5359, z: 0.0000 },
    { number: 13, x: 4.4331, y: 1.5359, z: 0.0000 },
    { number: 4, x: 4.4331, y: 1.5359, z: 0.0000 },
    { number: 12, x: 4.4331, y: 1.5359, z: 0.0000 },
    { number: 5, x: 4.4331, y: 1.5359, z: 0.0000 },
    { number: 11, x: 4.4331, y: 1.5359, z: 0.0000 },
    { number: 6, x: 4.4331, y: 1.5359, z: 0.0000 },
    { number: 10, x: 4.4331, y: 1.5359, z: 0.0000 },
    { number: 7, x: 4.4331, y: 1.5359, z: 0.0000 },
    { number: 9, x: 4.4331, y: 1.5359, z: 0.0000 }
];


// Función para crear una bola (física + visual)
const createBall = (props) => {
    // --- CORRECCIÓN: Crear un contenedor (Group) para la bola y sus elementos hijos (como el punto rojo) ---
    const ballContainer = new THREE.Group();

    let ballMesh;
    const targetName = getBallModelName(props.number);
    if (Object.keys(ballModelsMap).length > 0) {
        const sourceModel = ballModelsMap[targetName];

        if (sourceModel) {
            ballMesh = sourceModel.clone();
            const box = new THREE.Box3().setFromObject(ballMesh);
            const size = box.getSize(new THREE.Vector3());
            const originalDiameter = Math.max(size.x, size.y, size.z);
            
            if (originalDiameter > 0) {
                const scaleFactor = (BALL_RADIUS * 2) / originalDiameter;
                ballMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
            }
            const centeringBox = new THREE.Box3().setFromObject(ballMesh);
            const center = centeringBox.getCenter(new THREE.Vector3());
            ballMesh.position.sub(center);

            // --- MODIFICADO: Aplicar rotación inicial predefinida ---
            const ballNumber = props.number === null ? 'cue' : props.number;
            const rotationData = initialBallRotations.find(r => r.number === ballNumber);
            if (rotationData) {
                ballMesh.rotation.set(rotationData.x, rotationData.y, rotationData.z);
            } else {
                ballMesh.rotation.set(0, 0, 0); // Fallback si no se encuentra rotación
            }

            ballMesh.visible = true;
            ballMesh.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true; // --- MODIFICACIÓN: Las bolas proyectan sombras
                    child.visible = true;
                    // --- MODIFICACIÓN: Volver a MeshStandardMaterial para que reaccione a la luz ---
                    if (child.material) {
                        const oldMaterial = child.material;
                        child.material = new THREE.MeshStandardMaterial({
                            map: oldMaterial.map,
                            roughness: 0.3,
                            metalness: 0.2,
                        });
                        oldMaterial.dispose(); // Liberar memoria del material antiguo
                    }
                }
            });
        } else {
            console.warn(`Modelo GLB para '${targetName}' no encontrado. Usando esfera de reserva.`);
            const texture = createBallTexture(props.number, props.color);
            const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3, metalness: 0.2 });
            const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
            ballMesh = new THREE.Mesh(ballGeometry, material);
            ballMesh.castShadow = true;
        }
    } else {
        const texture = createBallTexture(props.number, props.color);
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3, metalness: 0.2 });
        const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
        ballMesh = new THREE.Mesh(ballGeometry, material);
        ballMesh.castShadow = true;
    }

    // --- CORRECCIÓN: Añadir la malla de la bola al contenedor, no directamente a la escena ---
    ballContainer.add(ballMesh);
    ballContainer.position.set(props.x, props.y, BALL_RADIUS);

    // --- NUEVO: Crear y añadir la sombra suave debajo de la bola ---
    // --- NUEVO: Añadir un punto rojo a la bola blanca ---
    if (props.number === null) { // Si es la bola blanca
        const dotGeometry = new THREE.CircleGeometry(BALL_RADIUS * 0.2, 16); // El punto tendrá un 20% del radio de la bola
        const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xe74c3c, side: THREE.DoubleSide }); // Rojo, visible por ambos lados
        cueBallRedDot = new THREE.Mesh(dotGeometry, dotMaterial);
        // --- CORRECCIÓN: Posicionar el punto en la superficie de la malla de la bola, no del contenedor. ---
        // Esto asegura que rote junto con la bola.
        cueBallRedDot.position.z = BALL_RADIUS + 0.1; // Un poco por encima para evitar z-fighting
        // El punto rojo no necesita rotación inicial.
        ballMesh.add(cueBallRedDot); // Añadir el punto a la malla de la bola, no al contenedor.
    }

    const shadowGeometry = new THREE.PlaneGeometry(BALL_RADIUS * 3.0, BALL_RADIUS * 3.0); // --- NUEVO: Geometría para el plano de la sombra
    const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial); // --- NUEVO: Crear la malla de la sombra
    shadowMesh.position.set(props.x, props.y, 0.1); // --- NUEVO: Posicionar la sombra justo sobre la mesa
    scene.add(shadowMesh); // --- NUEVO: Añadir la sombra a la escena

    scene.add(ballContainer); // --- CORRECCIÓN: Añadir el contenedor a la escena
    return { 
        ...props, 
        mesh: ballContainer, // --- CORRECCIÓN: La malla principal ahora es el contenedor
        originalModelName: targetName, // --- NUEVO: Guardar el nombre del modelo original 
        shadowMesh: shadowMesh, // --- MODIFICACIÓN: Guardar referencia a la sombra para poder moverla
        vx: 0,
        vy: 0,
        initialVx: 0, // --- NUEVO: Para calcular el efecto basado en la potencia del tiro
        initialVy: 0, // --- NUEVO: Para calcular el efecto basado en la potencia del tiro
        isPocketed: false, // Estado para saber si ha sido entronerada
        pocketedState: null, // --- NUEVO: 'falling', 'rolling', 'collected'
        distanceTraveled: 0, // --- NUEVO: Acumulador para la distancia total recorrida
        spin: { x: 0, y: 0 } // --- NUEVO: Propiedad para almacenar el efecto de la bola
    };
};

export function setupBalls(isInitialSetup = false, singleBallData = null) {
    
    if (singleBallData) {
        // --- NUEVO: Crear una sola bola a partir de los datos ---
        const newBall = createBall(singleBallData);
        balls.push(newBall);
        if (newBall.number === null) {
            cueBall = newBall;
        }
        return;
    }

    if (isInitialSetup) {
        // Limpiar bolas anteriores solo si es un setup completo
        balls.forEach(ball => {
            if (ball.mesh) scene.remove(ball.mesh);
            if (ball.shadowMesh) scene.remove(ball.shadowMesh);
            if (ball.mesh && ball.mesh.children.length > 0) scene.remove(ball.mesh.children[0]);
        });
        balls.length = 0;
    }

    // Bola Blanca
    const cueBallData = {
        number: null, color: 'white',
        distanceTraveled: 0, // --- NUEVO: Reiniciar distancia para la bola blanca
        x: TABLE_WIDTH / 4, y: TABLE_HEIGHT / 2,
        radius: BALL_RADIUS, isActive: true,
        spin: { x: 0, y: 0 } // --- NUEVO: Reiniciar el efecto
    }; 
    cueBall = createBall(cueBallData);
    balls.push(cueBall);

    // --- CORRECCIÓN: Las troneras solo se crean una vez al inicio del juego ---
    if (isInitialSetup) {
        pockets.forEach(pocket => {
            if (!pocket.mesh) { // Crear solo si no existe
                const shape = new THREE.Shape(pocket.points.map(p => new THREE.Vector2(p.x, p.y)));
                const pocketGeometry = new THREE.ShapeGeometry(shape);
                const pocketMaterial = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8, metalness: 0.1 });
                const pocketMesh = new THREE.Mesh(pocketGeometry, pocketMaterial);
                pocketMesh.position.z = -BALL_RADIUS / 2;
                pocketMesh.receiveShadow = true;
                scene.add(pocketMesh);
                pocket.mesh = pocketMesh;
            }
        });
    }

    const ballColors = {
        1: '#f1c40f', 2: '#3498db', 3: '#e74c3c', 4: '#9b59b6', 5: '#e67e22',
        6: '#2ecc71', 7: '#a52a2a', 8: 'black', 9: '#f1c40f', 10: '#3498db',
        11: '#e74c3c', 12: '#9b59b6', 13: '#e67e22', 14: '#2ecc71', 15: '#a52a2a'
    };

    const startX = TABLE_WIDTH * 0.75;
    const startY = TABLE_HEIGHT / 2;
    let ballCount = 1;

    const ballOrder = [1, 14, 2, 15, 8, 3, 13, 4, 12, 5, 11, 6, 10, 7, 9];

    for (let i = 0; i < 5; i++) {
        for (let j = 0; j <= i; j++) {
            const ballNumber = ballOrder[ballCount - 1];
            const newBallData = {
                id: ballNumber, // --- CORRECCIÓN: Usar el número real de la bola como ID
                number: ballNumber,
                distanceTraveled: 0, // --- NUEVO: Inicializar distancia para las bolas de color
                color: ballColors[ballNumber],
                x: startX + i * (RACK_SPACING_DIAMETER * 0.866),
                y: startY + j * RACK_SPACING_DIAMETER - i * (RACK_SPACING_DIAMETER / 2),
                radius: BALL_RADIUS, isActive: true
            };
            balls.push(createBall(newBallData));
            ballCount++;
        }
    }
}

/**
 * Carga los modelos 3D de las bolas.
 */
export function loadBallModels() {
    const loader = new GLTFLoader(loadingManager);
    const ballModelPath = 'modelos/billiard_balls.glb';

    // --- SOLUCIÓN: No es necesario gestionar este recurso manualmente.
    // El GLTFLoader ya está asociado con el loadingManager, que se encargará de la espera.
    loader.load(ballModelPath, (gltf) => {
        const modelScene = gltf.scene; 

        modelScene.traverse(child => {
            if (child.name) {
                ballModelsMap[child.name] = child;
                child.visible = false;
            }
        });

        loadedGltfScene = modelScene;
        scene.add(loadedGltfScene);
    }, undefined, (error) => {
        console.error(`Error al cargar el modelo de la bola desde '${ballModelPath}'. Detalles:`, error);
    });
}

/**
 * --- NUEVO: Actualiza la textura de una bola existente. ---
 * --- CORREGIDO: Actualiza el modelo y la textura de una bola existente. ---
 * @param {object} ball - La bola cuyo número y textura se actualizarán.
 */
export function updateBallModelAndTexture(ball) {
    if (!ball || !ball.mesh) return;
    // Guardar la transformación actual de la bola
    const oldPosition = ball.mesh.position.clone();
    const oldQuaternion = ball.mesh.quaternion.clone();
    const oldScale = ball.mesh.scale.clone();

    // Eliminar el modelo 3D antiguo de la escena
    scene.remove(ball.mesh);

    // Obtener el nombre del nuevo modelo
    const newModelName = getBallModelName(ball.number);
    const sourceModel = ballModelsMap[newModelName];

    let newMesh;
    if (sourceModel) {
        newMesh = sourceModel.clone();
        newMesh.visible = true;
        newMesh.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.visible = true;
                if (child.material) {
                    const oldMaterial = child.material;
                    child.material = new THREE.MeshStandardMaterial({
                        map: oldMaterial.map,
                        roughness: 0.3,
                        metalness: 0.2,
                    });
                    oldMaterial.dispose();
                }
            }
        });
    } else {
        // Fallback a una esfera si el modelo no se encuentra
        console.warn(`Modelo GLB para '${newModelName}' no encontrado. Usando esfera de reserva.`);
        const texture = createBallTexture(ball.number, ball.color);
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3, metalness: 0.2 });
        const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
        newMesh = new THREE.Mesh(ballGeometry, material);
        newMesh.castShadow = true;
    }

    // Aplicar la transformación guardada y añadir a la escena
    newMesh.position.copy(oldPosition);
    newMesh.quaternion.copy(oldQuaternion);
    newMesh.scale.copy(oldScale);
    ball.mesh = newMesh; // Reemplazar la referencia en el objeto de la bola
    scene.add(ball.mesh);
}

export function createBallTexture(ballNumber, ballColor) {
    const canvasSize = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const context = canvas.getContext('2d');

    context.beginPath();
    context.arc(canvasSize / 2, canvasSize / 2, canvasSize / 2, 0, Math.PI * 2);
    context.fillStyle = ballColor;
    context.fill();

    if (ballNumber !== null) {
        context.beginPath();
        context.arc(canvasSize / 2, canvasSize / 2, canvasSize / 2 * 0.4, 0, Math.PI * 2);
        context.fillStyle = 'white';
        context.fill();

        context.font = `bold ${canvasSize * 0.3}px Arial`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = (ballNumber === 8) ? 'white' : 'black';
        context.fillText(ballNumber.toString(), canvasSize / 2, canvasSize / 2);
    }

    return new THREE.CanvasTexture(canvas);
}

const getBallModelName = (ballNumber) => {
    if (ballNumber === null) return 'Ball_Clube_10_-_Default_0';
    switch (ballNumber) {
        case 1: return 'Ball1_01_-_Default_0';
        case 2: return 'Ball2_02_-_Default_0';
        case 3: return 'Ball3_03_-_Default_0';
        case 4: return 'Ball4_07_-_Default_0';
        case 5: return 'Ball5_08_-_Default_0';
        case 6: return 'Ball6_09_-_Default_0';
        case 7: return 'Ball7_13_-_Default_0';
        case 8: return 'Ball8_14_-_Default_0';
        case 9: return 'Ball9_15_-_Default_0';
        case 10: return 'Ball10_19_-_Default_0';
        case 11: return 'Ball11_20_-_Default_0';
        case 12: return 'Ball12_21_-_Default_0';
        case 13: return 'Ball13_04_-_Default_0';
        case 14: return 'Ball14_05_-_Default_0';
        case 15: return 'Ball15_06_-_Default_0';
        default:
            console.warn(`Nombre de modelo no definido para bola #${ballNumber}.`);
            return `ball_${ballNumber}`;
    }
};

/** --- NUEVO: Devuelve todas las bolas actualmente en la escena. */
export function getSceneBalls() {
    return balls;
}