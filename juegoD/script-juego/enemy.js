// const { GLTFLoader } = THREE; // GLTFLoader is a global, not part of THREE
window.spawnSkeleton = function(position, onComplete = () => {}) {
    const loader = new THREE.GLTFLoader();
    loader.load('enemigo/Skeleton_Warrior.glb', function(gltf) {
        const newSkeleton = gltf.scene;
        newSkeleton.position.copy(position);
        newSkeleton.scale.set(3.4, 3.4, 3.4);

        newSkeleton.userData.state = 'idle';

        // --- START: Adjust initial skeleton height ---
        // Raycast downwards to find the ground and place it correctly.
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
        // --- END: Adjust initial skeleton height ---

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
}

window.globalState.spawnSkeleton = window.spawnSkeleton;

window.setSkeletonAnimation = function(index, newAction) {
    const skeleton = window.globalState.skeletons[index];
    if (newAction && skeleton && skeleton.activeAction !== newAction) {
        skeleton.activeAction.fadeOut(0.2);
        newAction.reset().fadeIn(0.2).play();
        skeleton.activeAction = newAction;
    }
}

window.globalState.setSkeletonAnimation = window.setSkeletonAnimation;