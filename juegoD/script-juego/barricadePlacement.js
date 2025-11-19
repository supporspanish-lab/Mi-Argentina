// Barricade Placement Module
// Consolidates all barricade-related functionality

// Initialization functions
window.initBarricadePlacement = function() {
    // Initialize barricade model from map assets
    window.globalState.mapAssets.forEach(asset => {
        if (asset.userData.assetInfo && asset.userData.assetInfo.assetType === 'barricada') {
            asset.userData.isBarricade = true;
            asset.userData.health = window.BARRICADE_HEALTH || 100;
        }
    });
};

window.findAndSetBarricadeModel = function(assetInfo, originalObject) {
    if (assetInfo.assetName === 'wooden_box_light_brown_0') {
        if (!window.globalState.barricadeModel) {
            window.globalState.barricadeModel = originalObject.clone();
            window.globalState.barricadeModel.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
            console.log("Barricade model set from map.");
        }
        if (!window.globalState.barricadeScale) {
            window.globalState.barricadeScale = new THREE.Vector3(assetInfo.scale.x, assetInfo.scale.y, assetInfo.scale.z);
        }
        if (!window.globalState.barricadeY) {
            window.globalState.barricadeY = assetInfo.position.y;
        }
    }
};

window.loadBarricadeAnimations = function(assetInfo, newObject, gltf) {
    if (assetInfo.assetType === 'barricada' || assetInfo.assetName === 'Object_2') {
        const mixer = new THREE.AnimationMixer(newObject);
        const clips = gltf.animations;
        const hitClip = THREE.AnimationClip.findByName(clips, 'hit') || THREE.AnimationClip.findByName(clips, 'Hit');
        const destroyClip = THREE.AnimationClip.findByName(clips, 'destroy') || THREE.AnimationClip.findByName(clips, 'Destroy');

        newObject.animationActions = {};
        if (hitClip) {
            const hitAction = mixer.clipAction(hitClip);
            hitAction.setLoop(THREE.LoopOnce);
            hitAction.clampWhenFinished = true;
            newObject.animationActions.hit = hitAction;
        }
        if (destroyClip) {
            const destroyAction = mixer.clipAction(destroyClip);
            destroyAction.setLoop(THREE.LoopOnce);
            destroyAction.clampWhenFinished = true;
            newObject.animationActions.destroy = destroyAction;
        }
        newObject.mixer = mixer;
        newObject.activeAction = null;
        // Añadir el mixer a la lista de actualización, sin importar si es barricada u Object_2
        if (mixer) {
            window.globalState.barricadeMixers.push(mixer);
        }
    }
};

// UI functions
window.initBarricadeUI = function() {
    // Initialize shop UI elements for barricades
    window.globalState.barricadeButton = document.getElementById('barricade-button');
    window.globalState.barricadeCount = document.getElementById('barricade-count');

    // Load barricade model if not set
    if (!window.globalState.barricadeModel) {
        const loader = new THREE.GLTFLoader();
        loader.load('glb/free_modular_low_poly_dungeon_pack.glb', function(gltf) {
            const woodenBox = gltf.scene.getObjectByName('wooden_box_light_brown_0');
            if (woodenBox) {
                window.globalState.barricadeModel = woodenBox.clone();
                window.globalState.barricadeModel.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
                window.globalState.barricadeScale = new THREE.Vector3(5, 5, 5);
                window.globalState.barricadeY = 0;
                console.log("Barricade model loaded from GLB.");
            }
        });
    }

    // Shop buy button for barricades
    const buyButtons = document.querySelectorAll('.buy-button');
    buyButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const item = e.target.getAttribute('data-item');
            if (item === 'barricade' && window.globalState.playerMoney >= 50) {
                window.globalState.playerMoney -= 50;
                window.globalState.playerInventory.barricades += 1;
                window.updateBarricadeUI();
                window.updateMoneyUI();
            }
        });
    });

    // Barricade placement button
    window.globalState.barricadeButton.addEventListener('click', () => {
        if (window.globalState.playerInventory.barricades > 0) {
            window.globalState.barricadePlacementMode = !window.globalState.barricadePlacementMode;
            if (window.globalState.barricadePlacementMode) {
                window.globalState.previewPosition = null; // Reset position
                if (!window.globalState.placementPreviewMesh && window.globalState.barricadeModel) {
                    window.globalState.placementPreviewMesh = window.globalState.barricadeModel.clone();
                    if (window.globalState.barricadeScale) {
                        window.globalState.placementPreviewMesh.scale.copy(window.globalState.barricadeScale);
                    }
                    window.globalState.placementPreviewMesh.traverse(child => {
                        if (child.isMesh) {
                            child.material = child.material.clone();
                            child.material.transparent = true;
                            child.material.opacity = 0.8;
                        }
                    });
                    window.globalState.scene.add(window.globalState.placementPreviewMesh);
                }
            } else {
                if (window.globalState.placementPreviewMesh) {
                    window.globalState.scene.remove(window.globalState.placementPreviewMesh);
                    window.globalState.placementPreviewMesh = null;
                }
                window.globalState.previewPosition = null;
            }
        }
    });
};

