import {
    show,
    hide,
    toggleActive,
    toggleHidden,
    toggleUniqueActiveState,
    toggleStyles,
    toggleActiveState,
    deactivate,
    activate,
} from './event-utils.js';

import {init3DEnvironment} from './simulation.js';

import { Grid } from './classes/grid-classes.js';

function initLayoutIconBtns() {
    const layoutIcons = document.querySelectorAll('.layout-icon');
    const customLayoutButton = document.getElementById('custom-layout');
    const largeGridRes = document.querySelector('.grid-btn[data-tile-size="64"]');
    const smallGridRes = document.querySelector('.grid-btn[data-tile-size="32"]');

    let btnIds = ['layout-a', 'layout-b', 'layout-c'];
    btnIds.forEach(id => {
        const btn = document.getElementById(id);
        btn.addEventListener('click', async function() {
            layoutIcons.forEach(icon => deactivate(icon));
            activate(btn);
            const layoutFileName = id.toLowerCase();
            largeGridRes.click();
            await loadGrid(`../assets/layouts/${layoutFileName}.json`);
            updateMapStatus();
            init3DEnvironment();
        });
    });

    customLayoutButton.addEventListener('click', async function() {
        layoutIcons.forEach(icon => deactivate(icon));
        activate(customLayoutButton);
        updateMapStatus();
        removePlacedTiles();
    });
}

let initEventsPromiseResolve;
const initEventsPromise = new Promise(
    (resolve) => {initEventsPromiseResolve = resolve;}
); 

let firstLoad = true;
async function loadGrid(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`Failed to load ${path}`);
    processGridObj(await r.json());
    if (firstLoad) {
        initEventsPromiseResolve();
        firstLoad = false;
    }
}

function initCanvasBtn() {
    const canvasBtn = document.getElementById('open-canvas-btn');
    const canvasContainer = document.getElementById('canvas-container');
    canvasBtn.addEventListener('click', function() { 
        toggleActive(this);
        document.getElementById('canvas-container').classList.toggle('show');
        canvasContainer.classList.toggle('pointer-events-none');
        try {
            init3DEnvironment();
        } catch(e) {
            document.getElementById('layout-a').click();
        }
        updateMapStatus();
    });
}

function initCrosswalkBtn() {
    const crosswalkBtn = document.getElementById('crosswalk-btn');
    crosswalkBtn.addEventListener('click', function() { 
        toggleActive(this); 
        toggleHidden(document.getElementById('road-CW-tiles'));
        toggleHidden(document.getElementById('road-tiles'));
    });
}

function initClearGridBtn() {
    const clearGridBtn = document.getElementById('grid-clear-btn');
    clearGridBtn.addEventListener('click', function(e) {
        if (!e.isTrusted) return;
        const placedTiles = grid.querySelectorAll('.placed-tile');
        placedTiles.forEach(tile => tile.remove());
        document.getElementById('custom-layout').click();
        updateMapStatus();
    });
}

const deleteTileBtn = document.getElementById('grid-delete-btn');
function initDeleteTileBtn() {
    deleteTileBtn.addEventListener('click', toggleActiveState(deleteTileBtn));
}

function initDeleteMouseover() {
    // for UX so user knows they well delete when click
    const trashIcon = "url('data:image/svg+xml;utf8,<svg width=\"24\" height=\"24\" viewBox=\"0 0 512 512\" xmlns=\"http://www.w3.org/2000/svg\"><path fill=\"gray\" d=\"M296 64h-80a7.91 7.91 0 0 0-8 8v24h96V72a7.91 7.91 0 0 0-8-8\"/><path fill=\"white\" d=\"M432 96h-96V72a40 40 0 0 0-40-40h-80a40 40 0 0 0-40 40v24H80a16 16 0 0 0 0 32h17l19 304.92c1.42 26.85 22 47.08 48 47.08h184c26.13 0 46.3-19.78 48-47l19-305h17a16 16 0 0 0 0-32M192.57 416H192a16 16 0 0 1-16-15.43l-8-224a16 16 0 1 1 32-1.14l8 224A16 16 0 0 1 192.57 416M272 400a16 16 0 0 1-32 0V176a16 16 0 0 1 32 0Zm32-304h-96V72a7.91 7.91 0 0 1 8-8h80a7.91 7.91 0 0 1 8 8Zm32 304.57A16 16 0 0 1 320 416h-.58A16 16 0 0 1 304 399.43l8-224a16 16 0 1 1 32 1.14Z\"/></svg>') 12 12, pointer";
    document.getElementById('grid').addEventListener('mouseover', function(e) {
        const cursorContainsPlacedTile = e.target.closest('.placed-tile');
        const deleteModeActive = deleteTileBtn.classList.contains('active');
        if (cursorContainsPlacedTile && deleteModeActive) {
            e.target.style.cursor = trashIcon;
        }
    });
}

