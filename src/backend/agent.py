import numpy as np

class Position:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Position(x={self.x}, y={self.y})"
    
    def distance(self, other):
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5
    
    def to_dict(self):
        return {"x": self.x, "y": self.y}

class Agent:
    def __init__(self, position, goal_position, heading_angle, length, width):
        """
        Initialize an agent with position and heading angle.
        :param position: A tuple (x, y) representing the agent's position (m).
        :param heading_angle: A float representing the agent's heading angle in degrees.
        """
        self.position = Position(*position)
        self.goal_position = Position(*goal_position)  # Default goal position
        self.velocity = 0.0 # m/s
        self.acceleration = 0.0 # m/s^2
        self.heading_angle = heading_angle
        self.length = length
        self.width = width
        
    def __repr__(self):
        return (f"Agent(position={self.position}, velocity={self.velocity}, "
                f"acceleration={self.acceleration}, heading_angle={self.heading_angle})")
    
    def to_dict(self):
        return {
            "type": "agent",
            "position": self.position.to_dict(),
            "goal_position": self.goal_position.to_dict(),
            "heading_angle": self.heading_angle,
            "length": self.length,
            "width": self.width,
            "velocity": self.velocity,
            "acceleration": self.acceleration
        }

    def update(self, dt):
        """
        Update the agent's position based on its velocity and acceleration using Euler method.
        :param dt: Time step for the update.
        """
        heading_radians = np.radians(self.heading_angle)
        self.position.x += self.velocity * np.cos(heading_radians) * dt
        self.position.y += self.velocity * np.sin(heading_radians) * dt
        self.velocity += self.acceleration * dt

    def update_rk4(self, dt):
        """
        Update the agent's position using the Runge-Kutta 4th order method.
        Idk if this will be that much more accurate than Euler method, but can test it.
        :param dt: Time step for the update.
        """
        k1_v = self.velocity
        k1_a = self.acceleration

        k2_v = self.velocity + 0.5 * k1_a * dt
        k2_a = self.acceleration

        k3_v = self.velocity + 0.5 * k2_a * dt
        k3_a = self.acceleration

        k4_v = self.velocity + k3_a * dt
        k4_a = self.acceleration

        self.position.x += (k1_v + 2*k2_v + 2*k3_v + k4_v) / 6 * dt
        self.position.y += (k1_v + 2*k2_v + 2*k3_v + k4_v) / 6 * dt
        self.velocity += (k1_a + 2*k2_a + 2*k3_a + k4_a) / 6 * dt
    
