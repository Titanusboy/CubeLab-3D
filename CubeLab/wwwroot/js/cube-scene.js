import * as THREE from
    "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

/**
 * Mouse controls:
 *
 * Left drag on cube: rotate cube.
 * Right drag on cube: move cube in the screen plane.
 * Left drag on empty space: orbit camera.
 * Right drag on empty space: pan camera.
 * Wheel: zoom.
 */
export function createScene(host) {
    let disposed = false;
    let drag = null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#10141c");

    const camera = new THREE.PerspectiveCamera(
        42,
        1,
        0.1,
        200
    );

    const cameraTarget = new THREE.Vector3();

    camera.position.set(5, 4, 7);
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld();

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false
    });

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, 2)
    );

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const canvas = renderer.domElement;
    host.appendChild(canvas);

    const hemisphere = new THREE.HemisphereLight(
        "#dbeafe",
        "#293046",
        2.2
    );

    scene.add(hemisphere);

    const keyLight = new THREE.DirectionalLight(
        "#ffffff",
        3.5
    );

    keyLight.position.set(4, 7, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(
        "#60a5fa",
        2
    );

    rimLight.position.set(-5, 2, -4);
    scene.add(rimLight);

    const geometry = new THREE.BoxGeometry(2, 2, 2);

    const material = new THREE.MeshStandardMaterial({
        color: "#4c8dff",
        roughness: 0.32,
        metalness: 0.22
    });

    const cube = new THREE.Mesh(geometry, material);
    cube.rotation.set(0.12, 0.25, 0);

    scene.add(cube);

    const edgeGeometry = new THREE.EdgesGeometry(geometry);

    const edgeMaterial = new THREE.LineBasicMaterial({
        color: "#bfdbfe",
        transparent: true,
        opacity: 0.45
    });

    cube.add(new THREE.LineSegments(
        edgeGeometry,
        edgeMaterial
    ));

    const grid = new THREE.GridHelper(
        40,
        40,
        "#37445c",
        "#222c3d"
    );

    grid.position.y = -1.15;
    scene.add(grid);

    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();

    const dragPlane = new THREE.Plane();
    const planeNormal = new THREE.Vector3();
    const planePoint = new THREE.Vector3();
    const dragOffset = new THREE.Vector3();

    const worldUp = new THREE.Vector3(0, 1, 0);
    const cameraRight = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    const cameraOffset = new THREE.Vector3();
    const panOffset = new THREE.Vector3();

    const horizontalRotation = new THREE.Quaternion();
    const verticalRotation = new THREE.Quaternion();
    const spherical = new THREE.Spherical();

    function updatePointer(event) {
        const rect = canvas.getBoundingClientRect();

        pointer.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        camera.updateMatrixWorld();
        raycaster.setFromCamera(pointer, camera);
    }

    function intersectsCube() {
        cube.updateWorldMatrix(true, false);

        return raycaster.intersectObject(
            cube,
            false
        ).length > 0;
    }

    function updateHover(event) {
        updatePointer(event);

        canvas.style.cursor = intersectsCube()
            ? "grab"
            : "default";
    }

    function updateCamera() {
        camera.lookAt(cameraTarget);
        camera.updateMatrixWorld();
    }

    function orbitCamera(deltaX, deltaY) {
        cameraOffset
            .copy(camera.position)
            .sub(cameraTarget);

        spherical.setFromVector3(cameraOffset);

        const sensitivity = 0.006;

        spherical.theta -= deltaX * sensitivity;
        spherical.phi -= deltaY * sensitivity;

        // Prevent camera flips at the poles.
        spherical.phi = THREE.MathUtils.clamp(
            spherical.phi,
            0.02,
            Math.PI - 0.02
        );

        cameraOffset.setFromSpherical(spherical);

        camera.position
            .copy(cameraTarget)
            .add(cameraOffset);

        updateCamera();
    }

    function panCamera(deltaX, deltaY) {
        const distance = camera.position.distanceTo(
            cameraTarget
        );

        // Convert screen pixels into world-space units.
        const visibleHeight = 2 * distance * Math.tan(
            THREE.MathUtils.degToRad(camera.fov / 2)
        );

        const unitsPerPixel =
            visibleHeight / Math.max(canvas.clientHeight, 1);

        cameraRight
            .set(1, 0, 0)
            .applyQuaternion(camera.quaternion);

        cameraUp
            .set(0, 1, 0)
            .applyQuaternion(camera.quaternion);

        panOffset
            .copy(cameraRight)
            .multiplyScalar(-deltaX * unitsPerPixel)
            .addScaledVector(
                cameraUp,
                deltaY * unitsPerPixel
            );

        // Move camera and target together without changing orientation.
        camera.position.add(panOffset);
        cameraTarget.add(panOffset);

        updateCamera();
    }

    function rotateCube(deltaX, deltaY) {
        const sensitivity = 0.008;

        cameraRight
            .set(1, 0, 0)
            .applyQuaternion(camera.quaternion)
            .normalize();

        horizontalRotation.setFromAxisAngle(
            worldUp,
            deltaX * sensitivity
        );

        verticalRotation.setFromAxisAngle(
            cameraRight,
            deltaY * sensitivity
        );

        cube.quaternion.premultiply(horizontalRotation);
        cube.quaternion.premultiply(verticalRotation);
        cube.quaternion.normalize();
    }

    function moveCube(event) {
        updatePointer(event);

        if (raycaster.ray.intersectPlane(
            dragPlane,
            planePoint
        )) {
            cube.position
                .copy(planePoint)
                .add(dragOffset);
        }
    }

    function onPointerDown(event) {
        if (drag !== null)
            return;

        if (event.button !== 0 && event.button !== 2)
            return;

        updatePointer(event);

        const hitCube = intersectsCube();

        let mode;

        if (hitCube) {
            mode = event.button === 0
                ? "rotateCube"
                : "moveCube";
        } else {
            mode = event.button === 0
                ? "orbitCamera"
                : "panCamera";
        }

        if (mode === "moveCube") {
            camera.getWorldDirection(planeNormal);

            dragPlane.setFromNormalAndCoplanarPoint(
                planeNormal,
                cube.position
            );

            if (!raycaster.ray.intersectPlane(
                dragPlane,
                planePoint
            )) {
                return;
            }

            // Keep the grabbed point under the mouse.
            dragOffset
                .copy(cube.position)
                .sub(planePoint);
        }

        event.preventDefault();

        drag = {
            pointerId: event.pointerId,
            button: event.button,
            mode,
            lastX: event.clientX,
            lastY: event.clientY
        };

        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = "grabbing";
    }

    function onPointerMove(event) {
        if (drag === null) {
            updateHover(event);
            return;
        }

        if (event.pointerId !== drag.pointerId)
            return;

        event.preventDefault();

        const deltaX = event.clientX - drag.lastX;
        const deltaY = event.clientY - drag.lastY;

        drag.lastX = event.clientX;
        drag.lastY = event.clientY;

        // Keep the mode selected at the start of the drag.
        switch (drag.mode) {
            case "rotateCube":
                rotateCube(deltaX, deltaY);
                break;

            case "moveCube":
                moveCube(event);
                break;

            case "orbitCamera":
                orbitCamera(deltaX, deltaY);
                break;

            case "panCamera":
                panCamera(deltaX, deltaY);
                break;
        }
    }

    function clearDrag() {
        if (drag === null)
            return;

        const pointerId = drag.pointerId;
        drag = null;

        if (canvas.hasPointerCapture(pointerId))
            canvas.releasePointerCapture(pointerId);

        canvas.style.cursor = "default";
    }

    function onPointerUp(event) {
        if (drag?.pointerId !== event.pointerId)
            return;

        if (event.button !== drag.button)
            return;

        clearDrag();
        updateHover(event);
    }

    function onPointerCancel(event) {
        if (drag?.pointerId === event.pointerId)
            clearDrag();
    }

    function onLostPointerCapture(event) {
        if (drag?.pointerId === event.pointerId) {
            drag = null;
            canvas.style.cursor = "default";
        }
    }

    function onWheel(event) {
        event.preventDefault();

        if (drag !== null)
            return;

        let delta = event.deltaY;

        if (event.deltaMode === 1)
            delta *= 16;
        else if (event.deltaMode === 2)
            delta *= canvas.clientHeight;

        cameraOffset
            .copy(camera.position)
            .sub(cameraTarget);

        const nextDistance = THREE.MathUtils.clamp(
            cameraOffset.length() * Math.exp(
                THREE.MathUtils.clamp(
                    delta * 0.001,
                    -1,
                    1
                )
            ),
            3,
            35
        );

        cameraOffset.setLength(nextDistance);

        camera.position
            .copy(cameraTarget)
            .add(cameraOffset);

        updateCamera();
    }

    function onContextMenu(event) {
        event.preventDefault();
    }

    function onPointerLeave() {
        if (drag === null)
            canvas.style.cursor = "default";
    }

    function resize() {
        if (disposed)
            return;

        const width = Math.max(host.clientWidth, 1);
        const height = Math.max(host.clientHeight, 1);

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize(width, height, false);
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);

    canvas.addEventListener(
        "lostpointercapture",
        onLostPointerCapture
    );

    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("contextmenu", onContextMenu);

    canvas.addEventListener(
        "wheel",
        onWheel,
        { passive: false }
    );

    window.addEventListener("blur", clearDrag);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    resize();

    renderer.setAnimationLoop(() => {
        renderer.render(scene, camera);
    });

    return {
        dispose() {
            if (disposed)
                return;

            disposed = true;
            clearDrag();

            renderer.setAnimationLoop(null);
            resizeObserver.disconnect();

            canvas.removeEventListener(
                "pointerdown",
                onPointerDown
            );

            canvas.removeEventListener(
                "pointermove",
                onPointerMove
            );

            canvas.removeEventListener(
                "pointerup",
                onPointerUp
            );

            canvas.removeEventListener(
                "pointercancel",
                onPointerCancel
            );

            canvas.removeEventListener(
                "lostpointercapture",
                onLostPointerCapture
            );

            canvas.removeEventListener(
                "pointerleave",
                onPointerLeave
            );

            canvas.removeEventListener(
                "contextmenu",
                onContextMenu
            );

            canvas.removeEventListener(
                "wheel",
                onWheel
            );

            window.removeEventListener("blur", clearDrag);

            geometry.dispose();
            material.dispose();

            edgeGeometry.dispose();
            edgeMaterial.dispose();

            grid.geometry.dispose();

            const gridMaterials = Array.isArray(grid.material)
                ? grid.material
                : [grid.material];

            for (const gridMaterial of gridMaterials)
                gridMaterial.dispose();

            renderer.dispose();
            canvas.remove();
        }
    };
}