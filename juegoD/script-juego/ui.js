const nipplejs = window.nipplejs;
const attack = window.attack;
const dropHealthPickup = window.dropHealthPickup;
const HEALTH_PICKUP_AMOUNT = window.HEALTH_PICKUP_AMOUNT;
const PICKUP_COLLECTION_RANGE = window.PICKUP_COLLECTION_RANGE;
const PICKUP_PROMPT_OFFSET_Y = window.PICKUP_PROMPT_OFFSET_Y;


window.initUI = function() {
    window.globalState.coordsDiv = document.getElementById('coords');
    window.globalState.coordsDiv.addEventListener('click', function() {
        navigator.clipboard.writeText(window.globalState.coordsDiv.textContent.replace('Posición: ', ''));
        alert('Coordenadas copiadas al portapapeles');
    });

    window.globalState.fpsDiv = document.getElementById('fps');
    window.globalState.moneyDiv = document.getElementById('money');
    window.globalState.playerHealthBar = document.getElementById('player-health-bar');

    // Error modal
    window.globalState.errorModal = document.getElementById('error-modal');
    window.globalState.errorList = document.getElementById('error-list');
    window.globalState.closeErrorModalBtn = document.getElementById('close-error-modal-btn');
    window.globalState.clearErrorsBtn = document.getElementById('clear-errors-btn');
    window.globalState.errors = [];

    window.onerror = function(message, source, lineno, colno, error) {
        const errorMsg = `${message} at ${source}:${lineno}:${colno}`;
        window.globalState.errors.push(errorMsg);
        updateErrorModal();
        window.globalState.errorModal.style.display = 'flex';
    };

    window.globalState.closeErrorModalBtn.addEventListener('click', () => {
        window.globalState.errorModal.style.display = 'none';
    });

    window.globalState.clearErrorsBtn.addEventListener('click', () => {
        window.globalState.errors = [];
        updateErrorModal();
    });

    // Settings
    window.globalState.settingsIcon = document.getElementById('settings-icon');
    window.globalState.settingsPanel = document.getElementById('settings-panel');

    window.globalState.settingsIcon.addEventListener('click', () => {
        window.globalState.settingsPanel.style.display = window.globalState.settingsPanel.style.display === 'none' ? 'block' : 'none';
    });

    window.globalState.cameraDistanceInput = document.getElementById('camera-distance');
    window.globalState.cameraDistanceValue = document.getElementById('camera-distance-value');
    window.globalState.cameraDistanceInput.addEventListener('input', (e) => {
        window.globalState.cameraDistance = parseFloat(e.target.value);
        window.globalState.cameraDistanceValue.textContent = window.globalState.cameraDistance;
    });

    window.globalState.cameraAngleInput = document.getElementById('camera-angle');
    window.globalState.cameraAngleValue = document.getElementById('camera-angle-value');
    window.globalState.cameraAngleInput.addEventListener('input', (e) => {
        window.globalState.cameraAngle = parseFloat(e.target.value);
        window.globalState.cameraAngleValue.textContent = window.globalState.cameraAngle;
    });

    // --- INICIO: Añadir dinámicamente el control de renderizado ---
    if (window.globalState.settingsPanel) {
        const renderSettingItem = document.createElement('div');
        renderSettingItem.className = 'setting-item';

        renderSettingItem.innerHTML = `
            <label for="render-distance">Distancia de Renderizado:</label>
            <input type="range" id="render-distance" min="20" max="200" value="100" step="10">
            <span id="render-distance-value">100</span>
        `;

        window.globalState.settingsPanel.appendChild(renderSettingItem);
    }
    // --- FIN: Añadir dinámicamente el control de renderizado ---

    // Render distance slider
    window.globalState.renderDistanceInput = document.getElementById('render-distance');
    window.globalState.renderDistanceValue = document.getElementById('render-distance-value');
    if (window.globalState.renderDistanceInput && window.globalState.renderDistanceValue) {
        window.globalState.renderDistanceInput.addEventListener('input', (e) => {
            const newDistance = parseFloat(e.target.value);
            window.globalState.renderDistance = newDistance;
            window.globalState.renderDistanceValue.textContent = newDistance;
            // Actualizar el 'far plane' de la cámara
            if (window.globalState.camera) {
                window.globalState.camera.far = newDistance + 40; // Un poco más que la distancia de culling
                window.globalState.camera.updateProjectionMatrix();
            }
        });
    }

    const toggleAIEnemiesCheckbox = document.getElementById('toggle-ai-enemies');
    if (toggleAIEnemiesCheckbox) {
        toggleAIEnemiesCheckbox.addEventListener('change', (e) => {
            window.globalState.enableAI = e.target.checked;
        });
    }

    const godModeCheckbox = document.getElementById('god-mode');
    if (godModeCheckbox) {
        godModeCheckbox.addEventListener('change', (e) => {
            window.globalState.godMode = e.target.checked;
        });
    }


    // Generate enemy button
    const generateEnemyBtn = document.getElementById('generate-enemy');
    generateEnemyBtn.addEventListener('click', () => {
        if (window.globalState.character) {
            const pos = window.globalState.character.position.clone().add(new THREE.Vector3(5, 0, 5));
            window.spawnSkeleton(pos);
        }
    });

    // Generate boss1 button
    const generateBoss1Btn = document.getElementById('generate-boss1');
    generateBoss1Btn.addEventListener('click', () => {
        if (window.globalState.character) {
            const pos = window.globalState.character.position.clone().add(new THREE.Vector3(5, 0, 5));
            window.spawnBoss1(pos);
        }
    });

    // Fullscreen button
    const fullscreenBtn = document.getElementById('fullscreen-button');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        });
    }



    // Item button listener
    window.globalState.itemButton = document.getElementById('item-button');
    window.globalState.itemCount = document.getElementById('item-count');
    ['touchstart', 'mousedown'].forEach(evt => {
        window.globalState.itemButton.addEventListener(evt, function(e) {
            e.preventDefault();
            if (window.globalState.playerInventory.mugs.length > 0 && !window.globalState.character.userData.equippedMug) {
                const mugToEquip = window.globalState.playerInventory.mugs.pop(); // Get the mug from inventory

                const rightHand = window.globalState.character.getObjectByName('hand_r');
                if (rightHand) {
                    rightHand.add(mugToEquip);
                    mugToEquip.position.set(0, 0, 0);
                    mugToEquip.rotation.set(0, 0, 0);
                }

                window.globalState.character.userData.equippedMug = mugToEquip;

                window.globalState.character.traverse(function(child) {
                    if (child.isMesh && child.name === '1H_Sword') child.visible = false;
                });

                if (document.getElementById('attack-button')) document.getElementById('attack-button').style.opacity = '0.2';
                if (window.globalState.itemCount) window.globalState.itemCount.textContent = window.globalState.playerInventory.mugs.length;
                if (window.globalState.itemButton && window.globalState.playerInventory.mugs.length < 1) {
                    window.globalState.itemButton.style.display = 'none';
                }
            }
        });
    });

    // Potion button listener
    window.globalState.potionButton = document.getElementById('potion-button');
    window.globalState.potionCount = document.getElementById('potion-count');
    ['touchstart', 'mousedown'].forEach(evt => {
        window.globalState.potionButton.addEventListener(evt, function(e) {
            e.preventDefault();
            if (window.globalState.playerInventory.potions > 0) {
                window.globalState.playerInventory.potions -= 1;
                window.globalState.playerHealth = Math.min(100, window.globalState.playerHealth + 25); // Heal 25 health
                window.updatePlayerHealthUI();
                window.updatePotionUI();
                console.log(`Poción consumida. Vida actual: ${window.globalState.playerHealth}`);
            }
        });
    });

    // Shield button listener
    window.globalState.shieldButton = document.getElementById('shield-button');
    window.globalState.shieldCount = document.getElementById('shield-count');
    ['touchstart', 'mousedown'].forEach(evt => {
        window.globalState.shieldButton.addEventListener(evt, function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Start blocking if equipped
            if (window.globalState.character.userData.equippedShield && window.globalState.character.animationActions.block) {
                window.setPlayerAnimation(window.globalState.character.animationActions.block, 0.1);
                window.globalState.characterState = 'blocking';
                window.globalState.shieldPressed = true;
                console.log('Iniciando bloqueo');
            }
        });
    });
    ['touchend', 'mouseup'].forEach(evt => {
        window.globalState.shieldButton.addEventListener(evt, function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Stop blocking
            window.globalState.shieldPressed = false;
            if (window.globalState.characterState === 'blocking') {
                window.globalState.characterState = 'idle';
                console.log('Terminando bloqueo');
            }
        });
    });

    setupJoysticks();
    // setupJoysticks(); // Esta función se ha movido a input.js para una mejor organización.

    window.globalState.shopButtonContainer = document.getElementById('shop-button-container');
    window.globalState.shopModal = document.getElementById('shop-modal');
    window.globalState.closeShopBtn = document.getElementById('close-shop-btn');
    window.globalState.shopButton = document.getElementById('shop-button');

    window.globalState.shopButton.addEventListener('click', () => {
        window.globalState.shopModal.style.display = 'flex';
    });

    window.globalState.closeShopBtn.addEventListener('click', () => {
        window.globalState.shopModal.style.display = 'none';
    });

    // Start wave button
    const startWaveBtn = document.getElementById('start-wave-button');
    if (startWaveBtn) {
        startWaveBtn.addEventListener('click', () => {
            window.startWave();
        });
    }

    // Filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = e.target.getAttribute('data-filter');
            filterShopItems(filter);
            // Update active button
            filterButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    // Shop buy buttons (non-barricade)
    const buyButtons = document.querySelectorAll('.buy-button');
    buyButtons.forEach(button => {
        if (button) button.addEventListener('click', (e) => {
            const item = e.target.getAttribute('data-item');
            if (item === 'health_potion' && window.globalState.playerMoney >= 100) {
                window.globalState.playerMoney -= 100;
                window.globalState.playerInventory.potions += 1;
                updatePotionUI();
                window.playSound('sonido/compra.mp3', 1.0);
                updateMoneyUI();
            } else if (item === 'shield' && window.globalState.playerMoney >= 150) {
                window.globalState.playerMoney -= 150;
                // Equip shield immediately
                const shield = window.globalState.character.getObjectByName('Round_Shield');
                if (shield && !window.globalState.character.userData.equippedShield) {
                    shield.visible = true;
                    window.globalState.character.userData.equippedShield = true;
                    window.globalState.shieldDurability = 10; // Set initial durability
                    updateShieldUI();
                    updateMoneyUI();
                    window.playSound('sonido/equipando.mp3', 1.0);
                    console.log('Escudo comprado y equipado');
                } else if (window.globalState.character.userData.equippedShield) {
                    // If already equipped, increase durability
                    window.globalState.shieldDurability += 10;
                    updateShieldUI();
                    updateMoneyUI();
                    console.log('Durabilidad del escudo aumentada');
                }
            } else if (item === 'helmet' && window.globalState.playerMoney >= 100) {
                window.globalState.playerMoney -= 100;
                const helmet = window.globalState.character.getObjectByName('Knight_Helmet');
                if (helmet && !window.globalState.character.userData.equippedHelmet) {
                    helmet.visible = true;
                    window.globalState.character.userData.equippedHelmet = true;
                    window.globalState.helmetDurability = 15; // Set initial durability
                    updateMoneyUI();
                    updateEquipmentUI();
                    window.playSound('sonido/compra.mp3', 1.0);
                    console.log('Casco equipado');
                } else if (window.globalState.character.userData.equippedHelmet) {
                    // If already equipped, increase durability
                    window.globalState.helmetDurability += 10;
                    updateMoneyUI();
                    updateEquipmentUI();
                    console.log('Durabilidad del casco aumentada');
                }
            } else if (item === 'cape' && window.globalState.playerMoney >= 120) {
                window.globalState.playerMoney -= 120;
                const cape = window.globalState.character.getObjectByName('Knight_Cape');
                if (cape && !window.globalState.character.userData.equippedCape) {
                    cape.visible = true;
                    window.globalState.character.userData.equippedCape = true;
                    window.globalState.capeDurability = 12; // Set initial durability
                    updateMoneyUI();
                    updateEquipmentUI();
                    window.playSound('sonido/compra.mp3', 1.0);
                    console.log('Capa equipada');
                } else if (window.globalState.character.userData.equippedCape) {
                    // If already equipped, increase durability
                    window.globalState.capeDurability += 10;
                    updateMoneyUI();
                    updateEquipmentUI();
                    console.log('Durabilidad de la capa aumentada');
                }
            } else if (item === 'repair_base' && window.globalState.playerMoney >= 200) {
                window.globalState.playerMoney -= 200;
                window.globalState.object2Health = 1000;
                updateObject2HealthUI();
                window.playSound('sonido/compra.mp3', 1.0);
                updateMoneyUI();
            }
        });
    });

    // Initialize shop UI elements
    window.globalState.potionCount = document.getElementById('potion-count');
    window.globalState.object2HealthBar = document.getElementById('object2-health-bar');
    window.globalState.object2HealthContainer = document.getElementById('object2-health-container');

    // Initialize barricade UI
    window.initBarricadeUI();
}

