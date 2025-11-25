// script-juego/enemyAI.js

function checkEnemyCollision(skeleton, moveVector) {
    if (moveVector.lengthSq() === 0) return moveVector;

    const enemyHeight = 1.8; // Approximate height
    const enemyRadius = 0.5; // Approximate radius
    const nextPos = skeleton.position.clone().add(moveVector);

    const enemyBox = new THREE.Box3(
        new THREE.Vector3(nextPos.x - enemyRadius, nextPos.y, nextPos.z - enemyRadius),
        new THREE.Vector3(nextPos.x + enemyRadius, nextPos.y + enemyHeight, nextPos.z + enemyRadius)
    );

    // Check against all collision objects, including other skeletons
    const objectsToCheck = [...window.globalState.collisionObjects, ...window.globalState.skeletons];

    for (const object of objectsToCheck) {
        if (object === skeleton || object.userData.isFloor || !object.geometry || (object.userData.health !== undefined && object.userData.health <= 0)) {
            continue; // Skip self, floors, or objects without geometry/health
        }

        const objectBox = new THREE.Box3().setFromObject(object);
        if (enemyBox.intersectsBox(objectBox)) {
            return new THREE.Vector3(0, 0, 0); // Collision detected, stop movement
        }
    }

    return moveVector; // No collision, allow movement
}

function selectTargetForSkeleton(skeleton, i) {
    const ENEMY_AGGRO_RADIUS = window.ENEMY_AGGRO_RADIUS || 15;
    const ENEMY_BARRICADE_CHECK_RANGE = window.ENEMY_BARRICADE_CHECK_RANGE || 5;
    const TARGET_CACHE_TIME = 500; // Cache target for 500ms

    const now = performance.now();
    if (skeleton.userData.lastTargetUpdate && (now - skeleton.userData.lastTargetUpdate < TARGET_CACHE_TIME)) {
        const cachedTarget = skeleton.userData.currentTarget;
        if (cachedTarget && ((cachedTarget === window.globalState.character && window.globalState.playerHealth > 0) ||
            (cachedTarget.userData && cachedTarget.userData.isBarricade && cachedTarget.userData.health > 0) ||
            cachedTarget === window.globalState.object2Target)) {
            return cachedTarget;
        }
    }

    let target;

    if (skeleton.userData.isBoss) {
        // Boss logic: prioritize player, but check for barricades
        const ultimateTarget = window.globalState.character;
        target = ultimateTarget;

        const directionToPlayer = new THREE.Vector3().subVectors(ultimateTarget.position, skeleton.position).normalize();
        const raycasterOrigin = skeleton.position.clone();
        raycasterOrigin.y += 1;
        const bossBarricadeCheckRange = ENEMY_BARRICADE_CHECK_RANGE * 2;
        const raycaster = new THREE.Raycaster(raycasterOrigin, directionToPlayer, 0, bossBarricadeCheckRange);
        const intersects = raycaster.intersectObjects(window.globalState.collisionObjects, true);

        for (const intersect of intersects) {
            if (intersect.object.userData.isBarricade && intersect.object.userData.health > 0) {
                target = intersect.object;
                break;
            }
        }
    } else {
        // Normal skeleton logic
        target = skeleton.userData.currentTarget;
        const playerPosition = window.globalState.character.position;
        const distanceToPlayer = skeleton.position.distanceTo(playerPosition);

        if (distanceToPlayer <= ENEMY_AGGRO_RADIUS && window.globalState.playerHealth > 0) {
            target = window.globalState.character;
        } else {
            if (!target || (target === window.globalState.character && (distanceToPlayer > ENEMY_AGGRO_RADIUS || window.globalState.playerHealth <= 0)) || (target.userData.isBarricade && target.userData.health <= 0)) {
                target = window.globalState.object2Target;
            }

            if (target === window.globalState.object2Target) {
                const directionToObjective = new THREE.Vector3().subVectors(target.position, skeleton.position).normalize();
                const raycasterOrigin = skeleton.position.clone();
                raycasterOrigin.y += 1;
                const raycaster = new THREE.Raycaster(raycasterOrigin, directionToObjective, 0, ENEMY_BARRICADE_CHECK_RANGE);
                const intersects = raycaster.intersectObjects(window.globalState.collisionObjects, true);

                for (const intersect of intersects) {
                    if (intersect.object.userData.isBarricade && intersect.object.userData.health > 0) {
                        target = intersect.object;
                        break;
                    }
                }
                if (skeleton.userData.currentTarget && skeleton.userData.currentTarget.userData.isBarricade && !target.userData.isBarricade) {
                    target = window.globalState.object2Target;
                }
            }
        }
    }

    if (!target) {
        target = window.globalState.object2Target;
    }
    skeleton.userData.currentTarget = target;
    skeleton.userData.lastTargetUpdate = now;
    return target;
}

