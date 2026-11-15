import { parseNASAPlanets, NASA_FIELDS } from "./nasa.js";

const NASA_URL =
    "https://exoplanetarchive.ipac.caltech.edu/TAP/sync";

const FIELDS = NASA_FIELDS

const STORAGE_KEY = "planets.json";
const STARS_KEY = "stars.json";
const MAX_KV_VALUE_SIZE = 25 * 1024 * 1024;

// топ-50 по упрощенному ESI
function createPreview(planets) {
    return planets
        .filter(planet => Number.isFinite(planet.esi?.simple))
        .sort((a, b) =>
            b.esi.simple - a.esi.simple ||
            a.id.localeCompare(b.id)
        )
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

function isCurrentPart(data, field) {
    return data !== null &&
        typeof data === "object" &&
        typeof data.updatedAt === "string" &&
        Number.isFinite(Date.parse(data.updatedAt)) &&
        Array.isArray(data[field]) &&
        data[field].every(item =>
            item !== null &&
            typeof item === "object" &&
            item.measurements !== null &&
            typeof item.measurements === "object" &&
            item.flags !== null &&
            typeof item.flags === "object" &&
            (
                field === "planets"
                    ? item.esi?.full === null
                    : Array.isArray(item.planets)
            )
        ) &&
        !(field === "planets" ? "stars" in data : "planets" in data);
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
    const updatedAt = new Date().toISOString();

    const data = {
        updatedAt,
        planets,
        stars
    };

    const planetsJson = serializeForKV({ updatedAt, planets });
    const starsJson = serializeForKV({ updatedAt, stars });

    await Promise.all([
        env.PLANETS_KV.put(STORAGE_KEY, planetsJson),
        env.PLANETS_KV.put(STARS_KEY, starsJson)
    ]);

    console.log(`Сохранено ${planets.length} планет`);

    return data;
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (!["/planets", "/stars", "/preview", "/full"].includes(url.pathname)) {
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
            if (url.pathname === "/planets" || url.pathname === "/stars") {
                const field = url.pathname === "/planets" ? "planets" : "stars";
                const key = field === "planets" ? STORAGE_KEY : STARS_KEY;
                const cached = await env.PLANETS_KV.get(key, "json");

                if (isCurrentPart(cached, field)) {
                    return Response.json(cached, { headers });
                }

                console.log("Каталог пуст, загружунькаем данные с NASA");
                const data = await updatePlanets(env);

                return Response.json({
                    updatedAt: data.updatedAt,
                    [field]: data[field]
                }, { headers });
            }

            const [cachedPlanets, cachedStars] = await Promise.all([
                env.PLANETS_KV.get(STORAGE_KEY, "json"),
                env.PLANETS_KV.get(STARS_KEY, "json")
            ]);

            if (!isCurrentPart(cachedPlanets, "planets") ||
                !isCurrentPart(cachedStars, "stars")) {
                console.log("Каталог пуст, загружунькаем данные с NASA");
                const data = await updatePlanets(env);

                return Response.json(
                    url.pathname === "/preview" ? createPreviewData(data) : data,
                    { headers }
                );
            }

            if (cachedPlanets.updatedAt !== cachedStars.updatedAt) {
                throw new Error("Planet and star catalog timestamps do not match");
            }

            const data = {
                updatedAt: cachedPlanets.updatedAt,
                planets: cachedPlanets.planets,
                stars: cachedStars.stars
            };

            return Response.json(
                url.pathname === "/preview" ? createPreviewData(data) : data,
                { headers }
            );
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
