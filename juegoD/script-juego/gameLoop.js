// Game loop

function animateGame() {
    requestAnimationFrame(animateGame);

    const now = performance.now();
    const deltaTime = (now - window.globalState.lastTime) / 1000;
    window.globalState.lastTime = now;

    window.globalState.fps = 1 / deltaTime;

    if (window.globalState.character && window.globalState.joystickAttackIndicator && window.globalState.joystickAttackIndicator.visible) {
        const coneHeight = 10; // ATTACK_RANGE
        const gap = 2;
        const offset = new THREE.Vector3(0, 0, (coneHeight / 2) + gap).applyAxisAngle(new THREE.Vector3(0, 1, 0), window.globalState.lastAttackAngle);
        window.globalState.joystickAttackIndicator.position.copy(window.globalState.character.position).add(offset);
        window.globalState.joystickAttackIndicator.position.y = window.globalState.character.position.y + 0.1;

        window.globalState.joystickAttackIndicator.rotation.set(0, 0, 0);
        window.globalState.joystickAttackIndicator.rotateY(window.globalState.lastAttackAngle);
        window.globalState.joystickAttackIndicator.rotateX(Math.PI / 2);
    }

    if (window.globalState.character && window.globalState.characterState !== 'dead') {
        const rayOrigin = new THREE.Vector3(window.globalState.character.position.x, window.globalState.character.position.y + 5, window.globalState.character.position.z);
        const groundRaycaster = new THREE.Raycaster(rayOrigin, new THREE.Vector3(0, -1, 0));
        const intersects = groundRaycaster.intersectObjects(window.globalState.collisionObjects, true);

        if (intersects.length > 0) {
            window.globalState.character.position.y = intersects[0].point.y;
        } else {
            window.globalState.character.position.y -= 9.8 * deltaTime; // GRAVITY
            if (window.globalState.character.position.y < window.GROUND_LIMIT_Y) {
                window.globalState.character.position.y = window.GROUND_LIMIT_Y;
            }
        }
    }

    for (let i = 0; i < window.globalState.attackCooldowns.length; i++) {
        if (window.globalState.attackCooldowns[i] > 0) {
            window.globalState.attackCooldowns[i] -= deltaTime;
        }
    }

    if (window.globalState.playerHealth <= 0 && window.globalState.characterState !== 'dead') {
        window.globalState.characterState = 'dead';
        if (window.globalState.character.animationActions.deaths.length > 0) {
            const randomDeathAction = window.globalState.character.animationActions.deaths[Math.floor(Math.random() * window.globalState.character.animationActions.deaths.length)];
            window.setPlayerAnimation(randomDeathAction, 0.2);
        }
    } else if (window.globalState.characterState === 'dead' && !window.globalState.character.activeAction.isRunning()) {
        const currentDeathAnimName = window.globalState.character.activeAction.getClip().name;
        const poseAction = window.globalState.character.animationActions.deathPoses[currentDeathAnimName];
        if (poseAction && window.globalState.character.activeAction !== poseAction) {
            window.setPlayerAnimation(poseAction, 0.5);
        }
    }

    if (window.globalState.character && window.globalState.mixer && window.globalState.character.animationActions) {
        const keyboardMoving = window.globalState.moveForward || window.globalState.moveBackward || window.globalState.moveLeft || window.globalState.moveRight;
        const isMoving = (keyboardMoving || (window.globalState.isMobile && window.globalState.joystickForce > 0)) && window.globalState.characterState !== 'dead';
        if (window.globalState.characterState !== 'attacking' && window.globalState.characterState !== 'hit' && window.globalState.characterState !== 'pickup' && window.globalState.characterState !== 'blocking' && window.globalState.characterState !== 'dead') {
            window.globalState.characterState = isMoving ? 'running' : 'idle';
        }

        if (window.globalState.characterState !== 'dead' && window.globalState.characterState !== 'blocking') {
            const playerMoveSpeed = window.PLAYER_SPEED * deltaTime;
            const cameraRotationRad = (window.globalState.cameraRotation * Math.PI) / 180;
            let moveVector = new THREE.Vector3(0, 0, 0);
            let targetRotation = window.globalState.character.rotation.y; // Mantener la rotación actual si no hay input

            if (window.globalState.isMobile && window.globalState.joystickForce > 0) {
                // --- Lógica para Joystick (Móvil) --- (Corregida)
                const angle = window.globalState.joystickAngle;
                // Velocidad variable según la fuerza del joystick (arrastre), de mínima a máxima.
                const moveX = Math.cos(angle) * window.globalState.joystickSpeed * window.globalState.joystickForce * deltaTime;
                const moveZ = -Math.sin(angle) * window.globalState.joystickSpeed * window.globalState.joystickForce * deltaTime;
                moveVector.set(moveX, 0, moveZ);
            } else {
                // --- Lógica para Teclado (PC) ---
                let inputVector = new THREE.Vector3(0, 0, 0);
                if (window.globalState.moveForward) inputVector.z = -1;
                if (window.globalState.moveBackward) inputVector.z = 1;
                if (window.globalState.moveLeft) inputVector.x = -1;
                if (window.globalState.moveRight) inputVector.x = 1;

                if (inputVector.length() > 0) {
                    inputVector.normalize().multiplyScalar(playerMoveSpeed);
                    moveVector.copy(inputVector);
                }
            }

            // Rotar el vector de movimiento según la cámara y calcular la rotación del personaje
            const rotatedMoveX = moveVector.x * Math.cos(cameraRotationRad) - moveVector.z * Math.sin(cameraRotationRad);
            const rotatedMoveZ = moveVector.x * Math.sin(cameraRotationRad) + moveVector.z * Math.cos(cameraRotationRad);
            moveVector.set(rotatedMoveX, 0, rotatedMoveZ);
            if (moveVector.length() > 0) {
                targetRotation = Math.atan2(rotatedMoveX, rotatedMoveZ);
            }

            const finalTargetRotation = (window.globalState.characterState === 'attacking') ? window.globalState.lastAttackAngle : targetRotation;
            let rotationDiff = finalTargetRotation - window.globalState.character.rotation.y;

            while (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
            while (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;

            const rotationSpeed = 0.15;
            window.globalState.character.rotation.y += rotationDiff * rotationSpeed;

            const nextPos = window.globalState.character.position.clone().add(moveVector);
            if (window.isGroundAt(nextPos)) {
                const allowedMoveVector = window.checkHorizontalCollision(window.globalState.character.position, moveVector);
                window.globalState.character.position.add(allowedMoveVector);
            }
        }

        let desiredAction;
        switch(window.globalState.characterState) {
            case 'running':
                // Seleccionar animación de movimiento según la velocidad del joystick
                if (window.globalState.isMobile && window.globalState.joystickForce > 0) {
                    if (window.globalState.joystickForce > 0.8 && window.globalState.character.animationActions.running) {
                        desiredAction = window.globalState.character.animationActions.running; // Correr (80-100% de velocidad)
                    } else if (window.globalState.joystickForce > 0.4 && window.globalState.character.animationActions.sprint) {
                        desiredAction = window.globalState.character.animationActions.sprint; // Sprint (40-80% de velocidad)
                    } else if (window.globalState.character.animationActions.walking) {
                        desiredAction = window.globalState.character.animationActions.walking; // Caminar (1-40% de velocidad)
                    }
                } else {
                    desiredAction = window.globalState.character.animationActions.sprint;
                }
                break;
            case 'attacking': desiredAction = window.globalState.character.animationActions.attacks[window.globalState.comboCounter]; break;
            case 'hit': desiredAction = window.globalState.character.activeAction; break;
            case 'pickup': desiredAction = window.globalState.character.animationActions.pickup || window.globalState.character.animationActions.idle; break;
            case 'blocking': desiredAction = window.globalState.character.animationActions.block; break;
            case 'dead': desiredAction = window.globalState.character.activeAction; break;
            default: desiredAction = window.globalState.character.animationActions.idle; break;
        }

        if (desiredAction && window.globalState.character.activeAction !== desiredAction) {
            window.setPlayerAnimation(desiredAction, 0.2);
        }

        if ((window.globalState.characterState === 'attacking' || window.globalState.characterState === 'hit') && !window.globalState.character.activeAction.isRunning() && window.globalState.characterState !== 'dead') {
            if (window.globalState.characterState === 'hit' && window.globalState.wasBlocking && window.globalState.shieldPressed) {
                window.globalState.characterState = 'blocking';
                window.globalState.wasBlocking = false;
            } else {
                if (window.globalState.comboTimeout <= 0) window.globalState.comboCounter = 0;
                window.globalState.characterState = 'idle';
            }
        }
        // For blocking, stay in the final pose until manually stopped
        if (window.globalState.characterState === 'pickup' && window.globalState.character.animationActions.pickup && !window.globalState.character.activeAction.isRunning()) {
            window.globalState.characterState = 'idle';
        }

        if (window.globalState.comboTimeout > 0) {
            window.globalState.comboTimeout -= deltaTime;
        }

        // Camera, UI updates, etc.
        for (let i = 0; i < window.globalState.skeletons.length; i++) {
            const skeleton = window.globalState.skeletons[i];
            if (skeleton) {
                // --- INICIO: Forzar animación 'idle' si la IA está desactivada ---
                if (!window.globalState.enableAI && skeleton.userData.state === 'running') {
                    skeleton.userData.state = 'idle';
                    window.setSkeletonAnimation(i, skeleton.animationActions.idle);
                }
                // --- FIN: Forzar animación 'idle' si la IA está desactivada ---

                if (window.globalState.skeletonMixers[i]) {
                    window.globalState.skeletonMixers[i].update(deltaTime);
                    if (skeleton.userData.state === 'hit' && !skeleton.activeAction.isRunning()) {
                        // --- INICIO: Lógica de encadenamiento de animación de bloqueo del jefe ---
                        // Si la bandera está activa y la animación que terminó es la de reacción al bloqueo...
                        if (skeleton.userData.playOptimalBlockReaction && skeleton.activeAction === skeleton.animationActions.blockReaction) {
                            skeleton.userData.playOptimalBlockReaction = false; // Desactivar la bandera
                            // --- INICIO: Sonido de bloqueo exitoso del jefe ---
                            window.playSound('sonido/boss1-bloqueo.mp3', 0.9);
                            // ...reproducir la animación óptima. El estado sigue siendo 'hit'.
                            window.setSkeletonAnimation(i, skeleton.animationActions.blockReactionOptimal);

                            // --- INICIO: Contraataque del jefe: devolver el daño ---
                            let counterDamage = window.ENEMY_ATTACK_DAMAGE; // Daño igual al que el jugador inflige
                            if (window.globalState.character.userData.equippedHelmet) counterDamage *= 0.8;
                            if (window.globalState.character.userData.equippedCape) counterDamage *= 0.9;
                            counterDamage = Math.floor(counterDamage);

                            if (!window.globalState.godMode) {
                                // Aplicar daño siempre, incluso si está bloqueando
                                window.globalState.playerHealth -= counterDamage;
                                if (window.globalState.playerHealth < 0) window.globalState.playerHealth = 0;
                                window.updatePlayerHealthUI();
                                console.log(`Contraataque del jefe. Daño: ${counterDamage}. Vida restante: ${window.globalState.playerHealth}`);

                                // Aplicar daño a equipo si corresponde
                                if (window.globalState.character.userData.equippedHelmet) {
                                    window.globalState.helmetDurability -= 1;
                                    if (window.globalState.helmetDurability <= 0) {
                                        const helmet = window.globalState.character.getObjectByName('Knight_Helmet');
                                        if (helmet) helmet.visible = false;
                                        window.globalState.character.userData.equippedHelmet = false;
                                        window.globalState.helmetDurability = 0;
                                        console.log('Casco roto por contraataque');
                                    }
                                }
                                if (window.globalState.character.userData.equippedCape) {
                                    window.globalState.capeDurability -= 1;
                                    if (window.globalState.capeDurability <= 0) {
                                        const cape = window.globalState.character.getObjectByName('Knight_Cape');
                                        if (cape) cape.visible = false;
                                        window.globalState.character.userData.equippedCape = false;
                                        window.globalState.capeDurability = 0;
                                        console.log('Capa rota por contraataque');
                                    }
                                }
                                window.updateEquipmentUI();

                                if (window.globalState.characterState === 'blocking') {
                                    // Si está bloqueando, reproducir sonido de bloqueo y reducir durabilidad del escudo
                                    const blockSounds = ['sonido/escudo-bloqueo.wav', 'sonido/escudo-bloqueo2.wav', 'sonido/escudo-bloqueo3.wav'];
                                    const randomBlockSound = blockSounds[Math.floor(Math.random() * blockSounds.length)];
                                    window.playSound(randomBlockSound, 0.8);
                                    console.log('Contraataque bloqueado parcialmente');

                                    window.globalState.shieldDurability -= 1;
                                    if (window.globalState.shieldDurability <= 0) {
                                        const shield = window.globalState.character.getObjectByName('Round_Shield');
                                        if (shield) shield.visible = false;
                                        window.playSound('sonido/escudo-bloqueo-destruido.wav', 1.0);
                                        window.globalState.character.userData.equippedShield = false;
                                        window.globalState.shieldDurability = 0;
                                        window.globalState.wasBlocking = false;
                                        console.log('Escudo roto por contraataque');
                                    }
                                    window.updateShieldUI();

                                    if (window.globalState.character.animationActions.blockHit) {
                                        window.setPlayerAnimation(window.globalState.character.animationActions.blockHit, 0.1);
                                        window.globalState.characterState = 'hit';
                                        window.globalState.wasBlocking = true;
                                    } else {
                                        window.globalState.characterState = 'idle';
                                    }
                                } else {
                                    // Si no está bloqueando, reproducir sonido de golpe y animación de hit
                                    window.playSound('sonido/golpe-personaje.mp3', 0.5);

                                    if (window.globalState.character.animationActions.hits.length > 0) {
                                        const randomHitAction = window.globalState.character.animationActions.hits[Math.floor(Math.random() * window.globalState.character.animationActions.hits.length)];
                                        window.setPlayerAnimation(randomHitAction, 0.1);
                                        window.globalState.characterState = 'hit';
                                    }
                                }
                            } else {
                                console.log(`Modo Dios: Contraataque bloqueado. Daño evitado: ${counterDamage}`);
                            }
                            // --- FIN: Contraataque del jefe: devolver el daño ---
                        } else {
                            // Si no, volver a idle como de costumbre.
                            skeleton.userData.state = 'idle';
                            skeleton.userData.playOptimalBlockReaction = false; // Asegurarse de que la bandera esté desactivada
                        }
                        // --- FIN: Lógica de encadenamiento de animación de bloqueo del jefe ---
                    } else if (skeleton.userData.state === 'dead' && !skeleton.activeAction.isRunning()) {
                        window.globalState.scene.remove(skeleton);
                        window.globalState.skeletons.splice(i, 1);
                        window.globalState.skeletonMixers.splice(i, 1);
                        window.globalState.skeletonHealths.splice(i, 1);
                        window.globalState.attackCooldowns.splice(i, 1);
                        window.globalState.enemiesRemaining--;
                        if (window.globalState.enemiesRemaining <= 0) {
                            if (window.globalState.currentWave === 10 && !window.globalState.isFinalWave) {
                                // Completed wave 10, trigger the final wave
                                console.log('¡OLEADA FINAL INMINENTE!');
                                window.globalState.isFinalWave = true;
                                window.startWave(); // Automatically start the final wave
                            } else {
                                if (!window.globalState.isFinalWave) {
                                    console.log(`Oleada ${window.globalState.currentWave} completada!`);
                                    // Show the button for the next wave
                                    const startWaveBtn = document.getElementById('start-wave-button');
                                    if (startWaveBtn) startWaveBtn.style.display = 'inline-block';
                                }
                            }
                        }
                        window.updateWaveUI();
                        i--;
                    }
                }
            }
        }

        // Handle enemy AI
        if (window.globalState.enableAI) {
            window.globalState.handleEnemyAI(deltaTime);
        }

        // Barricade placement preview
        window.updateBarricadePreview();

        // Partial rendering culling
        if (window.globalState.character) {
            const cullDistance = window.globalState.renderDistance;
            const hysteresis = 10;
            const playerPos = window.globalState.character.position;
            let added = 0, removed = 0;
            for (let i = 0; i < window.globalState.cullableAssets.length; i++) {
                const asset = window.globalState.cullableAssets[i];
                const distance = playerPos.distanceTo(asset.position);
                const inScene = asset.object.parent === window.globalState.scene;
                if (distance < cullDistance && !inScene) {
                    window.globalState.scene.add(asset.object);
                    if (asset.isCollision) {
                        if (!window.globalState.collisionObjects.includes(asset.object)) window.globalState.collisionObjects.push(asset.object);
                    }
                    added++;
                } else if (distance > cullDistance + hysteresis && inScene) {
                    window.globalState.scene.remove(asset.object);
                    if (asset.isCollision) {
                        const index = window.globalState.collisionObjects.findIndex(obj => obj === asset.object);
                        if (index > -1) {
                            window.globalState.collisionObjects.splice(index, 1);
                        }
                    }
                    removed++;
                }
            }
            if (added > 0 || removed > 0) {
                console.log(`Culling: added=${added}, removed=${removed}, total cullable=${window.globalState.cullableAssets.length}, in scene=${window.globalState.scene.children.length}`);
            }
        }

        // --- INICIO: Lógica de Vibración de Pantalla (Screen Shake) ---
        if (window.globalState.shakeDuration > 0) {
            const now = performance.now();
            const elapsed = (now - window.globalState.shakeStartTime) / 1000; // Tiempo transcurrido en segundos
            const canvas = window.globalState.renderer.domElement;

            if (elapsed < window.globalState.shakeDuration) {
                // --- Vibración de la cámara ---
                const intensity = window.globalState.shakeIntensity;
                window.globalState.camera.position.x += (Math.random() - 0.5) * intensity * 5;
                window.globalState.camera.position.y += (Math.random() - 0.5) * intensity * 5;
                window.globalState.camera.position.z += (Math.random() - 0.5) * intensity * 5;

                // --- Desvanecimiento del desenfoque y brillo ---
                const progress = elapsed / window.globalState.shakeDuration;
                const maxBlur = 4.0; // Aumentado para un efecto más notable
                const maxBrightness = 1.1; // El valor inicial del brillo

                const currentBlur = maxBlur * (1 - progress); // Disminuye con el tiempo
                const currentBrightness = 1 + (maxBrightness - 1) * (1 - progress); // Disminuye a 1

                canvas.style.filter = `blur(${currentBlur.toFixed(2)}px) brightness(${currentBrightness.toFixed(2)})`;

            } else {
                // Terminar la vibración
                window.globalState.shakeDuration = 0;
                canvas.style.filter = 'none'; // Quitar el desenfoque y brillo
            }
        }
        // --- FIN: Lógica de Vibración de Pantalla (Screen Shake) ---

        if (window.globalState.isTopDown) {
            const angleRad = (window.globalState.cameraAngle * Math.PI) / 180;
            const rotationRad = (window.globalState.cameraRotation * Math.PI) / 180;
            const distance = window.globalState.cameraDistance;
            const height = distance * Math.cos(angleRad);
            const horizontalDistance = distance * Math.sin(angleRad);

            window.globalState.camera.position.set(
                window.globalState.character.position.x + horizontalDistance * Math.sin(rotationRad),
                height,
                window.globalState.character.position.z + horizontalDistance * Math.cos(rotationRad)
            );
            window.globalState.camera.lookAt(window.globalState.character.position);
        }

        // Update directional light to follow player for shadows
        if (window.globalState.character) {
            const light = window.globalState.scene.children.find(obj => obj.isDirectionalLight);
            if (light) {
                light.position.set(window.globalState.character.position.x - 10, 20, window.globalState.character.position.z + 10);
                // Center shadow camera on player
                light.shadow.camera.position.copy(window.globalState.character.position);
                // Update shadow camera to cover entire map to hide edges
                const bounds = window.globalState.mapBounds;
                if (bounds) {
                    light.shadow.camera.left = bounds.minX;
                    light.shadow.camera.right = bounds.maxX;
                    light.shadow.camera.top = bounds.maxZ;
                    light.shadow.camera.bottom = bounds.minZ;
                    light.shadow.camera.far = 500;
                    light.shadow.camera.updateProjectionMatrix();
                }
            }
        }

        window.updateCoordsUI();
        window.updateFPSUI();
        window.updateMoneyUI();
        window.updatePlayerHealthUI();
        window.updatePickupPrompts();
        window.updateShopUI();
        window.updateObject2HealthUI(); // <-- Añadir esta línea
        window.updateWaveUI();

        if (window.globalState.mixer) window.globalState.mixer.update(deltaTime);

        // Update barricade and Object_2 mixers
        window.updateBarricadeMixers(deltaTime);

        // Handle destroyed barricades
        window.handleDestroyedBarricades();
    }

    // Update and draw blood particles
    window.updateBloodParticles(deltaTime);
    window.drawBloodParticles();

    window.globalState.renderer.render(window.globalState.scene, window.globalState.camera);
}

// --- INICIO: Función para activar la vibración de pantalla ---
window.triggerScreenShake = function(intensity, duration) {
    window.globalState.shakeIntensity = intensity;
    window.globalState.shakeDuration = duration; // La duración total del efecto
    window.globalState.shakeStartTime = performance.now();
    // El filtro ahora se aplica y actualiza dentro del bucle del juego.
};
// --- FIN: Función para activar la vibración de pantalla ---