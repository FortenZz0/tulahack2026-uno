export class Planet {
    name = null;

    mass = null;
    radius = null;
    density = null;
    vesc = null;
    eqt = null;

    flux = null;

    star = {
        name: null,
        temperature: null,
        luminosity: null,
    };

    orbit = {
        semiMajorAxis: null,
        eccentricity: null,
        period: null,
    };

    esi = {
        full: null,
        simple: null,
    };

    habitableZone = {
        conservative: {
            inner: null,
            outer: null,
        },
        optimistic: {
            inner: null,
            outer: null,
        },
    };

    habitableTimeFraction = {
        conservative: null,
        optimistic: null,
    };

    classification = {
        sizeClass: null,
    };
}