window.setupJoysticks = function() {
    window.globalState.attack = window.attack;
    if (window.globalState.isMobile) {
        window.globalState.joystickContainer = document.getElementById('joystick-container');
        const joystickOptions = {
            zone: window.globalState.joystickContainer,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white',
            size: 120
        };
        window.globalState.manager = nipplejs.create(joystickOptions);

        window.globalState.manager.on('move', function (evt, data) {
            // Guardar el ángulo y la fuerza directamente para un movimiento analógico
            window.globalState.joystickAngle = data.angle ? data.angle.radian : 0;
            window.globalState.joystickForce = Math.min(data.force, 1); // Limitar a 1 para evitar velocidad excesiva
        });

        window.globalState.manager.on('end', function () {
            // Reiniciar los valores cuando se suelta el joystick
            window.globalState.joystickAngle = 0;
            window.globalState.joystickForce = 0;
        });
    }

    window.globalState.attackJoystickContainer = document.getElementById('attack-joystick-container');
    const attackJoystickOptions = {
        zone: window.globalState.attackJoystickContainer,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: 'red',
        size: 120, // El tamaño del área del joystick
        threshold: 0.1, // Umbral para detectar un arrastre (10% del radio)
        fadeTime: 0 // Sin animación de desvanecimiento para control manual
    };
    window.globalState.attackManager = nipplejs.create(attackJoystickOptions);

    let wasJoystickDragged = false;

    window.globalState.attackManager.on('start', function () {
        wasJoystickDragged = false; // Resetear la bandera al iniciar el toque
        // if (window.globalState.character && window.globalState.joystickAttackIndicator) {
        //     window.globalState.joystickAttackIndicator.visible = true;
        // }
        // Al empezar, el joystick se ve como un botón (el "stick" está oculto)
        const nippleInstance = window.globalState.attackManager[0];
        if (nippleInstance && nippleInstance.front) {
            nippleInstance.front.style.display = 'none';
        }
    });

    window.globalState.attackManager.on('move', function (evt, data) {
        wasJoystickDragged = true; // Si el evento 'move' se dispara (gracias al threshold), es un arrastre.
        // Mostrar el "stick" del joystick al arrastrar
        const nippleInstance = window.globalState.attackManager[0];
        if (nippleInstance && nippleInstance.front) {
            nippleInstance.front.style.display = 'block';
        }
        if (data.angle && window.globalState.character) {
            // Corregido en la interacción anterior
            window.globalState.lastAttackAngle = data.angle.radian + (Math.PI / 2);
        }
    });

    window.globalState.attackManager.on('end', function () {
        if (window.globalState.character) {
            // Ocultar el "stick" al soltar para que vuelva a parecer un botón
            const nippleInstance = window.globalState.attackManager[0];
            if (nippleInstance && nippleInstance.front) {
                nippleInstance.front.style.display = 'none';
            }

            // --- INICIO: Lógica de Auto-Apuntado ---
            if (!wasJoystickDragged) { // Si no se arrastró, fue un toque.
                let closestEnemy = null;
                let minDistance = Infinity;

                // Encontrar el enemigo más cercano
                for (let i = 0; i < window.globalState.skeletons.length; i++) {
                    if (window.globalState.skeletonHealths[i] > 0) {
                        const enemy = window.globalState.skeletons[i];
                        const distance = window.globalState.character.position.distanceTo(enemy.position);
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestEnemy = enemy;
                        }
                    }
                }

                // Si se encontró un enemigo, calcular el ángulo hacia él
                if (closestEnemy) {
                    const dx = closestEnemy.position.x - window.globalState.character.position.x;
                    const dz = closestEnemy.position.z - window.globalState.character.position.z;
                    window.globalState.lastAttackAngle = Math.atan2(dx, dz);
                }
            }
            // --- FIN: Lógica de Auto-Apuntado ---
            window.handleBarricadePlacementInAttack();
            if (window.globalState.attack) window.globalState.attack(window.globalState.lastAttackAngle);
            if (window.globalState.joystickAttackIndicator) {
                window.globalState.joystickAttackIndicator.visible = false;
            }
        }
    });

    let isAttackingWithMouse = false;

    window.globalState.attackJoystickContainer.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;

        isAttackingWithMouse = true;
        // if (window.globalState.character && window.globalState.joystickAttackIndicator) {
        //     window.globalState.joystickAttackIndicator.visible = true;
        // }
        e.preventDefault();
    });

    window.addEventListener('mousemove', function(e) {
        if (!isAttackingWithMouse) return;

        const rect = window.globalState.attackJoystickContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;

        const mouseAngle = Math.atan2(dy, dx);
        window.globalState.lastAttackAngle = -mouseAngle;
    });

    window.addEventListener('mouseup', function(e) {
        if (!isAttackingWithMouse) return;
        isAttackingWithMouse = false;
        window.handleBarricadePlacementInMouseUp();
        if (window.globalState.attack) window.globalState.attack(window.globalState.lastAttackAngle);
        if (window.globalState.joystickAttackIndicator) window.globalState.joystickAttackIndicator.visible = false;
    });
}

