// Animation utilities

window.playHitAnimation = function(targetObject) {
    // Don't animate if it's already animating or doesn't exist
    if (!targetObject || targetObject.userData.isHitAnimated) return;

    // For barricades, use the original scale stored during placement
    const originalScale = targetObject.userData.originalScale ? targetObject.userData.originalScale.clone() : targetObject.scale.clone();
    targetObject.userData.isHitAnimated = true;

    // The scale to animate to
    const hitScale = originalScale.clone().multiplyScalar(1.1);

    // Scale up
    targetObject.scale.copy(hitScale);

    // After a short delay, scale back to the original size
    setTimeout(() => {
        // Check if the object still exists before trying to access it
        if (targetObject && targetObject.parent) {
            targetObject.scale.copy(originalScale);
            targetObject.userData.isHitAnimated = false;
        }
    }, 100); // Animation duration in milliseconds
};

window.playBarricadeHitAnimation = function(targetObject) {
    if (!targetObject || targetObject.userData.isHitAnimated) return;

    targetObject.userData.isHitAnimated = true;
    const originalScale = targetObject.userData.originalScale ? targetObject.userData.originalScale.clone() : targetObject.scale.clone();
    const originalPosition = targetObject.position.clone();
    const hitScale = originalScale.clone().multiplyScalar(0.95); // Shrink to 95%

    // 1. Shrink
    targetObject.scale.copy(hitScale);

    // 2. Vibrate
    const vibrationDuration = 150; // ms
    const startTime = performance.now();

    function vibrate() {
        const elapsedTime = performance.now() - startTime;
        if (elapsedTime < vibrationDuration) {
            const offsetX = (Math.random() - 0.5) * 0.2;
            const offsetZ = (Math.random() - 0.5) * 0.2;
            targetObject.position.set(originalPosition.x + offsetX, originalPosition.y, originalPosition.z + offsetZ);
            requestAnimationFrame(vibrate);
        } else {
            // 3. Return to normal
            targetObject.position.copy(originalPosition);
            targetObject.scale.copy(originalScale);
            targetObject.userData.isHitAnimated = false;
        }
    }
    vibrate();
};