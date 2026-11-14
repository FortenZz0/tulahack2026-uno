const NASA_URL = 
    "https://exoplanetarchive.ipac.caltech.edu/TAP/sync";

const FIELDS = [
    "pl_name",
    "hostname",
    "pl_rade",
    "pl_bmasse",
    "pl_dens",
    "pl_eqt",
    "pl_insol",
    "st_teff",
    "st_lum",
    "pl_orbsmax",
    "pl_orbeccen",
    "pl_orbper"
];

const STORAGE_KEY = "planets.json";

// из базы НАСА
async function updatePlanets(env) {
    const url = new URL(NASA_URL);

    url.searchParams.set(
        "query",
        `SELECT ${FIELDS.join(", ")} FROM pscomppars`
    );

    url.searchParams.set("format", "json");

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`NASA API returned ${response.status}`);
    }

    const planets = await response.json();

    if (!Array.isArray(planets)) {
        throw new Error("Invalid NASA API response");
    }

    const data = {
        updatedAt: new Date().toISOString(),
        planets
    };

    await env.PLANETS_BUCKET.put(
        STORAGE_KEY,
        JSON.stringify(data),
        {
            httpMetadata: {
                contentType: "application/json"
            }
        }
    );

    console.log(`Saved ${planets.length} planets`);

    return data;
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname !== "/planets") {
            return new Response("Not Found", {
                status: 404
            });
        }

        const object = await env.PLANETS_BUCKET.get(STORAGE_KEY);

        if (object === null) {
            return Response.json(
                { error: "Каталог экзопланет пока не доступен😂😂😂.." },
                { status: 503 }
            );
        }
        
        // клиент сможет распарсить наконец-то!
        return new Response(object.body, {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    },

    async scheduled(event, env, ctx) {
        console.log("обновить");
    }
};
