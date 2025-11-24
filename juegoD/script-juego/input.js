// Input handling

window.initInput = function() {
    // Setup event listeners for keyboard input
    document.addEventListener('keydown', (event) => {
        window.globalState.keysPressed[event.code] = true;
        switch(event.code) {
            case 'KeyW': window.globalState.moveForward = true; break;
            case 'KeyA': window.globalState.moveLeft = true; break;
            case 'KeyS': window.globalState.moveBackward = true; break;
            case 'KeyD': window.globalState.moveRight = true; break;
            case 'ControlLeft':
            case 'ControlRight':
                if (!window.globalState.attackPressed) {
                    window.globalState.attackPressed = true;
                    window.attack(0); // Default attack angle
                }
                break;
        }
    });

    document.addEventListener('keyup', (event) => {
        window.globalState.keysPressed[event.code] = false;
        switch(event.code) {
            case 'KeyW': window.globalState.moveForward = false; break;
            case 'KeyA': window.globalState.moveLeft = false; break;
            case 'KeyS': window.globalState.moveBackward = false; break;
            case 'KeyD': window.globalState.moveRight = false; break;
            case 'ControlLeft':
            case 'ControlRight':
                window.globalState.attackPressed = false;
                break;
        }
    });

    // Initialize barricade events
    window.initBarricadeEvents();

    // --- INICIO: Lógica del Joystick Táctil ---

    // --- FIN: Lógica del Joystick Táctil ---
};