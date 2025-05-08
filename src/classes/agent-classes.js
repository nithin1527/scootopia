import * as THREE from 'three';

class Agent {
    constructor(position, heading, length, width) {
        this.position = position;
        this.heading = heading;
        this.length = length;
        this.width = width;
        this.velocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();
    }

}