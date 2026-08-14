```
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Three.js Robot Actions</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background-color: #f0f4f8;
            font-family: sans-serif;
            cursor: pointer; /* Indicates clickable window */
            user-select: none;
        }

        #canvas-container {
            width: 100vw;
            height: 100vh;
            display: block;
        }

        .instructions {
            position: absolute;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            color: #556677;
            font-size: 14px;
            background: rgba(255, 255, 255, 0.8);
            padding: 10px 20px;
            border-radius: 30px;
            pointer-events: none;
            backdrop-filter: blur(4px);
            user-select: none;
            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
        }

        .controls-ui {
            position: absolute;
            top: 30px;
            right: 30px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            z-index: 10;
        }

        .btn {
            background: rgba(255, 255, 255, 0.9);
            border: none;
            padding: 12px 24px;
            border-radius: 12px;
            font-family: sans-serif;
            font-weight: 600;
            font-size: 14px;
            color: #556677;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            transition: all 0.2s ease;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            text-align: left;
            display: flex;
            justify-content: space-between;
            min-width: 140px;
        }

        .btn:hover {
            transform: translateX(-5px);
            background: #fff;
            color: #00D2D3;
        }

        .btn.active {
            background: #00D2D3;
            color: white;
            box-shadow: 0 4px 12px rgba(0, 210, 211, 0.4);
            transform: scale(1.05);
        }
        
        .btn[onclick*="error"].active { background: #FF5252; box-shadow: 0 4px 12px rgba(255, 82, 82, 0.4); }
        .btn[onclick*="success"].active { background: #1DD1A1; box-shadow: 0 4px 12px rgba(29, 209, 161, 0.4); }
        .btn[onclick*="sleep"].active { background: #576574; box-shadow: 0 4px 12px rgba(87, 101, 116, 0.4); }
        
        /* Auto Pilot Toggle Style */
        .btn-toggle {
            margin-bottom: 10px;
            background: #2d3436;
            color: #fff;
        }
        .btn-toggle.active {
            background: #6c5ce7;
            box-shadow: 0 4px 15px rgba(108, 92, 231, 0.4);
        }

        /* Knock Ripple Effect */
        .ripple {
            position: absolute;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255, 255, 255, 0.6);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            animation: ripple-anim 0.6s ease-out forwards;
            box-shadow: 0 0 10px rgba(255,255,255,0.4);
        }

        @keyframes ripple-anim {
            0% { width: 10px; height: 10px; opacity: 1; border-width: 3px; }
            100% { width: 150px; height: 150px; opacity: 0; border-width: 0px; }
        }
    </style>
</head>
<body>

    <div id="canvas-container"></div>
    
    <div class="controls-ui">
        <button id="autoBtn" class="btn btn-toggle active" onclick="toggleAutoPilot(this)">Auto Pilot <span>ON</span></button>
        <div style="height: 1px; background: rgba(0,0,0,0.1); margin: 5px 0;"></div>
        <button class="btn" onclick="manualAction('idle', this)">Idle <span>●</span></button>
        <button class="btn" onclick="manualAction('thinking', this)">Thinking <span>?</span></button>
        <button class="btn" onclick="manualAction('coding', this)">Coding <span>⌨</span></button>
        <button class="btn" onclick="manualAction('reading', this)">Reading <span>@</span></button>
        <button class="btn" onclick="manualAction('success', this)">Success <span>★</span></button>
        <button class="btn" onclick="manualAction('error', this)">Error <span>!</span></button>
        <button class="btn" onclick="manualAction('sleep', this)">Sleep <span>z</span></button>
    </div>

    <div class="instructions">Tap anywhere on the glass to knock!</div>

    <script type="importmap">
        {
            "imports": {
                "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
                "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
            }
        }
    </script>

    <script type="module">
        import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

        // --- 1. Scene Setup ---
        const container = document.getElementById('canvas-container');
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0f4f8);
        scene.fog = new THREE.Fog(0xf0f4f8, 15, 60);

        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        // Fixed "Window" Camera Position
        camera.position.set(0, 4, 20);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.SoftShadowMap;
        container.appendChild(renderer.domElement);

        // Locked Camera Controls (Fixed Window View)
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableRotate = false; // Disable rotation
        controls.enableZoom = false;   // Disable zoom
        controls.enablePan = false;    // Disable panning
        controls.target.set(0, 2, 0);
        controls.update();

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(5, 15, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.bias = -0.0005;
        dirLight.shadow.camera.left = -20;
        dirLight.shadow.camera.right = 20;
        dirLight.shadow.camera.top = 20;
        dirLight.shadow.camera.bottom = -20;
        scene.add(dirLight);

        const planeGeometry = new THREE.PlaneGeometry(200, 200);
        const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.1, color: 0x000000 });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -4.5;
        scene.add(plane);


        // --- 2. Materials ---
        const colors = {
            orange: 0xFF9F43, white: 0xFFFFFF, darkGray: 0x343A40, metal: 0xAABBAA,
            eyeCyan: 0x00D2D3, eyeRed: 0xFF5252, eyeGreen: 0x1DD1A1, eyeOff: 0x333333,
            eyePurple: 0xa29bfe,
            propGrey: 0x2d3436, propBlue: 0x0984e3, propYellow: 0xfdcb6e, propCover: 0xe17055
        };

        const matWhite = new THREE.MeshLambertMaterial({ color: colors.white });
        const matOrange = new THREE.MeshLambertMaterial({ color: colors.orange });
        const matDark = new THREE.MeshLambertMaterial({ color: colors.darkGray });
        const matMetal = new THREE.MeshLambertMaterial({ color: colors.metal });
        const matEye = new THREE.MeshBasicMaterial({ color: colors.eyeCyan });
        
        const matPropBody = new THREE.MeshLambertMaterial({ color: colors.propGrey });
        const matPropScreen = new THREE.MeshBasicMaterial({ color: colors.propBlue });
        const matPropGold = new THREE.MeshPhongMaterial({ color: colors.propYellow, shininess: 100 });
        const matBookCover = new THREE.MeshLambertMaterial({ color: colors.propCover });


        // --- 3. Build Robot ---
        const robot = new THREE.Group();
        scene.add(robot);
        const bodyPivot = new THREE.Group();
        robot.add(bodyPivot);

        // Body
        const torso = new THREE.Mesh(new RoundedBoxGeometry(3.5, 4.5, 2.5, 4, 0.5), matWhite);
        torso.castShadow = true;
        bodyPivot.add(torso);

        const chestPlate = new THREE.Mesh(new RoundedBoxGeometry(2, 1.4, 0.2, 4, 0.1), matOrange);
        chestPlate.position.set(0, 1, 1.3);
        chestPlate.castShadow = true;
        bodyPivot.add(chestPlate);

        const headGroup = new THREE.Group();
        headGroup.position.set(0, 3.5, 0);
        bodyPivot.add(headGroup);

        const headMesh = new THREE.Mesh(new RoundedBoxGeometry(5, 4, 3.5, 4, 0.2), matWhite);
        headMesh.castShadow = true;
        headGroup.add(headMesh);

        const visor = new THREE.Mesh(new RoundedBoxGeometry(4, 2.2, 0.5, 4, 0.1), matDark);
        visor.position.set(0, 0, 1.8);
        headGroup.add(visor);

        const leftEye = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32), matEye);
        leftEye.position.set(-1, 0, 2.1);
        headGroup.add(leftEye);
        const rightEye = leftEye.clone();
        rightEye.position.set(1, 0, 2.1);
        headGroup.add(rightEye);

        const earGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.5, 32);
        const leftEar = new THREE.Mesh(earGeo, matOrange);
        leftEar.rotation.z = Math.PI / 2; leftEar.position.set(-2.8, 0, 0);
        headGroup.add(leftEar);
        const rightEar = leftEar.clone();
        rightEar.position.set(2.8, 0, 0);
        headGroup.add(rightEar);

        const antennaStem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 1, 16), matMetal);
        antennaStem.position.set(0, 2.5, 0);
        headGroup.add(antennaStem);
        const antennaBall = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), matOrange);
        antennaBall.position.set(0, 3, 0);
        headGroup.add(antennaBall);

        function createLimb(x, y, isArm = false) {
            const group = new THREE.Group();
            group.position.set(x, y, 0);
            const limbMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 2, 4, 8), isArm ? matMetal : matDark);
            limbMesh.position.y = -1; limbMesh.castShadow = true;
            group.add(limbMesh);
            if (isArm) {
                const hand = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), matWhite);
                hand.position.y = -2.2; hand.castShadow = true;
                group.add(hand);
            } else {
                const foot = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.8, 1.8, 4, 0.2), matWhite);
                foot.position.set(0, -2, 0.5); foot.castShadow = true;
                group.add(foot);
            }
            return group;
        }

        const leftArm = createLimb(-2.2, 1.5, true); bodyPivot.add(leftArm);
        const rightArm = createLimb(2.2, 1.5, true); bodyPivot.add(rightArm);
        const leftLeg = createLimb(-1.2, -2.5, false); bodyPivot.add(leftLeg);
        const rightLeg = createLimb(1.2, -2.5, false); bodyPivot.add(rightLeg);


        // --- 4. Props System ---
        
        const laptopAnchor = new THREE.Group();
        laptopAnchor.position.set(0, 0, 3.8); 
        laptopAnchor.rotation.set(-0.2, Math.PI, 0); 
        bodyPivot.add(laptopAnchor);

        const bookAnchor = new THREE.Group();
        bookAnchor.position.set(0, 0.5, 3.2);
        bookAnchor.rotation.set(-0.8, Math.PI, 0);
        bodyPivot.add(bookAnchor);

        const questionAnchor = new THREE.Group();
        questionAnchor.position.set(2, 6, 0); 
        scene.add(questionAnchor);

        const starAnchor = new THREE.Group();
        starAnchor.position.set(0, 7, 0);
        scene.add(starAnchor);

        const props = { coding: null, reading: null, thinking: null, success: null };

        // Laptop
        const laptop = new THREE.Group();
        laptop.add(new THREE.Mesh(new RoundedBoxGeometry(3, 0.2, 2.2, 2, 0.05), matPropBody));
        const screenPivot = new THREE.Group();
        screenPivot.position.set(0, 0.1, -1.0); 
        laptop.add(screenPivot);
        const lapScreen = new THREE.Mesh(new RoundedBoxGeometry(3, 2, 0.2, 2, 0.05), matPropBody);
        lapScreen.position.set(0, 1, 0); 
        screenPivot.add(lapScreen);
        const lapDisplay = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), matPropScreen);
        lapDisplay.position.set(0, 1, 0.11);
        screenPivot.add(lapDisplay);
        screenPivot.rotation.x = 0.4; 
        scene.add(laptop);
        props.coding = { mesh: laptop, anchor: laptopAnchor, state: 'hidden', vel: new THREE.Vector3() };

        // Book
        const book = new THREE.Group();
        book.add(new THREE.Mesh(new RoundedBoxGeometry(2.8, 3.8, 0.3, 2, 0.05), matBookCover));
        const pages = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.6, 0.2), matWhite);
        pages.position.z = 0.15; book.add(pages);
        scene.add(book);
        props.reading = { mesh: book, anchor: bookAnchor, state: 'hidden', vel: new THREE.Vector3() };

        // Question Mark
        const qGroup = new THREE.Group();
        const qShape = new THREE.Shape();
        qShape.moveTo(0, 0); qShape.absarc(0, 0.5, 0.5, 0, Math.PI, true); qShape.lineTo(0, -0.5);
        const qMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(qShape, { depth: 0.2, bevelEnabled: false }), matPropGold);
        qMesh.scale.set(1.5, 1.5, 1.5); qMesh.rotation.y = Math.PI;
        qGroup.add(qMesh);
        const qDot = new THREE.Mesh(new THREE.SphereGeometry(0.25), matPropGold);
        qDot.position.y = -1.2; qGroup.add(qDot);
        scene.add(qGroup);
        props.thinking = { mesh: qGroup, anchor: questionAnchor, state: 'hidden', vel: new THREE.Vector3() };

        // Star
        const sGroup = new THREE.Group();
        const starShape = new THREE.Shape();
        for (let i = 0; i < 5; i++) {
            const th = (i / 5) * Math.PI * 2;
            const thIn = ((i + 0.5) / 5) * Math.PI * 2;
            i===0 ? starShape.moveTo(Math.sin(th), Math.cos(th)) : starShape.lineTo(Math.sin(th), Math.cos(th));
            starShape.lineTo(Math.sin(thIn)*0.4, Math.cos(thIn)*0.4);
        }
        starShape.closePath();
        sGroup.add(new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.2, bevelEnabled: false }), matPropGold));
        scene.add(sGroup);
        props.success = { mesh: sGroup, anchor: starAnchor, state: 'hidden', vel: new THREE.Vector3() };

        // Z Particles
        const zParticles = [];
        for(let i=0; i<3; i++) {
            const c = document.createElement('canvas'); c.width=64; c.height=64;
            const ctx = c.getContext('2d'); ctx.fillStyle='white'; ctx.font='bold 50px sans-serif'; ctx.fillText('Z', 10, 50);
            const zSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0 }));
            zSprite.scale.set(1.5, 1.5, 1.5); scene.add(zSprite);
            zParticles.push({ mesh: zSprite, offset: i * 2 });
        }


        // --- 5. Animation & Behaviors ---

        const targets = {
            body: { pos: new THREE.Vector3(), rot: new THREE.Vector3() },
            head: { pos: new THREE.Vector3(0, 3.5, 0), rot: new THREE.Vector3() },
            leftArm: { pos: new THREE.Vector3(-2.2, 1.5, 0), rot: new THREE.Vector3() },
            rightArm: { pos: new THREE.Vector3(2.2, 1.5, 0), rot: new THREE.Vector3() },
            leftLeg: { rot: new THREE.Vector3() },
            rightLeg: { rot: new THREE.Vector3() },
        };

        function resetTargets() {
            targets.body.pos.set(0, 0, 0);
            targets.body.rot.set(0, 0, 0);
            targets.head.pos.set(0, 3.5, 0);
            targets.head.rot.set(0, 0, 0);
            targets.leftArm.pos.set(-2.2, 1.5, 0);
            targets.leftArm.rot.set(0, 0, 0);
            targets.rightArm.pos.set(2.2, 1.5, 0);
            targets.rightArm.rot.set(0, 0, 0);
            targets.leftLeg.rot.set(0, 0, 0);
            targets.rightLeg.rot.set(0, 0, 0);
        }

        const behaviors = {
            idle: (t) => {
                targets.body.pos.y = Math.sin(t * 1.5) * 0.1;
                targets.leftArm.rot.z = 0.1; targets.rightArm.rot.z = -0.1;
                targets.leftArm.rot.x = Math.sin(t) * 0.05; targets.rightArm.rot.x = -Math.sin(t) * 0.05;
                targets.head.rot.x = Math.cos(t * 0.4) * 0.1; targets.head.rot.y = Math.sin(t * 0.5) * 0.2;
            },
            thinking: (t) => {
                targets.body.pos.y = Math.abs(Math.sin(t * 4)) * 0.1;
                targets.body.rot.z = Math.sin(t * 2) * 0.05;
                targets.rightArm.rot.set(-2.0, -0.5, -0.5); targets.rightArm.pos.set(2.2, 1.5, 0);
                targets.leftArm.rot.z = 0.2;
                targets.head.rot.x = -0.3 + Math.sin(t) * 0.1; targets.head.rot.y = Math.sin(t * 0.5) * 0.3;
            },
            coding: (t) => {
                const jL = Math.sin(t * 25) * 0.05; const jR = Math.cos(t * 25) * 0.05;
                targets.leftArm.rot.set(-1.5, 0, 0.2); targets.rightArm.rot.set(-1.5, 0, -0.2);
                targets.leftArm.pos.y += jL; targets.rightArm.pos.y += jR;
                targets.head.rot.x = 0.2; targets.head.pos.y = 3.5 + Math.sin(t * 10) * 0.02;
            },
            reading: (t) => {
                targets.leftArm.rot.set(-1.0, 0, 0.5); targets.rightArm.rot.set(-1.0, 0, -0.5);
                const cycle = (t * 1.5) % 2;
                const lookY = cycle < 1.5 ? THREE.MathUtils.lerp(-0.4, 0.4, cycle/1.5) : THREE.MathUtils.lerp(0.4, -0.4, (cycle-1.5)/0.5);
                targets.head.rot.set(0.2, lookY, 0);
            },
            success: (t) => {
                const jump = Math.abs(Math.sin(t * 8));
                targets.body.pos.y = jump * 0.5;
                targets.leftArm.rot.set(0, 0, -2.5); targets.rightArm.rot.set(0, 0, 2.5);
                targets.head.rot.z = Math.sin(t * 8) * 0.1;
            },
            error: (t) => {
                targets.body.pos.x = Math.sin(t * 50) * 0.05;
                targets.head.rot.y = Math.sin(t * 30) * 0.5;
                targets.leftArm.rot.set(Math.sin(t * 20) * 0.2, 0, -2.8); targets.rightArm.rot.set(Math.cos(t * 20) * 0.2, 0, 2.8);
            },
            sleep: (t) => {
                targets.body.pos.y = -0.5 + Math.sin(t) * 0.05;
                targets.head.rot.set(0.5, 0.2, 0.1);
                targets.leftArm.rot.set(0, 0, 0); targets.rightArm.rot.set(0, 0, 0);
            },
            walk: (t) => {
                const speed = 10;
                targets.body.pos.y = Math.abs(Math.sin(t * speed)) * 0.2;
                targets.body.rot.z = Math.sin(t * speed/2) * 0.05;
                targets.leftLeg.rot.x = Math.sin(t * speed) * 0.8;
                targets.rightLeg.rot.x = Math.sin(t * speed + Math.PI) * 0.8;
                targets.leftArm.rot.x = Math.sin(t * speed + Math.PI) * 0.8;
                targets.rightArm.rot.x = Math.sin(t * speed) * 0.8;
                targets.leftArm.rot.z = 0.1; targets.rightArm.rot.z = -0.1;
            },
            wave: (t) => {
                targets.rightArm.rot.set(0, 0, -2.5);
                targets.rightArm.rot.x = Math.sin(t * 10) * 0.3;
                targets.leftArm.rot.z = 0.2;
                targets.head.rot.y = Math.sin(t * 2) * 0.1;
                targets.head.rot.z = Math.sin(t * 4) * 0.1;
            },
            knocked: (t) => {
                // Surprised Look at glass
                targets.body.pos.y = Math.max(0, Math.sin(t * 15)) * 1;
                targets.head.rot.x = -0.2; // Look up/at camera
                targets.head.rot.z = Math.sin(t*10)*0.1; // Shake/Tilt
                // Arms flared OUT to avoid clipping
                targets.leftArm.rot.set(0, 0, -1.0); 
                targets.rightArm.rot.set(0, 0, 1.0);
            }
        };


        // --- 6. AI & Interaction ---

        let currentAction = 'idle';
        let isAutoMode = true;
        let aiState = 'IDLE'; 
        let aiTimer = 0;
        let moveTarget = new THREE.Vector3();
        let robotSpeed = 5;

        // Window Knock Interaction
        function createRipple(x, y) {
            const ripple = document.createElement('div');
            ripple.className = 'ripple';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            document.body.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        }

        window.addEventListener('click', (event) => {
            // Ignore if clicking a button
            if (event.target.closest('.controls-ui') || event.target.tagName === 'BUTTON') return;

            // 1. Visual Ripple on the "Glass"
            createRipple(event.clientX, event.clientY);

            // 2. Robot Reaction (Interruption)
            currentAction = 'knocked';
            setEyeColor('knocked');
            
            // Resume previous behavior logic after delay
            setTimeout(() => {
                if(currentAction === 'knocked') {
                    currentAction = 'idle';
                    setEyeColor('idle');
                    // Reset AI to idle state so it picks a new action naturally
                    if (isAutoMode) {
                        aiState = 'IDLE';
                        aiTimer = 0; 
                    }
                }
            }, 2000);
        });

        window.toggleAutoPilot = function(btn) {
            isAutoMode = !isAutoMode;
            btn.classList.toggle('active');
            btn.querySelector('span').innerText = isAutoMode ? 'ON' : 'OFF';
            if(!isAutoMode) {
                aiState = 'IDLE';
                currentAction = 'idle';
                setEyeColor('idle');
            }
        };

        window.manualAction = function(action, btn) {
            isAutoMode = false;
            document.getElementById('autoBtn').classList.remove('active');
            document.getElementById('autoBtn').querySelector('span').innerText = 'OFF';
            setRobotAction(action, btn);
        };

        function setRobotAction(action, btn) {
            currentAction = action;
            if(btn) {
                document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
            setEyeColor(action);
        }

        function setEyeColor(action) {
            if(action === 'error') matEye.color.setHex(colors.eyeRed);
            else if (action === 'success') matEye.color.setHex(colors.eyeGreen);
            else if (action === 'sleep') matEye.color.setHex(colors.eyeOff);
            else if (action === 'knocked') matEye.color.setHex(colors.eyePurple);
            else matEye.color.setHex(colors.eyeCyan);
        }

        function updateAI(delta, time) {
            // Special handling for Knocked state: Force face camera
            if (currentAction === 'knocked') {
                let rotDiff = 0 - robot.rotation.y;
                while (rotDiff > Math.PI) rotDiff -= Math.PI*2;
                while (rotDiff < -Math.PI) rotDiff += Math.PI*2;
                robot.rotation.y += rotDiff * 0.1;
                return;
            }

            if (!isAutoMode) return;

            aiTimer -= delta;

            if (aiState === 'IDLE') {
                if (aiTimer <= 0) {
                    const r = Math.random();
                    if (r < 0.6) {
                        aiState = 'MOVING';
                        moveTarget.set((Math.random()-0.5)*12, 0, (Math.random()-0.5)*8);
                        currentAction = 'walk';
                    } else if (r < 0.9) {
                        const acts = ['thinking', 'coding', 'reading', 'success', 'idle'];
                        currentAction = acts[Math.floor(Math.random() * acts.length)];
                        aiState = 'PERFORMING';
                        aiTimer = 3 + Math.random() * 4;
                        setEyeColor(currentAction);
                    } else {
                        // Visit Window
                        aiState = 'MOVING';
                        moveTarget.set(0, 0, 12);
                        currentAction = 'walk';
                    }
                }
            }
            else if (aiState === 'MOVING') {
                const direction = new THREE.Vector3().subVectors(moveTarget, robot.position);
                const dist = direction.length();
                
                if (dist < 0.2) {
                    robot.position.copy(moveTarget);
                    if (robot.position.z > 10) { 
                        aiState = 'PERFORMING';
                        currentAction = 'wave';
                        aiTimer = 4;
                        const targetRot = 0; 
                        let rotDiff = targetRot - robot.rotation.y;
                        while (rotDiff > Math.PI) rotDiff -= Math.PI*2;
                        while (rotDiff < -Math.PI) rotDiff += Math.PI*2;
                        robot.rotation.y = targetRot; 
                    } else {
                        aiState = 'IDLE';
                        currentAction = 'idle';
                        aiTimer = 1;
                    }
                } else {
                    direction.normalize();
                    robot.position.addScaledVector(direction, robotSpeed * delta);
                    const targetRot = Math.atan2(direction.x, direction.z);
                    let rotDiff = targetRot - robot.rotation.y;
                    while (rotDiff > Math.PI) rotDiff -= Math.PI*2;
                    while (rotDiff < -Math.PI) rotDiff += Math.PI*2;
                    robot.rotation.y += rotDiff * 0.1;
                }
            }
            else if (aiState === 'PERFORMING') {
                if (aiTimer <= 0) {
                    aiState = 'IDLE';
                    currentAction = 'idle';
                    aiTimer = 0.5;
                }
            }
        }


        // --- 7. Main Loop ---
        const clock = new THREE.Clock();
        let isBlinking = false, blinkTimer = 0, timeSinceLastBlink = 0;
        const blinkDuration = 0.15;

        function updateProps(delta, currentAction) {
            for (const [key, prop] of Object.entries(props)) {
                let isHeld = (key === currentAction && currentAction !== 'walk');
                
                if (isHeld && prop.state !== 'dropping') {
                    prop.state = 'held';
                } else if (prop.state === 'held' && !isHeld) {
                    prop.state = 'dropping';
                    prop.vel.set((Math.random()-0.5)*2, 3, (Math.random()-0.5)*2 + 2);
                }

                if (prop.state === 'hidden') {
                    prop.mesh.visible = false;
                    prop.mesh.scale.set(0,0,0);
                } 
                else if (prop.state === 'held') {
                    prop.mesh.visible = true;
                    prop.mesh.scale.lerp(new THREE.Vector3(1,1,1), 0.1);
                    prop.anchor.getWorldPosition(prop.mesh.position);
                    prop.anchor.getWorldQuaternion(prop.mesh.quaternion);
                }
                else if (prop.state === 'dropping') {
                    prop.mesh.visible = true;
                    prop.vel.y -= 15 * delta;
                    prop.mesh.position.addScaledVector(prop.vel, delta * 3);
                    prop.mesh.rotation.x += delta * 3; 
                    prop.mesh.rotation.z += delta;
                    if (prop.mesh.position.y <= -4.3) {
                        prop.mesh.position.y = -4.3;
                        prop.vel.set(0,0,0);
                        prop.state = 'ground';
                        prop.mesh.rotation.set(-Math.PI/2, 0, Math.random() * Math.PI);
                    }
                }
                else if (prop.state === 'ground') {
                    prop.mesh.scale.lerp(new THREE.Vector3(0,0,0), 0.05);
                    if (prop.mesh.scale.y < 0.05) prop.state = 'hidden';
                }
            }
        }

        function animate() {
            requestAnimationFrame(animate);
            const delta = clock.getDelta();
            const time = clock.getElapsedTime();

            updateAI(delta, time);

            resetTargets();
            if (behaviors[currentAction]) behaviors[currentAction](time);

            const f = 0.1;
            const lerpV = (c, t) => c.lerp(t, f);
            const lerpR = (obj, t) => {
                obj.rotation.x = THREE.MathUtils.lerp(obj.rotation.x, t.x, f);
                obj.rotation.y = THREE.MathUtils.lerp(obj.rotation.y, t.y, f);
                obj.rotation.z = THREE.MathUtils.lerp(obj.rotation.z, t.z, f);
            }

            lerpV(bodyPivot.position, targets.body.pos); lerpR(bodyPivot, targets.body.rot);
            lerpV(headGroup.position, targets.head.pos); lerpR(headGroup, targets.head.rot);
            lerpV(leftArm.position, targets.leftArm.pos); lerpR(leftArm, targets.leftArm.rot);
            lerpV(rightArm.position, targets.rightArm.pos); lerpR(rightArm, targets.rightArm.rot);
            lerpR(leftLeg, targets.leftLeg.rot); lerpR(rightLeg, targets.rightLeg.rot);

            robot.updateMatrixWorld(true);
            updateProps(delta, currentAction);

            if (currentAction !== 'sleep' && currentAction !== 'error') {
                timeSinceLastBlink += delta;
                if (!isBlinking && timeSinceLastBlink > 2 + Math.random() * 3) {
                    isBlinking = true; blinkTimer = 0; timeSinceLastBlink = 0;
                }
                let targetScale = 1;
                if (isBlinking) {
                    blinkTimer += delta;
                    targetScale = (blinkTimer / blinkDuration < 0.5) ? 0.1 : 1;
                    if (blinkTimer >= blinkDuration) isBlinking = false;
                }
                leftEye.scale.y = THREE.MathUtils.lerp(leftEye.scale.y, targetScale, 0.5);
                rightEye.scale.y = THREE.MathUtils.lerp(rightEye.scale.y, targetScale, 0.5);
            } else {
                const s = (currentAction === 'sleep') ? 0.1 : 1;
                leftEye.scale.y = THREE.MathUtils.lerp(leftEye.scale.y, s, 0.1);
                rightEye.scale.y = THREE.MathUtils.lerp(rightEye.scale.y, s, 0.1);
            }

            if(props.thinking.state === 'held') {
                props.thinking.mesh.position.y += Math.sin(time * 2) * 0.02;
                props.thinking.mesh.rotation.z = Math.sin(time) * 0.2;
            }
            if(props.success.state === 'held') {
                props.success.mesh.rotation.y += delta * 2;
                props.success.mesh.scale.setScalar(1 + Math.sin(time * 5) * 0.2);
            }
            
            const isSleep = currentAction === 'sleep';
            zParticles.forEach((z, i) => {
                if (isSleep) {
                    z.mesh.visible = true;
                    const headWorldPos = new THREE.Vector3();
                    headGroup.getWorldPosition(headWorldPos);
                    const l = (time + i) % 3;
                    z.mesh.position.set(headWorldPos.x + 1, headWorldPos.y + 1 + l * 1.5, headWorldPos.z);
                    z.mesh.position.x += Math.sin(l * 5) * 0.5;
                    z.mesh.material.opacity = (l < 0.5) ? l * 2 : (l > 2.0 ? 1 - (l-2) : 1);
                } else z.mesh.visible = false;
            });

            controls.update();
            renderer.render(scene, camera);
        }

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        animate();

    </script>
</body>
</html>
```
This project is an **interactive, web-based 3D robot simulation** built using **Three.js**. It features a stylized character that lives in a "glass-fronted" environment, capable of both autonomous behavior and user-triggered interactions.