function initDeleteMouseout() {
    // change cursor back to default when it is not hovering over a placed tile
    document.getElementById('grid').addEventListener('mouseout', function(e) {
        const cursorContainsPlacedTile = e.target.classList.contains('placed-tile');
        const deleteModeActive = deleteTileBtn.classList.contains('active');
        if (cursorContainsPlacedTile && deleteModeActive) {
            e.target.style.cursor = 'default';
        }
    });
}

function initDeleteClick() {
    // delete the tile in delete mode
    document.getElementById('grid').addEventListener('click', function(e) {
        const cursorContainsPlacedTile = e.target.closest('.placed-tile');
        const deleteModeActive = deleteTileBtn.classList.contains('active');
        if (cursorContainsPlacedTile && deleteModeActive) {
            cursorContainsPlacedTile.remove();
            updateMapStatus();
        }
    });
}

function initTileBtns() {
    // tile states
    const tiles = document.querySelectorAll('.tile');
    tiles.forEach(tile => tile.addEventListener('click', 
        function() {
            tiles.forEach(tile => deactivate(tile));
            activate(tile);
            deactivate(deleteTileBtn);
        } 
    ));
}

function initGridResBtns() {
    const gridBtns = document.querySelectorAll('.grid-btn');
    gridBtns.forEach(btn => btn.addEventListener('click', 
        function() {
            if (btn.classList.contains('active')) return;
            gridBtns.forEach(btn => deactivate(btn));
            activate(btn);
            removePlacedTiles();
            updateMapStatus();
        }
    ));
}

function getTileSize() {
    const activeTileSizeState = document.querySelector('.grid-btn.active');
    const activeTileSize = activeTileSizeState.getAttribute('data-tile-size');
    const tileSize = parseInt(activeTileSize, 10);
    return tileSize;
}

const grid = document.getElementById('grid');
const ghostTile = document.getElementById('ghost-tile');
function initGhostTile() {
    grid.addEventListener('mousemove', function(e) {
        const deleteModeActive = deleteTileBtn.classList.contains('active');
        if (deleteModeActive) {
            hide(ghostTile);
            return;
        }
        const tileSize = getTileSize();

        const bbox = grid.getBoundingClientRect();
        const mousePos = { x:e.clientX, y:e.clientY };
        const x = mousePos.x - bbox.left;
        const y = mousePos.y - bbox.top;

        // grid pos
        const i = Math.floor(y / tileSize);
        const j = Math.floor(x / tileSize);

        // tile is absolute pos so
        ghostTile.style.top = `${i * tileSize}px`;
        ghostTile.style.left = `${j * tileSize}px`;
        ghostTile.style.width = `${tileSize}px`;
        ghostTile.style.height = `${tileSize}px`;
        show(ghostTile);
    });
}

// for map status notif update
function isGridValid() {
    const placedTiles = Array.from(grid.querySelectorAll('.placed-tile'));
    const tileSizeState = document.querySelector('.grid-btn.active');
    const tileSize = parseInt(tileSizeState.getAttribute('data-tile-size'), 10);
    let result = false;
    
    if (tileSize === 64) {
        if (placedTiles.length === GRID_SIZE_64PX * GRID_SIZE_64PX) result = true;
    } else if (tileSize === 32) {
        if (placedTiles.length === GRID_SIZE_32PX * GRID_SIZE_32PX) result = true;
    }

    return result
}

// for map status notif update
function updateMapStatus() {
    const mapStatus = document.getElementById('map-status');
    const mapStatusDot = document.getElementById('map-status-dot');
    const mapStatusText = document.getElementById('map-status-text');
    if (isGridValid()) {
        toggleStyles(mapStatus, 'not-loaded', 'loaded');
        mapStatusText.textContent = "Map Loaded";
        toggleStyles(mapStatusDot, 'not-loaded-dot', 'loaded-dot');
    } else {
        toggleStyles(mapStatus, 'loaded', 'not-loaded');
        mapStatusText.textContent = "Map Not Loaded";
        toggleStyles(mapStatusDot, 'loaded-dot', 'not-loaded-dot');
    }
}

