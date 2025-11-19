// Enemy spawning and animation management

window.spawnSkeleton = function(position, onComplete = () => {}) {
    const loader = new THREE.GLTFLoader();
    loader.load('enemigo/Skeleton_Warrior.glb', function(gltf) {
        const newSkeleton = gltf.scene;
        newSkeleton.position.copy(position);
        newSkeleton.scale.set(1.7, 1.7, 1.7);

        newSkeleton.userData.state = 'idle';

        // Adjust initial skeleton height
        setTimeout(() => {
            const skeletonRayOrigin = new THREE.Vector3(newSkeleton.position.x, 50, newSkeleton.position.z);
            window.globalState.raycaster.set(skeletonRayOrigin, new THREE.Vector3(0, -1, 0));
            const intersects = window.globalState.raycaster.intersectObjects(window.globalState.collisionObjects, true);
            if (intersects.length > 0) {
                newSkeleton.position.y = intersects[0].point.y;
            } else {
                newSkeleton.position.y = 0; // If no ground, place at y=0
            }
            onComplete(); // Call callback after adjusting height
        }, 100); // Small delay to ensure map is ready

        window.globalState.scene.add(newSkeleton);

        newSkeleton.traverse(function(child) {
            if (child.isMesh && child.name === 'Skeleton_Cape') {
                child.visible = false;
            }
            if (child.isMesh && child.name === 'Skeleton_Warrior_Helmet') {
                child.visible = true; // Show helmet initially
            }
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        const newSkeletonMixer = new THREE.AnimationMixer(newSkeleton);
        const skeletonClips = gltf.animations;
        const idleClip = THREE.AnimationClip.findByName(skeletonClips, 'Idle');
        const runningClip = THREE.AnimationClip.findByName(skeletonClips, 'Running_A');
        const hitBClip = THREE.AnimationClip.findByName(skeletonClips, 'Hit_B');
        const hitAClip = THREE.AnimationClip.findByName(skeletonClips, 'Hit_A'); // Load Hit_A
        const attackClip = THREE.AnimationClip.findByName(skeletonClips, '1H_Melee_Attack_Slice_Horizontal');

        // Load death animations and poses
        const deathAClip = THREE.AnimationClip.findByName(skeletonClips, 'Death_A');
        const deathBClip = THREE.AnimationClip.findByName(skeletonClips, 'Death_B');
        const deathAPoseClip = THREE.AnimationClip.findByName(skeletonClips, 'Death_A_Pose');
        const deathBPoseClip = THREE.AnimationClip.findByName(skeletonClips, 'Death_B_Pose');

        newSkeleton.animationActions = { hits: [], deaths: [], deathPoses: {} };

        if (deathAClip) {
            const action = newSkeletonMixer.clipAction(deathAClip);
            action.setLoop(THREE.LoopOnce); action.clampWhenFinished = true;
            newSkeleton.animationActions.deaths.push(action);
            if (deathAPoseClip) newSkeleton.animationActions.deathPoses[deathAClip.name] = newSkeletonMixer.clipAction(deathAPoseClip);
        }
        if (deathBClip) {
            const action = newSkeletonMixer.clipAction(deathBClip);
            action.setLoop(THREE.LoopOnce); action.clampWhenFinished = true;
            newSkeleton.animationActions.deaths.push(action);
            if (deathBPoseClip) newSkeleton.animationActions.deathPoses[deathBClip.name] = newSkeletonMixer.clipAction(deathBPoseClip);
        }

        if (idleClip) {
            newSkeleton.animationActions.idle = newSkeletonMixer.clipAction(idleClip);
        }
        if (runningClip) {
            newSkeleton.animationActions.running = newSkeletonMixer.clipAction(runningClip);
        }
        if (hitBClip) {
            const hitBAction = newSkeletonMixer.clipAction(hitBClip);
            hitBAction.setLoop(THREE.LoopOnce);
            hitBAction.clampWhenFinished = true;
            newSkeleton.animationActions.hits.push(hitBAction);
        }
        if (hitAClip) {
            const hitAAction = newSkeletonMixer.clipAction(hitAClip);
            hitAAction.setLoop(THREE.LoopOnce);
            hitAAction.clampWhenFinished = true;
            newSkeleton.animationActions.hits.push(hitAAction);
        }
        if (attackClip) {
            newSkeleton.animationActions.attack = newSkeletonMixer.clipAction(attackClip);
            newSkeleton.animationActions.attack.setLoop(THREE.LoopOnce);
            newSkeleton.animationActions.attack.clampWhenFinished = true;
        }
        if (newSkeleton.animationActions.idle) {
            newSkeleton.activeAction = newSkeleton.animationActions.idle;
            newSkeleton.activeAction.play();
        }

        window.globalState.skeletons.push(newSkeleton);
        window.globalState.skeletonBodies.push(null); // No physics body
        window.globalState.skeletonMixers.push(newSkeletonMixer);
        window.globalState.skeletonHealths.push(100);
        window.globalState.attackCooldowns.push(0);

    }, undefined, function(error) {
        console.error(error);
        onComplete(); // Ensure callback is called even if there's an error
    });
};

window.spawnBoss1 = function(position) {
    const loader = new THREE.GLTFLoader();
    loader.load('enemigo/boss1.glb', function(gltf) {
        const newBoss = gltf.scene;
        newBoss.position.copy(position);
        newBoss.scale.set(5.1, 5.1, 5.1); // 3 times larger

        newBoss.userData.state = 'idle';
        newBoss.userData.damageApplied = false;
        newBoss.userData.isBoss = true; // Marcar a esta entidad como un jefe
        newBoss.userData.isBlocking = false;
        newBoss.userData.blockEndTime = 0;
        newBoss.userData.playOptimalBlockReaction = false; // Bandera para la animación de contraataque
        // --- INICIO: Lógica de Furia Múltiple ---
        newBoss.userData.furyCount = 0; // Contador de furias usadas
        newBoss.userData.maxFuryCount = Math.floor(Math.random() * 3) + 3; // Aleatorio entre 3 y 5 furias
        // --- FIN: Lógica de Furia Múltiple ---

        // Adjust initial boss height
        setTimeout(() => {
            const bossRayOrigin = new THREE.Vector3(newBoss.position.x, 50, newBoss.position.z);
            window.globalState.raycaster.set(bossRayOrigin, new THREE.Vector3(0, -1, 0));
            const intersects = window.globalState.raycaster.intersectObjects(window.globalState.collisionObjects, true);
            if (intersects.length > 0) {
                newBoss.position.y = intersects[0].point.y;
            } else {
                newBoss.position.y = 0; // If no ground, place at y=0
            }
        }, 100); // Small delay to ensure map is ready

        window.globalState.scene.add(newBoss);

        newBoss.traverse(function(child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                // --- INICIO: Hacer que el jefe ignore la iluminación de la escena ---
                // Al hacer el material emisivo, el jefe se iluminará a sí mismo.
                if (child.material && child.material.isMeshStandardMaterial) {
                    child.material.emissive = child.material.color.clone(); // Emite su propio color base
                    child.material.emissiveMap = child.material.map; // Usa su propia textura para la emisión
                    child.material.emissiveIntensity = 1.0; // Intensidad de la luz propia
                    child.receiveShadow = false; // Un objeto que emite luz no debería recibir sombras
                }
                // --- FIN: Hacer que el jefe ignore la iluminación de la escena ---
            }
        });

        const newBossMixer = new THREE.AnimationMixer(newBoss);
        const bossClips = gltf.animations;
        // Assume similar animations as skeleton
        const idleClip = THREE.AnimationClip.findByName(bossClips, 'Troll_Idle') || THREE.AnimationClip.findByName(bossClips, 'Idle');
        const runningClip = THREE.AnimationClip.findByName(bossClips, 'Troll_WalkForward') || THREE.AnimationClip.findByName(bossClips, 'Running_A');
        const sprintClip = THREE.AnimationClip.findByName(bossClips, 'Troll_RunForward'); // Animación de carrera rápida
        const blockClip = THREE.AnimationClip.findByName(bossClips, 'Troll_Block');
        const blockReactionClip = THREE.AnimationClip.findByName(bossClips, 'Troll_BlockReaction');
        const blockReactionOptimalClip = THREE.AnimationClip.findByName(bossClips, 'Troll_BlockReaction_Optimal'); // Nueva animación
        const furyClip = THREE.AnimationClip.findByName(bossClips, 'Troll_RecklessFury'); // Animación de furia
        
        // --- INICIO: Cargar múltiples animaciones de ataque ---
        const attackNames = [
            'Troll_AttackBackHand_Damage',
            'Troll_AttackForeHand_Damage',
            'Troll_AttackMovingLeft',
            'Troll_AttackMovingRight'
        ];

        newBoss.animationActions = { hits: [], attacks: [], deaths: [], deathPoses: {} };

        attackNames.forEach(name => {
            const clip = THREE.AnimationClip.findByName(bossClips, name);
            if (clip) {
                const action = newBossMixer.clipAction(clip);
                action.setLoop(THREE.LoopOnce);
                action.clampWhenFinished = true;
                newBoss.animationActions.attacks.push(action);
            }
        });
        // --- FIN: Cargar múltiples animaciones de ataque ---
        
        if (idleClip) {
            newBoss.animationActions.idle = newBossMixer.clipAction(idleClip);
        }
        if (runningClip) {
            newBoss.animationActions.running = newBossMixer.clipAction(runningClip);
        }
        if (sprintClip) {
            newBoss.animationActions.sprint = newBossMixer.clipAction(sprintClip);
        }
        if (blockClip) {
            newBoss.animationActions.block = newBossMixer.clipAction(blockClip);
            newBoss.animationActions.block.setLoop(THREE.LoopRepeat);
        }
        if (blockReactionClip) {
            newBoss.animationActions.blockReaction = newBossMixer.clipAction(blockReactionClip);
            newBoss.animationActions.blockReaction.setLoop(THREE.LoopOnce);
            newBoss.animationActions.blockReaction.clampWhenFinished = true;
            // Asignar también como una animación de 'hit' para que la lógica de `gameLoop` la gestione
            newBoss.animationActions.hits.push(newBoss.animationActions.blockReaction);
        }
        if (blockReactionOptimalClip) {
            newBoss.animationActions.blockReactionOptimal = newBossMixer.clipAction(blockReactionOptimalClip);
            newBoss.animationActions.blockReactionOptimal.setLoop(THREE.LoopOnce);
            newBoss.animationActions.blockReactionOptimal.clampWhenFinished = true;
            newBoss.animationActions.hits.push(newBoss.animationActions.blockReactionOptimal); // Añadir a 'hits' para que gameLoop lo gestione
        }
        if (furyClip) {
            newBoss.animationActions.fury = newBossMixer.clipAction(furyClip);
            newBoss.animationActions.fury.setLoop(THREE.LoopOnce);
            newBoss.animationActions.fury.clampWhenFinished = true;
            newBoss.animationActions.hits.push(newBoss.animationActions.fury); // Añadir a 'hits' para que gameLoop lo gestione
        }

        // --- INICIO: Cargar múltiples animaciones de reacción (hit) ---
        const hitAnimationNames = [
            'Troll_RecoilRight', 'Troll_RecoilLeft', 'Troll_StaggerBack',
            'Troll_StaggerRight', 'Troll_StaggerLeft', 'Hit_A', 'Hit_B'
        ];

        hitAnimationNames.forEach(name => {
            const clip = THREE.AnimationClip.findByName(bossClips, name);
            if (clip) {
                const action = newBossMixer.clipAction(clip);
                action.setLoop(THREE.LoopOnce);
                action.clampWhenFinished = true;
                newBoss.animationActions.hits.push(action);
            }
        });
        // --- FIN: Cargar múltiples animaciones de reacción (hit) ---
        
        // --- INICIO: Cargar animación de muerte del jefe ---
        const deathClip = THREE.AnimationClip.findByName(bossClips, 'Troll_DeathRight');
        if (deathClip) {
            const deathAction = newBossMixer.clipAction(deathClip);
            deathAction.setLoop(THREE.LoopOnce);
            deathAction.clampWhenFinished = true;
            newBoss.animationActions.deathAnimation = deathAction; // Guardar la animación específica
        }
        // --- FIN: Cargar animación de muerte del jefe ---
        
        if (newBoss.animationActions.idle) {
            newBoss.activeAction = newBoss.animationActions.idle;
            newBoss.activeAction.play();
        }

        window.globalState.skeletons.push(newBoss); // Reuse skeletons array for bosses
        window.globalState.skeletonBodies.push(null);
        window.globalState.skeletonMixers.push(newBossMixer);
        window.globalState.skeletonHealths.push(200); // Higher health for boss
        window.globalState.attackCooldowns.push(0);

    }, undefined, function(error) {
        console.error(error);
    });
};

window.setSkeletonAnimation = function(index, newAction) {
    const skeleton = window.globalState.skeletons[index];
    if (newAction && skeleton && skeleton.activeAction !== newAction) {
        if (skeleton.activeAction) {
            skeleton.activeAction.fadeOut(0.2);
        }
        newAction.reset().fadeIn(0.2).play();
        skeleton.activeAction = newAction;
    }
};