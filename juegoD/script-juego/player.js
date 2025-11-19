

window.loadMap = async function(mapUrl) {
    try {
        const response = await fetch(mapUrl);
        if (!response.ok) {
            throw new Error(`No se pudo cargar el mapa: ${response.statusText}`);
        }
        const mapData = await response.json();
        await buildSceneFromMapData(mapData);
    } catch (error) {
        console.error("Error al cargar el mapa:", error);
        loadDefaultFloor();
    }
}

window.loadDefaultFloor = function() {
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    window.globalState.scene.add(floor);
    window.globalState.collisionObjects.push(floor);
}

window.buildSceneFromMapData = async function(data) {
    const assetsByPath = {};
    if (data.assets) {
        data.assets.forEach(asset => {
            if (!assetsByPath[asset.assetPath]) {
                assetsByPath[asset.assetPath] = [];
            }
            assetsByPath[asset.assetPath].push(asset);
        });
    }

    if (data.gridSize) {
        const mapSize = data.gridSize * 10; // Assuming cellSize = 10
        window.globalState.mapBounds = { minX: -mapSize / 2, maxX: mapSize / 2, minZ: -mapSize / 2, maxZ: mapSize / 2 };
    }

    const loader = new THREE.GLTFLoader();

    for (const path of Object.keys(assetsByPath)) {
        if (!path || path === 'undefined') {
            console.warn(`Skipping asset loading with invalid path: '${path}'. Make sure all assets in your map have an 'assetPath' defined.`);
            continue;
        }
        try {
            const gltf = await loader.loadAsync(path);
            const assetsToPlace = assetsByPath[path];

            assetsToPlace.forEach(assetInfo => {
                const originalObject = gltf.scene.getObjectByName(assetInfo.assetName);
                if (originalObject) {
                    window.findAndSetBarricadeModel(assetInfo, originalObject);

                    const newObject = originalObject.clone();
                    newObject.position.set(assetInfo.position.x, assetInfo.position.y, assetInfo.position.z);
                    newObject.rotation.set(assetInfo.rotation.x, assetInfo.rotation.y, assetInfo.rotation.z);
                    newObject.scale.set(assetInfo.scale.x, assetInfo.scale.y, assetInfo.scale.z);
                    newObject.userData.assetInfo = assetInfo; // Store original asset info

                    newObject.traverse(child => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });

                    window.globalState.mapAssets.push(newObject);

                    if (assetInfo.assetType === 'piso') {
                        // Floors are always collidable and not dynamically removed by culling
                        window.globalState.collisionObjects.push(newObject);
                        window.globalState.cullableAssets.push({
                            object: newObject,
                            position: new THREE.Vector3(assetInfo.position.x, assetInfo.position.y, assetInfo.position.z),
                            isCollision: false
                        });
                    } else {
                        window.globalState.cullableAssets.push({
                            object: newObject,
                            position: new THREE.Vector3(assetInfo.position.x, assetInfo.position.y, assetInfo.position.z),
                            isCollision: (assetInfo.assetType === 'no-piso' || assetInfo.assetType === 'barricada')
                        });
                        // For non-floor objects that are collidable, add them to the main collision array initially.
                        if (assetInfo.assetType === 'no-piso' || assetInfo.assetType === 'barricada') {
                            window.globalState.collisionObjects.push(newObject);
                        }

                        // --- INICIO: Asignar propiedades de barricada al cargar desde el mapa ---
                        if (assetInfo.assetType === 'barricada') {
                            newObject.userData.isBarricade = true;
                            newObject.userData.health = window.BARRICADE_MAX_HEALTH || 500; // Asignar vida inicial
                            console.log('Barricada del mapa inicializada:', newObject);
                        }
                    }
                    if (assetInfo.assetType === 'piso') newObject.userData.isFloor = true;

                    // Load animations for barricades and Object_2
                    window.loadBarricadeAnimations(assetInfo, newObject, gltf);

                    if (assetInfo.assetName === 'Object_2') {
                        window.globalState.object2Target = newObject;
                        console.log("Punto de control (tienda) asignado.");
                    }
                }
            });
        } catch (error) {
            console.error(`Error loading asset pack ${path}:`, error);
        }
    }

    // After placing all objects from all GLTFs, apply barricade properties to the clones
    window.initBarricadePlacement();

    if (data.playerSpawn) {
        window.globalState.playerSpawnPoint = {
            x: data.playerSpawn.x,
            y: data.playerSpawn.y,
            z: data.playerSpawn.z,
            animationSettings: data.playerSpawn.animationSettings || {},
            objectVisibility: data.playerSpawn.objectVisibility || {}
        };
    }

    if (data.enemySpawns) {
        data.enemySpawns.forEach(spawn => window.spawnSkeleton(new THREE.Vector3(spawn.x, spawn.y, spawn.z)));
    }
}


