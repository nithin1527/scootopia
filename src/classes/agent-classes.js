import * as THREE from 'three';
import { Vector3, Vector2 } from "three";
import { normAngle, angle_between_vectors, distance, clip, getCurrentTile } from "./util.js";

class Agent {
    constructor(id = null, startPos = null, goal = null, pos = null, risk = null) {
        this.id = id;
        
        this.pos = pos; // curr pos
        this.startPos = startPos; // initial pos
        this.goal = goal; // final pos

        this.v = 0.0; // m/s
        this.a = 0.0; // m/s^2
        this.heading_angle = 0; // rad

        this.mesh = null;
        this.startTile = null;

        this.width = 0;
        this.length = 0;
        this.radius = 0;

        this.curr_path = null; // tile objs
        this.curr_path_idx = -1;

        this.risk = risk;
        this.distracted = Math.random() * 100 < this.risk;
    }

    // i think this is how you do you do abstract methods in js...
    initDynamics() {
        throw new Error("Agent Class must implement initDynamics()");
    }

    reachedGoal() {
        throw new Error("Agent Class must implement reachedGoal()");
    }

    step(dt, action, renderMeta = null) {
        throw new Error("Agent Class must implement step()");
    }

    updateMesh() {
        throw new Error("Agent Class must implement updateMesh()");
    }

    // refer later - might not need it
    update_rk4(dt) {
        const k1_v = this.v;
        const k1_a = this.a;

        const k2_v = this.v + 0.5 * k1_a * dt;
        const k2_a = this.a;

        const k3_v = this.v + 0.5 * k2_a * dt;
        const k3_a = this.a;

        const k4_v = this.v + k3_a * dt;
        const k4_a = this.a;

        this.pos.x += (k1_v + 2*k2_v + 2*k3_v + k4_v) / 6 * dt;
        this.pos.y += (k1_v + 2*k2_v + 2*k3_v + k4_v) / 6 * dt;
        this.v += (k1_a + 2*k2_a + 2*k3_a + k4_a) / 6 * dt;
    }

    // render related methods -- no RL
    setGoal(goal) { 
        this.goal = goal; 
        this.curr_path = null;
        this.curr_path_idx = -1;
    }

    setPos(pos) { this.pos = pos; }
    setStartPos(startPos) { this.startPos = startPos; }
    setStartTile(startTile) { this.startTile = startTile; }

    removeFromWorld(world) {
        world.remove(this.mesh);
        if (this.visionSector) world.remove(this.visionSector);
        this.mesh = null;
        this.startTile = null;
        this.startPos = null;
        this.pos = null;
    }

    removeMeshFromWorld(world) {
        world.remove(this.mesh);
        if (this.visionSector) world.remove(this.visionSector);
        this.mesh = null;
    }

    getBoundingBox() {
        if (!this.mesh) return null;
        this.mesh.updateMatrixWorld();
        return new THREE.Box3().setFromObject(this.mesh);
    }

    collides(other) {
        if (!this.mesh || !other.mesh) return false;
        this.mesh.updateMatrixWorld();
        other.mesh.updateMatrixWorld();
        const bbox1 = new THREE.Box3().setFromObject(this.mesh);
        const bbox2 = new THREE.Box3().setFromObject(other.mesh);
        return bbox1.intersectsBox(bbox2);
    } 

    withinFOV(other, query_radius, fov) {
        const dist = distance(this.pos, other.pos);
        const rel_dir = other.pos.clone().sub(this.pos).normalize();
        const forward = new Vector3(Math.cos(this.heading_angle), 0, Math.sin(this.heading_angle));
        const angleToOther = forward.angleTo(rel_dir);
        return dist < query_radius && angleToOther < fov / 2;
    }
}

export class Pedestrian extends Agent {
    constructor(id, startPos, goal, pos, risk) {
        super(id, startPos, goal, pos, risk);
        this.type = "pedestrian";
        this.width = 16;
        this.length = 16;
        this.radius = 8;

        this.sfm_velocity = new Vector2(0, 0);
    }

    reachedGoal() { return distance(this.pos, this.goal.pos) < PEDESTRIAN_GOAL_RADIUS; }

    initDynamics() {
        this.heading_angle = angle_between_vectors(this.pos, this.goal.pos, this.pos); 
    }

