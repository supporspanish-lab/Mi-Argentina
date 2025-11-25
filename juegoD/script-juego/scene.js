// Scene initialization and management

window.initScene = function() {
    window.globalState.scene = new THREE.Scene();
    window.globalState.scene.background = new THREE.Color(0x000022); // Dark night sky
    window.globalState.clock = new THREE.Clock();

    window.globalState.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100); // Reducido el far plane
    window.globalState.camera.position.set(0, 5, 10); // Third person position
    window.globalState.camera.lookAt(0, 0, 0); // Look at character

    window.globalState.renderer = new THREE.WebGLRenderer();
    window.globalState.renderer.setSize(window.innerWidth, window.innerHeight);
    window.globalState.renderer.shadowMap.enabled = true;
    window.globalState.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(window.globalState.renderer.domElement);

    // Lighting for night
    const ambientLight = new THREE.AmbientLight(0x101010, 0.2); // Dim ambient light
    window.globalState.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xddddff, 0.3); // Bluish moonlight
    directionalLight.position.set(-10, 20, 10); // Moon position
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 200;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    directionalLight.shadow.bias = -0.0005;
    directionalLight.shadow.normalBias = 0.02;
    window.globalState.scene.add(directionalLight);

    // Create joystick attack indicator (yellow arc)
    const coneRadius = 10 * Math.tan((Math.PI / 3) / 2); // ATTACK_RANGE * tan(ATTACK_CONE_ANGLE / 2)
    const coneHeight = 10; // ATTACK_RANGE
    const joystickGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 32, 1, true); // 3D cone geometry
    const joystickMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
    window.globalState.joystickAttackIndicator = new THREE.Mesh(joystickGeometry, joystickMaterial);

    // Rotate the cone to point forward (positive Z-axis)
    window.globalState.joystickAttackIndicator.rotation.x = Math.PI / 2;

    window.globalState.joystickAttackIndicator.visible = false; // Initially hidden
    window.globalState.scene.add(window.globalState.joystickAttackIndicator);

    // Add resize event listener for responsive design
    window.addEventListener('resize', window.onWindowResize, false);

    // Also listen for fullscreen changes
    document.addEventListener('fullscreenchange', window.onWindowResize, false);
};

window.onWindowResize = function() {
    window.globalState.camera.aspect = window.innerWidth / window.innerHeight;
    window.globalState.camera.updateProjectionMatrix();
    window.globalState.renderer.setSize(window.innerWidth, window.innerHeight);
};

window.isGroundAt = function(position) {
    const groundRaycaster = new THREE.Raycaster(
        new THREE.Vector3(position.x, 50, position.z), // Ray origin from above
        new THREE.Vector3(0, -1, 0) // Direction downwards
    );
    const intersects = groundRaycaster.intersectObjects(window.globalState.collisionObjects, true);
    // Returns true if a floor object is found below
    return intersects.length > 0 && intersects[0].object.userData.isFloor;
};