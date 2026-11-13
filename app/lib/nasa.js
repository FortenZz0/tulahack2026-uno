
import { Planet } from "./types.js";

const NASA_API = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync";
const QUERY = `
    SELECT
        pl_name,
        pl_rade,
        pl_bmasse,
        pl_dens,
        pl_eqt
    FROM pscomppars
`;


function parseName(value) {
    if (typeof value !== "string") {
        return null;
    }

    const name = value.trim();

    if (
        !name ||
        ["unknown", "null", "n/a", "none"].includes(
            name.toLowerCase()
        )
    ) {
        return null;
    }

    return name;
}

function parsePositiveNumber(value) {
    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value <= 0
    ) {
        return null;
    }

    return value;
}

export async function fetchPlanets() {
    const params = new URLSearchParams({
        query: QUERY,
        format: "json"
    });

    const response = await fetch(`${NASA_API}?${params}`);

    if (!response.ok) {
        throw new Error(`NASA API error: ${response.status}`);
    }

    const data = await response.json();

    return data.map(item => {
        const planet = new Planet();

        planet.name = parseName(item.pl_name);

        planet.radius = parsePositiveNumber(item.pl_rade);
        planet.density = parsePositiveNumber(item.pl_dens);
        planet.eqt = parsePositiveNumber(item.pl_eqt);

        const mass = parsePositiveNumber(item.pl_bmasse);

        // Вторая космическая скорость (км/с)
        if (mass > 0 && planet.radius > 0) {
            planet.vesc = 11.186 * Math.sqrt(
                mass / planet.radius
            );
        }

        // Упрощенный ESI
        if (
            planet.radius > 0 &&
            planet.eqt > 0
        ) {
            planet.esi.simple = caluculateSimpleESI(
                planet.radius,
                planet.eqt
            );
        }

        // Полный ESI
        if (
            planet.radius > 0 &&
            planet.density > 0 &&
            planet.vesc > 0 &&
            planet.eqt > 0
        ) {
            planet.esi.full = calculateESI(
                planet.radius,
                planet.density,
                planet.vesc,
                planet.eqt
            );
        }

        return planet;
    });
}

