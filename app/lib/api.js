const API_URL =
    "https://tulahack2026-uno-exoworker.dfilirini.workers.dev";

export async function fetchCatalog(mode) {
    if (mode !== "preview" && mode !== "full") {
        throw new RangeError("Unknown catalog mode");
    }

    const response = await fetch(`${API_URL}/${mode}`, {
        priority: mode === "preview" ? "high" : "low"
    });

    if (!response.ok) {
        throw new Error(
            `Worker API request failed: ${response.status}`
        );
    }

    const data = await response.json();

    if (
        !data ||
        !Array.isArray(data.planets) ||
        !Array.isArray(data.stars) ||
        typeof data.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(data.updatedAt))
    ) {
        throw new TypeError("Worker API returned invalid data");
    }

    return data;
}