function handleBossSpecialStates(skeleton, i) {
    const bossMaxHealth = 200;
    const furyUsed = skeleton.userData.furyCount || 0;
    const maxFury = skeleton.userData.maxFuryCount || 0;
    const nextFuryHealthThreshold = bossMaxHealth * (1 - ((furyUsed + 1) / (maxFury + 1)));

    if (furyUsed < maxFury && window.globalState.skeletonHealths[i] <= nextFuryHealthThreshold) {
        skeleton.userData.furyCount++;
        skeleton.userData.state = 'fury';
        window.globalState.skeletonHealths[i] = Math.min(bossMaxHealth, window.globalState.skeletonHealths[i] + 80);
        window.setSkeletonAnimation(i, skeleton.animationActions.fury);
        window.triggerScreenShake(3.0, 1.0);
        if (window.globalState.isMobile && navigator.vibrate) {
            navigator.vibrate([100, 80, 100]);
        }
        const sound = (skeleton.userData.furyCount === maxFury) ? 'sonido/boss1-grito.wav' : 'sonido/boss1-grito2.mp3';
        window.playSound(sound, 1.0);
        return true; // Skip rest
    }

    if (skeleton.userData.state === 'fury') {
        if (!skeleton.activeAction.isRunning()) {
            if (skeleton.userData.furyCount === 1) {
                skeleton.userData.state = 'blocking';
                skeleton.userData.isBlocking = true;
                skeleton.userData.blockEndTime = performance.now() + 3000;
                window.setSkeletonAnimation(i, skeleton.animationActions.block);
            } else {
                skeleton.userData.state = 'idle';
            }
        }
        return true;
    }

    if (skeleton.userData.state === 'blocking') {
        if (performance.now() >= skeleton.userData.blockEndTime) {
            skeleton.userData.isBlocking = false;
            skeleton.userData.state = 'idle';
            window.setSkeletonAnimation(i, skeleton.animationActions.idle);
            window.globalState.attackCooldowns[i] = 1;
        }
        skeleton.lookAt(window.globalState.character.position);
        return true;
    }

    return false;
}

