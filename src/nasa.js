import { Planet, Star } from "./types.js";
import { calculateESI, calculateSimpleESI } from "./esi.js";
import {
    calculateHabitableZone,
    calculateHabitableTimeFraction,
} from "./habitable-zone.js";

/* Парсеры */
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

function parseNonNegativeNumber(value) {
    const number = parseNumber(value);
    return number !== null && number >= 0 ? number : null;
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

function parseInteger(value) {
    const number = parseNonNegativeNumber(value);
    return number !== null && Number.isSafeInteger(number)
        ? number
        : null;
}

function parseAngle(value) {
    const number = parseNumber(value);
    return number !== null && number >= 0 && number <= 360
        ? number
        : null;
}

function parseInclination(value) {
    const number = parseNumber(value);
    return number !== null && number >= 0 && number <= 180
        ? number
        : null;
}

function parseDeclination(value) {
    const number = parseNumber(value);
    return number !== null && number >= -90 && number <= 90
        ? number
        : null;
}

function parseFlag(value) {
    const number = parseNumber(value);
    return number === 1 ? true : number === 0 ? false : null;
}

function createId(type, name) {
    return `${type}:${name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()}`;
}

function parseLuminosity(value) {
    const logLuminosity = parseNumber(value);

    if (logLuminosity === null) return null;

    const luminosity = 10 ** logLuminosity;
    return Number.isFinite(luminosity) && luminosity > 0
        ? luminosity
        : null;
}

function parseReference(value) {
    const reference = parseName(value);
    return reference;
}

function parseStar(row) {
    const star = new Star();
    star.name = parseName(row.hostname);
    if (star.name === null) return null;

    star.id = createId("star", star.name);
    star.identifiers.hd = parseName(row.hd_name);
    star.identifiers.hip = parseName(row.hip_name);
    star.identifiers.tic = parseName(row.tic_id);
    star.identifiers.gaiaDR3 = parseName(row.gaia_dr3_id);

    star.spectralType = parseName(row.st_spectype);
    star.temperature = parsePositiveNumber(row.st_teff);
    star.luminosity = parseLuminosity(row.st_lum);
    star.mass = parsePositiveNumber(row.st_mass);
    star.radius = parsePositiveNumber(row.st_rad);
    star.age = parseNonNegativeNumber(row.st_age);
    star.metallicity = parseNumber(row.st_met);
    star.metallicityRatio = parseName(row.st_metratio);
    star.rotationPeriod = parsePositiveNumber(row.st_rotp);

    star.system.starCount = parseInteger(row.sy_snum);
    star.system.distance = parsePositiveNumber(row.sy_dist);
    star.system.circumbinary = parseFlag(row.cb_flag);
    star.system.moonsReported = parseInteger(row.sy_mnum);

    star.coordinates.ra = parseAngle(row.ra);
    star.coordinates.dec = parseDeclination(row.dec);

    return star;
}

function mergeStar(target, source) {
    // Не заменяем известные значения пропусками из других строк NASA.
    // При расхождении двух известных значений сохраняем первое.
    for (const field of [
        "spectralType", "temperature", "luminosity", "mass", "radius",
        "age", "metallicity", "metallicityRatio", "rotationPeriod"
    ]) {
        if (target[field] === null && source[field] !== null) {
            target[field] = source[field];
        }
    }

    for (const group of ["identifiers", "system", "coordinates"]) {
        for (const field of Object.keys(target[group])) {
            if (target[group][field] === null && source[group][field] !== null) {
                target[group][field] = source[group][field];
            }
        }
    }
}


/* ПРОИЗВОДНЫЕ */

export function classifyPlanet(radius) {
    if (
        typeof radius !== "number" ||
        !Number.isFinite(radius) ||
        radius <= 0
    ) {
        return null;
    }

    if (radius < 0.5) return "MINI";
    if (radius < 1.0) return "terrestrial";
    if (radius < 1.75) return "super-earth";
    if (radius < 3.5) return "sub-neptune";
    if (radius < 6.0) return "neptune";
    if (radius <= 14.3) return "jupiter";

    return "MEGA";
}

export function createPlanet(row, star = parseStar(row)) {
    const planet = new Planet();

    planet.name = parseName(row.pl_name);
    if (planet.name !== null) {
        planet.id = createId("planet", planet.name);
    }
    planet.starId = star?.id ?? null;

    planet.mass = parsePositiveNumber(row.pl_bmasse);
    planet.massProvenance = parseName(row.pl_bmassprov);
    planet.radius = parsePositiveNumber(row.pl_rade);
    planet.density = parsePositiveNumber(row.pl_dens);
    planet.eqt = parsePositiveNumber(row.pl_eqt);
    planet.flux = parseNonNegativeNumber(row.pl_insol);

    planet.orbit.semiMajorAxis =
        parsePositiveNumber(row.pl_orbsmax);

    planet.orbit.eccentricity =
        parseEccentricity(row.pl_orbeccen);

    planet.orbit.period =
        parsePositiveNumber(row.pl_orbper);

    planet.orbit.inclination =
        parseInclination(row.pl_orbincl);

    planet.orbit.argumentOfPeriastron =
        parseAngle(row.pl_orblper);

    planet.discovery.method = parseName(row.discoverymethod);
    planet.discovery.year = parseInteger(row.disc_year);
    planet.discovery.facility = parseName(row.disc_facility);
    planet.discovery.telescope = parseName(row.disc_telescope);
    planet.discovery.instrument = parseName(row.disc_instrument);
    planet.discovery.reference = parseReference(row.disc_refname);

    planet.observations.transitDepth =
        parseNonNegativeNumber(row.pl_trandep);
    planet.observations.transitDuration =
        parsePositiveNumber(row.pl_trandur);
    planet.observations.radialVelocityAmplitude =
        parseNonNegativeNumber(row.pl_rvamp);

    if (planet.mass !== null && planet.radius !== null) {
        planet.vesc = 11.186 * Math.sqrt(
            planet.mass / planet.radius
        );

        planet.gravity = planet.mass / (planet.radius ** 2);
    }

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

    if (planet.radius !== null && planet.flux !== null) {
        planet.esi.simple = calculateSimpleESI(
            planet.radius,
            planet.flux
        );
    }

    const temperature = star?.temperature ?? null;
    const luminosity = star?.luminosity ?? null;

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

    planet.classification.sizeClass =
        classifyPlanet(planet.radius);

    return planet;
}

export function parseNASAPlanets(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new TypeError(
            "NASA returned an empty or invalid catalog"
        );
    }

    const starsById = new Map();
    const planetsById = new Map();

    for (const row of rows) {
        if (row === null || typeof row !== "object" || Array.isArray(row)) {
            continue;
        }

        const parsedStar = parseStar(row);
        let star = null;

        if (parsedStar !== null) {
            star = starsById.get(parsedStar.id);

            if (star === undefined) {
                star = parsedStar;
                starsById.set(star.id, star);
            } else {
                mergeStar(star, parsedStar);
            }
        }

        const planet = createPlanet(row, star);
        if (planet.id !== null && !planetsById.has(planet.id)) {
            planetsById.set(planet.id, planet);
        }
    }

    const planets = [...planetsById.values()];
    if (planets.length === 0) {
        throw new TypeError(
            "NASA returned an empty or invalid catalog"
        );
    }

    for (const planet of planets) {
        const star = starsById.get(planet.starId);
        if (star !== undefined) {
            star.planets.push(planet.id);
        }
    }

    return {
        planets,
        stars: [...starsById.values()]
    };
}
