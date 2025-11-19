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

window.handleEnemyAI = function(deltaTime) {
    const ENEMY_SPEED = window.ENEMY_SPEED || 14.0;
    const moveSpeed = ENEMY_SPEED * deltaTime;
    const ENEMY_ATTACK_RANGE = window.ENEMY_ATTACK_RANGE || 10;
    const ENEMY_AGGRO_RADIUS = window.ENEMY_AGGRO_RADIUS || 15;
    const ENEMY_BARRICADE_CHECK_RANGE = window.ENEMY_BARRICADE_CHECK_RANGE || 5;
    const OBJECT2_ATTACK_DAMAGE = window.OBJECT2_ATTACK_DAMAGE || 25;
    const ENEMY_ATTACK_DAMAGE = window.ENEMY_ATTACK_DAMAGE || 10;
    const AI_UPDATE_PER_FRAME = window.AI_UPDATE_PER_FRAME || 3;

    const start = window.globalState.frameCount % Math.max(1, Math.floor(window.globalState.skeletons.length / AI_UPDATE_PER_FRAME));

    for (let i = start; i < window.globalState.skeletons.length; i += AI_UPDATE_PER_FRAME) {
        const skeleton = window.globalState.skeletons[i];
        if (!skeleton || window.globalState.skeletonHealths[i] <= 0 || skeleton.userData.state === 'dead') continue;

        // --- INICIO: Pausar IA si el enemigo está reaccionando a un golpe ---
        // Si el enemigo está en estado 'hit', no procesar más IA para este frame.
        // El gameLoop se encargará de devolverlo a 'idle' cuando la animación termine.
        if (skeleton.userData.state === 'hit') continue;
        // --- FIN: Pausar IA si el enemigo está reaccionando a un golpe ---

        // --- INICIO: Lógica de Furia Múltiple del Jefe ---
        const bossMaxHealth = 200; // Vida máxima del jefe
        const furyUsed = skeleton.userData.furyCount || 0;
        const maxFury = skeleton.userData.maxFuryCount || 0;
        // El umbral de vida para la siguiente furia se hace más bajo cada vez que la usa.
        const nextFuryHealthThreshold = bossMaxHealth * (1 - ((furyUsed + 1) / (maxFury + 1)));

        if (skeleton.userData.isBoss && furyUsed < maxFury && window.globalState.skeletonHealths[i] <= nextFuryHealthThreshold) {
            skeleton.userData.furyCount++; // Usar una carga de furia
            skeleton.userData.state = 'fury';

            // Curar al jefe
            window.globalState.skeletonHealths[i] = Math.min(bossMaxHealth, window.globalState.skeletonHealths[i] + 80);

            // Reproducir animación de furia
            window.setSkeletonAnimation(i, skeleton.animationActions.fury);
            
            // Activar vibración de pantalla y sonido
            window.triggerScreenShake(3.0, 1.0); // Intensidad MUY aumentada, Duración extendida (en segundos)
            if (window.globalState.isMobile && navigator.vibrate) {
                navigator.vibrate([100, 80, 100]); // Patrón de vibración suave (vibra-pausa-vibra)
            }

            // Si es la última furia, usar un grito diferente
            if (skeleton.userData.furyCount === maxFury) {
                window.playSound('sonido/boss1-grito.wav', 1.0);
            } else {
                window.playSound('sonido/boss1-grito2.mp3', 1.0);
            }

            continue; // Saltar el resto de la IA durante este frame
        }
        // --- FIN: Lógica de Furia Múltiple del Jefe ---

        // --- INICIO: Lógica de Estado de Furia ---
        if (skeleton.userData.state === 'fury') {
            // Si la animación de furia ha terminado, volver a idle.
            if (!skeleton.activeAction.isRunning()) {
                // --- INICIO: Lógica de Bloqueo Post-Furia ---
                // Si es la primera furia, entra en modo de bloqueo.
                if (skeleton.userData.isBoss && skeleton.userData.furyCount === 1 && skeleton.userData.state === 'fury') {
                    skeleton.userData.state = 'blocking';
                    skeleton.userData.isBlocking = true;
                    skeleton.userData.blockEndTime = performance.now() + 3000; // Bloquear por 3 segundos
                    window.setSkeletonAnimation(i, skeleton.animationActions.block);
                } else {
                    skeleton.userData.state = 'idle'; // Para las siguientes furias, vuelve a idle.
                }
                // --- FIN: Lógica de Bloqueo Post-Furia ---
            }
            continue; // No hacer nada más mientras está en furia.
        }

        // --- INICIO: Lógica de Estado de Bloqueo del Jefe ---
        if (skeleton.userData.state === 'blocking') {
            // Si el tiempo de bloqueo ha expirado, volver a idle
            if (performance.now() >= skeleton.userData.blockEndTime) {
                skeleton.userData.isBlocking = false;
                skeleton.userData.state = 'idle';
                window.setSkeletonAnimation(i, skeleton.animationActions.idle);
                window.globalState.attackCooldowns[i] = 1; // Pequeño cooldown después de bloquear
            }
            // Mantenerse mirando al jugador mientras bloquea
            skeleton.lookAt(window.globalState.character.position);
            continue; // No hacer más lógica de IA si está bloqueando
        }
        // --- FIN: Lógica de Estado de Bloqueo del Jefe ---
        
        // --- INICIO: Lógica de Selección de Objetivo ---
        let target;

        if (skeleton.userData.isBoss) {
            // Lógica de objetivo para el JEFE: el objetivo final es siempre el jugador, pero debe destruir obstáculos.
            const ultimateTarget = window.globalState.character;
            target = ultimateTarget; // Por defecto, el objetivo es el jugador.

            // Comprobar si hay una barricada en el camino hacia el jugador.
            const directionToPlayer = new THREE.Vector3().subVectors(ultimateTarget.position, skeleton.position).normalize();
            const raycasterOrigin = skeleton.position.clone();
            raycasterOrigin.y += 1; // Un poco por encima del suelo.
            const bossBarricadeCheckRange = ENEMY_BARRICADE_CHECK_RANGE * 2; // El jefe es más grande, necesita ver más lejos.
            const raycaster = new THREE.Raycaster(raycasterOrigin, directionToPlayer, 0, bossBarricadeCheckRange);
            const intersects = raycaster.intersectObjects(window.globalState.collisionObjects, true);

            for (const intersect of intersects) {
                if (intersect.object.userData.isBarricade && intersect.object.userData.health > 0) {
                    target = intersect.object; // Nuevo objetivo inmediato es la barricada.
                    break; // Atacar la primera barricada encontrada.
                }
            }

        } else {
            // Lógica de objetivo para enemigos normales.
            target = skeleton.userData.currentTarget;
            const playerPosition = window.globalState.character.position;
            const distanceToPlayer = skeleton.position.distanceTo(playerPosition);

            // Prioridad 1: Jugador si está dentro del rango de aggro y vivo
            if (distanceToPlayer <= ENEMY_AGGRO_RADIUS && window.globalState.playerHealth > 0) {
                target = window.globalState.character;
            } else {
                // Si el jugador salió del rango de aggro, está muerto, o el objetivo anterior era el jugador,
                // o si no hay objetivo actual, o el objetivo actual está destruido,
                // entonces la prioridad vuelve a ser el Object_2 o una barricada.
                if (!target || (target === window.globalState.character && (distanceToPlayer > ENEMY_AGGRO_RADIUS || window.globalState.playerHealth <= 0)) || (target.userData.isBarricade && target.userData.health <= 0)) {
                    target = window.globalState.object2Target; // Por defecto, el objetivo es Object_2
                }

                // Si el objetivo actual es Object_2, buscar barricadas en el camino
                if (target === window.globalState.object2Target) {
                    const directionToObjective = new THREE.Vector3().subVectors(target.position, skeleton.position).normalize();
                    const raycasterOrigin = skeleton.position.clone();
                    raycasterOrigin.y += 1; // Un poco por encima del suelo para evitar intersecciones con el piso
                    const raycaster = new THREE.Raycaster(raycasterOrigin, directionToObjective, 0, ENEMY_BARRICADE_CHECK_RANGE);
                    const intersects = raycaster.intersectObjects(window.globalState.collisionObjects, true);

                    let foundBarricade = false;
                    for (const intersect of intersects) {
                        if (intersect.object.userData.isBarricade && intersect.object.userData.health > 0) {
                            target = intersect.object; // Nuevo objetivo es la barricada
                            foundBarricade = true;
                            break; // Atacar la primera barricada encontrada
                        }
                    }
                    // Si no se encontró barricada y el objetivo anterior era una barricada, volver a Object_2
                    if (!foundBarricade && skeleton.userData.currentTarget && skeleton.userData.currentTarget.userData.isBarricade) {
                         target = window.globalState.object2Target;
                    }
                }
            }
        }

        // Si aún no hay objetivo (ej. al inicio del juego o si Object_2 no está definido)
        if (!target) {
            target = window.globalState.object2Target;
            skeleton.userData.currentTarget = target;
        } else {
            skeleton.userData.currentTarget = target; // Actualizar el objetivo en userData
        }        
        // --- FIN: Lógica de Selección de Objetivo ---
        
        // Calculate direction to target
        const direction = new THREE.Vector3().subVectors(target.position, skeleton.position);
        const distance = direction.length();

        if (distance > ENEMY_ATTACK_RANGE) {
            // --- INICIO: Lógica de Movimiento ---
            // Make the skeleton look at the target's horizontal position, not tilting up/down
            const lookAtPosition = target.position.clone();
            lookAtPosition.y = skeleton.position.y;
            skeleton.lookAt(lookAtPosition);

            // --- INICIO: Lógica de Carrera del Jefe ---
            let currentMoveSpeed = moveSpeed;
            let movementAnimation = skeleton.animationActions.running;

            // --- INICIO: Lógica de Persecución del Jefe ---
            if (skeleton.userData.isBoss) {
                if (target === window.globalState.character) {
                    if (!skeleton.userData.isChasingPlayer) {
                        // Empezó a perseguir al jugador, registrar el tiempo.
                        skeleton.userData.walkStartTime = performance.now();
                    }
                    skeleton.userData.isChasingPlayer = true;
                } else {
                    // El objetivo no es el jugador, reiniciar.
                    if (skeleton.userData.isChasingPlayer) skeleton.userData.isChasingPlayer = false;
                    skeleton.userData.walkStartTime = 0;
                }
            }
            // --- FIN: Lógica de Persecución del Jefe ---

            if (skeleton.userData.isBoss && skeleton.animationActions.sprint) {
                const sprintDistanceThreshold = 40; // Distancia a partir de la cual el jefe empieza a correr
                const walkTimeToSprint = 3000; // 3 segundos caminando antes de correr
                const hasBeenWalkingTooLong = skeleton.userData.isChasingPlayer && (performance.now() - skeleton.userData.walkStartTime > walkTimeToSprint);

                if (distance > sprintDistanceThreshold) {
                    currentMoveSpeed *= 1.5; // El jefe corre un 50% más rápido
                    movementAnimation = skeleton.animationActions.sprint;

                    // --- INICIO: Lógica de Sonido de Pasos del Jefe (SPRINT) ---
                    const now = performance.now();
                    const footstepInterval = 400; // ms entre pasos, ajústalo para que coincida con la animación
                    if (!skeleton.userData.lastFootstepTime) {
                        skeleton.userData.lastFootstepTime = 0;
                    }
                    // Usamos hasOwnProperty para asegurarnos de que la propiedad existe, incluso si es false
                    if (!skeleton.userData.hasOwnProperty('nextFootIsLeft')) {
                        skeleton.userData.nextFootIsLeft = true;
                    }

                    if (now - skeleton.userData.lastFootstepTime > footstepInterval) {
                        skeleton.userData.lastFootstepTime = now;
                        const footstepSound = skeleton.userData.nextFootIsLeft ? 'sonido/boss1-paso1.wav' : 'sonido/boss1-paso2.wav';
                        window.playSound(footstepSound, 0.75); // Volumen ajustado para ser más sutil
                        skeleton.userData.nextFootIsLeft = !skeleton.userData.nextFootIsLeft;
                    }
                    // --- FIN: Lógica de Sonido de Pasos del Jefe (SPRINT) ---
                } else {
                    // --- INICIO: Lógica de Sonido de Pasos del Jefe (CAMINATA) ---
                    const now = performance.now();
                    const walkFootstepInterval = 650; // Intervalo más lento para caminar
                    if (!skeleton.userData.lastFootstepTime) {
                        skeleton.userData.lastFootstepTime = 0;
                    }

                    if (now - skeleton.userData.lastFootstepTime > walkFootstepInterval) {
                        skeleton.userData.lastFootstepTime = now;
                        window.playSound('sonido/boss1-caminata.wav', 0.6); // Volumen más bajo para caminar
                    }
                    // --- FIN: Lógica de Sonido de Pasos del Jefe (CAMINATA) ---
                }
            } // --- FIN: Lógica de Carrera del Jefe ---

            const moveDirection = direction.normalize();
            const moveVector = moveDirection.clone().multiplyScalar(currentMoveSpeed);
            const allowedMoveVector = checkEnemyCollision(skeleton, moveVector);
            const nextPos = skeleton.position.clone().add(allowedMoveVector);

            const groundRayOrigin = new THREE.Vector3(nextPos.x, 50, nextPos.z);
            window.globalState.raycaster.set(groundRayOrigin, new THREE.Vector3(0, -1, 0));
            const intersects = window.globalState.raycaster.intersectObjects(window.globalState.collisionObjects, true);

            if (intersects.length > 0) {
                nextPos.y = intersects[0].point.y; // Adjust Y to ground
                skeleton.position.copy(nextPos);
            }

            // Si el estado no es 'running' O si la animación actual no es la que corresponde (ej. cambiar de sprint a walk), actualiza la animación.
            if ((skeleton.userData.state !== 'running' || skeleton.activeAction !== movementAnimation) && skeleton.userData.state !== 'hit' && movementAnimation) {
                window.setSkeletonAnimation(i, movementAnimation);
                skeleton.userData.state = 'running';
            }

            // --- FIN: Lógica de Movimiento ---
        } else {
            // --- START: Attack Logic ---
            // Make the skeleton look at the target's horizontal position, not tilting up/down
            const lookAtPosition = target.position.clone();
            lookAtPosition.y = skeleton.position.y;
            skeleton.lookAt(lookAtPosition);

            if (window.globalState.attackCooldowns[i] <= 0 && skeleton.userData.state !== 'attacking' && skeleton.userData.state !== 'blocking') {
                // Lógica de ataque normal
                if (skeleton.animationActions.attacks && skeleton.animationActions.attacks.length > 0) {
                    const randomAttack = skeleton.animationActions.attacks[Math.floor(Math.random() * skeleton.animationActions.attacks.length)];
                    window.setSkeletonAnimation(i, randomAttack);
                    skeleton.userData.state = 'attacking';
                    skeleton.userData.walkStartTime = 0; // Reiniciar el temporizador de caminata
                    skeleton.userData.isAttacking = true; 
                    skeleton.userData.damageApplied = false; // Reset damage flag for the new attack
                    skeleton.userData.attackTarget = target; // Store the target
                } else if (skeleton.animationActions.attack) {
                    // Fallback for skeletons
                    window.setSkeletonAnimation(i, skeleton.animationActions.attack);
                    skeleton.userData.walkStartTime = 0; // Reiniciar el temporizador de caminata
                    skeleton.userData.state = 'attacking';
                    skeleton.userData.isAttacking = true; 
                    skeleton.userData.damageApplied = false; // Reset damage flag for the new attack
                    skeleton.userData.attackTarget = target; // Store the target
                }
            } else {
                // If on cooldown and not already idle or in a hit/attack animation, switch to idle.
                if (skeleton.userData.state === 'running' || (skeleton.userData.state !== 'attacking' && skeleton.userData.state !== 'hit')) {
                    window.setSkeletonAnimation(i, skeleton.animationActions.idle);
                    skeleton.userData.walkStartTime = 0; // Reiniciar el temporizador de caminata
                    skeleton.userData.state = 'idle';
                }
            }

            // --- Lógica de Daño y Fin de Animación ---

            // 1. Aplicar daño en el punto medio de la animación
            const action = skeleton.activeAction;
            if (skeleton.userData.state === 'attacking' && skeleton.userData.isAttacking && !skeleton.userData.damageApplied && action.time >= action.getClip().duration / 2) {
                skeleton.userData.damageApplied = true; // Marcar que el daño ya se aplicó en este ataque
                
                const currentTarget = skeleton.userData.attackTarget;
                const currentDistance = skeleton.position.distanceTo(currentTarget.position);

                if (currentDistance <= ENEMY_ATTACK_RANGE) {
                    if (currentTarget === window.globalState.character && window.globalState.playerHealth > 0) {
                        // Atacar al jugador
                        let damage = ENEMY_ATTACK_DAMAGE;
                        // Apply damage reduction from armor
                        if (window.globalState.character.userData.equippedHelmet) {
                            damage *= 0.8; // 20% reduction
                        }
                        if (window.globalState.character.userData.equippedCape) {
                            damage *= 0.9; // 10% reduction
                        }
                        damage = Math.floor(damage); // Round down

                        if (window.globalState.characterState !== 'blocking' && !window.globalState.godMode) {
                            window.globalState.playerHealth -= damage;
                            if (window.globalState.playerHealth < 0) window.globalState.playerHealth = 0;
                            window.updatePlayerHealthUI();
                            window.playSound('sonido/golpe-personaje.mp3', 0.5); // Sonido de golpe al jugador
                            console.log(`Player golpeado. Daño: ${damage}. Vida restante: ${window.globalState.playerHealth}`);

                            // Reduce armor durability
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
                            // --- INICIO: Sonidos de bloqueo y rotura de escudo ---
                            const blockSounds = ['sonido/escudo-bloqueo.wav', 'sonido/escudo-bloqueo2.wav', 'sonido/escudo-bloqueo3.wav'];
                            const randomBlockSound = blockSounds[Math.floor(Math.random() * blockSounds.length)];
                            window.playSound(randomBlockSound, 0.8);
                            console.log('Ataque bloqueado exitosamente');                            

                            window.globalState.shieldDurability -= 1; // Decrease durability
                            if (window.globalState.shieldDurability <= 0) {
                                // Shield breaks
                                const shield = window.globalState.character.getObjectByName('Round_Shield');
                                if (shield) {
                                    shield.visible = false;
                                }
                                window.playSound('sonido/escudo-bloqueo-destruido.wav', 1.0);
                                window.globalState.character.userData.equippedShield = false;
                                window.globalState.shieldDurability = 0;
                                window.globalState.wasBlocking = false; // Prevent returning to blocking
                                console.log('Escudo roto');
                            }
                            window.updateShieldUI(); // Update UI
                        }
                        // --- FIN: Sonidos de bloqueo y rotura de escudo ---

                        // --- INICIO: Reproducir animación de golpe del jugador ---
                        if (window.globalState.characterState === 'blocking' && window.globalState.character.animationActions.blockHit) {
                            // Si está bloqueando, reproducir Block_Hit
                            window.setPlayerAnimation(window.globalState.character.animationActions.blockHit, 0.1);
                            window.globalState.characterState = 'hit';
                            window.globalState.wasBlocking = true; // Flag para volver a blocking después del hit
                        } else if (window.globalState.character.animationActions.hits.length > 0) {
                            const randomHitAction = window.globalState.character.animationActions.hits[Math.floor(Math.random() * window.globalState.character.animationActions.hits.length)];
                            window.setPlayerAnimation(randomHitAction, 0.1);
                            window.globalState.characterState = 'hit';
                        }
                        // --- FIN: Reproducir animación de golpe del jugador ---
                    } else if (currentTarget.userData.isBarricade) {
                        // Atacar barricada
                        currentTarget.userData.health -= window.BARRICADE_ATTACK_DAMAGE;
                        console.log(`Barricada golpeada. Vida restante: ${currentTarget.userData.health}`);
                        window.playSound('sonido/barricada-golpe.mp3', 0.3);
                        window.playBarricadeHitAnimation(currentTarget); // Animación de vibración

                        if (currentTarget.userData.health <= 0) {
                            console.log('Barricade destroyed by enemy!');
                            window.playSound('sonido/barricada-destruida.mp3', 0.7);
                            currentTarget.userData.isBarricade = false;
                            const index = window.globalState.collisionObjects.indexOf(currentTarget);
                            if (index > -1) {
                                window.globalState.collisionObjects.splice(index, 1);
                            }
                            const cullableIndex = window.globalState.cullableAssets.findIndex(asset => asset.object === currentTarget);
                            if (cullableIndex > -1) {
                                window.globalState.cullableAssets.splice(cullableIndex, 1);
                            }
                            window.globalState.scene.remove(currentTarget);
                            skeleton.userData.currentTarget = null; // Forzar re-selección de objetivo
                        }
                    } else if (currentTarget === window.globalState.object2Target) {
                        // Atacar Object_2
                        window.globalState.object2Health -= OBJECT2_ATTACK_DAMAGE;
                        if (window.globalState.object2Health < 0) window.globalState.object2Health = 0;
                        window.globalState.lastObject2DamageTime = performance.now(); // Record damage time
                        window.updateObject2HealthUI(); // Update UI

                        // Reproducir animación de vibración
                        window.playBarricadeHitAnimation(currentTarget);

                        window.playSound('sonido/base-golpeada.mp3', 0.6); // Sonido de golpe a la base

                        if (window.globalState.object2Health <= 0) {
                            if (currentTarget.animationActions && currentTarget.animationActions.destroy) {
                                currentTarget.animationActions.destroy.stop().play();
                            }
                            console.log('Object2 destroyed!');
                            // Aquí podrías añadir la lógica de "Game Over"
                        }
                    }
                }                
            }

            // 2. Comprobar si la animación de ataque ha terminado para volver a idle y poner cooldown
            if (skeleton.userData.state === 'attacking' && skeleton.userData.isAttacking && !action.isRunning()) {
                skeleton.userData.isAttacking = false;
                skeleton.userData.state = 'idle';
                // Poner el cooldown cuando la animación termina, no cuando se aplica el daño
                window.globalState.attackCooldowns[i] = 2; // Cooldown de 2 segundos
            }
            // --- END: Attack Logic ---
        }
    }
};

// Assign to global state
window.globalState.handleEnemyAI = window.handleEnemyAI;