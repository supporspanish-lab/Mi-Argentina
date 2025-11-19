// Map loading and scene building

window.loadMap = async function(mapUrl) {
    updateMapLoadingScreen("Cargando mapa...", 0);

    try {
        const response = await fetch(mapUrl);
        if (!response.ok) {
            throw new Error(`No se pudo cargar el mapa: ${response.statusText}`);
        }
        const mapData = await response.json();
        await window.buildSceneFromMapData(mapData);
        updateMapLoadingScreen("Mapa cargado.", 100);
    } catch (error) {
        console.error("Error al cargar el mapa:", error);
        window.loadDefaultFloor();
    }
};

window.loadDefaultFloor = function() {
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    window.globalState.scene.add(floor);
    window.globalState.collisionObjects.push(floor);
};

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

    const totalAssetPacks = Object.keys(assetsByPath).length;
    let loadedAssetPacks = 0;
    for (const path of Object.keys(assetsByPath)) {
        if (!path || path === 'undefined') {
            console.warn(`Skipping asset loading with invalid path: '${path}'. Make sure all assets in your map have an 'assetPath' defined.`);
            continue;
        }
        try {
            const gltf = await loader.loadAsync(path);
            loadedAssetPacks++;
            const progress = (loadedAssetPacks / totalAssetPacks) * 100;
            updateMapLoadingScreen(`Cargando assets del mapa... (${loadedAssetPacks}/${totalAssetPacks})`, progress);
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
                            isCollision: (assetInfo.assetType === 'no-piso' || assetInfo.assetType === 'barricada' || assetInfo.assetName === 'Object_2')
                        });
                        // For non-floor objects that are collidable, add them to the main collision array initially.
                        if (assetInfo.assetType === 'no-piso' || assetInfo.assetType === 'barricada' || assetInfo.assetName === 'Object_2') {
                            window.globalState.collisionObjects.push(newObject);
                        }
                    }
                    if (assetInfo.assetType === 'piso') newObject.userData.isFloor = true;

                    // Load animations for barricades and Object_2
                    window.loadBarricadeAnimations(assetInfo, newObject, gltf);

                    if (assetInfo.assetName === 'Object_2') {
                        window.globalState.object2Target = newObject;
                        updateMapLoadingScreen("Punto de control (tienda) asignado.", progress);
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
};