    step(dt, action, renderMeta = null) {
        // action tells us next step or target velocity 
        let vx = action.vx * WALKING_SPEED;
        let vz = action.vz * WALKING_SPEED;
        const dir = Math.atan2(vz, vx); // for heading angle

        const query_radius = this.distracted ? renderMeta.tileProps.width : renderMeta.tileProps.width / 3 * 5;
        const fov = this.distracted ? Math.PI / 4 : Math.PI / 2;

        // update heading angle
        let angle_diff = dir - this.heading_angle;
        angle_diff = normAngle(angle_diff);
        const turnable = Math.PI * dt;
        const turn_by = clip(angle_diff, -turnable, turnable);
        this.heading_angle += turn_by;
        this.heading_angle = normAngle(this.heading_angle);

        let total_force = new Vector2(0,0);        
        
        // self-driven force
        const desired_velocity = new Vector2(vx, vz);
        const velocity = this.sfm_velocity;
        let selfDrivenForce = new Vector2(0,0); 
        selfDrivenForce = desired_velocity.sub(velocity).divideScalar(TAU);
        total_force.add(selfDrivenForce);

        // interaction force for sfm
        if (renderMeta.agents) {
            for (let other of renderMeta.agents) {
                if (other.id != this.id && other.mesh) {
                    if (other.type === 'pedestrian' || (other.type === 'mmv' && other.isDismounted) || other.type === 'driver') {
                        const dist = distance(this.pos, other.pos);
                        const rel_dir = this.pos.clone().sub(other.pos).normalize();
                        const radii_sum = this.radius + other.radius;

                        // if other is outside of fov and query radius, skip
                        if (!this.withinFOV(other, query_radius, fov)) continue;

                        // other is within fov and query radius
                        if (dist < 20) {
                            const interactionForce = rel_dir.multiplyScalar(A * Math.exp((radii_sum - dist) / B));
                            total_force.add(new Vector2(interactionForce.x, interactionForce.z));
                        }

                        if (this.collides(other)) {
                            console.log("Collision detected between agent " + this.id + " and agent " + other.id);
                        }
                    }
                }
            }
        }

        this.sfm_velocity.add(total_force.multiplyScalar(dt));
        // console.log("Agent " + this.id + "interaction force: ", total_force.sub(selfDrivenForce), " sfm_velocity: ", this.sfm_velocity);
        if (this.sfm_velocity.length() > WALKING_SPEED) this.sfm_velocity.normalize().multiplyScalar(WALKING_SPEED);

        // pos update
        const nextPos = new Vector3(
            this.pos.x + this.sfm_velocity.x * dt,
            this.pos.y,
            this.pos.z + this.sfm_velocity.y * dt
        )
        
        this.pos.x = nextPos.x;
        this.pos.z = nextPos.z; 
        
        //pedestrian render, if reached goal -> snap to goal pos
        const reachedGoal = this.reachedGoal();
        if (renderMeta) {
            this.updateMesh(renderMeta);
            if (reachedGoal) {
                this.pos.copy(this.goal.pos);
                this.mesh.position.copy(this.pos);
                this.mesh.position.y = renderMeta.pfProps.depth / 2 + renderMeta.tileProps.height / 2 + PEDESTRIAN_HEIGHT / 2;
            }
        }

        return reachedGoal;
    }

    updateMesh(renderMeta) {
        this.mesh.position.copy(this.pos);
        this.mesh.position.y = renderMeta.pfProps.depth / 2 + renderMeta.tileProps.height / 2 + PEDESTRIAN_HEIGHT / 2;
        this.mesh.rotation.y = this.heading_angle;

        // Remove both sectors from world if they exist
        if (this.normalVisionSector) {
            renderMeta.world.remove(this.normalVisionSector);
        }
        if (this.distractedVisionSector) {
            renderMeta.world.remove(this.distractedVisionSector);
        }

        // Add the correct sector based on distracted state
        if (this.distracted) {
            if (this.distractedVisionSector) {
                renderMeta.world.add(this.distractedVisionSector);
                this.visionSector = this.distractedVisionSector;
            }
        } else {
            if (this.normalVisionSector) {
                renderMeta.world.add(this.normalVisionSector);
                this.visionSector = this.normalVisionSector;
            }
        }

        // Update vision sector position and rotation
        if (this.visionSector) {
            this.visionSector.rotation.z = -this.heading_angle;
            this.visionSector.position.copy(this.pos);
            this.visionSector.position.y = this.pos.y + 5;
        }
    }
    
