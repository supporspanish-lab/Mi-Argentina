const THREE = window.THREE;

window.globalState = {
    // Three.js related
    scene: null,
    camera: null,
    renderer: null,
    clock: null,

    // Character related
    character: null,
    mixer: null, // Player animation mixer
    characterState: 'idle', // 'idle', 'running', 'attacking', 'hit', 'pickup', 'dead'
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    playerHealth: 100,
    playerMoney: 1000,
    playerInventory: { mugs: [], barricades: 0, potions: 0, shields: 0 },
    shieldDurability: 0, // Durability of equipped shield
    helmetDurability: 0, // Durability of equipped helmet
    capeDurability: 0, // Durability of equipped cape
    playerSpawnPoint: null,
    playerAnimationSettings: {}, // From map data
    playerObjectVisibility: {}, // From map data
    attackPressed: false, // For keyboard attack
    keysPressed: {},
    wasBlocking: false, // Flag to return to blocking after hit
    shieldPressed: false, // Flag to track if shield button is currently pressed
    joystickAngle: 0, // For mobile movement
    joystickForce: 0, // For mobile movement
    joystickMoveVector: new THREE.Vector3(0, 0, 0), // For new constant speed joystick
    joystickSpeed: 15, // Joystick movement speed


    // Enemy related
    skeletons: [],
    skeletonBodies: [], // Placeholder for physics bodies if re-enabled
    skeletonMixers: [],
    skeletonHealths: [],
    attackCooldowns: [], // For enemy attacks

    // Map and environment
    collisionObjects: [], // Objects for raycasting and collision
    collisionObjectsCullable: [], // For dynamically added collision objects
    mapAssets: [], // For objects loaded from map
    cullableAssets: [], // For partial rendering
    barricadeMixers: [], // For barricade and Object_2 animations
    destroyedBarricades: [], // For delayed removal
    mapBounds: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }, // For map boundaries
    object2Target: null, // The object to defend
    object2Health: 1000,
    lastObject2DamageTime: 0, // Timestamp of last damage to object2

    // Wave system
    currentWave: 0,
    maxWave: 10,
    enemiesRemaining: 0,
    enableAI: true,
    isFinalWave: false, // Flag for the final boss wave
    gameWon: false, // Flag for game victory
    godMode: false,

    // Map loading
    loadTimer: 0, // Timer for initial full load

    // Barricade placement
    barricadePlacementMode: false,
    placementPreviewMesh: null,
    isDraggingBarricade: false,
    barricadeModel: null, // Loaded GLTF model for barricades

    // Attack mechanics
    comboCounter: 0,
    comboTimeout: 0,
    raycaster: null, // Reusable raycaster
    attackAimIndicator: null, // Visual indicator for attack
    lastAttackAngle: 0, // Last angle of attack (for joystick/mouse)
    joystickAttackIndicator: null, // Visual indicator for joystick attack

    // Camera settings
    cameraAngle: 30, // Degrees from vertical
    cameraRotation: 0, // Degrees around character
    cameraDistance: 25,
    isTopDown: true, // Camera mode
    renderDistance: 100, // Distancia de renderizado y culling
    // --- Screen Shake ---
    shakeIntensity: 0,
    shakeDuration: 0,
    shakeStartTime: 0,
    originalCameraPos: null,

    // Game loop and performance
    frameCount: 0,
    physicsTime: 0, // Placeholder for physics time
    fps: 0,
    lastTime: performance.now(),

    // UI elements (will be initialized in ui.js)
    coordsDiv: null,
    fpsDiv: null,
    moneyDiv: null,
    playerHealthBar: null,
    settingsIcon: null,
    settingsPanel: null,
    cameraDistanceInput: null,
    cameraDistanceValue: null,
    cameraAngleInput: null,
    cameraAngleValue: null,
    cameraRotationInput: null,
    cameraRotationValue: null,
    renderDistanceInput: null,
    renderDistanceValue: null,
    cameraModeCheckbox: null,

    itemButton: null,
    itemIcon: null,
    itemCount: null,
    barricadeButton: null,
    barricadeIcon: null,
    barricadeCount: null,
    potionButton: null,
    potionIcon: null,
    potionCount: null,
    shopModal: null,
    closeShopBtn: null,
    shopItemsGrid: null,
    shopButton: null,
    object2HealthContainer: null,
    object2HealthBar: null,
    joystickContainer: null,
    attackJoystickContainer: null,
    attackManager: null, // For attack joystick
    manager: null, // For movement joystick


    // Pickups
    mugDrops: [], // Array to store dropped mugs

    // Blood particles
    bloodParticles: [],
    bloodCanvas: null,
    bloodCtx: null,

    // Collision function
    checkHorizontalCollision: function(currentPos, moveVector) {
        if (moveVector.lengthSq() === 0) return moveVector;

        const playerHeight = window.PLAYER_HEIGHT;
        const playerRadius = window.PLAYER_RADIUS;
        const nextPos = currentPos.clone().add(moveVector);

        const playerBox = new THREE.Box3(
            new THREE.Vector3(nextPos.x - playerRadius, nextPos.y + 0.1, nextPos.z - playerRadius),
            new THREE.Vector3(nextPos.x + playerRadius, nextPos.y + playerHeight, nextPos.z + playerRadius)
        );

        for (let i = 0; i < window.globalState.collisionObjects.length; i++) {
            const object = window.globalState.collisionObjects[i];
            if (object.userData.isFloor === true || !object.geometry) continue;

            const objectBox = new THREE.Box3().setFromObject(object);
            if (playerBox.intersectsBox(objectBox)) return new THREE.Vector3(0, 0, 0);
        }

        return moveVector;
    },

    // Functions (will be imported from other modules and assigned here)
    initScene: null,
    loadMap: null,
    buildSceneFromMapData: null,
    findAndSetBarricadeModel: null,
    loadPlayer: null,
    initUI: null,
    loadDefaultFloor: null,
    updateUI: null,
    collectPickup: null,
    updateCamera: null,
    handlePlayerMovement: null,
    handlePlayerAttack: null,
    handleEnemyAI: null,
    handlePickups: null,
    handlePlayerDeath: null,
    handleEnemyDeath: null,
    handleBarricadeDamage: null,
    handleObject2Damage: null,
    setupEventListeners: null,
    setupSettingsPanel: null,
    updateObject2HealthUI: null,
    updateItemUI: null,
    updateBarricadeUI: null,
    updatePotionUI: null,
    updateShopUI: null,
    getQueryParam: null,
    setPlayerAnimation: null,
    setSkeletonAnimation: null,
    animateGame: null,
    isGroundAt: null,
    checkHorizontalCollision: null,
    playSound: null,
    isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),

    // Sound system
    audioContext: null,
    soundCache: {},
    loopingSounds: {}, // To track looping sounds
};