window.updateCoordsUI = function() {
    if (window.globalState.character && window.globalState.coordsDiv) {
        window.globalState.coordsDiv.textContent = `Posición: (${window.globalState.character.position.x.toFixed(2)}, ${window.globalState.character.position.y.toFixed(2)}, ${window.globalState.character.position.z.toFixed(2)})`;
    }
}

window.updateFPSUI = function() {
    if (window.globalState.fpsDiv) {
        window.globalState.fpsDiv.textContent = `FPS: ${window.globalState.fps.toFixed(1)}`;
    }
}

window.updateMoneyUI = function() {
    if (window.globalState.moneyDiv) {
        window.globalState.moneyDiv.textContent = `Dinero: ${window.globalState.playerMoney} 💰`;
    }
}

window.updatePlayerHealthUI = function() {
    if (window.globalState.playerHealthBar) {
        window.globalState.playerHealthBar.style.width = `${window.globalState.playerHealth}%`;
    }
}

window.updatePickupPrompts = function() {
    for (let i = window.globalState.mugDrops.length - 1; i >= 0; i--) {
        const mug = window.globalState.mugDrops[i];
        if (mug.collected && window.globalState.characterState !== 'pickup') {
            window.globalState.scene.remove(mug.mesh);
            window.globalState.mugDrops.splice(i, 1);
            console.log('Mug removed after pickup animation');
            continue;
        }
        if (!mug.collected) {
            // Floating animation
            if (mug.baseY !== undefined) {
                mug.animationTime += 0.02; // Adjust speed
                mug.mesh.position.y = mug.baseY + Math.sin(mug.animationTime) * 0.3; // Up and down, smaller amplitude
                mug.mesh.rotation.y += 0.05; // Rotate 360 degrees
            }
            const distance = window.globalState.character.position.distanceTo(mug.mesh.position);
            if (distance < PICKUP_COLLECTION_RANGE) {
                if (!mug.pickupPrompt) {
                    mug.pickupPrompt = document.createElement('div');
                    mug.pickupPrompt.textContent = mug.type === 'gold' ? '💰' : '🤚';
                    mug.pickupPrompt.style.position = 'absolute';
                    mug.pickupPrompt.style.fontSize = '24px';
                    mug.pickupPrompt.style.pointerEvents = window.globalState.isMobile ? 'auto' : 'none';
                    mug.pickupPrompt.style.zIndex = '1000';
                    document.body.appendChild(mug.pickupPrompt);

                    mug.pickupPrompt.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        collectPickup(mug, i);
                    });

                    mug.pickupPrompt.addEventListener('mousedown', (e) => {
                        if (e.button === 0) { // Left click
                            e.preventDefault();
                            collectPickup(mug, i);
                        }
                    });
                } else {
                    mug.pickupPrompt.style.display = 'block';
                }

                const worldPos = mug.mesh.position.clone();
                worldPos.y += PICKUP_PROMPT_OFFSET_Y;
                const screenPos = worldPos.clone();
                screenPos.project(window.globalState.camera);
                const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
                const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
                mug.pickupPrompt.style.left = `${x - 12}px`;
                mug.pickupPrompt.style.top = `${y - 12}px`;

                if (window.globalState.keysPressed['KeyE']) {
                    console.log('E pressed near mug, attempting pickup');
                    if (window.globalState.character.animationActions.pickup) {
                        console.log('Playing pickup animation');
                        window.globalState.character.activeAction.fadeOut(0.2);
                        window.globalState.character.animationActions.pickup.reset().fadeIn(0.2).play();
                        window.globalState.character.activeAction = window.globalState.character.animationActions.pickup;
                        window.globalState.characterState = 'pickup';

                        mug.collected = true;
                        if (mug.pickupPrompt) {
                            window.globalState.scene.remove(mug.mesh);
                            if (mug.type === 'gold') {
                                const goldAmount = Math.floor(Math.random() * 151) + 50; // 50 to 200
                                window.globalState.playerMoney += goldAmount;
                                console.log(`Gold collected: ${goldAmount}. Total money: ${window.globalState.playerMoney}`);
                                window.updateMoneyUI();
                            } else {
                                window.globalState.playerHealth = Math.min(100, window.globalState.playerHealth + HEALTH_PICKUP_AMOUNT);
                                console.log(`Player health: ${window.globalState.playerHealth}`);
                            }
                            document.body.removeChild(mug.pickupPrompt);
                            mug.pickupPrompt = null;
                        }
                    } else {
                        console.log('No pickup animation, collecting immediately');
                        if (mug.pickupPrompt) {
                            document.body.removeChild(mug.pickupPrompt);
                        }
                        if (mug.type === 'gold') {
                            const goldAmount = Math.floor(Math.random() * 151) + 50; // 50 to 200
                            window.globalState.playerMoney += goldAmount;
                            console.log(`Gold collected: ${goldAmount}. Total money: ${window.globalState.playerMoney}`);
                            window.updateMoneyUI();
                        } else {
                            window.globalState.playerHealth = Math.min(100, window.globalState.playerHealth + HEALTH_PICKUP_AMOUNT);
                            console.log(`Player health: ${window.globalState.playerHealth}`);
                        }
                        window.globalState.scene.remove(mug.mesh);
                        window.globalState.mugDrops.splice(i, 1);
                        console.log(`${mug.type} collected!`);
                    }
                }
            } else {
                if (mug.pickupPrompt) {
                    mug.pickupPrompt.style.display = 'none';
                }
            }
        } else {
            if (mug.pickupPrompt && mug.pickupPrompt.parentNode) {
                document.body.removeChild(mug.pickupPrompt);
            }
        }
    }
}

