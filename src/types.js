export class Planet {
    id = null;
    name = null;
    starId = null;

    mass = null;
    radius = null;
    density = null;
    vesc = null;
    gravity = null;
    eqt = null;
    flux = null;

    massProvenance = null;

    orbit = {
        semiMajorAxis: null,
        eccentricity: null,
        period: null,
        inclination: null,
        argumentOfPeriastron: null
    };

    discovery = {
        method: null,
        year: null,
        facility: null
    };

    esi = {
        full: null,
        simple: null
    };

    habitableZone = {
        conservative: { inner: null, outer: null },
        optimistic: { inner: null, outer: null }
    };

    habitableTimeFraction = {
        conservative: null,
        optimistic: null
    };

    classification = {
        sizeClass: null
    };
}

export class Star {
    id = null;
    name = null;

    spectralType = null;
    temperature = null;
    luminosity = null;
    mass = null;
    radius = null;
    age = null;
    metallicity = null;
    rotationPeriod = null;

    system = {
        starCount: null,
        planetCount: null,
        moonCount: null,
        distance: null
    };
}