Here is a summary of the project’s core components:

### 1. Visual Design & Aesthetics

* **The Robot:** Built entirely with procedural geometries (RoundedBox, Capsule, Sphere) rather than external 3D models. It has a clean, "tech-toy" aesthetic with a white body, orange accents, and glowing cyan eyes.
* **The Environment:** A minimalist, soft-lit gray space with shadows and fog, creating a depth-of-field effect that makes the robot feel like it’s inside a modern display case or laboratory.

### 2. Behavior & Animation System

The project uses a **Target-based Animation Engine** where the robot’s limbs and body lerp (linearly interpolate) toward specific positions and rotations based on its current state:

* **Dynamic Actions:** Includes distinct animations for **Idle**, **Thinking**, **Coding** (typing on a laptop), **Reading** (holding a book), **Success** (jumping for joy), **Error** (shaking in frustration), and **Sleep** (with animated "Z" particles).
* **Procedural Movement:** Features a "Walk" cycle and a "Wave" gesture used during autonomous navigation.

### 3. "Auto Pilot" AI Logic

The robot contains a simple **Finite State Machine (FSM)** that governs its autonomy:

* **Decision Making:** While in Auto Pilot, it chooses between moving to a random coordinate, performing a specific task (like coding or reading), or walking up to the "glass" to wave at the user.
* **Seamless Transitions:** It handles the spawning and "dropping" of physical props (laptop, book, star) based on the action it is currently performing.

