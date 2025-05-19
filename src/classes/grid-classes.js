import { Vector3, Vector2 } from "three";

export class Grid {
    constructor(grid, resolution = 64) {
        this.grid = grid;
        this.resolution = resolution;
        this.rows = this.grid.length;
        this.cols = this.grid[0].length;
        this.cellWidth = resolution;
        this.cellHeight = resolution;
    }
}

export class Tile {
	constructor(id, grid_i, grid_j, world_x, world_y, world_z, type, size, isEdgeTile = false, fullTileType) {
		this.id = id;
        this.grid_loc = new Vector2(grid_i, grid_j);
        this.world_loc = new Vector3(world_x, world_y, world_z);
		this.type = type;
        this.fullTileType = fullTileType;
		this.size = size;
        this.isEdgeTile = isEdgeTile;

        let dir = null;
        if (this.type === 'road' || this.type === 'road-cw') {
            const parts = this.fullTileType.split('-');
            dir = this.type === 'road-cw' ? parts[2] : parts[1];
        }
        this.dir = dir;
	}

	getRandomPosIn(margin = 0.25) {
		const newSize = this.size * (1 - margin); // margin to prevent exactly on edge cases
		const x = this.world_loc.x + (Math.random() - 0.5) * newSize;
		const z = this.world_loc.z + (Math.random() - 0.5) * newSize;
		return new Vector3(x, this.world_loc.y, z);
	}

    getCenterPos() { return this.world_loc; }

    getEdgeCenterPos(numTiles) {
        if (this.isEdgeTile) {
            let edgeX = this.world_loc.x, edgeY = this.world_loc.y, edgeZ = this.world_loc.z;
            if (this.grid_loc.x === 0) edgeX -= this.size / 2;
            if (this.grid_loc.x === numTiles - 1) edgeX += this.size / 2;
            if (this.grid_loc.y === 0) edgeZ -= this.size / 2;
            if (this.grid_loc.y === numTiles - 1) edgeZ += this.size / 2;
            return new Vector3(edgeX, edgeY, edgeZ);
        }
        return null;
    }
}