window.loadPlayer = function() {
    const loader = new THREE.GLTFLoader();
    loader.load('players/Knight.glb', function(gltf) {
        window.globalState.character = gltf.scene;
        window.globalState.character.position.set(0, 0, 0);
        window.globalState.character.scale.set(3.4, 3.4, 3.4);
        window.globalState.scene.add(window.globalState.character);
        
        // --- START: Adjust initial character height ---
        const checkSpawnPoint = setInterval(() => {
            if (window.globalState.playerSpawnPoint) {
                window.globalState.playerAnimationSettings = window.globalState.playerSpawnPoint.animationSettings || {};
                window.globalState.playerObjectVisibility = window.globalState.playerSpawnPoint.objectVisibility || {};
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
        }, 100);
        // --- END: Adjust initial character height ---

        window.globalState.character.userData.holdingMug = false;

        // Enable shadows for player
        window.globalState.character.traverse(function(child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // --- START: Apply object visibility from map ---
        window.globalState.character.traverse(function(child) {
            if (child.isMesh) {
                if (window.globalState.playerObjectVisibility[child.name] !== undefined) {
                    child.visible = window.globalState.playerObjectVisibility[child.name];
                } else {
                    const defaultHidden = ['1H_Sword_Offhand', '2H_Sword', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', 'Knight_Cape', 'Knight_Helmet', 'Mug'];
                    if (defaultHidden.includes(child.name)) {
                        child.visible = false;
                    }
                    child.visible = !defaultHidden.includes(child.name);
                }
            }
        });
        // --- END: Apply object visibility from map ---

        // Animations
        window.globalState.mixer = new THREE.AnimationMixer(window.globalState.character);
        const clips = gltf.animations;
        const idleAction = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, window.globalState.playerAnimationSettings.idle || 'Idle'));
        const runningAction = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, window.globalState.playerAnimationSettings.running || 'Running_A'));
        const jumpStartAction = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, 'Jump_Start'));
        jumpStartAction.setLoop(THREE.LoopOnce);
        jumpStartAction.clampWhenFinished = true;
        const jumpIdleAction = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, 'Jump_Idle'));
        const jumpLandAction = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, 'Jump_Land'));
        jumpLandAction.setLoop(THREE.LoopOnce);
        jumpLandAction.clampWhenFinished = true;
        const hitAction = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, window.globalState.playerAnimationSettings.hit2 || 'Hit_B'));
        hitAction.setLoop(THREE.LoopOnce);
        hitAction.clampWhenFinished = true;
        
        const hitActionA = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, window.globalState.playerAnimationSettings.hit1 || 'Hit_A'));
        if (hitActionA) {
            hitActionA.setLoop(THREE.LoopOnce);
            hitActionA.clampWhenFinished = true;
        }

        const deathActionA = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, window.globalState.playerAnimationSettings.death1 || 'Death_A'));
        if (deathActionA) {
            deathActionA.setLoop(THREE.LoopOnce);
            deathActionA.clampWhenFinished = true;
        }
        const deathActionB = window.globalState.mixer.clipAction(THREE.AnimationClip.findByName(clips, window.globalState.playerAnimationSettings.death2 || 'Death_B'));
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
            console.log('Using animation as pickup:', pickupClip.name);
        } else {
            console.log('No suitable pickup or fallback animation found. Available animations:', clips.map(c => c.name));
        }

        window.globalState.character.animationActions = {
            idle: idleAction,
            running: runningAction,
            jump_start: jumpStartAction,
            jump_idle: jumpIdleAction,
            jump_land: jumpLandAction,
            hits: [],
            deaths: [],
            deathPoses: {},
            attacks: []
        };

        // --- START: Load combo animations ---
        const attackNames = [
            window.globalState.playerAnimationSettings.attack1 || '1H_Melee_Attack_Slice_Horizontal',
            window.globalState.playerAnimationSettings.attack2 || '1H_Melee_Attack_Chop',
            window.globalState.playerAnimationSettings.attack3 || '1H_Melee_Attack_Slice_Diagonal',
            window.globalState.playerAnimationSettings.attack4 || '1H_Melee_Attack_Stab'
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
        // --- END: Load combo animations ---

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

    }, undefined, function(error) {
        console.error(error);
    });
}

