import { parseNASAPlanets } from "./nasa.js";

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
const PREVIEW_KEY = "preview.json";
const MAX_KV_VALUE_SIZE = 25 * 1024 * 1024;

// топ-50 по полному ESI
function createPreview(planets) {
    return planets
        .filter(planet => Number.isFinite(planet.esi.full))
        .sort((a, b) => b.esi.full - a.esi.full)
        .slice(0, 50);
}

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

    const rows = await response.json();

    if (!Array.isArray(rows)) {
        throw new Error("Invalid NASA API response");
    }

    const planets = parseNASAPlanets(rows);

    const data = {
        updatedAt: new Date().toISOString(),
        planets
    };

    const preview = {
        updatedAt: data.updatedAt,
        planets: createPreview(planets)
    };

    const json = JSON.stringify(data);
    const size = new TextEncoder().encode(json).byteLength;

    if (size > MAX_KV_VALUE_SIZE) {
        throw new Error(
            `Planet catalog exceeds KV limit: ${size} bytes`
        );
    }

    await env.PLANETS_KV.put(
        STORAGE_KEY,
        json
    );

    await env.PLANETS_KV.put(
        PREVIEW_KEY,
        JSON.stringify(preview)
    );

    console.log(`Сохранено ${planets.length} планет`);

    return data;
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname !== "/planets" && url.pathname !== "/preview") {
            return new Response("Not Found", {
                status: 404
            });
        }

        if (request.method !== "GET") {
            return new Response("Method Not Allowed", {
                status: 405,
                headers: {
                    "Allow": "GET"
                }
            });
        }

        // клиент сможет распарсить наконец-то!
        const headers = {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store"
        };

        try {
            if (url.pathname === "/preview") {
                let preview = await env.PLANETS_KV.get(PREVIEW_KEY);

                if (preview === null) {
                    const catalog = await env.PLANETS_KV.get(STORAGE_KEY);

                    if (catalog !== null) {
                        const data = JSON.parse(catalog);

                        if (
                            Array.isArray(data.planets) &&
                            data.planets.every(planet =>
                                planet !== null &&
                                typeof planet === "object" &&
                                planet.esi !== null &&
                                typeof planet.esi === "object"
                            )
                        ) {
                            preview = JSON.stringify({
                                updatedAt: data.updatedAt,
                                planets: createPreview(data.planets)
                            });

                            await env.PLANETS_KV.put(PREVIEW_KEY, preview);
                        }
                    }
                }

                if (preview !== null) {
                    return new Response(preview, {
                        headers: {
                            ...headers,
                            "Content-Type": "application/json"
                        }
                    });
                }

                const data = await updatePlanets(env);

                return Response.json({
                    updatedAt: data.updatedAt,
                    planets: createPreview(data.planets)
                }, {
                    headers
                });
            }

            const object = await env.PLANETS_KV.get(STORAGE_KEY);

            if (object !== null) {
                return new Response(object, {
                    headers: {
                        ...headers,
                        "Content-Type": "application/json"
                    }
                });
            }

            console.log("Каталог пуст, загружунькаем данные с NASA");

            const data = await updatePlanets(env);

            return Response.json(data, {
                headers
            });
        } catch (error) {
            console.error("Не удалось получить каталог планет: ", error);

            return Response.json(
                { error: "Каталог экзопланет пока не доступен😂😂😂.." },
                {
                    status: 503,
                    headers
                }
            );
        }
    },

    async scheduled(event, env, ctx) {
        console.log("актуализируем каталог...");
        ctx.waitUntil(
            updatePlanets(env)
                .then(() => {
                    console.log("успешно актуализировали каталог...")
                })
                .catch((error) => {
                    console.error("актуализация провалена: ", error);
                    throw error;
                })
        )
    }
};