    render(renderMeta) {
        const pedestrianGeo = new THREE.CylinderGeometry(8, 8, 50, 50);
        const pedestrianGeoMat = new THREE.MeshStandardMaterial({ color: CYAN });
        const pedestrian = new THREE.Mesh(pedestrianGeo, pedestrianGeoMat);

        pedestrian.position.copy(this.pos);
        pedestrian.position.y = renderMeta.pfProps.depth / 2 + renderMeta.tileProps.height / 2 + PEDESTRIAN_HEIGHT / 2;
        pedestrian.castShadow = true;
        pedestrian.receiveShadow = true;

        renderMeta.world.add(pedestrian);
        this.mesh = pedestrian;

        // Remove old vision sectors if they exist
        if (this.normalVisionSector) {
            renderMeta.world.remove(this.normalVisionSector);
            this.normalVisionSector = null;
        }
        if (this.distractedVisionSector) {
            renderMeta.world.remove(this.distractedVisionSector);
            this.distractedVisionSector = null;
        }

        // Helper to create a vision sector mesh
        function createVisionSector(query_radius, fov, color, heading_angle, pos) {
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            const segments = 32;
            for (let i = 0; i <= segments; i++) {
                const theta = -fov / 2 + (fov * i) / segments;
                shape.lineTo(query_radius * Math.cos(theta), query_radius * Math.sin(theta));
            }
            shape.lineTo(0, 0); // close the shape

            const geometry = new THREE.ShapeGeometry(shape);
            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide,
            });

            const sector = new THREE.Mesh(geometry, material);
            sector.rotation.x = -Math.PI / 2;
            sector.rotation.z = -heading_angle;
            sector.position.set(pos.x, pos.y + 5, pos.z);
            return sector;
        }

        // Create both sectors
        const normalQueryRadius = renderMeta.tileProps.width / 3 * 5;
        const normalFov = Math.PI / 2;
        const distractedQueryRadius = renderMeta.tileProps.width;
        const distractedFov = Math.PI / 4;

        this.normalVisionSector = createVisionSector(
            normalQueryRadius,
            normalFov,
            0x00FF00,
            this.heading_angle,
            this.pos
        );
        this.distractedVisionSector = createVisionSector(
            distractedQueryRadius,
            distractedFov,
            0xFF0000,
            this.heading_angle,
            this.pos
        );

        // Add only the active sector to the world and set this.visionSector
        if (this.distracted) {
            renderMeta.world.add(this.distractedVisionSector);
            this.visionSector = this.distractedVisionSector;
        } else {
            renderMeta.world.add(this.normalVisionSector);
            this.visionSector = this.normalVisionSector;
        }
    }
}

export class Driver extends Agent {
    constructor(id, startPos, goal, pos, risk) {
        super(id, startPos, goal, pos, risk);
        this.type = "driver";
        this.width = DRIVER_WIDTH;
        this.length = DRIVER_LENGTH + FRONT_OVERHANG + REAR_OVERHANG;
        this.base = DRIVER_LENGTH;
        this.radius = DRIVER_LENGTH;
    }

    reachedGoal() { return distance(this.pos, this.goal.pos) < DRIVER_GOAL_RADIUS; }

    pos_to_origin() {
        const x = this.pos.x - (this.base / 2) * Math.cos(this.heading_angle);
        const z = this.pos.z - (this.base / 2) * Math.sin(this.heading_angle);
        return new Vector3(x, 0, z);
    }

    origin_to_pos() {
        const x = this.origin.x + (this.base / 2) * Math.cos(this.heading_angle);
        const z = this.origin.z + (this.base / 2) * Math.sin(this.heading_angle);
        return new Vector3(x, 0, z);
    }

    initDynamics() {
        this.v = 0; 
        this.a = 0;
        this.heading_angle = this.getHeadingAngle();

        this.base = DRIVER_LENGTH;
        this.front_overhang = FRONT_OVERHANG;
        this.rear_overhang = REAR_OVERHANG;

        this.origin = this.pos_to_origin();
        this.omega = 0.0; 
        this.steering_angle = 0.0;
    }

    getHeadingAngle() {
        let dir = this.startTile.dir;
        const angleDict = {
            "N": -Math.PI / 2,
            "E": 0,
            "S": Math.PI / 2,
            "W": Math.PI
        }
        return angleDict[dir];
    }

