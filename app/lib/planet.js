// поля либо число, либо null
export class Planet {
    name = null;

    mass = null;
    radius = null;
    density = null;
    vesc = null;
    eqt = null;

    star = {
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
        simple: null
    };

    habitableZone = null;
    habitableTimeFraction = null;
}