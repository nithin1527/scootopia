export const WHITE = "#FFFFFF";
export const DIRT = "#D2B48C";
export const SUNLIGHT = "#FFF3E0";
export const PLATFORM_UNDER = "#080820";
export const SIDEWALK = "#D6D3D1";
export const ROAD = "#333333";
export const GRASS = "#16A34A";
export const CYAN = "#00FFFF";
export const MAGENTA = "#FF00FF";
export const PURPLE = "#800080";
export const ORANGE = "#FFA500";

// show constants -- control these!!
export const SHOW_PEDESTRIAN = true;
export const SHOW_MMV = true;
export const SHOW_DRIVER = true;
export const SHOW_SECTOR = true;
export const SHOW_GOALS = true;
export const SHOW_SINGLE_AGENT = false;
export const SINGLE_AGENT_TYPE = 'mmv';

// limiter constants for init spawning distribution of agents
// constants w1,w2,w3
export const NUM_CARS_LIMITER = 0.5;
export const NUM_PEDESTRIANS_LIMITER = 0.5;
export const NUM_MMV_LIMITER = 0.4;

// agents spawned on the SAME tile must be sep MIN_SEP_DIST apart
export const MIN_SEP_DIST = 800;

// goal constants
export const GOAL_HEIGHT = 50;

// pedestrian constants
export const PEDESTRIAN_GOAL_RADIUS = 20; 
export const PEDESTRIAN_HEIGHT = 50;
export const WALKING_SPEED = 5;

// sfm constants
export const TAU = 1; 
export const A = 5.0; 
export const MMV_A = 2.0;
export const MMV_B = 2.0;
export const B = 5.0; 

// driver constants
export const DRIVER_GOAL_RADIUS = 30;
export const DRIVER_WIDTH = 40;
export const DRIVER_LENGTH = 40; 
export const DRIVER_HEIGHT = 10;
export const FRONT_OVERHANG = 5;
export const REAR_OVERHANG = 5

export const ACCEL = 2.0; // m/s^2 -- acceleration
export const BRAKE = 2.0; // m/s^2 -- deceleration
export const MAX_VELOCITY = 10.0; // m/s 

// driver speeder constants
export const SPEEDER_ACCEL = 4.0; // m/s^2 -- acceleration
export const SPEEDER_BRAKE = 2.0; // m/s^2 -- deceleration
export const SPEEDER_MAX_VELOCITY = 15.0; // m/s

export const OMEGA = Math.PI; // rad/s 
export const MAX_STEERING_ANGLE = Math.PI / 4; // rad

// mmv constants
export const MMV_WIDTH = 10;
export const MMV_LENGTH = 30; //need for rl later
export const MMV_HEIGHT = 10;
export const MMV_FRONT_OVERHANG = 5;
export const MMV_REAR_OVERHANG = 5;

export const MMV_WALKING_SPEED = 5;
export const MMV_ACCEL = 3.0;  // m/s^2 -- acceleration
export const MMV_BRAKE = 3.0;  // m/s^2 -- deceleration
export const MMV_MAX_VELOCITY = 10.0; // m/s
export const MMV_MAX_STEERING_ANGLE = Math.PI / 5; // rad

// mmv speeder constants
export const MMV_SPEEDER_ACCEL = 5.0; // m/s^2 -- acceleration
export const MMV_SPEEDER_BRAKE = 3.0; // m/s^2 -- deceleration
export const MMV_SPEEDER_MAX_VELOCITY = 20.0; // m/s

export const MMV_OMEGA = Math.PI; // rad/s