    // preconditions: call render -> call initDynamics
    // for driver movement, can also be for MMV?
    step(dt, action, renderMeta = null) {
        // actions
        const turn_left = -1, turn_right = 1;
        const brake = -1, accel = 1;

        // clip action values
        const accel_action = clip(action.accel, brake, accel);
        const steer_action = clip(action.steer, turn_left, turn_right);

        // map action values to REAL values
        this.a = accel_action > 0 ? accel_action * ACCEL : accel_action * BRAKE;

        // update velocity
        this.v += this.a * dt;
        this.v = clip(this.v, 0, MAX_VELOCITY); // -- debug limit v for debug
        
        // steering
        this.omega = steer_action * OMEGA;
        this.steering_angle += this.omega * dt;
        this.steering_angle = clip(this.steering_angle, -Math.PI / 4, Math.PI / 4);

        // heading angle -- bicycle model
        if (Math.abs(this.v) > 0.01) {
            const beta = (this.v / this.length) * Math.tan(this.steering_angle);
            this.heading_angle += beta * dt;
            this.heading_angle = normAngle(this.heading_angle); // maybe should help?
        }

        // update position
        this.origin = this.pos_to_origin();
        this.origin.x += this.v * Math.cos(this.heading_angle) * dt;
        this.origin.z += this.v * Math.sin(this.heading_angle) * dt;

        const new_pos = this.origin_to_pos();
        this.pos.x = new_pos.x;
        this.pos.z = new_pos.z;

        // render
        if (renderMeta) {
            this.updateMesh(renderMeta);
            const reachedGoal = this.reachedGoal();
            if (reachedGoal) {
                this.pos.copy(this.goal.pos);
                this.mesh.position.copy(this.pos);
                this.mesh.position.y = renderMeta.pfProps.depth / 2 + renderMeta.tileProps.height / 2 + DRIVER_HEIGHT / 2;
            }
        }

        return this.reachedGoal();
    }

    updateMesh(renderMeta) {
        this.mesh.position.copy(this.pos);
        this.mesh.position.y = renderMeta.pfProps.depth / 2 + renderMeta.tileProps.height / 2 + DRIVER_HEIGHT / 2;
        this.mesh.rotation.y = -this.heading_angle;
    }
    
    render(renderMeta) {
        const driverGeo = new THREE.BoxGeometry(
            DRIVER_LENGTH + FRONT_OVERHANG + REAR_OVERHANG,
            DRIVER_HEIGHT,
            DRIVER_WIDTH
        );
        const RED = "#FF0000";
        const driverMat = new THREE.MeshStandardMaterial({ color: RED });
        const driver = new THREE.Mesh(driverGeo, driverMat);
        driver.castShadow = true;
        driver.receiveShadow = true;

        // position
        driver.position.copy(this.pos);
        driver.position.y = renderMeta.pfProps.depth / 2 + renderMeta.tileProps.height / 2 + DRIVER_HEIGHT / 2; 
        
        // orientation
        driver.rotation.y = this.getHeadingAngle();
        
        renderMeta.world.add(driver);
        this.mesh = driver;
    }
}

export class MMV extends Agent {
    constructor(id, startPos, goal, pos, isDismounted, risk) {
        super(id, startPos, goal, pos, risk);
        this.type = "mmv";
        this.width = MMV_WIDTH;
        this.length = MMV_LENGTH + MMV_FRONT_OVERHANG + MMV_REAR_OVERHANG;
        this.base = MMV_LENGTH;
        this.radius = MMV_LENGTH;
        this.isDismounted = isDismounted;
    }

    reachedGoal() { return distance(this.pos, this.goal.pos) < PEDESTRIAN_GOAL_RADIUS; }

    pos_to_origin() {
        const x = this.pos.x - (this.base / 2) * Math.cos(this.heading_angle);
        const z = this.pos.z - (this.base / 2) * Math.sin(this.heading_angle);
        return new Vector3(x, null, z);
    }

    origin_to_pos() {
        const x = this.origin.x + (this.base / 2) * Math.cos(this.heading_angle);
        const z = this.origin.z + (this.base / 2) * Math.sin(this.heading_angle);
        return new Vector3(x, null, z);
    }

    getHeadingAngle() {
        let dir_parts = this.startTile.fullTileType.split('-');
        let dir = dir_parts[1];

        if (!['N', 'E', 'S', 'W'].includes(dir)) dir = dir_parts[2];         
        const angleDict = {
            "N": -Math.PI / 2,
            "E": Math.PI,
            "S": Math.PI / 2,
            "W": 0
        }
        return angleDict[dir];
    }

