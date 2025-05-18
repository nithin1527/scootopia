export const WHITE = "#FFFFFF";
export const DIRT = "#D2B48C";
export const SUNLIGHT = "#FFF3E0";
export const PLATFORM_UNDER = "#080820";
export const SIDEWALK = "#D6D3D1";
export const ROAD = "#333333";
export const GRASS = "#16A34A";
export const CYAN = "#00FFFF";
export const MAGENTA = "#FF00FF";

// goal constants
export const GOAL_HEIGHT = 50;

// pedestrian constants
export const PEDESTRIAN_GOAL_RADIUS = 20; 
export const PEDESTRIAN_HEIGHT = 50;
export const WALKING_SPEED = 5;
// sfm constants
export const TAU = 0.5; 
export const A = 10.0; 
export const B = 10.0; 

// driver constants
export const DRIVER_GOAL_RADIUS = 20;
export const DRIVER_WIDTH = 40;
export const DRIVER_LENGTH = 40; 
export const DRIVER_HEIGHT = 10;
export const FRONT_OVERHANG = 5;
export const REAR_OVERHANG = 5

export const ACCEL = 2.0; // m/s^2 -- acceleration
export const BRAKE = 2.0; // m/s^2 -- deceleration
export const MAX_VELOCITY = 10.0; // m/s 
export const OMEGA = Math.PI / 2; // rad/s 

// mmv constants
export const MMV_WIDTH = 10;
export const MMV_LENGTH = 20; //need for rl
export const MMV_HEIGHT = 10;
export const MMV_FRONT_OVERHANG = 5;
export const MMV_REAR_OVERHANG = 5;

export const MMV_ACCEL = 3.0;  // m/s^2 -- acceleration
export const MMV_BRAKE = 5.0;  // m/s^2 -- deceleration
export const MMV_MAX_VELOCITY = 10.0; // m/s
export const MMV_OMEGA = Math.PI; // rad/s