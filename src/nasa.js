import { Planet, Star } from "./types.js";
import { calculateSimpleESI } from "./esi.js";
import {
    calculateHabitableZone,
    calculateHabitableTimeFraction,
} from "./habitable-zone.js";
import {
    calculateMultiStarHabitableTimeFraction
} from "./multi-star.js";

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

function parseLimit(value) {
    const number = parseNumber(value);
    return number === -1 || number === 0 || number === 1
        ? number
        : null;
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

// Путь свойства, столбец NASA, парсер, наличие поля lim
const PLANET_NUMBERS = [
    ["mass", "pl_bmasse", parsePositiveNumber],
    ["radius", "pl_rade", parsePositiveNumber],
    ["density", "pl_dens", parsePositiveNumber],
    ["eqt", "pl_eqt", parsePositiveNumber],
    ["flux", "pl_insol", parseNonNegativeNumber],
    ["orbit.semiMajorAxis", "pl_orbsmax", parsePositiveNumber],
    ["orbit.eccentricity", "pl_orbeccen", parseEccentricity],
    ["orbit.period", "pl_orbper", parsePositiveNumber],
    ["orbit.inclination", "pl_orbincl", parseInclination],
    ["orbit.argumentOfPeriastron", "pl_orblper", parseAngle],
    ["observations.transitDepth", "pl_trandep", parseNonNegativeNumber],
    ["observations.transitDuration", "pl_trandur", parsePositiveNumber],
    ["observations.radialVelocityAmplitude", "pl_rvamp", parseNonNegativeNumber]
];

const STAR_NUMBERS = [
    ["temperature", "st_teff", parsePositiveNumber],
    ["luminosity", "st_lum", parseLuminosity],
    ["mass", "st_mass", parsePositiveNumber],
    ["radius", "st_rad", parsePositiveNumber],
    ["age", "st_age", parseNonNegativeNumber],
    ["metallicity", "st_met", parseNumber],
    ["rotationPeriod", "st_rotp", parsePositiveNumber],
    ["system.distance", "sy_dist", parsePositiveNumber, false],
    ["coordinates.ra", "ra", parseAngle, false],
    ["coordinates.dec", "dec", parseDeclination, false]
];

const BASIC_FIELDS = [
    "pl_name",
    "hostname",
    "hd_name",
    "hip_name",
    "tic_id",
    "gaia_dr3_id",
    "pl_bmassprov",
    "discoverymethod",
    "disc_year",
    "disc_facility",
    "disc_telescope",
    "disc_instrument",
    "disc_refname",
    "st_spectype",
    "st_metratio",
    "sy_snum",
    "sy_mnum",
    "cb_flag"
];

function measurementFields(specs) {
    return specs.flatMap(([, column, , hasLimit = true]) => [
        column,
        `${column}err1`,
        `${column}err2`,
        ...(hasLimit ? [`${column}lim`] : [])
    ]);
}

export const NASA_FIELDS = [
    ...new Set([
        ...BASIC_FIELDS,
        ...measurementFields(PLANET_NUMBERS),
        ...measurementFields(STAR_NUMBERS)
    ])
];

function readMeasurement(row, column, hasLimit) {
    return {
        value: parseNumber(row[column]),
        err1: parseNumber(row[`${column}err1`]),
        err2: parseNumber(row[`${column}err2`]),
        lim: hasLimit ? parseLimit(row[`${column}lim`]) : null
    };
}

function getPath(object, path) {
    return path.split(".").reduce(
        (value, key) => value?.[key],
        object
    );
}

function setPath(object, path, value) {
    const parts = path.split(".");
    const property = parts.pop();
    let target = object;

    for (const part of parts) {
        target = target[part];
    }

    target[property] = value;
}

function applyMeasurements(object, row, specs) {
    for (const [path, column, parser, hasLimit = true] of specs) {
        const measurement = readMeasurement(
            row,
            column,
            hasLimit
        );

        if (Object.values(measurement).every(value => value === null)) {
            continue;
        }

        object.measurements[path] = measurement;

        // Верхний/нижний предел не является точным измерением.
        const value = measurement.lim === 1 || measurement.lim === -1
            ? null
            : parser(measurement.value);

        setPath(object, path, value);
    }
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
    star.metallicityRatio = parseName(row.st_metratio);

    star.system.starCount = parseInteger(row.sy_snum);
    star.system.distance = null;
    star.system.circumbinary = parseFlag(row.cb_flag);
    star.system.moonsReported = parseInteger(row.sy_mnum);

    applyMeasurements(star, row, STAR_NUMBERS);

    return star;
}

function mergeStar(target, source) {
    for (const [path] of STAR_NUMBERS) {
        const current = getPath(target, path);
        const incoming = getPath(source, path);

        if (current === null && incoming !== null) {
            setPath(target, path, incoming);
            target.measurements[path] =
                source.measurements[path];
        } else if (
            current !== null &&
            incoming !== null &&
            current !== incoming
        ) {
            target.flags.conflictingMeasurements = true;
        } else if (
            !target.measurements[path] &&
            source.measurements[path]
        ) {
            target.measurements[path] =
                source.measurements[path];
        }
    }

    for (const group of ["identifiers", "system"]) {
        for (const field of Object.keys(target[group])) {
            if (field === "components") continue;

            if (group === "system" && field === "circumbinary") {
                if (source.system.circumbinary === true) {
                    target.system.circumbinary = true;
                } else if (target.system.circumbinary === null) {
                    target.system.circumbinary =
                        source.system.circumbinary;
                }
                continue;
            }

            if (
                target[group][field] === null &&
                source[group][field] !== null
            ) {
                target[group][field] = source[group][field];
            }
        }
    }

    for (const field of [
        "spectralType",
        "metallicityRatio"
    ]) {
        if (target[field] === null && source[field] !== null) {
            target[field] = source[field];
        }
    }
}

function measurementInterval(value, measurement) {
    if (
        !Number.isFinite(value) ||
        !Number.isFinite(measurement?.err1) ||
        !Number.isFinite(measurement?.err2)
    ) {
        return null;
    }

    const lower = value + measurement.err2;
    const upper = value + measurement.err1;

    if (lower > upper) return null;

    return { lower, upper };
}

function checkDensityConsistency(planet) {
    const { mass, radius, density } = planet;

    if (
        mass === null ||
        radius === null ||
        density === null ||
        planet.flags.massIsMinimum === true
    ) {
        planet.flags.densityConsistency = "unavailable";
        return;
    }

    const calculated = 5.514 * mass / (radius ** 3);
    const ratio = density / calculated;

    if (!Number.isFinite(ratio) || ratio <= 0) {
        planet.flags.densityConsistency = "unavailable";
        return;
    }

    planet.flags.densityRatio = ratio;

    const m = measurementInterval(
        mass, planet.measurements.mass
    );

    const r = measurementInterval(
        radius, planet.measurements.radius
    );

    const d = measurementInterval(
        density, planet.measurements.density
    );

    if (
        m !== null && r !== null && d !== null &&
        m.lower > 0 && r.lower > 0 && d.lower > 0
    ) {
        const minDensity =
            5.514 * m.lower / (r.upper ** 3);

        const maxDensity =
            5.514 * m.upper / (r.lower ** 3);

        planet.flags.densityConsistency =
            d.upper >= minDensity && d.lower <= maxDensity
                ? "compatible"
                : "inconsistent";

        return;
    }

    // Предварительная проверка при неполных погрешностях.
    // Фактор 2 — диагностический порог, не физический закон.
    planet.flags.densityConsistency =
        ratio < 0.5 || ratio > 2
            ? "suspicious"
            : "plausible";
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

    applyMeasurements(planet, row, PLANET_NUMBERS);

    planet.massProvenance = parseName(row.pl_bmassprov);

    planet.discovery.method = parseName(row.discoverymethod);
    planet.discovery.year = parseInteger(row.disc_year);
    planet.discovery.facility = parseName(row.disc_facility);
    planet.discovery.telescope = parseName(row.disc_telescope);
    planet.discovery.instrument = parseName(row.disc_instrument);
    planet.discovery.reference = parseName(row.disc_refname);

    const provenance = planet.massProvenance?.toLowerCase() ?? "";

    planet.flags.massIsEstimated = provenance
        ? provenance.includes("m-r relationship")
        : null;

    planet.flags.massIsMinimum = provenance
        ? provenance === "msini" ||
          provenance === "m*sin(i)" ||
          provenance === "m*sini"
        : null;

    const massLimit = planet.measurements.mass?.lim;
    planet.flags.massIsLimit =
        massLimit === 1 || massLimit === -1;

    planet.flags.circumbinary = parseFlag(row.cb_flag);

    if (
        planet.mass !== null &&
        planet.radius !== null &&
        planet.flags.massIsMinimum !== true
    ) {
        planet.vesc = 11.186 * Math.sqrt(
            planet.mass / planet.radius
        );

        planet.gravity =
            planet.mass / (planet.radius ** 2);
    }

    // Полный ESI пока не рассчитываем.
    planet.esi.full = null;

    if (planet.radius !== null && planet.flux !== null) {
        planet.esi.simple = calculateSimpleESI(
            planet.radius,
            planet.flux
        );
    }

    checkDensityConsistency(planet);

    const temperature = star?.temperature ?? null;
    const luminosity = star?.luminosity ?? null;
    const starCount = star?.system.starCount ?? null;

    if (starCount === 1) {
        planet.flags.habitableZoneModel = "single-star";

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
    } else if (starCount !== null && starCount > 1) {
        planet.flags.habitableZoneModel = "multi-star-data-missing";
    } else {
        planet.flags.habitableZoneModel = "unknown-star-count";
    }

    planet.classification.sizeClass =
        classifyPlanet(planet.radius);

    return planet;
}

export function parseNASAPlanets(rows, options = {}) {
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new TypeError(
            "NASA returned an empty or invalid catalog"
        );
    }

    const starsById = new Map();
    const planetsById = new Map();

    const validRows = rows
        .filter(row =>
            row !== null &&
            typeof row === "object" &&
            !Array.isArray(row)
        )
        .sort((a, b) =>
            String(a.pl_name ?? "").localeCompare(
                String(b.pl_name ?? ""), "en"
            )
        );

    // Сначала объединяем сведения о звёздах.
    for (const row of validRows) {
        const parsedStar = parseStar(row);

        if (parsedStar === null) continue;

        const star = starsById.get(parsedStar.id);

        if (star === undefined) {
            starsById.set(parsedStar.id, parsedStar);
        } else {
            mergeStar(star, parsedStar);
        }
    }

    // Дополнительные компоненты и эфемериды должны
    // поступать из независимо проверенных источников.
    const multiStarData = options.multiStarData ?? {};

    for (const star of starsById.values()) {
        const details = multiStarData[star.id];

        if (Array.isArray(details?.components)) {
            star.system.components = details.components;
        }

        const count = star.system.starCount;

        if (count !== null && count > 1) {
            star.flags.multiStarDataComplete =
                star.system.components.length === count;
        }
    }

    // Затем создаём планеты, используя готовые Star.
    for (const row of validRows) {
        const name = parseName(row.pl_name);
        if (name === null) continue;

        const starName = parseName(row.hostname);
        const star = starName === null
            ? null
            : starsById.get(createId("star", starName));

        const planet = createPlanet(row, star);

        if (!planetsById.has(planet.id)) {
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

        if (star === undefined) continue;

        star.planets.push(planet.id);

        if (
            star.system.starCount === null ||
            star.system.starCount <= 1
        ) {
            continue;
        }

        const details = multiStarData[star.id];
        const samples = details?.planets?.[planet.id];

        if (!star.flags.multiStarDataComplete) continue;

        const fraction = calculateMultiStarHabitableTimeFraction(
            star.system.components,
            samples
        );

        if (fraction !== null) {
            planet.habitableTimeFraction = fraction;
            planet.flags.habitableZoneModel =
                "multi-star-sampled";
        }
    }

    return {
        planets,
        stars: [...starsById.values()]
    };
}