window.collectPickup = function(mug, index) {
    if (window.globalState.character.animationActions.pickup) {
        window.globalState.character.activeAction.fadeOut(0.2);
        window.globalState.character.animationActions.pickup.reset().fadeIn(0.2).play();
        window.globalState.character.activeAction = window.globalState.character.animationActions.pickup;
        window.globalState.characterState = 'pickup';

        mug.collected = true;
        if (mug.pickupPrompt) {
            window.globalState.scene.remove(mug.mesh);
            if (mug.type === 'gold') {
                const goldAmount = Math.floor(Math.random() * 151) + 50; // 50 to 200
                window.globalState.playerMoney += goldAmount;
                console.log(`Gold collected: ${goldAmount}. Total money: ${window.globalState.playerMoney}`);
                window.updateMoneyUI();
            } else {
                window.globalState.playerHealth = Math.min(100, window.globalState.playerHealth + HEALTH_PICKUP_AMOUNT);
                console.log(`Player health: ${window.globalState.playerHealth}`);
            }
            document.body.removeChild(mug.pickupPrompt);
            mug.pickupPrompt = null;
        }
    } else {
        if (mug.pickupPrompt) {
            document.body.removeChild(mug.pickupPrompt);
        }
        if (mug.type === 'gold') {
            const goldAmount = Math.floor(Math.random() * 151) + 50; // 50 to 200
            window.globalState.playerMoney += goldAmount;
            console.log(`Gold collected: ${goldAmount}. Total money: ${window.globalState.playerMoney}`);
            window.updateMoneyUI();
        } else {
            window.globalState.playerHealth = Math.min(100, window.globalState.playerHealth + HEALTH_PICKUP_AMOUNT);
            console.log(`Player health: ${window.globalState.playerHealth}`);
        }
        window.globalState.scene.remove(mug.mesh);
        window.globalState.mugDrops.splice(index, 1);
        console.log(`${mug.type} collected!`);
    }
}