window.updateBarricadeUI = function() {
    if (window.globalState.barricadeButton && window.globalState.barricadeCount) {
        if (window.globalState.playerInventory.barricades > 0) {
            window.globalState.barricadeButton.style.display = 'flex';
            window.globalState.barricadeCount.textContent = window.globalState.playerInventory.barricades;
        } else {
            window.globalState.barricadeButton.style.display = 'none';
        }
    }
};

// Placement functions
window.placeBarricade = function(placementPosition) {
    // --- INICIO: Validar posición antes de colocar ---
    if (!isPlacementValid(placementPosition)) {
        console.log("Posición de barricada inválida.");
        return; // No colocar la barricada
    }
    // --- FIN: Validar posición ---
    const newBarricade = window.globalState.barricadeModel.clone();
    newBarricade.position.copy(placementPosition);
    if (window.globalState.barricadeScale) {
        newBarricade.scale.copy(window.globalState.barricadeScale);
    }
    newBarricade.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            // Initialize barricade properties
            newBarricade.userData.isBarricade = true;
            newBarricade.userData.health = window.BARRICADE_HEALTH || 100;
            newBarricade.userData.isPlayerPlaced = true; // Marcar como colocada por el jugador
        }
    });
    window.globalState.scene.add(newBarricade);
    window.globalState.collisionObjects.push(newBarricade);
    window.globalState.playerInventory.barricades -= 1;
    window.updateBarricadeUI();
    window.globalState.barricadePlacementMode = false;
    window.globalState.scene.remove(window.globalState.placementPreviewMesh);
    window.globalState.placementPreviewMesh = null;
    window.globalState.previewPosition = null;
};

