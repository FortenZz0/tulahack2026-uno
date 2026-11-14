
import { Planet } from "./planet.js";
import { calculateESI, calculateSimpleESI } from "./esi.js";
import {
    calculateHabitableZone,
    calculateHabitableTimeFraction,
} from "./habitable-zone.js";

const NASA_URL = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync";

const FIELDS = [
    "pl_name",
    "pl_rade",
    "pl_bmasse",
    "pl_dens",
    "pl_eqt",
    "st_teff",
    "st_lum",
    "pl_orbsmax",
    "pl_orbeccen",
    "pl_orbper",
];

function parseNumber(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
}

function parsePositiveNumber(value) {
    const number = parseNumber(value);

    return number !== null && number > 0 ? number : null;
}

function parseEccentricity(value) {
    const number = parseNumber(value);

    return number !== null && number >= 0 && number < 1
        ? number
        : null;
}

function parseName(value) {
    return typeof value === "string" && value.trim()
        ? value.trim()
        : null;
}

function createPlanet(row) {
    const planet = new Planet();

    planet.name = parseName(row.pl_name);

    planet.mass = parsePositiveNumber(row.pl_bmasse);
    planet.radius = parsePositiveNumber(row.pl_rade);
    planet.density = parsePositiveNumber(row.pl_dens);
    planet.eqt = parsePositiveNumber(row.pl_eqt);

    planet.star.temperature = parsePositiveNumber(row.st_teff);

    const logLuminosity = parseNumber(row.st_lum);

    if (logLuminosity !== null) {
        const luminosity = 10 ** logLuminosity;

        planet.star.luminosity =
            Number.isFinite(luminosity) && luminosity > 0
                ? luminosity
                : null;
    }

    planet.orbit.semiMajorAxis = parsePositiveNumber(row.pl_orbsmax);
    planet.orbit.eccentricity = parseEccentricity(row.pl_orbeccen);
    planet.orbit.period = parsePositiveNumber(row.pl_orbper);

    if (planet.mass !== null && planet.radius !== null) {
        planet.vesc = 11.186 * Math.sqrt(
            planet.mass / planet.radius
        );
    }

    if (
        planet.radius !== null &&
        planet.eqt !== null
    ) {
        planet.esi.simple = calculateSimpleESI(
            planet.radius,
            planet.eqt
        );

        if (
            planet.density !== null &&
            planet.vesc !== null
        ) {
            planet.esi.full = calculateESI(
                planet.radius,
                planet.density,
                planet.vesc,
                planet.eqt
            );
        }
    }
    
    const temperature = planet.star.temperature;
    const luminosity = planet.star.luminosity;

    if (
        temperature !== null &&
        temperature >= 2600 &&
        temperature <= 7200 &&
        luminosity !== null
    ) {
        const zone = calculateHabitableZone(
            temperature,
            luminosity
        );

        if (zone !== null) {
            planet.habitableZone = zone;

            const semiMajorAxis = planet.orbit.semiMajorAxis;
            const eccentricity = planet.orbit.eccentricity;

            if (
                semiMajorAxis !== null &&
                eccentricity !== null
            ) {
                const fraction = calculateHabitableTimeFraction(
                    semiMajorAxis,
                    eccentricity,
                    zone
                );

                if (fraction !== null) {
                    planet.habitableTimeFraction = fraction;
                }
            }
        }
    }

    return planet;
}

export async function fetchPlanets() {
    const query = `SELECT ${FIELDS.join(", ")} FROM pscomppars`;

    const url = new URL(NASA_URL);

    url.searchParams.set("query", query);
    url.searchParams.set("format", "json");

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `NASA API request failed: ${response.status}`
        );
    }

    const rows = await response.json();

    if (!Array.isArray(rows)) {
        throw new TypeError("NASA API returned invalid data");
    }

    return rows.map(createPlanet);
}
