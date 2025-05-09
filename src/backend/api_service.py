from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from agent import *
import numpy as np
import json

app = FastAPI()

# Enable CORS to allow requests from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins, for development purposes
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def save_agents_to_file():
    with open("agents.json", "w") as f:
        json.dump({k: v.to_dict() for k, v in agents.items()}, f)

def load_agents_from_file():
    global agents
    try:
        with open("agents.json", "r") as f:
            data = json.load(f)
            agents = {
                int(k): Agent(
                    position=(v["position"]["x"], v["position"]["y"]),
                    goal_position=(v["goal_position"]["x"], v["goal_position"]["y"]),
                    heading_angle=v["heading_angle"],
                    length=v["length"],
                    width=v["width"],
                )
                for k, v in data.items()
            }
    except FileNotFoundError:
        agents = {}

# Load agents when the server starts
load_agents_from_file()

# Pydantic model for creating agents
class AgentCreate(BaseModel):
    position: List[float]  # [x, y]
    goal_position: List[float]  # [x, y]
    heading_angle: float
    length: float
    width: float

class VehicleCreate(AgentCreate):
    front_overhang: float
    rear_overhang: float

class UpdateAgent(BaseModel):
    dt: float

@app.post("/agents/create_agent/")
async def create_agent(agent_data: AgentCreate):
    """
    Create a new agent and store it in memory.
    """
    agent_id = len(agents) + 1
    new_agent = Agent(
        position=tuple(agent_data.position),
        goal_position=tuple(agent_data.goal_position),  # Default goal position
        heading_angle=agent_data.heading_angle,
        length=agent_data.length,
        width=agent_data.width,
    )
    agents[agent_id] = new_agent
    save_agents_to_file()
    return {"agent_id": agent_id, "agent": new_agent}

@app.post("/agents/create_vehicle/")
async def create_vehicle(agent_data: VehicleCreate):
    """
    Create a new vehicle and store it in memory.
    """
    agent_id = len(agents) + 1
    new_vehicle = Vehicle(
        position=tuple(agent_data.position),
        heading_angle=agent_data.heading_angle,
        length=agent_data.length,
        width=agent_data.width,
        front_overhang=agent_data.front_overhang,
        rear_overhang=agent_data.rear_overhang,
    )
    agents[agent_id] = new_vehicle
    return {"agent_id": agent_id, "vehicle": new_vehicle}

@app.post("/agents/create_mmv/")
async def create_mmv(agent_data: VehicleCreate):
    """
    Create a new MMV and store it in memory.
    """
    agent_id = len(agents) + 1
    new_mmv = MMV(
        position=tuple(agent_data.position),
        heading_angle=agent_data.heading_angle,
        length=agent_data.length,
        width=agent_data.width,
        front_overhang=agent_data.front_overhang,
        rear_overhang=agent_data.rear_overhang,  
    )
    agents[agent_id] = new_mmv
    return {"agent_id": agent_id, "mmv": new_mmv}

@app.post("/agents/create_pedestrian/")
async def create_pedestrian(agent_data: AgentCreate):
    """
    Create a new pedestrian and store it in memory.
    """
    agent_id = len(agents) + 1
    new_pedestrian = Pedestrian(
        position=tuple(agent_data.position),
        heading_angle=agent_data.heading_angle,
        length=agent_data.length,
        width=agent_data.width,
    )
    agents[agent_id] = new_pedestrian
    return {"agent_id": agent_id, "pedestrian": new_pedestrian}

@app.get("/agents/{agent_id}/")
async def get_agent(agent_id: int):
    """
    Retrieve an agent by its ID.
    """
    agent = agents.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"agent_id": agent_id, "agent": agent}

@app.put("/agents/{agent_id}/")
async def update_agent(agent_id: int, request: UpdateAgent):
    """
    Update agent's position.
    TODO: Replace velocity with RL
    """
    dt = request.dt
    agent = agents.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent.velocity = Position.distance(agent.position, agent.goal_position) / 10
    agent.heading_angle = np.arctan2(agent.goal_position.y - agent.position.y, agent.goal_position.x - agent.position.x)    
    # agent.velocity = 0.1  # Set a constant velocity for simplicity
    agent.update(dt)
    return {"agent_id": agent_id, "agent": agent.to_dict()}

@app.delete("/agents/{agent_id}")
async def delete_agent(agent_id: int):
    """
    Delete an agent by its ID.
    """
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    del agents[agent_id]
    return {"message": f"Agent {agent_id} deleted successfully"}