class Vehicle(Agent):
    def __init__(self, position, goal_position, heading_angle, length, width, front_overhang, rear_overhang, steering_angle=0.0):
        """
        Initializes a vehicle with position, velocity, acceleration, heading angle, and dimensions.
        :param position: A tuple (x, y) representing the vehicle's position (center of vehicle).
        :param heading_angle: A float representing the vehicle's heading angle in degrees.
        :param length: Length between axles.
        :param width: Width of the vehicle.
        :param front_overhang: Distance from the front axle to the front of the vehicle.
        :param rear_overhang: Distance from the rear axle to the rear of the vehicle.
        :param steering_angle: Steering angle of the vehicle in degrees between [-90, 90] in body frame.
        """
        super().__init__(position, goal_position, heading_angle, length, width)
        self.origin = self.pos_to_origin()
        self.omega = 0.0 # angular velocity in degrees/s
        self.steering_angle = steering_angle
        self.width = width
        self.length = length
        self.front_overhang = front_overhang
        self.rear_overhang = rear_overhang

    def __repr__(self):
        return (f"Vehicle(position={self.position}, velocity={self.velocity}, "
                f"acceleration={self.acceleration}, heading_angle={self.heading_angle}, ")
    
    def to_dict(self):
        dict = super().to_dict()
        dict["type"] = "vehicle"
        dict["steering_angle"] = self.steering_angle
        dict["front_overhang"] = self.front_overhang
        dict["rear_overhang"] = self.rear_overhang
        dict["omega"] = self.omega
        dict["origin"] = self.origin.to_dict()
        return dict
    
    def pos_to_origin(self):
        """
        Convert the vehicle's position to the origin of the vehicle (center of rear axle for RWD).
        :return: A tuple (x, y) representing the vehicle's position at its origin.
        """
        heading_radians = np.radians(self.heading_angle)
        x = self.position.x - (self.length / 2) * np.cos(heading_radians)
        y = self.position.y - (self.length / 2) * np.sin(heading_radians)
        return Position(x, y)
    
    def origin_to_pos(self):
        """
        Convert the vehicle's origin position to the center of the vehicle.
        :return: A tuple (x, y) representing the vehicle's position at its center.
        """
        heading_radians = np.radians(self.heading_angle)
        x = self.origin.x + (self.length / 2) * np.cos(heading_radians)
        y = self.origin.y + (self.length / 2) * np.sin(heading_radians)
        return Position(x, y)
    
    def update(self, dt):
        """
        Update the vehicle's position based on its velocity and acceleration using Euler method.
        :param dt: Time step for the update.
        """
        # Update the steering angle based on angular velocity
        self.steering_angle += self.omega * dt
        self.steering_angle = np.clip(self.steering_angle, -90, 90)  # Ensure steering angle is within bounds
        
        # Update the heading angle based on steering angle
        steering_radians = np.radians(self.steering_angle)
        self.heading_angle += (self.velocity / self.length) * np.tan(steering_radians) * dt
        self.heading_angle = self.heading_angle % 360
        
        heading_radians = np.radians(self.heading_angle)
        self.origin.x += self.velocity * np.cos(heading_radians) * dt
        self.origin.y += self.velocity * np.sin(heading_radians) * dt
        self.position = self.origin_to_pos()
        self.velocity += self.acceleration * dt

    def accelerate(self, acceleration):
        self.acceleration = acceleration

    def steer(self, omega):
        self.omega = omega
        
    def gap(self, other):
        """
        Calculate the gap between self and other.
        :param other: The other vehicle.
        :return: Gap between the two vehicles.
        """
        heading_radians = np.radians(self.heading_angle)
        front_position = Position(self.position.x + (self.front_overhang + self.length) * np.cos(heading_radians), 
                                  self.position.y + (self.front_overhang + self.length) * np.sin(heading_radians))
        other_heading_radians = np.radians(other.heading_angle)
        rear_position = Position(other.position.x - other.rear_overhang * np.cos(other_heading_radians),
                                    other.position.y - other.rear_overhang * np.sin(other_heading_radians))
        
        # Calculate the distance from the front of this vehicle to the rear of the other vehicle
        return front_position.distance(rear_position)
    
    def follow(self, other, v0, a, b, delta, T, s0, dt):
        """
        Follow another vehicle using IDM (Intelligent Driver Model).
        :param other: The vehicle to follow.
        :param v0: The desired velocity.
        :param a: The maximum acceleration.
        :param b: The comfortable deceleration .
        :param delta: The acceleration exponent.
        :param T: The safe time headway.
        :param s0: The minimum distance between vehicles.
        """
        gap = self.gap(other)

        desired_gap = s0 + max(0, self.velocity * T + (self.velocity * (self.velocity - other.velocity)) / (2 * np.sqrt(a * b)))
        self.acceleration = a * (1 - (self.velocity / v0) ** delta - (desired_gap / gap) ** 2)
        self.update(dt)

    # TODO: approaching stop sign
    
class MMV(Vehicle):
    def __init__(self, position, goal_position, velocity, acceleration, heading_angle, length, width, front_overhang, rear_overhang, steering_angle=0.0):
        """
        Initializes a micro-mobility vehicle (MMV) as a type of vehicle.
        TODO add MMV specific properties for RL
        """
        super().__init__(position, goal_position, velocity, acceleration, heading_angle, length, width, front_overhang, rear_overhang, steering_angle)

    def __repr__(self):
        return (f"MMV(position={self.position}, velocity={self.velocity}, "
                f"acceleration={self.acceleration}, heading_angle={self.heading_angle}, ")
    
    def to_dict(self):
        dict = super().to_dict()
        dict["type"] = "mmv"
        return dict
    
class Pedestrian(Agent):
    def __init__(self, position, goal_position, heading_angle, length, width):
        super().__init__(position, goal_position, heading_angle, length, width)

    def __repr__(self):
        return (f"Pedestrian(position={self.position}, velocity={self.velocity}, "
                f"acceleration={self.acceleration}, heading_angle={self.heading_angle}, ")
    
    def to_dict(self):
        return {
            "type": "pedestrian",
            "position": self.position.to_dict(),
            "goal_position": self.goal_position.to_dict(),
            "heading_angle": self.heading_angle,
            "length": self.length,
            "width": self.width,
            "velocity": self.velocity,
            "acceleration": self.acceleration
        }