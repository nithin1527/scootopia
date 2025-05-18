import {Vector3} from "three";
import { getCurrentTile , clip, getRandFromRange, normAngle} from "./util.js";

function getPedestrianDir(agent) {
	let targetPos = agent.curr_path[agent.curr_path_idx].getCenterPos();
	return new Vector3(targetPos.x - agent.pos.x, 0, targetPos.z - agent.pos.z).normalize();
}

function nonGoalTileAction_pedestrian(agent) {
	let dirToTile = getPedestrianDir(agent);
	if (dirToTile.length() < getRandFromRange(5,20)) { agent.curr_path_idx++; }
	if (agent.curr_path_idx < agent.curr_path.length) {
		dirToTile = getPedestrianDir(agent);
		return {vx: dirToTile.x, vz: dirToTile.z};
	}
	return null;
}

function goalTileAction_pedestrian(agent) {
	let goal_dir = new Vector3(agent.goal.pos.x - agent.pos.x, 0, agent.goal.pos.z - agent.pos.z).normalize();
	return {vx: goal_dir.x, vz: goal_dir.z}; 
}

export function stepPedestrian(agent, dt, renderMeta) {
	let action = {vx:0,vz:0};
	if (agent.mesh && !agent.reachedGoal()) { 
		action = agent.curr_path_idx < agent.curr_path.length ? nonGoalTileAction_pedestrian(agent) : goalTileAction_pedestrian(agent);
		agent.step(dt, action, renderMeta);
	} else {
		agent.removeFromWorld(renderMeta.world);
	}
}

export function getAccel(agent, curr_tile) {
	const MAV_VEL = 10.0;
	if (curr_tile.type === 'road-cw' && agent.v >= MAV_VEL * 0.5) { // slow down on crosswalk
		return -0.1;
	} else if (agent.v < MAV_VEL) {
		return 0.3
	} else {
		return 0.0;
	}
}

export function stepDriver(agent, dt, renderMeta) {
	let action = {dismount:1, accel:0, steer:0};
	if (agent.mesh &&!agent.reachedGoal()) {
		if (agent.curr_path_idx < agent.curr_path.length) {
			let targetTile = agent.curr_path[agent.curr_path_idx];
			let targetPos = targetTile.getCenterPos();
			let dirToTile = new Vector3(targetPos.x - agent.pos.x, 0, targetPos.z - agent.pos.z);
			if (dirToTile.length() < 64 ) { agent.curr_path_idx++; }

			if (agent.curr_path_idx < agent.curr_path.length) {
				// todo
				const curr_tile = getCurrentTile(agent.pos, renderMeta.tileDict, renderMeta.tileProps);
				const targetHeading = Math.atan2(dirToTile.z, dirToTile.x);
				let angleDiff = normAngle(targetHeading - agent.heading_angle);
				let max_angle = Math.PI;
				let steer = clip(angleDiff / max_angle, -1, 1);
				action = {accel:getAccel(agent, curr_tile), steer:steer};
			}
		} else {
			let goal_dir = new Vector3(agent.goal.pos.x - agent.pos.x, 0, agent.goal.pos.z - agent.pos.z);
			goal_dir.normalize();
			const curr_tile = getCurrentTile(agent.pos, renderMeta.tileDict, renderMeta.tileProps);
			const targetHeading = Math.atan2(goal_dir.z, goal_dir.x);
			let angleDiff = normAngle(targetHeading - agent.heading_angle);
			let max_angle = Math.PI;
			let steer = clip(angleDiff / max_angle, -1, 1);
			action = {accel:getAccel(agent, curr_tile), steer:steer};
		}
		agent.step(dt, action, renderMeta);
	} else {
		agent.removeFromWorld(renderMeta.world);
	}
}

export function stepMMV(agent, dt, renderMeta) {
	let action = {dismount:1, accel:0, steer:0, vx:0,vz:0};
	if (agent.mesh &&!agent.reachedGoal()) {
		if (agent.curr_path_idx < agent.curr_path.length) {
			
			let targetTile = agent.curr_path[agent.curr_path_idx];
			let targetPos = targetTile.getCenterPos();
			let dirToTile = new Vector3(targetPos.x - agent.pos.x, 0, targetPos.z - agent.pos.z);
			if (dirToTile.length() < 30 ) { agent.curr_path_idx++; }

			if (agent.curr_path_idx < agent.curr_path.length) {
				if (agent.isDismounted) {
					dirToTile.normalize();
					action = {dismount:1, accel:0, steer:0, vx: dirToTile.x, vz: dirToTile.z};
				} else {
					dirToTile.normalize();
					action = {dismount:1, accel:0, steer:0, vx: dirToTile.x, vz: dirToTile.z};
				}
			}
		} else {
			if (agent.isDismounted) {
				let goal_dir = new Vector3(agent.goal.pos.x - agent.pos.x, 0, agent.goal.pos.z - agent.pos.z);
				goal_dir.normalize();
				action = {dismount:1, accel:0, steer:0, vx:goal_dir.x,vz:goal_dir.z};
			} else {
				dirToTile.normalize();
				action = {dismount:1, accel:0, steer:0, vx: dirToTile.x, vz: dirToTile.z};
			}

		}
		agent.step(dt, action, renderMeta);
	} else {
		agent.removeFromWorld(renderMeta.world);
	}
}