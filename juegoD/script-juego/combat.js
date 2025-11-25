// Combat and collision logic

// Function to drop health pickup
window.dropHealthPickup = function(position) {
    const isGold = Math.random() < 0.5; // 50% chance for gold

    let pickup;
    let type;
    if (isGold) {
        // Create gold coin
        const coinGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
        const coinMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700 }); // Gold color
        pickup = new THREE.Mesh(coinGeometry, coinMaterial);
        pickup.rotation.x = -Math.PI / 2; // Stand up
        type = 'gold';
    } else {
        // Create a + shape for health pickup
        pickup = new THREE.Group();

        // Horizontal bar
        const horizontalGeometry = new THREE.BoxGeometry(2.5, 0.5, 0.5);
        const horizontalMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Green for health
        const horizontal = new THREE.Mesh(horizontalGeometry, horizontalMaterial);
        pickup.add(horizontal);

        // Vertical bar
        const verticalGeometry = new THREE.BoxGeometry(0.5, 2.5, 0.5);
        const verticalMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const vertical = new THREE.Mesh(verticalGeometry, verticalMaterial);
        pickup.add(vertical);
        type = 'health';
    }

    const dropRayOrigin = new THREE.Vector3(position.x, 50, position.z);
    window.globalState.raycaster.set(dropRayOrigin, new THREE.Vector3(0, -1, 0));
    const intersects = window.globalState.raycaster.intersectObjects(window.globalState.collisionObjects, true);

    if (intersects.length > 0) {
        position.y = intersects[0].point.y;
    } else {
        position.y = 5.00;
    }

    pickup.position.copy(position);
    pickup.position.y += 1.5;
    if (!isGold) {
        pickup.scale.set(1.2, 1.2, 1.2); // Slightly smaller for health
    }
    window.globalState.scene.add(pickup);
    window.globalState.mugDrops.push({ mesh: pickup, collected: false, baseY: pickup.position.y, animationTime: 0, type: type });
    console.log(`${type} pickup dropped at:`, position);
};

