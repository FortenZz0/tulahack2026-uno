// коэффициенты для расчета границ обитаемости 
// по модели Kopparapu et al. (2014)
// https://doi.org/10.1088/2041-8205/787/2/L29
const COEFFICIENTS = {
    recentVenus: {
        s: 1.776,
        a: 2.136e-4,
        b: 2.533e-8,
        c: -1.332e-11,
        d: -3.097e-15,
    },
    runawayGreenhouse: {
        s: 1.107,
        a: 1.332e-4,
        b: 1.580e-8,
        c: -8.308e-12,
        d: -1.931e-15,
    },
    maximumGreenhouse: {
        s: 0.356,
        a: 6.171e-5,
        b: 1.698e-9,
        c: -3.198e-12,
        d: -5.575e-16,
    },
    earlyMars: {
        s: 0.320,
        a: 5.547e-5,
        b: 1.526e-9,
        c: -2.874e-12,
        d: -5.011e-16,
    },
};

export function effectiveFlux(temperature, coefficients) {
    // Температура относительно солнечной (5780 К)
    const t = temperature - 5780;
    const { s, a, b, c, d } = coefficients;

    return s + a * t + b * t ** 2
        + c * t ** 3 + d * t ** 4;
}

export function calculateHabitableZone(temperature, luminosity) {
    if (
        !Number.isFinite(temperature)
        || temperature < 2600
        || temperature > 7200
    ) {
        throw new RangeError(
            "Температура звезды должна быть от 2600 до 7200 К."
        );
    }

    if (!Number.isFinite(luminosity) || luminosity <= 0) {
        throw new RangeError(
            "Светимость звезды должна быть положительным числом."
        );
    }

    const distance = (boundary) => {
        const flux = effectiveFlux(
            temperature,
            COEFFICIENTS[boundary]
        );

        return Math.sqrt(luminosity / flux);
    };

    return {
        conservative: {
            inner: distance("runawayGreenhouse"),
            outer: distance("maximumGreenhouse"),
        },
        optimistic: {
            inner: distance("recentVenus"),
            outer: distance("earlyMars"),
        },
    };
}

function orbitalTimeFractionWithinRadius(
    semiMajorAxis,
    eccentricity,
    radius
) {
    const periapsis = semiMajorAxis * (1 - eccentricity);
    const apoapsis = semiMajorAxis * (1 + eccentricity);

    if (radius <= periapsis) return 0;
    if (radius >= apoapsis) return 1;

    // Переводим расстояние в эксцентрическую, затем в среднюю аномалию
    const cosE = (1 - radius / semiMajorAxis) / eccentricity;
    const E = Math.acos(Math.max(-1, Math.min(1, cosE)));

    return (E - eccentricity * Math.sin(E)) / Math.PI;
}

export function calculateHabitableTimeFraction(
    semiMajorAxis,
    eccentricity,
    zone
) {
    if (!Number.isFinite(semiMajorAxis) || semiMajorAxis <= 0) {
        throw new RangeError(
            "Большая полуось должна быть положительным числом."
        );
    }

    if (
        !Number.isFinite(eccentricity)
        || eccentricity < 0
        || eccentricity >= 1
    ) {
        throw new RangeError(
            "Эксцентриситет должен находиться в диапазоне [0, 1)."
        );
    }

    const fraction = ({ inner, outer }) => {
        return orbitalTimeFractionWithinRadius(
            semiMajorAxis,
            eccentricity,
            outer
        ) - orbitalTimeFractionWithinRadius(
            semiMajorAxis,
            eccentricity,
            inner
        );
    };

    return {
        conservative: fraction(zone.conservative),
        optimistic: fraction(zone.optimistic),
    };
}