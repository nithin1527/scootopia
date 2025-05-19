import * as THREE from "three";
import { Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { readGridState } from "./events.js";
import { Tile } from "./classes/grid-classes.js";
import { getTileFromGridLoc } from "./classes/util.js";
import { Goal, Pedestrian, Driver, MMV } from "./classes/agent-classes.js";
import { getPath } from "./classes/path-finding.js";
import { stepPedestrian, stepMMV, stepDriver } from "./classes/step.js";

import * as constants from "./constants.js";
Object.assign(window, constants);

/* (Setup) 
	Notes:
	- camera, renderer, scene, orbital controls
*/
async function setupWorld() {
	
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

	return [world, renderer, scene, camera]
}

/* (Environment -> PLATFORM)
	Notes:
	- platform base
*/
function setupPlatform(world, gridObj) {
	// platform prop constants
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

	return { width: PLATFORM_WIDTH, height: PLATFORM_HEIGHT, depth: PLATFORM_DEPTH }
}

/* (Environment -> TILES)
	Notes:
	- 3d tiles 
*/
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

function setupTiles(world, gridObj, pf_w, pf_h, pf_d) {
	const numTiles = gridObj.rows;
	const TILE_SIZE = pf_w / numTiles;
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

		const moveToLeft = -pf_w / 2;
		const moveToBottom = -pf_h / 2;
		const moveToCenter = TILE_SIZE / 2;
		const tileX = moveToLeft + moveToCenter + i * TILE_SIZE;
		const tileY = moveToBottom + moveToCenter + j * TILE_SIZE;
		const tileZ = pf_d / 2 + TILE_HEIGHT / 2;
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
	for (let j = 0; j < numTiles; j++) {
		for (let i = 0; i < numTiles; i++) {
			const tileType = getTileType(i, j, gridObj.grid);
			const fullTileType = gridObj.grid[j][i];
			let isEdgeTile = false;
			if (i == 0 || j == 0 || i == numTiles - 1 || j == numTiles - 1) isEdgeTile = true;
			const pos = placeTile3D(i, j, tileType);
			const tileObj = new Tile(
				i * numTiles + j,
				i, j,
				pos.x, pos.y, pos.z,
				tileType, TILE_SIZE,
				isEdgeTile,
				fullTileType
			);
			const tileId = i * numTiles + j;
			tileObjsDict.set(tileId, tileObj);
		}
	}
	// world.rotation.y = Math.PI / 2;
	return [tileObjsDict, {width: TILE_SIZE, height: TILE_HEIGHT, zOffset: TILE_Z_OFFSET}]
}

/* (Agents -> TILE FILTERS)
    Notes:
    - tile filtering logic for assigning initial and goal positions
*/
// filter tiles by type
function getAllTilesOfType(type = "sidewalk", grid, tileDict) {
	const tiles = [];
	for (let i = 0; i < grid.length; i++) {
		for (let j = 0; j < grid[i].length; j++) {
			const tileId = i * grid.length + j;
			const tileType = grid[i][j].split("-")[0];
			if (tileType === type) tiles.push(tileDict.get(tileId));
		}
	}
	return tiles;
}

function getAllEdgeTilesOfType(type, grid, tileDict) {
	let tiles = getAllTilesOfType(type, grid, tileDict);
	return tiles.filter(tile => tile.isEdgeTile);
}

function getGoalsFromEdgeTiles(tiles, numTiles) {
	return tiles.map(tile => new Goal(
		null, 
		tile.getEdgeCenterPos(numTiles), 
		tile.type, 
		tile.grid_loc,
		tile.fullTileType,
	));
}

/* (Agents -> SPAWN)
    Notes:
    - spawn agents in the environment
	- spawn goals for debug
*/
function manhattanDist(a, b) {
	return Math.abs(a.x - b.y) + Math.abs(a.y - b.y);
}

// -- debug
function spawnGoals(goals, renderMeta) {
	goals.forEach(goal => goal.render(renderMeta));
}

function getRandomObjFromList(list) {
	return list[Math.floor(Math.random() * list.length)];
}

function getRandomCorrectRoadGoal(driverAgent, roadGoals, num_tiles) {
	const start_i = driverAgent.startTile.grid_loc.x
	const start_j = driverAgent.startTile.grid_loc.y;
	const startTile_dir = driverAgent.startTile.fullTileType.split('-').find(part => ['N', 'S', 'E', 'W'].includes(part));

	// condition 1: remove goals behind or in the same row as the car (assuming North perspective)
	const firstFilteredGoals = roadGoals.filter(g => {
		const goal_i = g.grid_loc.x, goal_j = g.grid_loc.y; 
		switch (startTile_dir) {
			case 'N':
				if (goal_i === start_i && goal_j > start_j) return false;
				break;
			case 'S':
				if (goal_i === start_i && goal_j < start_j) return false;
				break;
			case 'E':
				if (goal_j === start_j && goal_i > start_i) return false;
				break;
			case 'W':
				if (goal_j === start_j && goal_i < start_i) return false;
				break;
		}
		return true;
	});

	// condition 2: correct goal rules for each start dir
	const correctGoals = [];
	for (const g of firstFilteredGoals) {
		const goal_i = g.grid_loc.x; 
		const goal_j = g.grid_loc.y;
		const goalTile_dir = g.fullTileType.split('-').find(part => ['N', 'S', 'E', 'W'].includes(part));
		
		let isCorrect = false;

		// assume driiving on the left side
		switch (startTile_dir) {
			case 'N':
				if (goal_j === 0 && goalTile_dir === 'N') isCorrect = true; // north
				else if (goal_i === num_tiles - 1 && goalTile_dir === 'E' && goal_j <= start_j) isCorrect = true; // right is east
				else if (goal_i === 0 && goalTile_dir === 'W' && goal_j <= start_j) isCorrect = true; // left is west
				break;
			case 'S':
				if (goal_j === num_tiles - 1 && goalTile_dir === 'S') isCorrect = true; // south
				else if (goal_i === 0 && goalTile_dir === 'W' && goal_j >= start_j) isCorrect = true; // right is west
				else if (goal_i === num_tiles - 1 && goalTile_dir === 'E' && goal_j >= start_j) isCorrect = true; // left is east
				break;
			case 'E':
				if (goal_i === 0 && goalTile_dir === 'E') isCorrect = true; // east
				else if (goal_j === 0 && goalTile_dir === 'S' && goal_i <= start_i) isCorrect = true; // right is south
				else if (goal_j === num_tiles - 1 && goalTile_dir === 'N' && goal_i <= start_i) isCorrect = true; // left is north
				break;
			case 'W':
				if (goal_i === num_tiles - 1 && goalTile_dir === 'W') isCorrect = true; // west
				else if (goal_j === num_tiles - 1 && goalTile_dir === 'N' && goal_i >= start_i) isCorrect = true; // right is north
				else if (goal_j === 0 && goalTile_dir === 'S' && goal_i >= start_i) isCorrect = true; // left is south
				break;
		}
		if (isCorrect) correctGoals.push(g);
	}
	return correctGoals.length > 0 ? getRandomObjFromList(correctGoals) : null;
}

function assignStartPos(agents, worldAgents, tiles, minManhattanDist, renderMeta, minSep = 800) {
	let vehicleTiles = tiles.slice();

	for (let agent of agents) {
		let placed = false, attempts = 0;
		
		while (!placed && attempts++ < 100) {

			const tile = agent.type === 'driver' ? getRandomObjFromList(vehicleTiles) : getRandomObjFromList(tiles);
			const candidatePos = agent.type === "driver" ? tile.getCenterPos() : tile.getRandomPosIn();

			// condition 1: check minimum distance to goal so that agent is movable
			if (manhattanDist(tile.grid_loc, agent.goal.grid_loc) <= minManhattanDist)
				continue
			
			// condition 2: agents should not be too close to each other
			if (
				(agent.type !== 'driver') && worldAgents
				.filter(a => a.startTile === agent.startTile)
				.some(a => Math.hypot(candidatePos.x - a.pos.x, candidatePos.z - a.pos.z) < minSep)
			) { continue }

			// condition 3: at most 1 driver agent can occupy a tile
			if ( (agent.type === 'driver') && worldAgents.some(a => a.startTile === tile))
				continue
			
			// render agent at candidate pos (NOT A VALID SPAWN YET)
			agent.setPos(candidatePos);
			agent.setStartTile(tile);
			if (agent.type === 'mmv') {
				agent.isDismounted = tile.type === 'sidewalk' ? false : false;
			}
			agent.setStartPos(agent.pos);
			agent.render(renderMeta);

			// condition 4: driver agent should be contained completely within the start tile
			if (agent.type === 'driver') {
				const tileSizeHalf = renderMeta.tileProps.width / 2;
				const tileCenter = tile.getCenterPos();
				const minTileX = tileCenter.x - tileSizeHalf;
				const maxTileX = tileCenter.x + tileSizeHalf;
				const minTileZ = tileCenter.z - tileSizeHalf;
				const maxTileZ = tileCenter.z + tileSizeHalf;
				if (candidatePos.x < minTileX || candidatePos.x > maxTileX || candidatePos.z < minTileZ || candidatePos.z > maxTileZ) {
					agent.removeFromWorld(renderMeta.world);
					continue;
				}
			}

			// condition 5: agents should not overlap with each other
			const collision = worldAgents.filter(a => a !== agent && a.mesh).some(a => a.collides(agent));
			if (!collision) {
				placed = true;
				worldAgents.push(agent);
				if (agent.type === 'driver')
					vehicleTiles = vehicleTiles.filter(t => t !== tile);
			} else { agent.removeFromWorld(renderMeta.world); }
		}
	}
}

function spawnSingleAgent(type, agents, renderMeta, debug = false) {
	let currAgents = agents.filter(a => a.type === type);
	const agent = currAgents[0];
	agent.initDynamics();
	agent.render(renderMeta);
	if (debug) agent.goal.render(renderMeta);
	
	const start_tile = agent.startTile;
	const goal_tile = getTileFromGridLoc(agent.goal.grid_loc, renderMeta.tileDict);

	if (start_tile && goal_tile) {
		const path = getPath(start_tile, goal_tile, renderMeta.tileDict, agent.type);
		if (path) {
			agent.curr_path = path;
			agent.curr_path_idx = 0;
			agent.goal_tile = goal_tile;
		}
	}
	return agent;
}

function spawnAllAgents(agents, renderMeta) {
	for (let agent of agents) {
		agent.initDynamics();
		agent.render(renderMeta);
		const start_tile = agent.startTile;
		const goal_tile = getTileFromGridLoc(agent.goal.grid_loc, renderMeta.tileDict);
		if (start_tile && goal_tile) {
			const path = getPath(start_tile, goal_tile, renderMeta.tileDict, agent.type);
			if (path) {
				agent.curr_path = path;
				agent.curr_path_idx = 0;
				agent.goal_tile = goal_tile;
			}
		}
	}
}

function updatePosition(agents, dt, renderMeta) {
	for (let agent of agents) {
		switch (agent.type) {
			case 'pedestrian':
				stepPedestrian(agent, dt, renderMeta);
				break;
			case 'mmv':
				stepMMV(agent, dt, renderMeta);
				break;
			default:
				stepDriver(agent, dt, renderMeta);
				break;
		}
	}
}

// for debugging
function updateSingleAgentPosition(agent, dt, renderMeta) {
	switch (agent.type) {
		case 'pedestrian':
			stepPedestrian(agent, dt, renderMeta);
			break;
		case 'mmv':
			stepMMV(agent, dt, renderMeta);
			break;
		default:
			stepDriver(agent, dt, renderMeta);
			break;
	}
}

// later - change this to normal distribution based on data
function generateRiskForAgent(risk) {
	const max = risk + 10;
	const min = risk - 10;
	const range = max - min;
	const randVal = Math.floor(Math.random() * range + min)
	return Math.max(0, Math.min(randVal, 100));
}

export async function init3DEnvironment() {

	// environment setup
	let [world, renderer, scene, camera] = await setupWorld();
	const gridObj = await readGridState();
	let pfProps = setupPlatform(world, gridObj);
	let [tileDict, tileProps] = setupTiles(world, gridObj, pfProps.width, pfProps.height, pfProps.depth);

	// goal creation
	let roadGoalTiles = getAllEdgeTilesOfType("road", gridObj.grid, tileDict);
	let sidewalkGoalTiles = getAllEdgeTilesOfType("sidewalk", gridObj.grid, tileDict);
	let roadGoalObjs = getGoalsFromEdgeTiles(roadGoalTiles, gridObj.rows);
	let sidewalkGoalObjs = getGoalsFromEdgeTiles(sidewalkGoalTiles, gridObj.rows);
	
	// goal id mapping
	let goal_id_counter = 0;
	roadGoalObjs.forEach(goal => goal.id = goal_id_counter++);
	sidewalkGoalObjs.forEach(goal => goal.id = goal_id_counter++);

	// --debug goal visualization
	const renderMeta = {world, pfProps, tileProps};
	// spawnGoals(roadGoalObjs, renderMeta);
	// spawnGoals(sidewalkGoalObjs, renderMeta);

	// density param logic: controls number of agents in simulation
	const roadTiles = getAllTilesOfType("road", gridObj.grid, tileDict);
	const validRoadTiles = roadTiles.filter(tile => !tile.fullTileType.includes('X'));
	const sidewalkTiles = getAllTilesOfType("sidewalk", gridObj.grid, tileDict);
	const density = parseInt(document.getElementById('densityRangeInput').value, 10);
	const risk = parseInt(document.getElementById('riskRange').value, 10);
	console.log("density:", density, "risk:", risk);
	
	const NUM_CARS_LIMITER = 0.3;
	const NUM_PEDESTRIANS_LIMITER = 0.7;
	const NUM_MMV_LIMITER = 0.7;
	
	const maxDrivers = validRoadTiles.length * NUM_CARS_LIMITER;
	const maxPedestrians = Math.floor(sidewalkTiles.length * NUM_PEDESTRIANS_LIMITER);
	const maxMMVs = Math.floor(sidewalkTiles.length * NUM_MMV_LIMITER);

	const numDrivers = Math.floor( (density / 10) * maxDrivers );
	const numPedestrians = Math.floor( (density / 10) * maxPedestrians );
	const numMMVs = Math.floor( (density / 10) * maxMMVs );

	// --debug density output change
	// console.log("numDrivers:", numDrivers, "numPedestrians:", numPedestrians, "numMMVs:", numMMVs);

	// agent creation: assign random respective goals
	const getRandomGoal = goals => goals[Math.floor(Math.random() * goals.length)];
	let id_counter = 0;
	const pedestrianAgents = Array.from({ length: numPedestrians }, 
		() => new Pedestrian(id_counter++, null, getRandomGoal(sidewalkGoalObjs), null, generateRiskForAgent(risk))
	);
	const driverAgents = Array.from({ length: numDrivers }, 
		() => new Driver(id_counter++, null, getRandomGoal(roadGoalObjs), null, generateRiskForAgent(risk))
	);
	const mmvAgents = Array.from({ length: numMMVs }, 
		() => new MMV(id_counter++, null, getRandomGoal(sidewalkGoalObjs.concat(roadGoalObjs)), null, generateRiskForAgent(risk))
	);

	// agent start_pos initialization
	let agents = [];
	const minManhattanDist = 3;
	assignStartPos(pedestrianAgents, agents, sidewalkTiles, minManhattanDist, renderMeta);
	assignStartPos(mmvAgents, agents, sidewalkTiles, minManhattanDist, renderMeta);
	assignStartPos(driverAgents, agents, validRoadTiles, minManhattanDist, renderMeta);
	
	driverAgents.forEach(agent => {
		const correctGoal = getRandomCorrectRoadGoal(agent, roadGoalObjs, gridObj.rows);
		if (correctGoal) agent.setGoal(correctGoal);
	});

	mmvAgents.forEach(agent => {
		if (agent.goal.type === 'road' && agent.startTile.type === 'road') {
			const correctGoal = getRandomCorrectRoadGoal(agent, roadGoalObjs, gridObj.rows);
			if (correctGoal) agent.setGoal(correctGoal);
		}
	});

	console.log(mmvAgents);
	
	// clear meshes rendered when spawning
	agents.forEach(agent => agent.removeMeshFromWorld(renderMeta.world));

	// just give type name "pedestrian", "driver", "mmv"
	let newRenderMeta = {world, pfProps, tileProps, tileDict, agents};
	let debugAgent = spawnSingleAgent("pedestrian", agents, newRenderMeta, true);
	console.log(debugAgent);

	// spawnAllAgents(agents, newRenderMeta);

	const dt = 0.05;   
	let isAgentMoving = false;
	function update() {
		if (!isAgentMoving) return;
		newRenderMeta = {world, pfProps, tileProps, tileDict, agents};
		// updatePosition(agents, dt, newRenderMeta);
		updateSingleAgentPosition(debugAgent, dt, newRenderMeta);
	}

	window.addEventListener("keydown", (event) => {if (event.code == "Space") isAgentMoving = !isAgentMoving});

	function animate() {
		requestAnimationFrame(animate);
		renderer.render(scene, camera);
		update();
	}
	animate();
}

document.getElementById("densityRangeInput").addEventListener("input", async function () {
	await init3DEnvironment();
});

document.getElementById("riskRange").addEventListener("input", async function () {
	await init3DEnvironment();
});