function placeTile(e) {
    hide(ghostTile);
    const tileSize = getTileSize();

    // get bbox of the grid 
    const bbox = grid.getBoundingClientRect();
    const mousePos = { x:e.clientX, y:e.clientY };

    // mouse pos relative to grid
    const x = mousePos.x - bbox.left; 
    const y = mousePos.y - bbox.top;

    // grid pos world -> grid
    const i = Math.floor(y / tileSize);
    const j = Math.floor(x / tileSize);

    const existingTiles = grid.querySelectorAll('.placed-tile');
    existingTiles.forEach(tile => {
        const checkTop = tile.style.top === `${i * tileSize}px`;
        const checkLeft = tile.style.left === `${j * tileSize}px`;
        if (checkTop && checkLeft) { 
            // this means that cursor is on an existing tile
            // remove the old tile
            tile.remove();
            return;
        }
    })

    // init new tile to be placed on the grid
    const placedTile = document.createElement('div');
    const activeTileBtn = document.querySelector('.tile.active');
    
    // copy icon svg
    placedTile.innerHTML = activeTileBtn.innerHTML;

    // copy classes
    activeTileBtn.classList.forEach(c => {
        if (c === 'active' || c === 'tile') return;
        placedTile.classList.add(c);
    });
    placedTile.classList.add('placed-tile');

    // smaller icons for the smaller grid for visibility
    const activeGridResBtn = document.querySelector('.grid-btn.active');
    if (activeGridResBtn.getAttribute('data-tile-size') === '32') {
        placedTile.querySelectorAll('svg.small').forEach(svg => svg.classList.add('small-icons'));
    } else {
        placedTile.querySelectorAll('svg.small').forEach(svg => svg.classList.remove('small-icons'));
    }

    // tile is absolute position so we calc relative pos in grid
    placedTile.style.top = `${i * tileSize}px`;
    placedTile.style.left = `${j * tileSize}px`;
    placedTile.style.width = `${tileSize}px`;
    placedTile.style.height = `${tileSize}px`;
    grid.appendChild(placedTile);
    updateMapStatus();
}

function initPlaceTile() {
    grid.addEventListener('click', function(e) {
        const deleteModeActive = deleteTileBtn.classList.contains('active');
        if (deleteModeActive) {
            hide(ghostTile);
            return;
        }
        placeTile(e);
    });
}

function initMultiPlaceTile() {
    // dragging logic since individual placing tiles was getting annoying
    let isPlacing = false;
    grid.addEventListener('mousedown', function(e) { 
        const deleteModeActive = deleteTileBtn.classList.contains('active');
        if (deleteModeActive) {
            hide(ghostTile);
            return;
        }
        isPlacing = true; 
        placeTile(e);
    });
    grid.addEventListener('mouseup', function() { isPlacing = false; });
    grid.addEventListener('mouseleave', function() { isPlacing = false; hide(ghostTile); });
    grid.addEventListener('mousemove', function(e) {
        const deleteModeActive = deleteTileBtn.classList.contains('active');
        if (deleteModeActive) {
            hide(ghostTile);
            return;
        }
        if (isPlacing) placeTile(e);
    });
}

function initGridEvents() {
    initDeleteMouseover();
    initDeleteMouseout();
    initDeleteClick();
    initGhostTile();
    initPlaceTile();
    initMultiPlaceTile();
}

const GRID_SIZE_64PX = 8;
const GRID_SIZE_32PX = 16;
function getGrid(tileSize) {
    const placedTiles = Array.from(grid.querySelectorAll('.placed-tile'));
    
    if (tileSize === 64) {
        if (placedTiles.length !== GRID_SIZE_64PX * GRID_SIZE_64PX) {
            alert('Each grid cell must be occupied by a tile!');
            return;
        }
    } else if (tileSize === 32) {
        if (placedTiles.length !== GRID_SIZE_32PX * GRID_SIZE_32PX) {
            console.log(placedTiles.length);
            alert('Each grid cell must be occupied by a tile!');
            return;
        }
    }
    const gridSize = tileSize === 64 ? GRID_SIZE_64PX : GRID_SIZE_32PX;

    // sort so the tiles in grid order
    placedTiles.sort((a,b) => {
        const aTop = parseInt(a.style.top, 10);
        const aLeft = parseInt(a.style.left, 10);
        const bTop = parseInt(b.style.top, 10);
        const bLeft = parseInt(b.style.left, 10);
        if (aTop === bTop) return aLeft - bLeft; // same row then sort by column which is left to right
        return aTop - bTop; // sort by row higher is priority
    })

    const canvasGrid = [];
    for (let i = 0; i < gridSize; i++) {
        canvasGrid[i] = [];
        for (let j = 0; j < gridSize; j++) {
            // not sure why classlist index 1 is taking the third class? 
            // but it works so whatever -- make sense of this if time permits
            canvasGrid[i][j] = placedTiles[i * gridSize + j].classList[1];
        }
    }

    return canvasGrid;
}