// Initialize raycaster after globalState is defined
globalState.raycaster = new THREE.Raycaster();

// --- INICIO: Función para Sonido en Bucle ---
// Se mueve aquí para garantizar que esté disponible globalmente desde el principio.
window.playLoopingSound = function(url, volume) {
    // Evitar reproducir múltiples bucles del mismo sonido
    if (window.globalState.loopingSounds && window.globalState.loopingSounds[url]) {
        return;
    }
    const audioContext = window.globalState.audioContext;
    if (!audioContext) return;

    const soundBuffer = window.globalState.soundCache[url];
    if (soundBuffer) {
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        source.buffer = soundBuffer;
        source.loop = true;
        gainNode.gain.value = volume;
        source.connect(gainNode).connect(audioContext.destination);
        source.start(0);
        window.globalState.loopingSounds[url] = source; // Guardar referencia para evitar duplicados
    }
};

// --- INICIO: Sistema de Partículas de Sangre ---
window.initBloodCanvas = function() {
    window.globalState.bloodCanvas = document.getElementById('blood-canvas');
    window.globalState.bloodCtx = window.globalState.bloodCanvas.getContext('2d');
    window.resizeBloodCanvas();
    window.addEventListener('resize', window.resizeBloodCanvas);
};

window.resizeBloodCanvas = function() {
    window.globalState.bloodCanvas.width = window.innerWidth;
    window.globalState.bloodCanvas.height = window.innerHeight;
};

window.addBloodParticles = function(worldX, worldY, worldZ, count = 10, color = 'red') {
    for (let i = 0; i < count; i++) {
        window.globalState.bloodParticles.push({
            worldX: worldX,
            worldY: worldY,
            worldZ: worldZ,
            vx: (Math.random() - 0.5) * 2, // velocity in world units
            vy: (Math.random() - 0.5) * 2 - 1, // velocity y, bias upwards
            vz: (Math.random() - 0.5) * 2,
            life: 1.0, // life from 1 to 0
            size: Math.random() * 2 + 1,
            color: color
        });
    }
};

window.updateBloodParticles = function(deltaTime) {
    const playerPos = window.globalState.character ? window.globalState.character.position : new THREE.Vector3();
    const cullDistance = window.globalState.renderDistance + 20;

    for (let i = window.globalState.bloodParticles.length - 1; i >= 0; i--) {
        const p = window.globalState.bloodParticles[i];
        p.worldX += p.vx * deltaTime;
        p.worldY += p.vy * deltaTime;
        p.worldZ += p.vz * deltaTime;
        p.vy -= 9.8 * deltaTime; // gravity in world
        p.life -= deltaTime * 2; // fade out

        // Cull based on distance
        const dist = Math.sqrt((p.worldX - playerPos.x)**2 + (p.worldZ - playerPos.z)**2);
        if (p.life <= 0 || dist > cullDistance) {
            window.globalState.bloodParticles.splice(i, 1);
        } else {
            // Project to screen
            const worldPos = new THREE.Vector3(p.worldX, p.worldY, p.worldZ);
            const screenPos = worldPos.clone().project(window.globalState.camera);
            p.x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
            p.y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
        }
    }
};

window.drawBloodParticles = function() {
    const ctx = window.globalState.bloodCtx;
    ctx.clearRect(0, 0, window.globalState.bloodCanvas.width, window.globalState.bloodCanvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; // shadow
    for (const p of window.globalState.bloodParticles) {
        ctx.globalAlpha = p.life * 0.5;
        ctx.beginPath();
        ctx.arc(p.x + 2, p.y + 2, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    for (const p of window.globalState.bloodParticles) {
        ctx.fillStyle = p.color === 'yellow' ? 'rgba(255,255,0,0.8)' : 'red';
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
};
// --- FIN: Sistema de Partículas de Sangre ---