    // later for redirecting maybe -- currently A* should handle this
    isValidTileMove(t1, t2) {
        // mmv constraints
        let cond1 = t1 == null || t2 == null|| t2.type === 'grass';
        let cond2 = !this.isDismounted && t1.type === 'road' && t2.type === 'sidewalk';
        let cond3 = this.isDismounted && t1.type === 'sidewalk' && t2.type === 'road';
        if (!(cond1 && cond2 && cond3)) return true;
        return false;
    }

    initDynamics() {
        this.v = 0;
        this.a = 0;

        if (this.goal.type === 'road' && this.startTile.type === 'road') {
            this.heading_angle = this.getHeadingAngle();
        } else {
            this.heading_angle = Math.atan2(this.goal.pos.z - this.pos.z, this.goal.pos.x - this.pos.x);
        }

        this.base = MMV_LENGTH;
        this.front_overhang = MMV_FRONT_OVERHANG;
        this.rear_overhang = MMV_REAR_OVERHANG;

        this.origin = this.pos_to_origin();
        this.omega = 0.0; 
        this.steering_angle = 0.0;

        this.sfm_velocity = new Vector2(0, 0);
    }

    // same as driver
    step_mount(dt, action, renderMeta = null) {
        // actions
        const turn_left = -1, turn_right = 1;
        const brake = -1, accel = 1;

        // clip action values
        const accel_action = clip(action.accel, brake, accel);
        const steer_action = clip(action.steer, turn_left, turn_right);

        // map action values to REAL values
        this.a = accel_action > 0 ? accel_action * MMV_ACCEL : accel_action * MMV_BRAKE;

        // update velocity
        this.v += this.a * dt;
        this.v = clip(this.v, 0, MMV_MAX_VELOCITY); // -- debug limit v for debug
        
        // steering
        this.omega = steer_action * MMV_OMEGA;
        this.steering_angle += this.omega * dt;
        this.steering_angle = clip(this.steering_angle, -Math.PI / 5, Math.PI / 5);

        // heading angle -- bicycle model
        if (Math.abs(this.v) > 0.01) {
            const beta = (this.v / this.length) * Math.tan(this.steering_angle);
            this.heading_angle += beta * dt;
            this.heading_angle = normAngle(this.heading_angle); // maybe should help?
        }

        // update position
        this.origin = this.pos_to_origin();
        this.origin.x += this.v * Math.cos(this.heading_angle) * dt;
        this.origin.z += this.v * Math.sin(this.heading_angle) * dt;

        const new_pos = this.origin_to_pos();
        this.pos.x = new_pos.x;
        this.pos.z = new_pos.z;
    }

    step_dismount(dt, action, renderMeta = null) {
        // action tells us next step or target velocity 
        let vx = action.vx * WALKING_SPEED;
        let vz = action.vz * WALKING_SPEED;
        const dir = Math.atan2(vz, vx); // for heading angle

        // update heading angle
        let angle_diff = dir - this.heading_angle;
        angle_diff = normAngle(angle_diff);
        const turnable = Math.PI * dt;
        const turn_by = clip(angle_diff, -turnable, turnable);
        this.heading_angle += turn_by;
        this.heading_angle = normAngle(this.heading_angle);

        let total_force = new Vector2(0,0);        
        
        // self-driven force
        const desired_velocity = new Vector2(vx, vz);
        const velocity = this.sfm_velocity;
        let selfDrivenForce = new Vector2(0,0); 
        selfDrivenForce = desired_velocity.sub(velocity).divideScalar(TAU);
        total_force.add(selfDrivenForce);

        // interaction force for sfm
        // if (renderMeta.agents) {
        //     for (let other of renderMeta.agents) {
        //         if (other.id != this.id && other.mesh) {
        //             if (other.type === 'pedestrian' || (other.type === 'mmv' && other.isDismounted) || other.type === 'driver') {
        //                 const dist = distance(this.pos, other.pos);
        //                 const rel_dir = this.pos.clone().sub(other.pos).normalize();
        //                 const radii_sum = this.radius + other.radius;
        //                 if (dist < 20) {
        //                     const interactionForce = rel_dir.multiplyScalar(A * Math.exp((radii_sum - dist) / B));
        //                     total_force.add(new Vector2(interactionForce.x, interactionForce.z));
        //                 }
        //             }
        //         }
        //     }
        // }

        this.sfm_velocity.add(total_force.multiplyScalar(dt));
        if (this.sfm_velocity.length() > WALKING_SPEED) this.sfm_velocity.normalize().multiplyScalar(WALKING_SPEED);

        // pos update
        const nextPos = new Vector3(
            this.pos.x + this.sfm_velocity.x * dt,
            this.pos.y,
            this.pos.z + this.sfm_velocity.y * dt
        )
        
        this.pos.x = nextPos.x;
        this.pos.z = nextPos.z; 
        
        //pedestrian render, if reached goal -> snap to goal pos
        const reachedGoal = this.reachedGoal();
        if (renderMeta) {
            this.updateMesh(renderMeta);
            if (reachedGoal) {
                this.pos.copy(this.goal.pos);
                this.mesh.position.copy(this.pos);
                this.mesh.position.y = renderMeta.pfProps.depth / 2 + renderMeta.tileProps.height / 2 + PEDESTRIAN_HEIGHT / 2;
            }
        }

        return reachedGoal;
    }

