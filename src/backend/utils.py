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
    
def angle_between_vectors(origin, center, goal):
    # Vector from origin to center
    vector1 = (center.x - origin.x, center.y - origin.y)
    
    # Vector from center to goal
    vector2 = (goal.x - center.x, goal.y - center.y)
    
    dot_product = vector1[0] * vector2[0] + vector1[1] * vector2[1]
    cross_product = vector1[0] * vector2[1] - vector1[1] * vector2[0]
    
    magnitude1 = np.sqrt(vector1[0]**2 + vector1[1]**2)
    magnitude2 = np.sqrt(vector2[0]**2 + vector2[1]**2)
    
    if magnitude1 == 0 or magnitude2 == 0:
        return 0.0
    
    # Calculate the signed angle in radians
    angle_radians = np.arctan2(cross_product, dot_product)
    angle_degrees = np.degrees(angle_radians)
    
    return angle_degrees