### 4. Interactive Elements

* **The "Window" Knock:** A primary interaction feature where clicking anywhere on the screen creates a CSS ripple effect. The robot reacts by getting "startled," turning to face the user, and flashing its eyes purple.
* **Manual Controls:** A UI overlay allows users to override the AI and manually trigger specific animations or toggle the Auto Pilot on/off.
* **Micro-Interactions:** The robot features realistic procedural touches like random eye blinking and "breathing" (subtle vertical floating).

### 5. Technical Stack

* **Engine:** Three.js (using `PerspectiveCamera`, `SoftShadowMap`, and `OrbitControls`).
* **Geometries:** Utilizes `RoundedBoxGeometry` for a more premium, "beveled" look than standard cubes.
* **Performance:** Implements a single `requestAnimationFrame` loop with delta-timing to ensure smooth animations regardless of screen refresh rates.

---

## ✅ STATUS UPDATE — 2026-08-15

This standalone prototype evolved into the **VS Code extension webview** (React 18 + Three.js, Vite). Where the prototype lives today:

* The entire scene/robot setup above was extracted into modules under `webview-ui/src/scene/` (`setupScene.ts`, `createRobotMesh.ts`) and driven by `webview-ui/src/app/RobotScene.ts` (a `RobotScene` class implementing `RobotSceneContext`).
* The prototype's inline action/animation code became the **target-based action system** in `webview-ui/src/robot/actions/` (one file per action, `defineAction()` + dynamic props registry).
* The prototype's AutoPilot FSM became `webview-ui/src/robot/autopilot.ts` (`updateAI(ctx, delta)`); interactions/cleanup live in `robot/interaction.ts`; the render loop is `render/render-loop.ts`.
* The manual control overlay became the dev **Control Panel** webview (`webview-ui/src/control-panel/`).
* The props system became `robot/scene-props.ts` (ground scene props) + `robot/actions/props.ts` (hand-held action props).
* The ripple/knock interaction is preserved in `RobotScene`'s click handler.

Full current layout: see `docs/architecture-refactor.md` and the `copilot-instructions.md` in `.github/`.

---