    step(dt, action, renderMeta = null) {
        // actions: [dismount] = [0, 1], [turn_left,turn_right] = [-1, 1], [brake, accel] = [-1, 1], [vx,vz]
        this.isDismounted = action.dismount; 
        if (this.isDismounted === 1) this.step_dismount(dt, action, renderMeta);
        else this.step_mount(dt, action, renderMeta);

        const reachedGoal = this.reachedGoal();
        if (renderMeta) {
            this.updateMesh(renderMeta);
            if (reachedGoal) {
                this.pos.copy(this.goal.pos);
                this.mesh.position.copy(this.pos);
                this.mesh.position.y = renderMeta.pfProps.depth / 2 + renderMeta.tileProps.height / 2 + PEDESTRIAN_HEIGHT / 2;
            }
        }

        return reachedGoal;
    }

    updateMesh(renderMeta) {
        this.mesh.position.copy(this.pos);
        this.mesh.position.y = renderMeta.pfProps.depth / 2 + renderMeta.tileProps.height / 2 + MMV_HEIGHT / 2; 
        this.mesh.rotation.y = -this.heading_angle;
    }

    render(renderMeta) {
        const mmvGeo = new THREE.BoxGeometry(
            MMV_LENGTH + MMV_FRONT_OVERHANG + MMV_REAR_OVERHANG,
            MMV_HEIGHT,
            MMV_WIDTH
        );
        const PURPLE = "#800080";
        const mmvMat = new THREE.MeshStandardMaterial({ color: PURPLE });
        const mmv = new THREE.Mesh(mmvGeo, mmvMat);
        mmv.castShadow = true;
        mmv.receiveShadow = true;

        // position
        mmv.position.copy(this.pos);
        mmv.position.y = renderMeta.pfProps.depth / 2 + renderMeta.tileProps.height / 2 + MMV_HEIGHT / 2; 
        
        // orientation
        mmv.rotation.y = -this.heading_angle;
        
        renderMeta.world.add(mmv);
        this.mesh = mmv;
    }
}

export class Goal {
    // pos: Vector3
    constructor(id, pos, type, grid_loc, fullTileType) {
        this.id = id;
        this.pos = pos;
        this.type = type;
        this.grid_loc = grid_loc;
        this.fullTileType = fullTileType;
        
        let dir = null;
        if (this.type === 'road' || this.type === 'road-cw') {
            const parts = this.fullTileType.split('-');
            dir = this.type === 'road-cw' ? parts[2] : parts[1];
        }
        this.dir = dir;
    }

    render(renderMeta) {
        const goalGeo = new THREE.ConeGeometry(10, 50, 50);
        
        let color = null;
        switch (this.type) {
            case "sidewalk":
                color = CYAN;
                break;
            case "road":
                color = MAGENTA;
                break;
        }

        const goalMat = new THREE.MeshStandardMaterial({ color: color });
        const goal = new THREE.Mesh(goalGeo, goalMat);
        
        goal.position.copy(this.pos);
        goal.position.y = renderMeta.pfProps.depth / 2 + renderMeta.tileProps.height / 2 + GOAL_HEIGHT / 2;
        goal.castShadow = true;
        goal.receiveShadow = true;
        renderMeta.world.add(goal);
    }
}