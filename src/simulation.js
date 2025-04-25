import * as THREE from 'three';
import { Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { readGridState } from './events.js';

const LIGHT_GRAY = "#F0F0F0";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const GREEN = "#00FF00";
const MUTED_GRAY = "#CCDCDA";
const DIRT = "#D2B48C";
const SUNLIGHT = "#FFF3E0";
const PLATFORM_UNDER = "#080820";

const SIDEWALK = "#D6D3D1";
// const ROAD = "#444444"; // i like this one too
const ROAD = "#333333";
// const GRASS = "#22C55E"; // i like this one too
const GRASS = "#16A34A";

export async function init3DEnvironment() {
    
    /* (Setup) 
        Notes:
        - camera, renderer, scene, orbital controls
    */
    const container = document.querySelector('.simulation-area');
    container.innerHTML = '';
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(WHITE);

    // camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const res = (await readGridState()).resolution;
    camera.position.set(0, res === 32 ? 600 : 200, res === 32 ? 950 : 450);
    camera.far = 5000;
    camera.updateProjectionMatrix();
    camera.lookAt(0,0,0);

    // renderer
    const renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    const hemisphereLight = new THREE.HemisphereLight(SUNLIGHT, PLATFORM_UNDER, 2);
    scene.add(hemisphereLight);

    const INTENSITY = 2;
    const directionalLight = new THREE.DirectionalLight(SUNLIGHT, INTENSITY);
    directionalLight.position.set(100, 100, 100);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    /* (Environment -> PLATFORM)
        Notes:
        - platform geometry
        - 3d tiles will be added on top of this platform
    */

    const world = new THREE.Group();
    scene.add(world);

    const gridObj = await readGridState();
    const PLATFORM_WIDTH = gridObj.resolution === 64 ? 512 : 1024;
    const PLATFORM_HEIGHT = gridObj.resolution === 64 ? 512 : 1024; // this is redudant but if we have time we can explore other dimensions
    const PLATFORM_DEPTH = 20;
    const SMOOTHNESS = 5;
    const EDGE_RADIUS = 2;
    
    const platformGeo = new RoundedBoxGeometry(PLATFORM_WIDTH, PLATFORM_DEPTH, PLATFORM_HEIGHT, SMOOTHNESS, EDGE_RADIUS);
    const platformMat = new THREE.MeshStandardMaterial({ color: DIRT });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.receiveShadow = true;
    world.add(platform);
    
    /* (Environment -> TILES)
        Notes:
        - 3d tiles 
    */
    
    let numTiles = gridObj.rows;
    const TILE_SIZE = PLATFORM_WIDTH / numTiles;
    const TILE_HEIGHT = 4;
    const TILE_Z_OFFSET = 2.8;
    const TILE_SMOOTHNESS = 5;
    const TILE_RADIUS = 2;
    
    const tileGeo = new RoundedBoxGeometry(TILE_SIZE, TILE_HEIGHT, TILE_SIZE, TILE_SMOOTHNESS, TILE_RADIUS);

    for (let i = 0; i < numTiles; i++) {
        for (let j = 0; j < numTiles; j++) {

            const tileType = getTileType(i,j, gridObj.grid);
            let baseTileType;
            if (tileType === 'road-cw') {
                baseTileType = 'road';
            } else {
                baseTileType = tileType;
            }
            const tileMat = new THREE.MeshStandardMaterial(getTileProps(baseTileType));
            const tile = new THREE.Mesh(tileGeo, tileMat);

            const moveToLeft = -PLATFORM_WIDTH / 2;
            const moveToBottom = -PLATFORM_HEIGHT / 2;
            const moveToCenter = TILE_SIZE / 2;
            const tileX = moveToLeft + moveToCenter + (i * TILE_SIZE);
            const tileY = moveToBottom + moveToCenter + (j * TILE_SIZE);
            const tileZ = PLATFORM_DEPTH / 2 + TILE_HEIGHT / 2;
            tile.position.set(tileX, tileZ, tileY);

            tile.castShadow = true;
            tile.receiveShadow = true;

            world.add(tile);

            if (tileType === 'road-cw') {
                const crosswalkGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
                const crowsswalkMat = new THREE.MeshStandardMaterial(getTileProps('road-cw'));
                const crosswalk = new THREE.Mesh(crosswalkGeo, crowsswalkMat);
                crosswalk.rotation.x = -Math.PI / 2;
                const dir = getCrosswalkTileDir(i,j, gridObj.grid);
                if (dir === 'N' || dir === 'S') {
                    crosswalk.rotation.z = Math.PI / 2;
                }
                crosswalk.position.set(tileX, tileZ + TILE_Z_OFFSET, tileY);
                crosswalk.receiveShadow = true;
                crosswalk.castShadow = true;
                world.add(crosswalk);
            }
            
        }
    }

    world.rotation.y = Math.PI / 2;

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);        
    }
    animate();
}

function getTileProps(type) {
    switch (type) {
        case 'grass':
            return {
                color: GRASS,
                roughness: 0.75,
                metalness: 0.05,
            }
        case 'sidewalk':
            return {
                color: SIDEWALK,
                roughness: 0.75,
                metalness: 0.05,
            }
        case 'road':
            return {
                color: ROAD,
                roughness: 0.75,
                metalness: 0.05,
            }
        case 'road-cw':
            return {
                map: new THREE.TextureLoader().load('../assets/textures/road-cw.png'),
                roughness: 0.6,
                metalness: 0.1,
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide,
                alphaTest: 0.5,
            }
    }
}

function getTileType(i,j, grid) {
    const tileName = grid[i][j].split('-')[0];
    const hasCrosswalk = grid[i][j].split('-')[1] === 'CW';
    if (hasCrosswalk) return 'road-cw';
    return tileName;
}

function getCrosswalkTileDir(i,j, grid) {
    const dir = grid[i][j].split('-').find(term => ['N', 'S', 'E', 'W'].includes(term));
    return dir;
}