window.updateShopUI = function() {
    if (window.globalState.character && window.globalState.object2Target && window.globalState.shopButtonContainer) {
        const distance = window.globalState.character.position.distanceTo(window.globalState.object2Target.position);
        const SHOP_INTERACTION_RANGE = 8;

        if (distance < SHOP_INTERACTION_RANGE) {
            window.globalState.shopButtonContainer.style.display = 'block';
            const screenPos = window.globalState.object2Target.position.clone().project(window.globalState.camera);
            const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
            window.globalState.shopButtonContainer.style.left = `${x - window.globalState.shopButtonContainer.offsetWidth / 2}px`;
            window.globalState.shopButtonContainer.style.top = `${y - 80}px`; // Position above the object
        } else {
            window.globalState.shopButtonContainer.style.display = 'none';
        }
    }
};


window.updatePotionUI = function() {
    if (window.globalState.potionButton && window.globalState.potionCount) {
        if (window.globalState.playerInventory.potions > 0) {
            window.globalState.potionButton.style.display = 'flex';
            window.globalState.potionCount.textContent = window.globalState.playerInventory.potions;
        } else {
            window.globalState.potionButton.style.display = 'none';
        }
    }
};

window.updateShieldUI = function() {
    if (window.globalState.shieldButton && window.globalState.shieldCount) {
        if (window.globalState.character.userData.equippedShield) {
            window.globalState.shieldButton.style.display = 'flex';
            window.globalState.shieldCount.textContent = window.globalState.shieldDurability;
        } else {
            window.globalState.shieldButton.style.display = 'none';
        }
    }
};