function handleMovement(skeleton, i, target, deltaTime) {
    const ENEMY_SPEED = window.ENEMY_SPEED || 14.0;
    const moveSpeed = ENEMY_SPEED * deltaTime;
    const ENEMY_ATTACK_RANGE = window.ENEMY_ATTACK_RANGE || 10;

    const direction = new THREE.Vector3().subVectors(target.position, skeleton.position);
    const distance = direction.length();

    if (distance > ENEMY_ATTACK_RANGE) {
        const lookAtPosition = target.position.clone();
        lookAtPosition.y = skeleton.position.y;
        skeleton.lookAt(lookAtPosition);

        let currentMoveSpeed = moveSpeed;
        let movementAnimation = skeleton.animationActions.running;

        if (skeleton.userData.isBoss && skeleton.animationActions.sprint) {
            if (target === window.globalState.character) {
                if (!skeleton.userData.isChasingPlayer) {
                    skeleton.userData.walkStartTime = performance.now();
                }
                skeleton.userData.isChasingPlayer = true;
            } else {
                skeleton.userData.isChasingPlayer = false;
                skeleton.userData.walkStartTime = 0;
            }

            const sprintDistanceThreshold = 40;

            if (distance > sprintDistanceThreshold) {
                currentMoveSpeed *= 1.5;
                movementAnimation = skeleton.animationActions.sprint;
                playBossFootstepSound(skeleton, 400, 'sprint');
            } else {
                playBossFootstepSound(skeleton, 650, 'walk');
            }
        }

        const moveDirection = direction.normalize();
        const moveVector = moveDirection.clone().multiplyScalar(currentMoveSpeed);
        const allowedMoveVector = checkEnemyCollision(skeleton, moveVector);

        // Detect stuck
        if (allowedMoveVector.lengthSq() === 0) {
            if (!skeleton.userData.stuckTime) skeleton.userData.stuckTime = 0;
            skeleton.userData.stuckTime += deltaTime;
            if (skeleton.userData.stuckTime > 5) {
                breakBarricades(skeleton);
            }
        } else {
            skeleton.userData.stuckTime = 0;
        }

        const nextPos = skeleton.position.clone().add(allowedMoveVector);

        const groundRayOrigin = new THREE.Vector3(nextPos.x, 50, nextPos.z);
        window.globalState.raycaster.set(groundRayOrigin, new THREE.Vector3(0, -1, 0));
        const intersects = window.globalState.raycaster.intersectObjects(window.globalState.collisionObjects, true);

        if (intersects.length > 0) {
            nextPos.y = intersects[0].point.y;
            skeleton.position.copy(nextPos);
        }

        if ((skeleton.userData.state !== 'running' || skeleton.activeAction !== movementAnimation) && skeleton.userData.state !== 'hit' && movementAnimation) {
            window.setSkeletonAnimation(i, movementAnimation);
            skeleton.userData.state = 'running';
        }
    } else {
        handleAttack(skeleton, i, target);
    }
}

function playBossFootstepSound(skeleton, interval, type) {
    const now = performance.now();
    if (!skeleton.userData.lastFootstepTime) skeleton.userData.lastFootstepTime = 0;
    if (!skeleton.userData.hasOwnProperty('nextFootIsLeft')) skeleton.userData.nextFootIsLeft = true;

    if (now - skeleton.userData.lastFootstepTime > interval) {
        skeleton.userData.lastFootstepTime = now;
        let sound;
        if (type === 'sprint') {
            sound = skeleton.userData.nextFootIsLeft ? 'sonido/boss1-paso1.wav' : 'sonido/boss1-paso2.wav';
            window.playSound(sound, 0.75);
        } else {
            sound = 'sonido/boss1-caminata.wav';
            window.playSound(sound, 0.6);
        }
        skeleton.userData.nextFootIsLeft = !skeleton.userData.nextFootIsLeft;
    }
}

function breakBarricades(skeleton) {
    const breakRange = 3;
    const breakDamage = 50;

    for (const obj of window.globalState.collisionObjects) {
        if (obj.userData.isBarricade && obj.userData.health > 0) {
            const distance = skeleton.position.distanceTo(obj.position);
            if (distance <= breakRange) {
                obj.userData.health -= breakDamage;
                console.log(`Barricada rota por esqueleto atascado. Vida restante: ${obj.userData.health}`);
                window.playSound('sonido/barricada-golpe.mp3', 0.3);
                window.playBarricadeHitAnimation(obj);

                if (obj.userData.health <= 0) {
                    console.log('Barricade destroyed by stuck enemy!');
                    window.playSound('sonido/barricada-destruida.mp3', 0.7);
                    obj.userData.isBarricade = false;
                    const index = window.globalState.collisionObjects.indexOf(obj);
                    if (index > -1) window.globalState.collisionObjects.splice(index, 1);
                    const cullableIndex = window.globalState.cullableAssets.findIndex(asset => asset.object === obj);
                    if (cullableIndex > -1) window.globalState.cullableAssets.splice(cullableIndex, 1);
                    window.globalState.scene.remove(obj);
                }
            }
        }
    }
    skeleton.userData.stuckTime = 0;
}

