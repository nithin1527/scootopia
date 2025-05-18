import {Vector3} from "three";
import { getCurrentTile , clip, getRandFromRange, normAngle} from "./util.js";
// import * as constants from "./constants.js";

function getGoalDir(agent) {
	return new Vector3(agent.goal.pos.x - agent.pos.x, 0, agent.goal.pos.z - agent.pos.z).normalize();
}

function getPedestrianTargetDir(agent) {
	let targetPos = agent.curr_path[agent.curr_path_idx].getCenterPos();
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