window.updateEquipmentUI = function() {
    const helmetDiv = document.getElementById('helmet-equipment');
    const capeDiv = document.getElementById('cape-equipment');
    if (helmetDiv && window.globalState.character.userData.equippedHelmet) {
        helmetDiv.style.display = 'block';
        document.getElementById('helmet-durability').textContent = window.globalState.helmetDurability;
    } else if (helmetDiv) {
        helmetDiv.style.display = 'none';
    }
    if (capeDiv && window.globalState.character.userData.equippedCape) {
        capeDiv.style.display = 'block';
        document.getElementById('cape-durability').textContent = window.globalState.capeDurability;
    } else if (capeDiv) {
        capeDiv.style.display = 'none';
    }
};

window.updateWaveUI = function() {
    const waveDiv = document.getElementById('wave-display');
    if (waveDiv) {
        waveDiv.textContent = `Oleada ${window.globalState.currentWave}/${window.globalState.maxWave} - Enemigos: ${window.globalState.enemiesRemaining}`;
    }
};

window.startWave = async function() { // Convertir a función asíncrona
    // Incrementar la oleada al inicio
    if (window.globalState.isFinalWave) {
        console.log("¡APARECE EL JEFE FINAL!");
        const playerPos = window.globalState.character.position;
        const spawnPos = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z - 80); // Spawn boss far from player
        window.spawnBoss1(spawnPos);
        window.globalState.enemiesRemaining = 1;
        window.updateWaveUI();
        const startWaveBtn = document.getElementById('start-wave-button');
        if (startWaveBtn) startWaveBtn.style.display = 'none';
        return;
    }


    window.globalState.currentWave++;

    // --- INICIO: Sonido especial para oleada 8 ---
    if (window.globalState.currentWave === 8) {
        window.playSound('sonido/oleada8.wav', 1.0); // Reproducir sonido de la oleada 8
    }
    // --- FIN: Sonido especial para oleada 8 ---

    const enemiesToSpawn = Math.min(window.globalState.currentWave * 2, 15); // Max 15 enemies
    const spawnPositions = [];

    // Collect all floor positions from the map
    const floorPositions = [];
    window.globalState.collisionObjects.forEach(obj => {
        if (obj.userData.isFloor) {
            floorPositions.push(obj.position.clone());
        }
    });

    if (floorPositions.length > 0) {
        // Spawn on random floor tiles
        for (let i = 0; i < enemiesToSpawn; i++) {
            const randomFloor = floorPositions[Math.floor(Math.random() * floorPositions.length)];
            spawnPositions.push(randomFloor.clone());
        }
    } else {
        // Fallback: spawn around player
        const playerPos = window.globalState.character.position;
        for (let i = 0; i < enemiesToSpawn; i++) {
            const angle = (i / enemiesToSpawn) * Math.PI * 2; // Distribute around player
            const distance = 50 + Math.random() * 30; // Closer: 50-80 units away
            const pos = new THREE.Vector3(
                playerPos.x + Math.cos(angle) * distance,
                0,
                playerPos.z + Math.sin(angle) * distance
            );
            spawnPositions.push(pos);
        }
    }

    // --- INICIO: Generar enemigos uno por uno ---
    const spawnInterval = 300; // 300ms de retraso entre cada enemigo
    for (let i = 0; i < enemiesToSpawn; i++) {
        window.spawnSkeleton(spawnPositions[i]); // spawnSkeleton handles Y adjustment with delay
        await new Promise(resolve => setTimeout(resolve, spawnInterval)); // Esperar antes del siguiente
    }
    // --- FIN: Generar enemigos uno por uno ---

    window.globalState.enemiesRemaining = enemiesToSpawn;

    // --- INICIO: Lógica de renderizado completo temporal ---
    setTimeout(() => {
        const originalRenderDistance = window.globalState.renderDistance;
        const fullRenderDistance = 200;

        // Aplicar renderizado completo
        window.globalState.renderDistance = fullRenderDistance;
        window.globalState.camera.far = fullRenderDistance + 40;
        window.globalState.camera.updateProjectionMatrix();
        if (window.globalState.renderDistanceInput) window.globalState.renderDistanceInput.value = fullRenderDistance;
        if (window.globalState.renderDistanceValue) window.globalState.renderDistanceValue.textContent = fullRenderDistance;

        // Volver a la configuración original después de 2 segundos
        setTimeout(() => {
            window.globalState.renderDistance = originalRenderDistance;
            window.globalState.camera.far = originalRenderDistance + 40;
            window.globalState.camera.updateProjectionMatrix();
            if (window.globalState.renderDistanceInput) window.globalState.renderDistanceInput.value = originalRenderDistance;
            if (window.globalState.renderDistanceValue) window.globalState.renderDistanceValue.textContent = originalRenderDistance;
        }, 2000);
    }, 1000); // Esperar 1 segundo después de que el último enemigo empiece a spawnear
    // --- FIN: Lógica de renderizado completo temporal ---

    window.updateWaveUI();
    // Hide the button during active wave
    const startWaveBtn = document.getElementById('start-wave-button');
    if (startWaveBtn) startWaveBtn.style.display = 'none';
};

