import { parseNASAPlanets } from "./nasa.js";

const NASA_URL =
    "https://exoplanetarchive.ipac.caltech.edu/TAP/sync";

const FIELDS = [
    "pl_name",
    "hostname",
    "hd_name",
    "hip_name",
    "tic_id",
    "gaia_dr3_id",
    "pl_rade",
    "pl_bmasse",
    "pl_bmassprov",
    "pl_dens",
    "pl_eqt",
    "pl_insol",
    "pl_orbsmax",
    "pl_orbeccen",
    "pl_orbper",
    "pl_orbincl",
    "pl_orblper",
    "discoverymethod",
    "disc_year",
    "disc_facility",
    "disc_telescope",
    "disc_instrument",
    "disc_refname",
    "pl_trandep",
    "pl_trandur",
    "pl_rvamp",
    "st_spectype",
    "st_teff",
    "st_lum",
    "st_mass",
    "st_rad",
    "st_age",
    "st_met",
    "st_metratio",
    "st_rotp",
    "sy_snum",
    "sy_mnum",
    "sy_dist",
    "cb_flag",
    "ra",
    "dec"
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

function createPreviewData(data) {
    const planets = createPreview(data.planets);
    const starIds = new Set(planets.map(planet => planet.starId));

    return {
        updatedAt: data.updatedAt,
        planets,
        stars: data.stars.filter(star => starIds.has(star.id))
    };
}

function isCurrentCatalog(data) {
    return data !== null &&
        typeof data === "object" &&
        typeof data.updatedAt === "string" &&
        Array.isArray(data.planets) &&
        Array.isArray(data.stars);
}

function serializeForKV(data) {
    const json = JSON.stringify(data);
    const size = new TextEncoder().encode(json).byteLength;

    if (size > MAX_KV_VALUE_SIZE) {
        throw new Error(
            `Planet catalog exceeds KV limit: ${size} bytes`
        );
    }

    return json;
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

    const { planets, stars } = parseNASAPlanets(rows);

    const data = {
        updatedAt: new Date().toISOString(),
        planets,
        stars
    };

    const preview = createPreviewData(data);
    const json = serializeForKV(data);
    const previewJson = serializeForKV(preview);

    await env.PLANETS_KV.put(
        STORAGE_KEY,
        json
    );

    await env.PLANETS_KV.put(
        PREVIEW_KEY,
        previewJson
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
                const cachedPreview = await env.PLANETS_KV.get(PREVIEW_KEY);

                if (cachedPreview !== null && isCurrentCatalog(JSON.parse(cachedPreview))) {
                    return new Response(cachedPreview, {
                        headers: {
                            ...headers,
                            "Content-Type": "application/json"
                        }
                    });
                }

                const catalog = await env.PLANETS_KV.get(STORAGE_KEY);

                if (catalog !== null) {
                    const data = JSON.parse(catalog);

                    if (isCurrentCatalog(data)) {
                        const preview = serializeForKV(createPreviewData(data));
                        await env.PLANETS_KV.put(PREVIEW_KEY, preview);

                        return new Response(preview, {
                            headers: {
                                ...headers,
                                "Content-Type": "application/json"
                            }
                        });
                    }
                }

                const data = await updatePlanets(env);

                return Response.json(createPreviewData(data), {
                    headers
                });
            }

            const object = await env.PLANETS_KV.get(STORAGE_KEY);

            if (object !== null && isCurrentCatalog(JSON.parse(object))) {
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
