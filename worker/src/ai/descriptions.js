import systemPrompt from "./system.prompt.md";
import userPrompt from "./user.prompt.md";
import starSystemPrompt from "./star.system.prompt.md";

const AI_URL = "https://api.aitunnel.ru/v1/chat/completions";
const AI_MODEL = "deepseek-v4.1-flash-1017";

export function descriptionKey(id) {
    return `descriptions:${id}`;
}

export function isDescription(value, id) {
    return value?.id === id &&
        typeof value.description === "string" &&
        value.description.trim().length > 0;
}

export async function readDescription(env, id) {
    const value = await env.PLANETS_KV.get(descriptionKey(id), "json");
    return isDescription(value, id) ? value : null;
}

export async function getDescription(env, kind, planet, star) {
    const id = kind === "planet" ? planet.id : star.id;
    const cached = await readDescription(env, id);
    if (cached !== null) return cached;

    const objectId = env.DESCRIPTION_GENERATOR.idFromName(id);
    const response = await env.DESCRIPTION_GENERATOR.get(objectId).fetch(
        "https://description.internal/generate",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind, planet, star })
        }
    );

    if (!response.ok) {
        throw new Error(`Description generator returned ${response.status}`);
    }

    return response.json();
}

async function generateDescription(env, kind, planet, star) {
    if (!env.AI_TOKEN) {
        throw new Error("AI_TOKEN is not configured");
    }

    const data = kind === "planet" ? { Planet: planet, Star: star } : { Star: star };
    const instruction = kind === "planet"
        ? userPrompt
        : "Подготовь индивидуальное научно-популярное описание звезды по данным Star. Данные для анализа:";
    const response = await fetch(AI_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${env.AI_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: AI_MODEL,
            stream: false,
            max_tokens: 4096,
            messages: [
                { role: "system", content: kind === "planet" ? systemPrompt : starSystemPrompt },
                { role: "user", content: `${instruction}\n${JSON.stringify(data)}` }
            ]
        }),
        signal: AbortSignal.timeout(90_000)
    });

    if (!response.ok) {
        throw new Error(`AITUNNEL returned ${response.status}`);
    }

    const result = await response.json();
    const choice = result.choices?.[0];
    const description = choice?.message?.content;
    if (typeof description !== "string" || !description.trim() ||
        choice.finish_reason !== "stop") {
        throw new Error("AITUNNEL returned an empty or incomplete description");
    }

    return description.trim();
}

// Один объект на id: одновременные запросы из разных регионов используют
// общую генерацию, даже пока новая запись ещё не распространилась в KV.
export class DescriptionGenerator {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.pending = null;
    }

    async fetch(request) {
        const { kind, planet, star } = await request.json();
        const id = kind === "planet" ? planet?.id : star?.id;
        if (!["planet", "star"].includes(kind) ||
            typeof id !== "string" || !id.startsWith(`${kind}:`)) {
            return new Response("Invalid description request", { status: 400 });
        }

        if (this.pending === null) {
            this.pending = this.ensureDescription(id, kind, planet, star)
                .finally(() => { this.pending = null; });
        }

        return Response.json(await this.pending);
    }

    async ensureDescription(id, kind, planet, star) {
        let saved = await this.state.storage.get("description");
        if (!isDescription(saved?.value, id)) {
            const cached = await readDescription(this.env, id);
            const value = cached ?? {
                id,
                description: await generateDescription(this.env, kind, planet, star)
            };
            saved = { value, published: cached !== null };
            // Сохраняем результат до KV: сбой записи KV не запускает AI повторно.
            await this.state.storage.put("description", saved);
        }

        if (!saved.published) {
            await this.env.PLANETS_KV.put(descriptionKey(id), JSON.stringify(saved.value));
            await this.state.storage.put("description", { ...saved, published: true });
        }

        return saved.value;
    }
}