window.updateObject2HealthUI = function() {
    if (window.globalState.object2HealthBar) {
        window.globalState.object2HealthBar.style.width = `${(window.globalState.object2Health / 1000) * 100}%`;
    }
    if (window.globalState.object2HealthContainer) {
        if (window.globalState.object2Target && (performance.now() - window.globalState.lastObject2DamageTime) < 2000) {
            const worldPosition = new THREE.Vector3();
            window.globalState.object2Target.getWorldPosition(worldPosition);

            // Crear un frustum para verificar la visibilidad
            const frustum = new THREE.Frustum();
            const projScreenMatrix = new THREE.Matrix4();
            projScreenMatrix.multiplyMatrices(window.globalState.camera.projectionMatrix, window.globalState.camera.matrixWorldInverse);
            frustum.setFromProjectionMatrix(projScreenMatrix);

            // Solo mostrar la barra si el objeto está en el frustum de la cámara y ha recibido daño recientemente
            if (frustum.containsPoint(worldPosition)) {
                const screenPos = worldPosition.clone().project(window.globalState.camera);
                window.globalState.object2HealthContainer.style.display = 'flex';
                // Position near Object_2
                const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
                const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
                window.globalState.object2HealthContainer.style.left = `${x - window.globalState.object2HealthContainer.offsetWidth / 2}px`;
                window.globalState.object2HealthContainer.style.top = `${y - 100}px`;
            }
            else {
                window.globalState.object2HealthContainer.style.display = 'none';
            }
        } else {
            window.globalState.object2HealthContainer.style.display = 'none';
        }
    }
};

function filterShopItems(filter) {
    const items = document.querySelectorAll('.shop-item-row');
    items.forEach(item => {
        const category = item.getAttribute('data-category');
        if (filter === 'all' || category === filter) {
            item.style.display = 'grid';
        } else {
            item.style.display = 'none';
        }
    });
}

function updateErrorModal() {
    window.globalState.errorList.innerHTML = '';
    window.globalState.errors.forEach(err => {
        const div = document.createElement('div');
        div.className = 'error-item';
        div.textContent = err;
        window.globalState.errorList.appendChild(div);
    });
}