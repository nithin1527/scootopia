import * as THREE from "three";
import { Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { readGridState } from "./events.js";
import { createAgent, updateAgent } from "./api-client.js";

// COLORS!!!!
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

function getTileProps(type) {
	switch (type) {
		case "grass":
			return {
				color: GRASS,
				roughness: 0.75, // might just do a texture later, same tile look for now
				metalness: 0.05,
			};
		case "sidewalk":
			return {
				color: SIDEWALK,
				roughness: 0.75,
				metalness: 0.05,
			};
		case "road":
			return {
				color: ROAD,
				roughness: 0.75,
				metalness: 0.05,
			};
		case "road-cw":
			return {
				map: new THREE.TextureLoader().load("../assets/textures/road-cw.png"),
				roughness: 0.6,
				metalness: 0.1,
				transparent: true,
				depthWrite: false,
				side: THREE.DoubleSide,
				alphaTest: 0.5,
			};
	}
}

function getTileType(i, j, grid) {
	const tileName = grid[i][j].split("-")[0];
	const hasCrosswalk = grid[i][j].split("-")[1] === "CW";
	if (hasCrosswalk) return "road-cw";
	return tileName;
}

function getCrosswalkTileDir(i, j, grid) {
	const dir = grid[i][j]
		.split("-")
		.find((term) => ["N", "S", "E", "W"].includes(term));
	return dir;
}

export async function init3DEnvironment() {
	/* (Setup) 
        Notes:
        - camera, renderer, scene, orbital controls
    */
	const container = document.querySelector(".simulation-area");
	container.innerHTML = "";
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
	camera.lookAt(0, 0, 0);

	// renderer
	const renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.setSize(width, height);
	renderer.setPixelRatio(window.devicePixelRatio);
	document.querySelector(".simulation-area").appendChild(renderer.domElement);

	// orbital controls
	const controls = new OrbitControls(camera, renderer.domElement);
	const panOffset = new Vector3(0, 0, 0);
	camera.position.add(panOffset);
	controls.target.add(panOffset);
	controls.update();

	// lights
	const hemisphereLight = new THREE.HemisphereLight(
		SUNLIGHT,
		PLATFORM_UNDER,
		2
	);
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

	// group EVERYTHING in the environment
	const world = new THREE.Group();
	scene.add(world);

	// platform prop constants
	const gridObj = await readGridState();
	const PLATFORM_WIDTH = gridObj.resolution === 64 ? 512 : 1024;
	const PLATFORM_HEIGHT = gridObj.resolution === 64 ? 512 : 1024; // this is redudant but if we have time we can explore other dimensions
	const PLATFORM_DEPTH = 20;
	const SMOOTHNESS = 5;
	const EDGE_RADIUS = 2;

	// platform geo
	const platformGeo = new RoundedBoxGeometry(
		PLATFORM_WIDTH,
		PLATFORM_DEPTH,
		PLATFORM_HEIGHT,
		SMOOTHNESS,
		EDGE_RADIUS
	);
	const platformMat = new THREE.MeshStandardMaterial({ color: DIRT });
	const platform = new THREE.Mesh(platformGeo, platformMat);
	platform.receiveShadow = true;
	world.add(platform);

	/* (Environment -> TILES)
        Notes:
        - 3d tiles 
    */
	const numTiles = gridObj.rows;
	const TILE_SIZE = PLATFORM_WIDTH / numTiles;
	const TILE_HEIGHT = 4;
	const TILE_Z_OFFSET = 2.8;
	const TILE_SMOOTHNESS = 5;
	const TILE_RADIUS = 2;
	const tileGeo = new RoundedBoxGeometry(
		TILE_SIZE,
		TILE_HEIGHT,
		TILE_SIZE,
		TILE_SMOOTHNESS,
		TILE_RADIUS
	);

	function placeTile3D(i, j, tileType) {
		const baseTileType = tileType === "road-cw" ? "road" : tileType;
		const tileMat = new THREE.MeshStandardMaterial(getTileProps(baseTileType));
		const tile = new THREE.Mesh(tileGeo, tileMat);

		const moveToLeft = -PLATFORM_WIDTH / 2;
		const moveToBottom = -PLATFORM_HEIGHT / 2;
		const moveToCenter = TILE_SIZE / 2;
		const tileX = moveToLeft + moveToCenter + i * TILE_SIZE;
		const tileY = moveToBottom + moveToCenter + j * TILE_SIZE;
		const tileZ = PLATFORM_DEPTH / 2 + TILE_HEIGHT / 2;
		tile.position.set(tileX, tileZ, tileY);
		tile.castShadow = true;
		tile.receiveShadow = true;

		world.add(tile);

		if (tileType === "road-cw") {
			const crosswalkGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
			const crowsswalkMat = new THREE.MeshStandardMaterial(
				getTileProps("road-cw")
			);
			const crosswalk = new THREE.Mesh(crosswalkGeo, crowsswalkMat);
			crosswalk.rotation.x = -Math.PI / 2;
			const dir = getCrosswalkTileDir(i, j, gridObj.grid);
			if (dir === "N" || dir === "S") crosswalk.rotation.z = Math.PI / 2;

			crosswalk.position.set(tileX, tileZ + TILE_Z_OFFSET, tileY);
			crosswalk.receiveShadow = true;
			crosswalk.castShadow = true;
			world.add(crosswalk);
		}

		return tile.position;
	}

	const tileObjsDict = new Map();
	for (let i = 0; i < numTiles; i++) {
		for (let j = 0; j < numTiles; j++) {
			const tileType = getTileType(i, j, gridObj.grid);
			const pos = placeTile3D(i, j, tileType);
			const tileObj = new Tile(
				i * numTiles + j,
				i,
				j,
				pos.x,
				pos.y,
				pos.z,
				tileType,
				TILE_SIZE
			);
			const tileId = i * numTiles + j;
			tileObjsDict.set(tileId, tileObj);
		}
	}
	world.rotation.y = Math.PI / 2;

	/* (Agents -> LOADING)
        Notes:
        - loading in the agent models, cartoonish style
    */
	// filter tiles by type
	function getAllTilesOfType(type = "sidewalk", grid) {
		const tiles = [];
		for (let i = 0; i < grid.length; i++) {
			for (let j = 0; j < grid[i].length; j++) {
				const tileId = i * grid.length + j;
				const tileType = grid[i][j].split("-")[0];
				if (tileType === type) tiles.push(tileObjsDict.get(tileId));
			}
		}
		return tiles;
	}

	// random initial position in grid with given type
	function getInitialPosInGrid(type, grid) {
		const tiles = getAllTilesOfType(type, grid);
		const tileId = Math.floor(Math.random() * tiles.length);
		const randomTile = tiles[tileId];
		return { pos: randomTile.getRandomPosIn(), id: randomTile.id };
	}

	// sidewalk for MMV and pedestrian, road for driver
	const { pos, id } = getInitialPosInGrid("sidewalk", gridObj.grid);
	const minNumOfTiles = 10;
	function manhattanDist(a, b) {
		return Math.abs(a.x - b.y) + Math.abs(a.y - b.y);
	}

	// random goal position, same tile type as initial position
	// at least minNumOfTiles away from initial position
	function getGoalPosInGrid(type, grid, id) {
		const tiles = getAllTilesOfType(type, grid);
		const initialTile = tileObjsDict.get(id);
		const validTiles = tiles.filter((tile) => {
			return tile.id !== id && manhattanDist(tile, initialTile) > minNumOfTiles;
		});
		const goalTileId = Math.floor(Math.random() * validTiles.length);
		const goalTile = validTiles[goalTileId];
		return goalTile.getRandomPosIn();
	}

	const goalPos = getGoalPosInGrid("sidewalk", gridObj.grid, id);

	// ccylinder placeholder for agent
	const agentGeo = new THREE.CylinderGeometry(10, 10, 50, 50);
	const RED = "#FF0000";
	const agentMat = new THREE.MeshStandardMaterial({ color: RED });
	const agent = new THREE.Mesh(agentGeo, agentMat);
	const AGENT_HEIGHT = 50;
	agent.position.copy(pos);
	agent.position.y = PLATFORM_DEPTH / 2 + TILE_HEIGHT / 2 + AGENT_HEIGHT / 2;
	agent.castShadow = true;
	agent.receiveShadow = true;
	world.add(agent);

	// create agent in api
	const agentData = {
		position: [agent.position.x, agent.position.y],
		goal_position: [goalPos.x, goalPos.y],
		heading_angle: 0,
		length: 20,
		width: 20,
	};

	var agentId = 0;
	createAgent(agentData)
		.then((response) => {
			console.log("Agent created successfully:", response);
			agentId = response.agent_id; // incorrect agent id
		})
		.catch((error) => {
			console.error("Error:", error);
		});

	// goal is a cone
	const goalGeo = new THREE.ConeGeometry(10, 50, 50);
	const CYAN = "#00FFFF";
	const goalMat = new THREE.MeshStandardMaterial({ color: CYAN });
	const goal = new THREE.Mesh(goalGeo, goalMat);
	const GOAL_HEIGHT = 50;
	goal.position.copy(goalPos);
	goal.position.y = PLATFORM_DEPTH / 2 + TILE_HEIGHT / 2 + GOAL_HEIGHT / 2;
	goal.castShadow = true;
	goal.receiveShadow = true;
	world.add(goal);

	// temp! replace with icon later
	let isAgentMoving = false;
	window.addEventListener("keydown", (event) => {
		if (event.code === "Space") {
			isAgentMoving = !isAgentMoving;
		}
	});

	// very very basic agent movement <-- change to kinematics equations!
	const dt = 0.1;
	function updateAgentPos(agentId) {
		if (!isAgentMoving) return;
		else {
			updateAgent(agentId, dt)
				.then((response) => {
					console.log("Agent updated successfully:", response);
					agent.position.x = response.agent.position[0];
					agent.position.z = response.agent.position[1];
				})
				.catch((error) => {
					console.error("Error:", error);
				});
			if (agent.position.distanceTo(goal.position) < 1) {
				isAgentMoving = false;
				console.log("Agent reached the goal!");
			}
		}

		// const dir = new Vector3(
		// 	goalPos.x - agent.position.x,
		// 	0,
		// 	goalPos.z - agent.position.z
		// );
		// dir.normalize();
		// agent.position.add(dir.multiplyScalar(dt));
	}

	function animate() {
		requestAnimationFrame(animate);
		renderer.render(scene, camera);
		updateAgentPos(agentId);
	}
	animate();
}

class Tile {
	constructor(id, grid_i, grid_j, word_x, world_y, world_z, type, size) {
		this.id = id;
		this.i = grid_i;
		this.j = grid_j;
		this.x = word_x;
		this.depth = world_z;
		this.y = world_y;
		this.type = type;
		this.size = size;
	}

	getRandomPosIn(margin = 0.2) {
		const newSize = this.size * (1 - margin); // margin to prevent exactly on edge cases
		const x = this.x + (Math.random() - 0.5) * newSize;
		const y = this.y + (Math.random() - 0.5) * newSize;
		return new Vector3(x, y, this.depth);
	}
}