window.setPlayerAnimation = function(newAction, fadeDuration = 0.2) {
    if (window.globalState.character.activeAction !== newAction) {
        window.globalState.character.activeAction.fadeOut(fadeDuration);
        newAction.reset().fadeIn(fadeDuration).play();
        window.globalState.character.activeAction = newAction;
    }
}

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
        // --- START: Combo Logic ---
        if (window.globalState.comboTimeout <= 0) {
            window.globalState.comboCounter = -1;
        }
        window.globalState.comboCounter = (window.globalState.comboCounter + 1) % window.globalState.character.animationActions.attacks.length;

        window.globalState.comboTimeout = window.COMBO_WINDOW;
        // --- END: Combo Logic ---

        window.globalState.characterState = 'attacking';
        const attackAction = window.globalState.character.animationActions.attacks[window.globalState.comboCounter];
        setPlayerAnimation(attackAction, 0.1);

        // --- START: Directional attack logic ---
        const attackDirection = new THREE.Vector3(Math.sin(attackAngle), 0, Math.cos(attackAngle));
        attackDirection.normalize();

        for (let i = 0; i < window.globalState.skeletons.length; i++) {
            if (window.globalState.skeletonHealths[i] > 0) {
                const enemyVector = new THREE.Vector3().subVectors(window.globalState.skeletons[i].position, window.globalState.character.position);
                const distance = enemyVector.length();
                enemyVector.normalize();

                const dotProduct = attackDirection.dot(enemyVector);
                const angleToEnemy = Math.acos(dotProduct);
                
                if (distance < window.ATTACK_RANGE && angleToEnemy < window.ATTACK_CONE_ANGLE / 2) {
                    const healthBeforeHit = window.globalState.skeletonHealths[i];
                    window.globalState.skeletonHealths[i] -= window.ENEMY_ATTACK_DAMAGE;

                    // --- START: Helmet breaking logic ---
                    if (healthBeforeHit > 50 && window.globalState.skeletonHealths[i] <= 50) {
                        const helmet = window.globalState.skeletons[i].getObjectByName('Skeleton_Warrior_Helmet');
                        if (helmet) {
                                helmet.visible = false;
                        }
                        window.globalState.playSound('sonido/casco-roto-enemigo.mp3', 0.8);
                    }
                    // --- END: Helmet breaking logic ---

                    if (window.globalState.skeletons[i].animationActions.hits.length > 0 && window.globalState.skeletonMixers[i]) {
                        const randomHitAction = window.globalState.skeletons[i].animationActions.hits[Math.floor(Math.random() * window.globalState.skeletons[i].animationActions.hits.length)];
                        setSkeletonAnimation(i, randomHitAction);
                        window.globalState.skeletons[i].userData.state = 'hit';
                    }
                    if (window.globalState.skeletonHealths[i] <= 0 && window.globalState.skeletons[i].userData.state !== 'dead') {
                        window.globalState.skeletons[i].userData.state = 'dead';
                        if (window.globalState.skeletons[i].animationActions.deaths.length > 0 && window.globalState.skeletonMixers[i]) {
                            const randomDeathAction = window.globalState.skeletons[i].animationActions.deaths[Math.floor(Math.random() * window.globalState.skeletons[i].animationActions.deaths.length)];
                            window.globalState.skeletons[i].activeAction.fadeOut(0.2);
                            window.globalState.playerMoney += window.MONEY_PER_KILL;
                            setSkeletonAnimation(i, randomDeathAction);
                        }
                        dropHealthPickup(window.globalState.skeletons[i].position.clone());
                    }
                }
            }
        }
        // --- END: Directional attack logic ---
    }
}

window.dropHealthPickup = function(position) {
    const mugGeometry = new THREE.BoxGeometry(1, 1, 1);
    const mugMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const healthPickup = new THREE.Mesh(mugGeometry, mugMaterial);

    const dropRayOrigin = new THREE.Vector3(position.x, 50, position.z);
    window.globalState.raycaster.set(dropRayOrigin, new THREE.Vector3(0, -1, 0));
    const intersects = window.globalState.raycaster.intersectObjects(window.globalState.collisionObjects, true);

    if (intersects.length > 0) {
        position.y = intersects[0].point.y;
    } else {
        position.y = 5.00;
    }

    healthPickup.position.copy(position);
    healthPickup.position.y += 1.5;
    healthPickup.scale.set(0.5, 0.5, 0.5);
    window.globalState.scene.add(healthPickup);
    window.globalState.mugDrops.push({ mesh: healthPickup, collected: false });
    console.log('Health pickup dropped at:', position);
};