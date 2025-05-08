/**
 * 
 * @param {Object} agentData position, heading, length, width
 * @returns 
 */
export async function createAgent(agentData) {
    try {
        const response = await fetch('http://127.0.0.1:8000/agents/create_agent/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(agentData),
        });

        if (!response.ok) {
            throw new Error(`Failed to create agent: ${response.statusText}`);
        }

        const data = await response.json();
        return data; // Contains agent_id and agent details
    } catch (error) {
        console.error('Error creating agent:', error);
        throw error;
    }
}

export async function updateAgent(agentId, dt) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/agents/${agentId}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({dt}),
        });
        if (!response.ok) {
            throw new Error(`Failed to update agent: ${response.statusText}`);
        } 
        const data = await response.json();
        return data; // Contains updated agent details
    } catch (error) {
        console.error('Error updating agent:', error);
        throw error;
    }
}