import {Vector3} from "three";
import { getCurrentTile , clip, getRandFromRange, normAngle, distance} from "./util.js";
import { MAX_VELOCITY } from "../constants.js";

function refocusAgent(agent, renderMeta) {
	if (agent.distracted) {
		// intrinsic refocus
		const intrinsic = Math.random() * 100 > agent.risk * 1.5;

		// extrinsic refocus based on relative velocity
		const query_radius = agent.distracted ? renderMeta.tileProps.width : renderMeta.tileProps.width / 3 * 5;
        const fov = agent.distracted ? Math.PI / 4 : Math.PI / 2;
		let avgRelVel = 0;
		if (renderMeta.agents && renderMeta.agents.length > 1) {
			let sum = 0, count = 0;
			for (let other of renderMeta.agents) {
				if (other.id != agent.id && other.mesh) {
					if (other.type === 'pedestrian' || (other.type === 'mmv' && other.isDismounted) || other.type === 'driver') {
						if (!agent.withinFOV(other, query_radius, fov)) continue;
						if (other !== agent && other.v !== undefined) {
							const relVel = Math.abs(agent.v - other.v);
							sum += relVel;
							count++;
						}
					}
				}
			}
			if (count > 0) avgRelVel = sum / count;
		}

		const extrinsic = Math.random() < avgRelVel / (2 * MAX_VELOCITY);

		if (intrinsic) {
			console.log("Agent " + agent.id + " refocused due to intrinsic.");
		}
		if (extrinsic) {
			console.log("Agent " + agent.id + " refocused due to extrinsic.");
		}
		if (intrinsic || extrinsic) {
			agent.distracted = false;
		}
	}
}

function getGoalDir(agent) {
	return new Vector3(agent.goal.pos.x - agent.pos.x, 0, agent.goal.pos.z - agent.pos.z).normalize();
}

function getPedestrianTargetDir(agent) {
	const currIdx = agent.curr_path_idx;
	const targetTile = agent.curr_path[currIdx];
	const targetPos = targetTile.getCenterPos().clone();
	if (agent.distracted) {
		// only compute a new offset if agent is at a new tile
		if (agent.lastFuzzyIdx !== currIdx || !agent.fuzzyOffset) {
			const dist = distance(agent.pos, targetPos);
			const semiMinor = 0.1 * dist;
			const semiMajor = 0.2 * dist;
			const theta = agent.heading_angle;
			const randAngle = Math.random() * 2 * Math.PI;
			const r = Math.sqrt(Math.random());
			const x = r * semiMajor * Math.cos(randAngle);
			const z = r * semiMinor * Math.sin(randAngle);
			const rotatedX = x * Math.cos(theta) - z * Math.sin(theta);
			const rotatedZ = x * Math.sin(theta) + z * Math.cos(theta);

			agent.fuzzyOffset = new Vector3(rotatedX, 0, rotatedZ);
			agent.lastFuzzyIdx = currIdx;
		}

		targetPos.add(agent.fuzzyOffset);
	}

	return new Vector3(targetPos.x - agent.pos.x, 0, targetPos.z - agent.pos.z);
}


function getPedestrianAction(agent) {
	if (agent.curr_path_idx < agent.curr_path.length) {
		let dirToTile = getPedestrianTargetDir(agent);
		if (dirToTile.length() < getRandFromRange(5,20)) { agent.curr_path_idx++; }
	}
	const targetDir = agent.curr_path_idx < agent.curr_path.length ? getPedestrianTargetDir(agent) : getGoalDir(agent);
	return {vx:targetDir.x, vz:targetDir.z}
}

export function stepPedestrian(agent, dt, renderMeta) {
	refocusAgent(agent, renderMeta);
	if (agent.mesh && !agent.reachedGoal()) {
		agent.step(dt, getPedestrianAction(agent), renderMeta);
	} else {
		agent.removeFromWorld(renderMeta.world);
	}
}

export function getAccel(agent, curr_tile) {
	if (curr_tile && curr_tile.type === 'road-cw' && agent.v >= MAX_VELOCITY * 0.5) { // slow down on crosswalk
		return -0.2;
	} else if (agent.v < MAX_VELOCITY) { 
		return 0.2 
	} else {
		return 0.0;
	}
}

function getActionFromDir(dir, agent, renderMeta) {
	const curr_tile = getCurrentTile(agent.pos, renderMeta.tileDict, renderMeta.tileProps);
	const targetHeading = Math.atan2(dir.z, dir.x);
	let angleDiff = normAngle(targetHeading - agent.heading_angle);
	let steer = clip(angleDiff / Math.PI , -1, 1);
	return {accel:getAccel(agent, curr_tile), steer:steer}
}

function getDriverTargetDir(agent) {
	let targetPos = agent.curr_path[agent.curr_path_idx].getCenterPos();
	return new Vector3(targetPos.x - agent.pos.x, 0, targetPos.z - agent.pos.z);
}

function getDriverAction(agent, renderMeta) {
	if (agent.curr_path_idx < agent.curr_path.length) {
		let dirToTile = getDriverTargetDir(agent);
		if (dirToTile.length() < 64) { agent.curr_path_idx++; }
	}
	const targetDir = agent.curr_path_idx < agent.curr_path.length ? getDriverTargetDir(agent) : getGoalDir(agent);
	return getActionFromDir(targetDir, agent, renderMeta);
}

export function stepDriver(agent, dt, renderMeta) {
	if (agent.mesh && !agent.reachedGoal()) { 
		agent.step(dt, getDriverAction(agent, renderMeta), renderMeta);
	} else {
		agent.removeFromWorld(renderMeta.world);
	}
}

function mountAction(agent, renderMeta) {
	const driver_action = getDriverAction(agent, renderMeta);
	return {dismount:0, accel:driver_action.accel, steer:driver_action.steer, vx: 0, vz:0};
}

function dismountAction(agent) {
	const pedestrian_action = getPedestrianAction(agent);
	return {dismount:1, accel:0, steer:0, vx:pedestrian_action.vx, vz:pedestrian_action.vz}
}

export function stepMMV(agent, dt, renderMeta) {
	if (agent.mesh && !agent.reachedGoal()) {
		const action = agent.isDismounted ? dismountAction(agent) : mountAction(agent, renderMeta);
		agent.step(dt, action, renderMeta);
	} else {
		agent.removeFromWorld(renderMeta.world);
	}
}