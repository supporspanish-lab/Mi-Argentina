// Player loading and animation management

window.loadPlayer = function() {
    return new Promise((resolve, reject) => {
        updateMapLoadingScreen("Cargando jugador...", undefined);
        const loader = new THREE.GLTFLoader();
        loader.load('players/Knight.glb', function(gltf) {
            window.globalState.character = gltf.scene;
            window.globalState.character.position.set(0, 0, 0);
            window.globalState.character.scale.set(1.7, 1.7, 1.7);
            window.globalState.scene.add(window.globalState.character);

            window.globalState.characterAnimationSettings = {};
            window.globalState.characterObjectVisibility = {};

            // Adjust initial character height
            const checkSpawnPoint = setInterval(() => {
                if (window.globalState.playerSpawnPoint) {
                    window.globalState.characterAnimationSettings = window.globalState.playerSpawnPoint.animationSettings || {};
                    window.globalState.characterObjectVisibility = window.globalState.playerSpawnPoint.objectVisibility || {};
                } else {
                    window.globalState.characterObjectVisibility = {};
                }

                if (!window.globalState.playerSpawnPoint && window.globalState.character.position.x === 0 && window.globalState.character.position.z === 0) return;

                clearInterval(checkSpawnPoint);

                if (window.globalState.playerSpawnPoint) {
                    window.globalState.character.position.set(window.globalState.playerSpawnPoint.x, window.globalState.playerSpawnPoint.y, window.globalState.playerSpawnPoint.z);
                }

                const spawnPosition = window.globalState.playerSpawnPoint ? window.globalState.playerSpawnPoint : new THREE.Vector3(0, 50, 0);
                const startRaycaster = new THREE.Raycaster(new THREE.Vector3(spawnPosition.x, 50, spawnPosition.z), new THREE.Vector3(0, -1, 0));
                const intersects = startRaycaster.intersectObjects(window.globalState.collisionObjects, true);
                if (intersects.length > 0) {
                    window.globalState.character.position.y = intersects[0].point.y;
                }

                // Apply object visibility from map
                window.globalState.character.traverse(function(child) {
                    if (child.isMesh) {
                        if (window.globalState.characterObjectVisibility[child.name] !== undefined) {
                            child.visible = window.globalState.characterObjectVisibility[child.name];
                        } else {
                            const defaultHidden = ['1H_Sword_Offhand', '2H_Sword', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', 'Knight_Cape', 'Knight_Helmet', 'Mug'];
                            child.visible = !defaultHidden.includes(child.name);
                        }
                    }
                });
            }, 100);

            window.globalState.character.userData.holdingMug = false;

            // Enable shadows for player
            window.globalState.character.traverse(function(child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Animations
            window.globalState.mixer = new THREE.AnimationMixer(window.globalState.character);
            const clips = gltf.animations;
            const idleAction = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, window.globalState.characterAnimationSettings.idle || 'Idle'));
            const runningAction = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, window.globalState.characterAnimationSettings.running || 'Running_A'));
            const walkingAction = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, 'Walking_B'));
            const sprintAction = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, 'Running_B'));
            const jumpStartAction = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, 'Jump_Start'));
            jumpStartAction.setLoop(THREE.LoopOnce);
            jumpStartAction.clampWhenFinished = true;
            const jumpIdleAction = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, 'Jump_Idle'));
            const jumpLandAction = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, 'Jump_Land'));
            jumpLandAction.setLoop(THREE.LoopOnce);
            jumpLandAction.clampWhenFinished = true;
            const hitAction = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, window.globalState.characterAnimationSettings.hit2 || 'Hit_B'));
            hitAction.setLoop(THREE.LoopOnce);
            hitAction.clampWhenFinished = true;

            const blockAction = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, 'Block'));
            if (blockAction) {
                blockAction.setLoop(THREE.LoopOnce);
                blockAction.clampWhenFinished = true;
            }

            const blockHitAction = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, 'Block_Hit'));
            if (blockHitAction) {
                blockHitAction.setLoop(THREE.LoopOnce);
                blockHitAction.clampWhenFinished = true;
            }

            const hitActionA = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, window.globalState.characterAnimationSettings.hit1 || 'Hit_A'));
            if (hitActionA) {
                hitActionA.setLoop(THREE.LoopOnce);
                hitActionA.clampWhenFinished = true;
            }

            const deathActionA = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, window.globalState.characterAnimationSettings.death1 || 'Death_A'));
            if (deathActionA) {
                deathActionA.setLoop(THREE.LoopOnce);
                deathActionA.clampWhenFinished = true;
            }
            const deathActionB = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, window.globalState.characterAnimationSettings.death2 || 'Death_B'));
            if (deathActionB) {
                deathActionB.setLoop(THREE.LoopOnce);
                deathActionB.clampWhenFinished = true;
            }

            const deathPoseA = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, 'Death_A_Pose'));
            if (deathPoseA) {
                deathPoseA.setLoop(THREE.LoopRepeat);
            }
            const deathPoseB = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, 'Death_B_Pose'));
            if (deathPoseB) {
                deathPoseB.setLoop(THREE.LoopRepeat);
            }

            let pickupClip = THREE.AnimationClip.findByName(clips, 'pickup') || THREE.AnimationClip.findByName(clips, 'Pickup') || THREE.AnimationClip.findByName(clips, 'PickUp');
            if (!pickupClip) {
                console.log('Pickup animation not found, attempting to use \'Hit_B\' as a fallback.');
                pickupClip = THREE.AnimationClip.findByName(clips, 'Hit_B');
            }

            let pickupAction = null;
            if (pickupClip) {
                pickupAction = window.globalState.mixer.clipAction(pickupClip);
                pickupAction.setLoop(THREE.LoopOnce);
                pickupAction.clampWhenFinished = true;
                const msg = `Usando animación para recoger: ${pickupClip.name}`;
                updateMapLoadingScreen(msg, undefined);
                console.log('Using animation as pickup:', pickupClip.name);
            } else {
                console.log('No suitable pickup or fallback animation found. Available animations:', clips.map(c => c.name));
            }

            window.globalState.character.animationActions = {
                idle: idleAction,
                running: runningAction,
                walking: walkingAction,
                sprint: sprintAction,
                jump_start: jumpStartAction,
                jump_idle: jumpIdleAction,
                jump_land: jumpLandAction,
                hits: [],
                deaths: [],
                deathPoses: {},
                attacks: [],
                block: blockAction,
                blockHit: blockHitAction
            };

            // Load combo animations
            const attackNames = [
                window.globalState.characterAnimationSettings.attack1 || '1H_Melee_Attack_Slice_Horizontal',
                window.globalState.characterAnimationSettings.attack2 || '1H_Melee_Attack_Chop',
                window.globalState.characterAnimationSettings.attack3 || '1H_Melee_Attack_Slice_Diagonal',
                window.globalState.characterAnimationSettings.attack4 || '1H_Melee_Attack_Stab'
            ];

            attackNames.forEach(name => {
                const clip = THREE.AnimationClip.findByName(clips, name);
                if (clip) {
                    const action = window.globalState.mixer.clipAction(clip);
                    action.setLoop(THREE.LoopOnce);
                    action.clampWhenFinished = true;
                    action.timeScale = 1.5;
                    window.globalState.character.animationActions.attacks.push(action);
                }
            });

            if (hitAction) window.globalState.character.animationActions.hits.push(hitAction);
            if (hitActionA) window.globalState.character.animationActions.hits.push(hitActionA);
            if (deathActionA) window.globalState.character.animationActions.deaths.push(deathActionA);
            if (deathActionB) window.globalState.character.animationActions.deaths.push(deathActionB);
            if (deathActionA && deathPoseA) window.globalState.character.animationActions.deathPoses[deathActionA.getClip().name] = deathPoseA;
            if (deathActionB && deathPoseB) window.globalState.character.animationActions.deathPoses[deathActionB.getClip().name] = deathPoseB;

            if (pickupAction) {
                window.globalState.character.animationActions.pickup = pickupAction;
            }
            window.globalState.character.activeAction = idleAction;
            idleAction.play();

            // Top-down camera: follow character from above
            window.globalState.camera.position.set(window.globalState.character.position.x, 20, window.globalState.character.position.z);
            window.globalState.camera.lookAt(window.globalState.character.position);

            updateMapLoadingScreen("Jugador cargado.", undefined);
            resolve();
        }, undefined, function(error) {
            console.error(error);
            reject(error);
        });
    });
};

window.setPlayerAnimation = function(newAction, fadeDuration = 0.2) {
    if (window.globalState.character.activeAction !== newAction) {
        window.globalState.character.activeAction.fadeOut(fadeDuration);
        newAction.reset().fadeIn(fadeDuration).play();
        window.globalState.character.activeAction = newAction;
    }
};