// The attack function
window.attack = function(attackAngle) {
    // If the character is holding a mug, unequip it and show the sword.
    if (window.globalState.character.userData.equippedMug) {
        const mugToUnequip = window.globalState.character.userData.equippedMug;

        const rightHand = window.globalState.character.getObjectByName('hand_r');
        if (rightHand) {
            rightHand.remove(mugToUnequip);
        }

        window.globalState.playerInventory.mugs.push(mugToUnequip);

        window.globalState.character.traverse(function(child) {
            if (child.isMesh && child.name === '1H_Sword') child.visible = true;
        });

        window.globalState.character.userData.equippedMug = null;
        if (document.getElementById('attack-button')) document.getElementById('attack-button').style.opacity = '1';
        if (document.getElementById('item-count')) document.getElementById('item-count').textContent = window.globalState.playerInventory.mugs.length;
        if (document.getElementById('item-button')) document.getElementById('item-button').style.display = 'flex';

        return;
    }

    // If not holding a mug, attack normally.
    if (window.globalState.characterState === 'idle' || window.globalState.characterState === 'running' || window.globalState.characterState === 'hit') {
        // Combo Logic
        if (window.globalState.comboTimeout <= 0) {
            window.globalState.comboCounter = -1;
        }
        window.globalState.comboCounter = (window.globalState.comboCounter + 1) % window.globalState.character.animationActions.attacks.length;

        window.globalState.comboTimeout = window.COMBO_WINDOW;

        window.globalState.characterState = 'attacking';
        const attackAction = window.globalState.character.animationActions.attacks[window.globalState.comboCounter];
        window.setPlayerAnimation(attackAction, 0.1);

        // Directional attack logic
        const attackDirection = new THREE.Vector3(Math.sin(attackAngle), 0, Math.cos(attackAngle));
        attackDirection.normalize();

        let hitAnEnemy = false; // Bandera para rastrear si se golpeó a un enemigo

        for (let i = 0; i < window.globalState.skeletons.length; i++) {
            if (window.globalState.skeletonHealths[i] > 0) {
                const enemyVector = new THREE.Vector3().subVectors(window.globalState.skeletons[i].position, window.globalState.character.position);
                const distance = enemyVector.length();
                enemyVector.normalize();

                const dotProduct = attackDirection.dot(enemyVector);
                const angleToEnemy = Math.acos(dotProduct);

                if (distance < window.ATTACK_RANGE && angleToEnemy < window.ATTACK_CONE_ANGLE / 2) {
                    hitAnEnemy = true; // Se ha golpeado a un enemigo
                    // --- INICIO: Lógica de Reacción al Bloqueo del Jefe ---
                    const enemy = window.globalState.skeletons[i];
                    if (enemy.userData.isBoss && enemy.userData.isBlocking && enemy.animationActions.blockReaction) {
                        console.log("¡El jugador golpeó el bloqueo del jefe!");
                        window.setSkeletonAnimation(i, enemy.animationActions.blockReaction);
                        enemy.userData.state = 'hit'; // Estado de reacción
                        enemy.userData.isBlocking = false; // Terminar el bloqueo
                        enemy.userData.playOptimalBlockReaction = Math.random() < 0.2; // 20% de probabilidad de activar la siguiente animación
                        enemy.userData.blockEndTime = 0; // Resetear el tiempo
                        window.globalState.attackCooldowns[i] = 1.5; // Cooldown después de una reacción
                        window.playSound('sonido/boss1-bloqueo.mp3', 0.9);
                        continue; // No aplicar daño y pasar al siguiente enemigo
                    }
                    // --- FIN: Lógica de Reacción al Bloqueo del Jefe ---

                    const healthBeforeHit = window.globalState.skeletonHealths[i];
                    window.globalState.skeletonHealths[i] -= window.ENEMY_ATTACK_DAMAGE;

                    // Add blood particles
                    const enemyPos = enemy.position.clone();
                    enemyPos.y += 1; // Approximate head height
                    window.addBloodParticles(enemyPos.x, enemyPos.y, enemyPos.z);

                    // Add blood on ground
                    const groundPos = new THREE.Vector3(enemyPos.x, 0, enemyPos.z);
                    const raycaster = new THREE.Raycaster(groundPos.clone().add(new THREE.Vector3(0, 10, 0)), new THREE.Vector3(0, -1, 0));
                    const intersects = raycaster.intersectObjects(window.globalState.collisionObjects, true);
                    if (intersects.length > 0) {
                        groundPos.y = intersects[0].point.y + 0.01; // Slightly above ground
                        const bloodGeometry = new THREE.PlaneGeometry(0.5, 0.5);
                        const bloodMaterial = new THREE.MeshBasicMaterial({ color: 0x880000, transparent: true, opacity: 0.9 });
                        const bloodMesh = new THREE.Mesh(bloodGeometry, bloodMaterial);
                        bloodMesh.position.copy(groundPos);
                        bloodMesh.rotation.x = -Math.PI / 2;
                        window.globalState.scene.add(bloodMesh);
                        // Remove after 30 seconds
                        setTimeout(() => {
                            window.globalState.scene.remove(bloodMesh);
                            bloodGeometry.dispose();
                            bloodMaterial.dispose();
                        }, 30000);
                    }

                    // --- INICIO: Lógica de Sonido de Golpe ---
                    // Primero, reproducir siempre el sonido del golpe de la espada.
                    const swordHitSounds = ['sonido/espada1.mp3', 'sonido/espada2.wav', 'sonido/espada3.wav'];
                    const randomSound = swordHitSounds[Math.floor(Math.random() * swordHitSounds.length)];
                    const randomVolume = 0.2 + Math.random() * 0.8; // 0.2 to 1.0
                    window.playSound(randomSound, randomVolume);

                    // Luego, si es el jefe, añadir su sonido de dolor con probabilidad.
                    if (enemy.userData.isBoss) {
                        // El jefe tiene un 20% de probabilidad de hacer un sonido de dolor al ser golpeado.
                        if (Math.random() < 0.2) {
                            const bossPainSounds = ['sonido/boss1-dolor.mp3', 'sonido/boss1-dolor2.mp3'];
                            const randomPainSound = bossPainSounds[Math.floor(Math.random() * bossPainSounds.length)];
                            window.playSound(randomPainSound, 1.0);
                        }
                    }
                    // --- FIN: Lógica de Sonido de Golpe ---

                    // Helmet breaking logic
                    if (healthBeforeHit > 50 && window.globalState.skeletonHealths[i] <= 50) {
                        const helmet = window.globalState.skeletons[i].getObjectByName('Skeleton_Warrior_Helmet');
                        if (helmet) {
                            helmet.visible = false;
                        }
                        window.playSound('sonido/casco-roto-enemigo.mp3', 0.8);
                    }

                    if (window.globalState.skeletons[i].animationActions.hits.length > 0 && window.globalState.skeletonMixers[i]) {
                        const randomHitAction = window.globalState.skeletons[i].animationActions.hits[Math.floor(Math.random() * window.globalState.skeletons[i].animationActions.hits.length)];
                        // --- INICIO: Lógica de Animación Ininterrumpible para el Jefe ---
                        if (enemy.userData.isBoss && (enemy.userData.state === 'attacking' || enemy.userData.state === 'fury')) {
                            // Si el jefe está atacando o en furia, no interrumpir su animación.
                            // El daño se aplica, pero visualmente continúa su acción.
                        } else {
                            // Para enemigos normales o si el jefe está en un estado normal (idle, running).
                            window.globalState.skeletons[i].userData.state = 'hit'; // Poner al enemigo en estado 'hit'
                            window.setSkeletonAnimation(i, randomHitAction);
                        }
                        // --- FIN: Lógica de Animación Ininterrumpible para el Jefe ---
                    }
                    if (window.globalState.skeletonHealths[i] <= 0 && enemy.userData.state !== 'dead') {
                        enemy.userData.state = 'dead';
                        enemy.activeAction.fadeOut(0.2);
                        
                        let deathAction;
                        if (enemy.userData.isBoss && enemy.animationActions.deathAnimation) {
                            // Usar la animación de muerte específica del jefe
                            deathAction = enemy.animationActions.deathAnimation;
                            // --- INICIO: Reproducir sonido de muerte del jefe ---
                            window.playSound('sonido/boss1-dead.wav', 0.9); // Volumen al 90%
                            // --- INICIO: Lógica de Victoria ---
                            if (window.globalState.isFinalWave) {
                                window.globalState.gameWon = true;
                                document.getElementById('victory-screen').style.display = 'flex';
                                console.log("¡HAS GANADO EL JUEGO!");
                            }
                            // --- FIN: Lógica de Victoria ---
                            // --- FIN: Reproducir sonido de muerte del jefe ---
                        } else if (enemy.animationActions.deaths.length > 0) {
                            // Usar una animación de muerte aleatoria para enemigos normales
                            deathAction = enemy.animationActions.deaths[Math.floor(Math.random() * enemy.animationActions.deaths.length)];
                        }

                        if (deathAction && window.globalState.skeletonMixers[i]) {
                            // Otorga una cantidad aleatoria de dinero entre 10 y 100
                            const randomMoney = Math.floor(Math.random() * 91) + 10; // Genera un número entre 10 y 100
                            window.globalState.playerMoney += randomMoney;
                            window.setSkeletonAnimation(i, deathAction);
                        }
                        window.dropHealthPickup(window.globalState.skeletons[i].position.clone());
                    }
                }
            }
        }

        // Blood effects are now only particles and ground stains

        // Si después de comprobar a todos los enemigos, no se golpeó a ninguno, reproducir sonido de fallo.
        if (!hitAnEnemy) {
            window.playSound('sonido/espada-no-daño.wav', 0.2); // Volumen al 50%
        }
    }
};

// Horizontal collision logic
window.checkHorizontalCollision = function(currentPos, moveVector) {
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
};