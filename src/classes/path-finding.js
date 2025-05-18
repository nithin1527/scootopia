import {getTileFromGridLoc, manhattanDistance} from './util.js';
import { Vector2 } from 'three';

const PEDESTRIAN_COSTS = {
    "sidewalk": 1,
    'road-cw': 1.5,
    "road": 5,
    "grass": Infinity
}

// A* algorithm for finding shortest path from startTile to goalTile -> returns sequence of Tile objects
// used pseudocde obtained from: https://medium.com/@nicholas.w.swift/easy-a-star-pathfinding-7e6689c7f7b2
// We then modified it to fit our needs!
class Node {
    constructor(tile, parent = null) {
        this.tile = tile;
        this.parent = parent;
        this.g = 0;
        this.h = 0;
        this.f = 0;
    }

    in(list) {
        return list.some(node => node.tile.id === this.tile.id);
    }
}

function laneKeepingConstraint(candidateNode, currNode, goalTile) {
    let type = currNode.tile.dir === 'X' ? "intersection" : currNode.tile.type;
    let clause = false;
    switch (type) {
        case 'road': {
            // from formal methods i think these are clauses?
            clause = (candidateNode.tile.type === 'road' || candidateNode.tile.type === 'road-cw') && candidateNode.tile.dir === currNode.tile.dir;
            break;
        }   
        case 'intersection': {
            clause = candidateNode.tile.type === 'road-cw' ? candidateNode.tile.dir === goalTile.dir : candidateNode.tile.dir === 'X';
            break;
        }
        case 'road-cw': {
            clause = candidateNode.tile.dir === goalTile.dir ? true : clause = candidateNode.tile.dir === 'X';
            break;
        }
            
    }
    return clause;
}

function checkTileConstraints(tile, agentType) {
    switch (agentType) {
        case 'pedestrian':
            return tile.type === 'sidewalk' || tile.type === 'road-cw';
        case 'mmv':
            return tile.type === 'sidewalk' || tile.type === 'road-cw' || tile.type === 'road';
        case 'driver':
            return tile.type === 'road' || tile.type === 'road-cw';
    }
}

export function getPath(startTile, goalTile, tileDict, agentType) {
    let openList = [];
    let closedList = [];

    let startNode = new Node(startTile);
    openList.push(startNode);

    while (openList.length > 0) {
        let currNode = openList.reduce((min, node) => node.f < min.f ? node : min);
        openList = openList.filter(node => node !== currNode);
        closedList.push(currNode);

        // goal reached, backtrack and return path
        if (currNode.tile.id === goalTile.id) {
            let path = [];
            let curr = currNode;
            while (curr) {
                path.unshift(curr.tile);
                curr = curr.parent;
            }
            return path;
        }

        // get children of currNode -> only consider valid neghbors in cardinal directions
        let dirs = [
            {dx: 0, dy: 1},  // up
            {dx: 0, dy: -1}, // down
            {dx: -1, dy: 0}, // left
            {dx: 1, dy: 0}   // right
        ]

        // generate children of curr tile node
        let children = [];
        for (let dir of dirs) {
            let { dx, dy } = dir;
            let childGridLoc = currNode.tile.grid_loc.clone().add(new Vector2(dx, dy));
            let childTile = getTileFromGridLoc(childGridLoc, tileDict);
            if (childTile) {
                const newNode = new Node(childTile, currNode);
                if (agentType === 'driver' && !laneKeepingConstraint(newNode, currNode, goalTile)) 
                    continue
                if (checkTileConstraints(childTile, agentType)) {
                    console.log("New Node: ", newNode.tile.fullTileType);
                    console.log("Curr Node: ", currNode.tile.fullTileType);
                    children.push(newNode)
                };
            } 
        }

        for (let child of children) {
            // already visited case
            if (child.in(closedList)) continue;

            // fscore, gscore, hscore
            child.g = currNode.g + 1;
            child.h = manhattanDistance(child.tile, goalTile);
            child.f = child.g + child.h;

            // if child in openList
            if (child.in(openList)) {
                if (child.g > currNode.g) continue;
            }

            openList.push(child);
        }
    }
}