function initSaveBtn() {
    document.getElementById('save-btn').addEventListener('click', function() {
        const tileSize = getTileSize();
        handleJsonDownload(getGrid(tileSize), tileSize);
    });
}

// tutorial on downloading json files: 
// - https://www.geeksforgeeks.org/how-to-convert-json-to-blob-in-javascript/
// - https://dnmtechs.com/simple-steps-to-download-json-object-as-a-file-from-your-browser/
function handleJsonDownload(grid, gridRes = 64) {
    if (!grid) return;

    let jsonFileName = prompt("Enter a name for your grid:");
    if (!jsonFileName || jsonFileName === "") jsonFileName = "grid";
    jsonFileName = jsonFileName + ".json";

    const gridObj = {grid:grid, gridRes:gridRes};
    const gridObjJsonStr = JSON.stringify(gridObj, null, 2);
    const blob = new Blob([gridObjJsonStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const l = document.createElement('a');
    l.href = url;
    l.download = jsonFileName;
    l.click();
    URL.revokeObjectURL(l.href);
}

function placeTileType(type, tileSize, i, j) {
    hide(ghostTile);

    // init new tile to be placed on the grid
    const placedTile = document.createElement('div');
    const currentTile = document.getElementById(type);

    // copy icon svg
    placedTile.innerHTML = currentTile.innerHTML;

    // copy classes
    currentTile.classList.forEach(c => {
        if (c === 'active' || c === 'tile') return;
        placedTile.classList.add(c);
    });
    placedTile.classList.add('placed-tile');

    if (tileSize === 32) {
        placedTile.querySelectorAll('svg.small').forEach(svg => svg.classList.add('small-icons'));
    } else {
        placedTile.querySelectorAll('svg.small').forEach(svg => svg.classList.remove('small-icons'));
    }

    // tile is absolute position so we calc relative pos in grid
    placedTile.style.top = `${i * tileSize}px`;
    placedTile.style.left = `${j * tileSize}px`;
    placedTile.style.width = `${tileSize}px`;
    placedTile.style.height = `${tileSize}px`;
    grid.appendChild(placedTile);

    updateMapStatus();
}

function parseJson(callback) {
    return function(e) {
        try {
            const gridObj = JSON.parse(e.target.result);
            callback(gridObj); // for returning the object to process later
        } catch (error) {
            alert('Invalid Grid Upload');
        }
    }
}

function removePlacedTiles() {
    const placedTiles = grid.querySelectorAll('.placed-tile');
    placedTiles.forEach(tile => tile.remove());
}

// take the loaded gridObj and map tiles back to canvas grid
function processGridObj(gridObj) {
    
    // set grid res when processing
    const gridBtns = document.querySelectorAll('.grid-btn');
    gridBtns.forEach(btn => deactivate(btn));
    const gridBtn = document.querySelector(`.grid-btn[data-tile-size="${gridObj.gridRes}"]`);
    activate(gridBtn);

    removePlacedTiles();
    updateMapStatus();
    const map = Array.from(gridObj.grid);
    const tileSize = gridObj.gridRes;
    const dim = tileSize === 64 ? GRID_SIZE_64PX : GRID_SIZE_32PX;
    for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {
            placeTileType(map[i][j], tileSize, i, j);
        }
    }
}

function handleJsonUpload() {
    const input = document.getElementById('gridUpload');
    input.value = ''; // clear any prev files
    input.click();
}

function initUploadBtn() {
    const uploadBtn = document.getElementById('upload-btn');
    const input = document.getElementById('gridUpload');
    input.addEventListener('change', async function(e) {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();

        const readComplete = new Promise(resolve => {
            r.onload = function(e) {
                try {
                    const gridObj = JSON.parse(e.target.result);
                    processGridObj(gridObj);
                    resolve();
                } catch (error) {
                    alert('Invalid Grid Upload');
                    resolve();
                }
            };
        });
        r.readAsText(f);
        await readComplete;
        init3DEnvironment();
    });
    uploadBtn.addEventListener('click', handleJsonUpload);
}

export function initEvents() {
    // button inits
    initLayoutIconBtns();
    initCanvasBtn();
    initCrosswalkBtn();
    initClearGridBtn();
    initDeleteTileBtn();
    initTileBtns();
    initGridResBtns();
    initSaveBtn();
    initUploadBtn();

    // non button stuff
    initGridEvents();

    // load the first json grid
    document.getElementById('layout-a').click();
    
}

export async function readGridState() {
    await initEventsPromise;
    const tileSize = getTileSize();
    const grid = getGrid(tileSize);
    return new Grid(grid, tileSize);
}