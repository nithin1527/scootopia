import * as THREE from 'three';
import { Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { readGridState, initEventsPromise } from './events.js';

const LIGHT_GRAY = "#F0F0F0";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const GREEN = "#00FF00";

export function init3DEnvironment() {
    
    /* (Setup) 
        Notes:
        - camera, renderer, scene, orbital controls
    */
    const container = document.querySelector('.simulation-area');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(WHITE);

    // camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 200, 500);
    camera.lookAt(0,0,0);

    // renderer
    const renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize( width, height );
    renderer.setPixelRatio(window.devicePixelRatio);
    document.querySelector('.simulation-area').appendChild(renderer.domElement);

    // orbital controls
    const controls = new OrbitControls(camera, renderer.domElement);
    const panOffset = new Vector3(0,0,0);
    camera.position.add(panOffset);
    controls.target.add(panOffset);
    controls.update();

    // lights
    const INTENSITY = 0.5;
    const ambientLight = new THREE.AmbientLight(WHITE, INTENSITY);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(WHITE, INTENSITY);
    directionalLight.position.set(100, 100, 100);
    scene.add(directionalLight);

    /* (Environment -> PLATFORM)
        Notes:
        - platform geometry
        - 3d tiles will be added on top of this platform
    */
   const PLATFORM_WIDTH = 512;
   const PLATFORM_DEPTH = 20;
   const PLATFORM_HEIGHT= 512;
   const SMOOTHNESS = 5;
   const EDGE_RADIUS = 2;
   
   const platformGeo = new RoundedBoxGeometry(PLATFORM_WIDTH, PLATFORM_DEPTH, PLATFORM_HEIGHT, SMOOTHNESS, EDGE_RADIUS);
   const platformMat = new THREE.MeshStandardMaterial({ color: GREEN });
   const platform = new THREE.Mesh(platformGeo, platformMat);
   scene.add(platform);


   async function initSim() {
        const gridObj = await readGridState();
        console.log(gridObj);
   }

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);        
    }
    animate();
    initSim();
}