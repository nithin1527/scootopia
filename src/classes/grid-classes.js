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

class Tile {
    constructor(i,j,tileSize) {
        this.i = i;
        this.j = j;
        this.tileSize = tileSize;
    }
}

class GrassTile extends Tile {
    constructor(i,j,tileSize) {
        super(i,j,tileSize);
    }
}

class SidewalkTile extends Tile {
    constructor(i,j,tileSize) {
        super(i,j,tileSize);
    }
}

class RoadTile extends Tile {
    constructor(i,j,tileSize) {
        super(i,j,tileSize);
    }
}

class RoadCWTile extends Tile {
    constructor(i,j,tileSize) {
        super(i,j,tileSize);
    }
}