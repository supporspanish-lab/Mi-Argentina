// script-juego/gameLogic.js
const ATTACK_RANGE = window.ATTACK_RANGE;
const ATTACK_CONE_ANGLE = window.ATTACK_CONE_ANGLE;
const setSkeletonAnimation = window.setSkeletonAnimation;
const playSound = window.playSound;

// Function to drop health pickup
window.dropHealthPickup = function(position) {
    const mugGeometry = new THREE.BoxGeometry(1, 1, 1);
    const mugMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Verde
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
    console.log('Objeto de curación soltado en:', position);
}

// The attack function
window.attack = function(attackAngle) {
    // Si el personaje está sosteniendo una jarra, la guarda y saca la espada.
    if (window.globalState.character.userData.equippedMug) {
        const mugToUnequip = window.globalState.character.userData.equippedMug;

        // Quitar la jarra de la mano
        const rightHand = window.globalState.character.getObjectByName('hand_r');
        if (rightHand) {
            rightHand.remove(mugToUnequip);
        }

        // Devolver la jarra al inventario
        window.globalState.playerInventory.mugs.push(mugToUnequip);

        // Mostrar la espada de nuevo
        window.globalState.character.traverse(function(child) {
            if (child.isMesh && child.name === '1H_Sword') child.visible = true;
        });

        // Actualizar el estado y la UI
        window.globalState.character.userData.equippedMug = null;
        document.getElementById('attack-button').style.opacity = '1';
        document.getElementById('item-count').textContent = window.globalState.playerInventory.mugs.length;
        document.getElementById('item-button').style.display = 'flex';

        return; // No atacar en este clic, solo cambiar de equipo.
    }

    // Si no sostiene una jarra, ataca normally.
    if (window.globalState.characterState === 'idle' || window.globalState.characterState === 'running' || window.globalState.characterState === 'hit') {
        // --- INICIO: Lógica de Combo ---
        if (window.globalState.comboTimeout <= 0) { // Si el combo ha expirado, reiniciarlo
            window.globalState.comboCounter = -1; // Reiniciar a -1 para que el primer incremento sea 0
        }
        window.globalState.comboCounter = (window.globalState.comboCounter + 1) % window.globalState.character.animationActions.attacks.length;

        window.globalState.comboTimeout = COMBO_WINDOW; // Reiniciar la ventana de tiempo del combo
        // --- FIN: Lógica de Combo ---

        window.globalState.characterState = 'attacking';
        const attackAction = window.globalState.character.animationActions.attacks[window.globalState.comboCounter];
        window.globalState.setPlayerAnimation(attackAction, 0.1);

        // --- INICIO: Lógica de ataque direccional ---
        const attackDirection = new THREE.Vector3(Math.sin(attackAngle), 0, Math.cos(attackAngle));
        attackDirection.normalize();

        for (let i = 0; i < window.globalState.skeletons.length; i++) {
            if (window.globalState.skeletonHealths[i] > 0) {
                const enemyVector = new THREE.Vector3().subVectors(window.globalState.skeletons[i].position, window.globalState.character.position);
                const distance = enemyVector.length();
                enemyVector.normalize();

                const dotProduct = attackDirection.dot(enemyVector);
                const angleToEnemy = Math.acos(dotProduct);
                // Comprobar si el enemigo está dentro del rango y del cono de ataque
                if (distance < ATTACK_RANGE && angleToEnemy < ATTACK_CONE_ANGLE / 2) {
                    const healthBeforeHit = window.globalState.skeletonHealths[i];
                    window.globalState.skeletonHealths[i] -= 20;

                    // --- INICIO: Lógica para romper el casco ---
                    if (healthBeforeHit > 50 && window.globalState.skeletonHealths[i] <= 50) {
                        const helmet = window.globalState.skeletons[i].getObjectByName('Skeleton_Warrior_Helmet');
                        if (helmet) {
                                helmet.visible = false;
                        }
                        playSound('sonido/casco-roto-enemigo.mp3', 0.8);
                    }
                    // --- FIN: Lógica para romper el casco ---

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
                            window.globalState.playerMoney += 10;
                            setSkeletonAnimation(i, randomDeathAction);
                        }
                        dropHealthPickup(window.globalState.skeletons[i].position.clone());
                    }
                }
            }
        }
        // --- FIN: Lógica de ataque direccional ---
    }
};

// Horizontal collision logic
window.checkHorizontalCollision = function(currentPos, moveVector) {
    if (moveVector.lengthSq() === 0) return moveVector;

    const playerHeight = 1.6;
    const playerRadius = 0.4;
    const nextPos = currentPos.clone().add(moveVector);

    const playerBox = new THREE.Box3(
        new THREE.Vector3(nextPos.x - playerRadius, nextPos.y + 0.1, nextPos.z - playerRadius),
        new THREE.Vector3(nextPos.x + playerRadius, nextPos.y + playerHeight, nextPos.z + playerRadius)
    );

    for (let i = 0; i < window.globalState.collisionObjects.length; i++) {
        const object = window.globalState.collisionObjects[i];
        if (object.userData.isFloor === true || !object.geometry) {
            continue;
        }

        const objectBox = new THREE.Box3().setFromObject(object);
        if (playerBox.intersectsBox(objectBox)) {
            return new THREE.Vector3(0, 0, 0);
        }
    }
    return moveVector;
}
