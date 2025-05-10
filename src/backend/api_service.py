from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Union
from agent import *
import numpy as np
import json
from enum import Enum


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
            agents = {}
            for k, v in data.items():
                if v["type"] == "vehicle":
                    agents[int(k)] = Vehicle(
                        position=(v["position"]["x"], v["position"]["y"]),
                        goal_position=(v["goal_position"]["x"], v["goal_position"]["y"]),
                        heading_angle=v["heading_angle"],
                        length=v["length"],
                        width=v["width"],
                        front_overhang=v["front_overhang"],
                        rear_overhang=v["rear_overhang"],
                    )
                elif v["type"] == "pedestrian":
                    agents[int(k)] = Pedestrian(
                        position=(v["position"]["x"], v["position"]["y"]),
                        goal_position=(v["goal_position"]["x"], v["goal_position"]["y"]),
                        heading_angle=v["heading_angle"],
                        length=v["length"],
                        width=v["width"],
                    )
                elif v["type"] == "mmv":
                    agents[int(k)] = MMV(
                        position=(v["position"]["x"], v["position"]["y"]),
                        goal_position=(v["goal_position"]["x"], v["goal_position"]["y"]),
                        heading_angle=v["heading_angle"],
                        length=v["length"],
                        width=v["width"],
                        front_overhang=v["front_overhang"],
                        rear_overhang=v["rear_overhang"],
                    )
                else:
                    raise ValueError(f"Unknown agent type: {v['type']}")
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

class AgentType(str, Enum):
    VEHICLE = "vehicle"
    PEDESTRIAN = "pedestrian"
    MMV = "mmv"

class CreateAgentRequest(BaseModel):
    type: AgentType
    data: Union[AgentCreate, VehicleCreate]

class UpdateAgent(BaseModel):
    dt: float

@app.post("/agents/")
async def create_agent(agent_data: CreateAgentRequest):
    """
    Create a new agent and store it in memory.
    """
    agent_id = len(agents) + 1
    if agent_data.type == AgentType.PEDESTRIAN:
        new_agent = Pedestrian(
            position=tuple(agent_data.data.position),
            goal_position=tuple(agent_data.data.goal_position),
            heading_angle=agent_data.data.heading_angle,
            length=agent_data.data.length,
            width=agent_data.data.width,
        )
    elif agent_data.type == AgentType.VEHICLE:
        new_agent = Vehicle(
            position=tuple(agent_data.data.position),
            goal_position=tuple(agent_data.data.goal_position),
            heading_angle=agent_data.data.heading_angle,
            length=agent_data.data.length,
            width=agent_data.data.width,
            front_overhang=agent_data.data.front_overhang,
            rear_overhang=agent_data.data.rear_overhang,
        )
    elif agent_data.type == AgentType.MMV:
        new_agent = MMV(
            position=tuple(agent_data.data.position),
            goal_position=tuple(agent_data.data.goal_position),
            heading_angle=agent_data.data.heading_angle,
            length=agent_data.data.length,
            width=agent_data.data.width,
            front_overhang=agent_data.data.front_overhang,
            rear_overhang=agent_data.data.rear_overhang,
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid agent type")
    agents[agent_id] = new_agent
    save_agents_to_file()
    return {"agent_id": agent_id, "agent": new_agent}

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
    
    reached_goal = agent.update(dt)
    return {"agent_id": agent_id, "agent": agent.to_dict(), "reached_goal": str(reached_goal)}

@app.delete("/agents/{agent_id}")
async def delete_agent(agent_id: int):
    """
    Delete an agent by its ID.
    """
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    del agents[agent_id]
    return {"message": f"Agent {agent_id} deleted successfully"}