// Preview functions
function isPlacementValid(position) {
    if (!window.globalState.barricadeModel) return false;

    // Usar el tamaño del preview mesh para una detección más precisa
    const previewBox = new THREE.Box3().setFromObject(window.globalState.placementPreviewMesh);

    // Comprobar contra otros objetos de colisión
    for (const object of window.globalState.collisionObjects) {
        // Ignorar el suelo y el propio preview mesh
        if (object.userData.isFloor || object === window.globalState.placementPreviewMesh) {
            continue;
        }

        // No comprobar contra barricadas que ya están destruidas
        if (object.userData.isBarricade && object.userData.health <= 0) {
            continue;
        }

        const objectBox = new THREE.Box3().setFromObject(object);
        if (previewBox.intersectsBox(objectBox)) {
            return false; // Colisión detectada
        }
    }

    // Comprobar si está fuera de los límites del mapa
    const bounds = window.globalState.mapBounds;
    if (position.x < bounds.minX || position.x > bounds.maxX || position.z < bounds.minZ || position.z > bounds.maxZ) {
        return false;
    }

    return true; // Posición válida
}
function updatePreviewPosition(x, y) {
    const rect = window.globalState.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
        ((x - rect.left) / rect.width) * 2 - 1,
        -((y - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, window.globalState.camera);
    const intersects = raycaster.intersectObjects(window.globalState.collisionObjects, true);
    if (intersects.length > 0) {
        const pos = intersects[0].point.clone();

        // Calculate stacking height
        let highestY = pos.y;
        const objectsToCheck = window.globalState.collisionObjects;
        const tolerance = 10; // cellSize
        for (const child of objectsToCheck) {
            if (Math.abs(child.position.x - pos.x) < tolerance && Math.abs(child.position.z - pos.z) < tolerance) {
                const box = new THREE.Box3().setFromObject(child);
                const topOfObject = box.max.y;
                if (topOfObject > highestY) {
                    highestY = topOfObject;
                }
            }
        }

        // Calculate yOffset for the preview
        const tempBox = new THREE.Box3().setFromObject(window.globalState.placementPreviewMesh);
        const yOffset = -tempBox.min.y;
        pos.y = highestY + yOffset;

        window.globalState.placementPreviewMesh.position.copy(pos);
        window.globalState.placementPreviewMesh.rotation.x = -Math.PI / 2; // Match placement rotation
        window.globalState.previewPosition = pos;
    }
}

window.initBarricadeEvents = function() {
    // Keyboard event for placing barricade
    document.addEventListener('keydown', (event) => {
        if (event.code === 'KeyB' && window.globalState.barricadePlacementMode && window.globalState.placementPreviewMesh && window.globalState.playerInventory.barricades > 0 && window.globalState.barricadeModel) {
            const placementPosition = window.globalState.placementPreviewMesh.position.clone();
            window.placeBarricade(placementPosition);
        }
    });

    // Mouse events for preview dragging
    document.addEventListener('mousedown', (e) => {
        if (window.globalState.barricadePlacementMode && window.globalState.placementPreviewMesh) {
            window.globalState.isDraggingPreview = true;
            window.globalState.previewPosition = window.globalState.placementPreviewMesh.position.clone();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (window.globalState.isDraggingPreview) {
            updatePreviewPosition(e.clientX, e.clientY);
        }
    });

    document.addEventListener('mouseup', () => {
        window.globalState.isDraggingPreview = false;
    });

    // Touch events for preview dragging
    document.addEventListener('touchstart', (e) => {
        if (window.globalState.barricadePlacementMode && window.globalState.placementPreviewMesh) {
            window.globalState.isDraggingPreview = true;
            window.globalState.previewPosition = window.globalState.placementPreviewMesh.position.clone();
        }
    });

    document.addEventListener('touchmove', (e) => {
        if (window.globalState.isDraggingPreview) {
            const touch = e.touches[0];
            updatePreviewPosition(touch.clientX, touch.clientY);
        }
    });

    document.addEventListener('touchend', () => {
        window.globalState.isDraggingPreview = false;
    });
};

window.handleBarricadePlacementInAttack = function() {
    // This is called from ui.js in the attack manager end event
    if (window.globalState.barricadePlacementMode && window.globalState.placementPreviewMesh && window.globalState.playerInventory.barricades > 0 && window.globalState.barricadeModel) {
        const placementPosition = new THREE.Vector3();
        if (window.globalState.previewPosition) {
            placementPosition.copy(window.globalState.previewPosition);
        } else {
            const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(window.globalState.character.quaternion);
            placementPosition.copy(window.globalState.character.position).add(direction.multiplyScalar(5));
            placementPosition.y = window.globalState.barricadeY || 0;
        }
        window.placeBarricade(placementPosition);
    }
};

window.handleBarricadePlacementInMouseUp = function() {
    // This is called from ui.js in the mouseup event
    if (window.globalState.barricadePlacementMode && window.globalState.placementPreviewMesh && window.globalState.playerInventory.barricades > 0 && window.globalState.barricadeModel) {
        const placementPosition = new THREE.Vector3();
        if (window.globalState.previewPosition) {
            placementPosition.copy(window.globalState.previewPosition);
        } else {
            const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(window.globalState.character.quaternion);
            placementPosition.copy(window.globalState.character.position).add(direction.multiplyScalar(5));
            placementPosition.y = window.globalState.barricadeY || 0;
        }
        window.placeBarricade(placementPosition);
    }
};

// Update functions
window.updateBarricadePreview = function() {
    if (window.globalState.barricadePlacementMode && window.globalState.placementPreviewMesh) {
        let finalPos;
        if (window.globalState.previewPosition) {
            finalPos = window.globalState.previewPosition.clone();
        } else if (!window.globalState.isDraggingPreview) {
            const direction = new THREE.Vector3(0, 0, -1);
            direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), window.globalState.character.rotation.y);
            const previewPos = window.globalState.character.position.clone().add(direction.multiplyScalar(5));
            const raycaster = new THREE.Raycaster(previewPos.clone().add(new THREE.Vector3(0, 10, 0)), new THREE.Vector3(0, -1, 0));
            const intersects = raycaster.intersectObjects(window.globalState.collisionObjects, true);
            if (intersects.length > 0) {
                finalPos = intersects[0].point.clone();
            } else {
                finalPos = previewPos.clone();
            }
        } else {
            return; // If dragging, position is updated in mousemove
        }

        // Calculate stacking height
        let highestY = finalPos.y;
        const objectsToCheck = window.globalState.collisionObjects;
        const tolerance = 10; // cellSize
        for (const child of objectsToCheck) {
            if (Math.abs(child.position.x - finalPos.x) < tolerance && Math.abs(child.position.z - finalPos.z) < tolerance) {
                const box = new THREE.Box3().setFromObject(child);
                const topOfObject = box.max.y;
                if (topOfObject > highestY) {
                    highestY = topOfObject;
                }
            }
        }

        // Calculate yOffset for the preview
        const tempBox = new THREE.Box3().setFromObject(window.globalState.placementPreviewMesh);
        const yOffset = -tempBox.min.y;
        finalPos.y = highestY + yOffset;

        window.globalState.placementPreviewMesh.position.copy(finalPos);
        window.globalState.placementPreviewMesh.rotation.x = -Math.PI / 2; // Match placement rotation

        // --- INICIO: Actualizar color del preview según validez ---
        if (window.globalState.placementPreviewMesh) {
            const isValid = isPlacementValid(window.globalState.placementPreviewMesh.position);
            const color = isValid ? 0x00ff00 : 0xff0000; // Verde si es válido, Rojo si no

            window.globalState.placementPreviewMesh.traverse(child => {
                if (child.isMesh) {
                    if (child.material.color.getHex() !== color) {
                        child.material.color.setHex(color);
                    }
                }
            });
        }
        // --- FIN: Actualizar color del preview ---
    }
};

window.updateBarricadeMixers = function(deltaTime) {
    for (let mixer of window.globalState.barricadeMixers) {
        mixer.update(deltaTime);
    }
window.handleDestroyedBarricades = function() {
    // Check for destroyed barricades and remove them
    for (let i = window.globalState.collisionObjects.length - 1; i >= 0; i--) {
        const obj = window.globalState.collisionObjects[i];
        if (obj.userData.isBarricade && obj.userData.health <= 0) {
            // Play destroy animation if available
            if (obj.animationActions && obj.animationActions.destroy && obj.mixer) {
                obj.animationActions.destroy.reset().play();
                // Remove after animation, but for now, remove immediately
                window.globalState.scene.remove(obj);
                window.globalState.collisionObjects.splice(i, 1);
                // Remove mixer if exists
                const mixerIndex = window.globalState.barricadeMixers.indexOf(obj.mixer);
                if (mixerIndex > -1) {
                    window.globalState.barricadeMixers.splice(mixerIndex, 1);
                }
            } else {
                // No animation, remove immediately
                window.globalState.scene.remove(obj);
                window.globalState.collisionObjects.splice(i, 1);
            }
            window.playSound('sonido/barricada-destruida.mp3', 0.8);
        }
    }
};
};