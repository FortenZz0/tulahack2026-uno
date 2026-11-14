import { Planet } from "./planet.js";
import {
    calculateESI,
    calculateSimpleESI
} from "./esi.js";
import {
    calculateHabitableZone,
    calculateHabitableTimeFraction
} from "./habitable-zone.js";

const NASA_API = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync";

const QUERY = `
    SELECT
        pl_name,
        pl_rade,
        pl_bmasse,
        pl_dens,
        pl_eqt,
        st_teff,
        st_lum,
        pl_orbsmax,
        pl_orbeccen,
        pl_orbper
    FROM pscomppars
`;

function parseName(value) {
    if (typeof value !== "string") {
        return null;
    }

    const name = value.trim();

    if (
        !name ||
        ["unknown", "null", "n/a", "none"].includes(name.toLowerCase())
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

function parseEccentricity(value) {
    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value >= 1
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
        planet.mass = parsePositiveNumber(item.pl_bmasse);

        planet.star.temperature = parsePositiveNumber(item.st_teff);

        const logLuminosity = (
            typeof item.st_lum === "number" &&
            Number.isFinite(item.st_lum)
        ) ? item.st_lum : null;

        if (logLuminosity !== null) {
            planet.star.luminosity = parsePositiveNumber(
                10 ** logLuminosity
            );
        }

        planet.orbit.semiMajorAxis = parsePositiveNumber(item.pl_orbsmax);
        planet.orbit.eccentricity = parseEccentricity(item.pl_orbeccen);
        planet.orbit.period = parsePositiveNumber(item.pl_orbper);

        // Вторая космическая скорость (км/с)
        if (planet.mass !== null && planet.radius !== null) {
            planet.vesc = 11.186 * Math.sqrt(
                planet.mass / planet.radius
            );
        }

        // Упрощённый ESI
        if (planet.radius !== null && planet.eqt !== null) {
            planet.esi.simple = calculateSimpleESI(
                planet.radius,
                planet.eqt
            );
        }

        // Полный ESI
        if (
            planet.radius !== null &&
            planet.density !== null &&
            planet.vesc !== null &&
            planet.eqt !== null
        ) {
            planet.esi.full = calculateESI(
                planet.radius,
                planet.density,
                planet.vesc,
                planet.eqt
            );
        }

        const temperature = planet.star.temperature;
        const luminosity = planet.star.luminosity;

        // Зона обитаемости звезды
        if (
            temperature !== null &&
            temperature >= 2600 &&
            temperature <= 7200 &&
            luminosity !== null
        ) {
            planet.habitableZone = calculateHabitableZone(
                temperature,
                luminosity
            );
        }

        // Доля времени в зоне обитаемости
        if (
            planet.habitableZone !== null &&
            planet.orbit.semiMajorAxis !== null &&
            planet.orbit.eccentricity !== null
        ) {
            planet.habitableTimeFraction = calculateHabitableTimeFraction(
                planet.orbit.semiMajorAxis,
                planet.orbit.eccentricity,
                planet.habitableZone
            );
        }

        return planet;
    });
}
