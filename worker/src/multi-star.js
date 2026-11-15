import { calculateHabitableZone } from "./habitable-zone.js";

const ZONES = ["conservative", "optimistic"];

function validPosition(position) {
    return position !== null &&
        typeof position === "object" &&
        ["x", "y", "z"].every(axis =>
            Number.isFinite(position[axis])
        );
}

function distanceSquared(a, b) {
    return (a.x - b.x) ** 2 +
        (a.y - b.y) ** 2 +
        (a.z - b.z) ** 2;
}

export function calculateMultiStarHabitableTimeFraction(
    components,
    samples
) {
    if (
        !Array.isArray(components) ||
        components.length < 2 ||
        !Array.isArray(samples) ||
        samples.length < 2
    ) {
        return null;
    }

    const stellarZones = new Map();

    for (const component of components) {
        if (
            typeof component.id !== "string" ||
            !Number.isFinite(component.temperature) ||
            !Number.isFinite(component.luminosity) ||
            component.luminosity <= 0
        ) {
            return null;
        }

        const zone = calculateHabitableZone(
            component.temperature,
            component.luminosity
        );

        if (zone === null) return null;

        for (const type of ZONES) {
            if (
                !Number.isFinite(zone[type]?.inner) ||
                !Number.isFinite(zone[type]?.outer)
            ) {
                return null;
            }
        }

        if (stellarZones.has(component.id)) return null;
        stellarZones.set(component.id, zone);
    }

    const counts = {
        conservative: 0,
        optimistic: 0
    };

    for (const sample of samples) {
        if (
            !validPosition(sample.planet) ||
            !sample.stars ||
            typeof sample.stars !== "object"
        ) {
            return null;
        }

        const totals = {
            conservative: { inner: 0, outer: 0 },
            optimistic: { inner: 0, outer: 0 }
        };

        for (const component of components) {
            const position = sample.stars[component.id];

            if (!validPosition(position)) return null;

            const d2 = distanceSquared(
                sample.planet,
                position
            );

            if (d2 <= 0) return null;

            const zone = stellarZones.get(component.id);

            for (const type of ZONES) {
                totals[type].inner +=
                    (zone[type].inner ** 2) / d2;

                totals[type].outer +=
                    (zone[type].outer ** 2) / d2;
            }
        }

        for (const type of ZONES) {
            if (
                totals[type].inner <= 1 &&
                totals[type].outer >= 1
            ) {
                counts[type]++;
            }
        }
    }

    return {
        conservative: counts.conservative / samples.length,
        optimistic: counts.optimistic / samples.length
    };
}
