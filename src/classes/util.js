import { Vector2 } from "three";

export function distance(p1, p2) { return Math.hypot(p1.x - p2.x, p1.z - p2.z); }

export function angle_between_vectors(origin, center, goal) {
    const vec1 = new Vector2(center.x - origin.x, center.z - origin.z);
    const vec2 = new Vector2(goal.x - center.x, goal.z - center.z);
    
    const dot_product = vec1.x * vec2.x + vec1.y * vec2.y;
    const cross_product = vec1.x * vec2.y - vec1.y * vec2.x;
    
    const mag1 = vec1.lengthSq();
    const mag2 = vec2.lengthSq();

    if (mag1 == 0 || mag2 == 0) return 0.0;
    return Math.atan2(cross_product, dot_product);
}
export function normAngle(angle) {
    angle = angle % (2 * Math.PI);
    if (angle > Math.PI) angle -= 2 * Math.PI;
    else if (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}
export function clip(value, min, max) { return Math.max(min, Math.min(max, value)); }

export function getRandFromRange(min, max) {
	return Math.random() * (max - min) + min;
}

export function getCurrentTile(pos, tileDict, tileProps) {
	for (let tile of tileDict.values()) {
		const half = tileProps.width / 2;
		const tileCenter = tile.getCenterPos();
		const minTileX = tileCenter.x - half;
		const maxTileX = tileCenter.x + half;
		const minTileZ = tileCenter.z - half;
		const maxTileZ = tileCenter.z + half;
		if (pos.x >= minTileX && pos.x <= maxTileX && pos.z >= minTileZ && pos.z <= maxTileZ) {
			return tile;
		}
	}
	return null;
}

export function getTileFromGridLoc(gridLoc, tileDict) {
    let tile = tileDict.values().find(tile => {
        return tile.grid_loc.x === gridLoc.x && tile.grid_loc.y === gridLoc.y;
    });
    return tile;
}

export function manhattanDistance(tileA, tileB) {
    return Math.abs(tileA.grid_loc.x - tileB.grid_loc.x) + Math.abs(tileA.grid_loc.y - tileB.grid_loc.y);
}