function handleAttack(skeleton, i, target) {
    const ENEMY_ATTACK_RANGE = window.ENEMY_ATTACK_RANGE || 10;
    const OBJECT2_ATTACK_DAMAGE = window.OBJECT2_ATTACK_DAMAGE || 25;
    const ENEMY_ATTACK_DAMAGE = window.ENEMY_ATTACK_DAMAGE || 10;

    const lookAtPosition = target.position.clone();
    lookAtPosition.y = skeleton.position.y;
    skeleton.lookAt(lookAtPosition);

    if (window.globalState.attackCooldowns[i] <= 0 && skeleton.userData.state !== 'attacking' && skeleton.userData.state !== 'blocking') {
        if (skeleton.animationActions.attacks && skeleton.animationActions.attacks.length > 0) {
            const randomAttack = skeleton.animationActions.attacks[Math.floor(Math.random() * skeleton.animationActions.attacks.length)];
            window.setSkeletonAnimation(i, randomAttack);
        } else if (skeleton.animationActions.attack) {
            window.setSkeletonAnimation(i, skeleton.animationActions.attack);
        }
        skeleton.userData.state = 'attacking';
        skeleton.userData.walkStartTime = 0;
        skeleton.userData.isAttacking = true;
        skeleton.userData.damageApplied = false;
        skeleton.userData.attackTarget = target;
    } else {
        if (skeleton.userData.state === 'running' || (skeleton.userData.state !== 'attacking' && skeleton.userData.state !== 'hit')) {
            window.setSkeletonAnimation(i, skeleton.animationActions.idle);
            skeleton.userData.walkStartTime = 0;
            skeleton.userData.state = 'idle';
        }
    }

    const action = skeleton.activeAction;
    if (skeleton.userData.state === 'attacking' && skeleton.userData.isAttacking && !skeleton.userData.damageApplied && action.time >= action.getClip().duration / 2) {
        skeleton.userData.damageApplied = true;
        const currentTarget = skeleton.userData.attackTarget;
        const currentDistance = skeleton.position.distanceTo(currentTarget.position);

        if (currentDistance <= ENEMY_ATTACK_RANGE) {
            if (currentTarget === window.globalState.character && window.globalState.playerHealth > 0) {
                let damage = ENEMY_ATTACK_DAMAGE;
                if (window.globalState.character.userData.equippedShield) damage *= 0.9; // 10% reduction
                if (window.globalState.character.userData.equippedHelmet) damage *= 0.8;
                if (window.globalState.character.userData.equippedCape) damage *= 0.5; // 50% reduction
                damage = Math.floor(damage);

                if (window.globalState.characterState !== 'blocking' && !window.globalState.godMode) {
                    window.globalState.playerHealth -= damage;
                    if (window.globalState.playerHealth < 0) window.globalState.playerHealth = 0;
                    window.updatePlayerHealthUI();
                    const randomVolume = 0.2 + Math.random() * 0.8; // 0.2 to 1.0
                    window.playSound('sonido/golpe-personaje.mp3', randomVolume);

                    // Add blood particles
                    const playerPos = window.globalState.character.position.clone();
                    playerPos.y += 1; // Approximate head height
                    window.addBloodParticles(playerPos.x, playerPos.y, playerPos.z);

                    // Add blood on ground
                    const groundPos = new THREE.Vector3(playerPos.x, 0, playerPos.z);
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

                    console.log(`Player golpeado. Daño: ${damage}. Vida restante: ${window.globalState.playerHealth}`);

                    if (window.globalState.character.userData.equippedHelmet) {
                        window.globalState.helmetDurability -= 1;
                        if (window.globalState.helmetDurability <= 0) {
                            const helmet = window.globalState.character.getObjectByName('Knight_Helmet');
                            if (helmet) helmet.visible = false;
                            window.globalState.character.userData.equippedHelmet = false;
                            window.globalState.helmetDurability = 0;
                            console.log('Casco roto');
                        }
                    }
                    if (window.globalState.character.userData.equippedCape) {
                        window.globalState.capeDurability -= 1;
                        if (window.globalState.capeDurability <= 0) {
                            const cape = window.globalState.character.getObjectByName('Knight_Cape');
                            if (cape) cape.visible = false;
                            window.globalState.character.userData.equippedCape = false;
                            window.globalState.capeDurability = 0;
                            console.log('Capa rota');
                        }
                    }
                    window.updateEquipmentUI();
                } else if (window.globalState.godMode) {
                    console.log(`Modo Dios: Daño bloqueado. Daño evitado: ${damage}`);
                } else {
                    // For boss1, damage always applies even when blocked, as it's a counterattack
                    if (skeleton.userData.isBoss) {
                        window.globalState.playerHealth -= damage;
                        if (window.globalState.playerHealth < 0) window.globalState.playerHealth = 0;
                        window.updatePlayerHealthUI();
                        const randomVolume = 0.2 + Math.random() * 0.8; // 0.2 to 1.0
                        window.playSound('sonido/golpe-personaje.mp3', randomVolume);

                        // Add blood particles
                        const playerPos = window.globalState.character.position.clone();
                        playerPos.y += 1; // Approximate head height
                        window.addBloodParticles(playerPos.x, playerPos.y, playerPos.z);

                        // Add blood on ground
                        const groundPos = new THREE.Vector3(playerPos.x, 0, playerPos.z);
                        const raycaster = new THREE.Raycaster(groundPos.clone().add(new THREE.Vector3(0, 10, 0)), new THREE.Vector3(0, -1, 0));
                        const intersects = raycaster.intersectObjects(window.globalState.collisionObjects, true);
                        if (intersects.length > 0) {
                            groundPos.y = intersects[0].point.y + 0.01; // Slightly above ground
                            const bloodGeometry = new THREE.PlaneGeometry(0.3, 0.3);
                            const bloodMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
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

                        console.log(`Boss1 counterattack damage applied despite block. Daño: ${damage}. Vida restante: ${window.globalState.playerHealth}`);

                        if (window.globalState.character.userData.equippedHelmet) {
                            window.globalState.helmetDurability -= 1;
                            if (window.globalState.helmetDurability <= 0) {
                                const helmet = window.globalState.character.getObjectByName('Knight_Helmet');
                                if (helmet) helmet.visible = false;
                                window.globalState.character.userData.equippedHelmet = false;
                                window.globalState.helmetDurability = 0;
                                console.log('Casco roto');
                            }
                        }
                        if (window.globalState.character.userData.equippedCape) {
                            window.globalState.capeDurability -= 1;
                            if (window.globalState.capeDurability <= 0) {
                                const cape = window.globalState.character.getObjectByName('Knight_Cape');
                                if (cape) cape.visible = false;
                                window.globalState.character.userData.equippedCape = false;
                                window.globalState.capeDurability = 0;
                                console.log('Capa rota');
                            }
                        }
                        window.updateEquipmentUI();
                    }

                    const blockSounds = ['sonido/escudo-bloqueo.wav', 'sonido/escudo-bloqueo2.wav', 'sonido/escudo-bloqueo3.wav'];
                    const randomBlockSound = blockSounds[Math.floor(Math.random() * blockSounds.length)];
                    window.playSound(randomBlockSound, 0.8);

                    // Add block particles from shield
                    const shield = window.globalState.character.getObjectByName('Round_Shield');
                    if (shield) {
                        const shieldPos = new THREE.Vector3();
                        shield.getWorldPosition(shieldPos);
                        window.addBloodParticles(shieldPos.x, shieldPos.y, shieldPos.z, 10, 'yellow');
                    } else {
                        // Fallback to player position
                        const playerPos = window.globalState.character.position.clone();
                        playerPos.y += 1; // Approximate head height
                        window.addBloodParticles(playerPos.x, playerPos.y, playerPos.z, 10, 'yellow');
                    }

                    console.log('Ataque bloqueado exitosamente');

                    window.globalState.shieldDurability -= 1;
                    if (window.globalState.shieldDurability <= 0) {
                        const shield = window.globalState.character.getObjectByName('Round_Shield');
                        if (shield) shield.visible = false;
                        window.playSound('sonido/escudo-bloqueo-destruido.wav', 1.0);
                        window.globalState.character.userData.equippedShield = false;
                        window.globalState.shieldDurability = 0;
                        window.globalState.wasBlocking = false;
                        if (window.globalState.characterState === 'blocking') {
                            window.globalState.characterState = 'idle';
                        }
                        console.log('Escudo roto');
                    }
                    window.updateShieldUI();
                }

                if (window.globalState.characterState === 'blocking' && window.globalState.character.animationActions.blockHit) {
                    window.setPlayerAnimation(window.globalState.character.animationActions.blockHit, 0.1);
                    // Stay in blocking state, don't set to 'hit'
                } else if (window.globalState.character.animationActions.hits.length > 0) {
                    const randomHitAction = window.globalState.character.animationActions.hits[Math.floor(Math.random() * window.globalState.character.animationActions.hits.length)];
                    window.setPlayerAnimation(randomHitAction, 0.1);
                    window.globalState.characterState = 'hit';
                }
            } else if (currentTarget.userData.isBarricade) {
                currentTarget.userData.health -= window.BARRICADE_ATTACK_DAMAGE;
                console.log(`Barricada golpeada. Vida restante: ${currentTarget.userData.health}`);
                window.playSound('sonido/barricada-golpe.mp3', 0.3);
                window.playBarricadeHitAnimation(currentTarget);

                if (currentTarget.userData.health <= 0) {
                    console.log('Barricade destroyed by enemy!');
                    window.playSound('sonido/barricada-destruida.mp3', 0.7);
                    currentTarget.userData.isBarricade = false;
                    const index = window.globalState.collisionObjects.indexOf(currentTarget);
                    if (index > -1) window.globalState.collisionObjects.splice(index, 1);
                    const cullableIndex = window.globalState.cullableAssets.findIndex(asset => asset.object === currentTarget);
                    if (cullableIndex > -1) window.globalState.cullableAssets.splice(cullableIndex, 1);
                    window.globalState.scene.remove(currentTarget);
                    skeleton.userData.currentTarget = null;
                }
            } else if (currentTarget === window.globalState.object2Target) {
                window.globalState.object2Health -= OBJECT2_ATTACK_DAMAGE;
                if (window.globalState.object2Health < 0) window.globalState.object2Health = 0;
                window.globalState.lastObject2DamageTime = performance.now();
                window.updateObject2HealthUI();
                window.playBarricadeHitAnimation(currentTarget);
                window.playSound('sonido/base-golpeada.mp3', 0.6);

                if (window.globalState.object2Health <= 0) {
                    if (currentTarget.animationActions && currentTarget.animationActions.destroy) {
                        currentTarget.animationActions.destroy.stop().play();
                    }
                    console.log('Object2 destroyed!');
                }
            }
        }
    }

    if (skeleton.userData.state === 'attacking' && skeleton.userData.isAttacking && !action.isRunning()) {
        skeleton.userData.isAttacking = false;
        skeleton.userData.state = 'idle';
        window.globalState.attackCooldowns[i] = 2;
    }
}

window.handleEnemyAI = function(deltaTime) {
    const AI_UPDATE_PER_FRAME = window.AI_UPDATE_PER_FRAME || 5; // Increased from 3 to 5 for better performance

    const start = window.globalState.frameCount % Math.max(1, Math.floor(window.globalState.skeletons.length / AI_UPDATE_PER_FRAME));

    for (let i = start; i < window.globalState.skeletons.length; i += AI_UPDATE_PER_FRAME) {
        const skeleton = window.globalState.skeletons[i];
        if (!skeleton || window.globalState.skeletonHealths[i] <= 0 || skeleton.userData.state === 'dead') continue;

        if (skeleton.userData.state === 'hit') continue;

        if (skeleton.userData.isBoss && handleBossSpecialStates(skeleton, i)) continue;

        const target = selectTargetForSkeleton(skeleton, i);
        handleMovement(skeleton, i, target, deltaTime);
    }
};

// Assign to global state
window.globalState.handleEnemyAI = window.handleEnemyAI;