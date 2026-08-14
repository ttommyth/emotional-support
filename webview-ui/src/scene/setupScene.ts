import {
	AmbientLight,
	Color,
	DirectionalLight,
	Fog,
	Mesh,
	MeshBasicMaterial,
	MeshLambertMaterial,
	PCFSoftShadowMap,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	ShadowMaterial,
	WebGLRenderer
} from 'three';

export type RobotColors = {
	orange: number;
	white: number;
	darkGray: number;
	metal: number;
	eyeCyan: number;
	eyeRed: number;
	eyeGreen: number;
	eyeOff: number;
	eyePurple: number;
	eyeCalm: number;
};

export type SceneSetup = {
	scene: Scene;
	camera: PerspectiveCamera;
	renderer: WebGLRenderer;
	colors: RobotColors;
	matWhite: MeshLambertMaterial;
	matOrange: MeshLambertMaterial;
	matDark: MeshLambertMaterial;
	matMetal: MeshLambertMaterial;
	matEye: MeshBasicMaterial;
};

/**
 * Create the Three.js scene, camera, renderer, lighting and ground plane.
 * The renderer's canvas is appended to the given container element.
 */
export function setupScene(containerEl: HTMLElement): SceneSetup {
	const scene = new Scene();
	const computedStyles = getComputedStyle(document.body);
	const themeBackground = computedStyles.getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';
	const backgroundColor = new Color(themeBackground);
	scene.background = backgroundColor;
	scene.fog = new Fog(backgroundColor, 14, 55);

	const camera = new PerspectiveCamera(45, 1, 0.1, 1000);
	camera.position.set(0, 3.6, 18);

	const renderer = new WebGLRenderer({ antialias: true, alpha: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFSoftShadowMap;
	containerEl.appendChild(renderer.domElement);
	camera.lookAt(0, 2, 0);

	const ambientLight = new AmbientLight(0xffffff, 0.6);
	scene.add(ambientLight);

	const dirLight = new DirectionalLight(0xffffff, 1);
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

	const planeGeometry = new PlaneGeometry(200, 200);
	const planeMaterial = new ShadowMaterial({ opacity: 0.1, color: 0x000000 });
	const plane = new Mesh(planeGeometry, planeMaterial);
	plane.rotation.x = -Math.PI / 2;
	plane.position.y = -4.8;
	scene.add(plane);

	const colors: RobotColors = {
		orange: 0xff9f43,
		white: 0xffffff,
		darkGray: 0x343a40,
		metal: 0xaabbaa,
		eyeCyan: 0x00d2d3,
		eyeRed: 0xff5252,
		eyeGreen: 0x1dd1a1,
		eyeOff: 0x333333,
		eyePurple: 0xa29bfe,
		eyeCalm: 0x5fbfc0
	};

	const matWhite = new MeshLambertMaterial({ color: colors.white });
	const matOrange = new MeshLambertMaterial({ color: colors.orange });
	const matDark = new MeshLambertMaterial({ color: colors.darkGray });
	const matMetal = new MeshLambertMaterial({ color: colors.metal });
	const matEye = new MeshBasicMaterial({ color: colors.eyeCyan });

	return { scene, camera, renderer, colors, matWhite, matOrange, matDark, matMetal, matEye };
}
