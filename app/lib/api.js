const API_URL = 
    "https://tulahack2026-uno-exoworker.dfilirini.workers.dev";

export async function fetchPlanets() {
    const response = await fetch(`${API_URL}/planets`);

    if (!response.ok) {
        throw new Error(
            `Worker API request failed: ${response.status}`
        );
    }

    const data = await response.json();

    if (
        !Array.isArray(data.planets) ||
        typeof data.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(data.updatedAt))
    ) {
        throw new TypeError("Worker API returned invalid data");
    }

    return {
        planets: data.planets,
        updatedAt: new Date(data.updatedAt)
    };
}

export async function fetchPreview() {
    const response = await fetch(`${API_URL}/preview`);

    if (!response.ok) {
        throw new Error(
            `Worker API request failed: ${response.status}`
        );
    }

    const data = await response.json();

    if (!Array.isArray(data.planets)) {
        throw new TypeError("Worker API returned invalid data");
    }

    return data.planets;
}
