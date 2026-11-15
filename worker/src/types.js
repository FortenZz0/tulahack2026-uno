export class Planet {
    // Идентификация и связь со звездой
    id = null;
    name = null;
    starId = null;

    // Физические характеристики
    mass = null;
    massProvenance = null;
    radius = null;
    density = null;
    gravity = null;
    vesc = null;
    eqt = null;
    flux = null;

    // Орбита
    orbit = {
        semiMajorAxis: null,
        eccentricity: null,
        period: null,
        inclination: null,
        argumentOfPeriastron: null
    };

    // Открытие
    discovery = {
        method: null,
        year: null,
        facility: null,
        telescope: null,
        instrument: null,
        reference: null
    };

    // Наблюдения
    observations = {
        transitDepth: null,
        transitDuration: null,
        radialVelocityAmplitude: null
    };

    // Сходство с Землёй
    esi = {
        full: null,
        simple: null
    };

    // Обитаемая зона
    habitableZone = {
        conservative: { inner: null, outer: null },
        optimistic: { inner: null, outer: null }
    };

    // Доля орбиты внутри обитаемой зоны
    habitableTimeFraction = {
        conservative: null,
        optimistic: null
    };

    // Классификация
    classification = {
        sizeClass: null
    };

    // Метаданные измерений NASA
    measurements = {};

    // Результаты проверки данных и расчётов
    flags = {
        massIsEstimated: null,
        massIsMinimum: null,
        massIsLimit: null,
        densityConsistency: null,
        densityRatio: null,
        circumbinary: null,
        habitableZoneModel: null
    };
}

export class Star {
    // Идентификация
    id = null;
    name = null;

    // Обозначения в каталогах
    identifiers = {
        hd: null,
        hip: null,
        tic: null,
        gaiaDR3: null
    };

    // Физические характеристики звезды
    spectralType = null;
    temperature = null;
    luminosity = null;
    mass = null;
    radius = null;
    age = null;
    metallicity = null;
    metallicityRatio = null;
    rotationPeriod = null;

    // Звёздная система
    system = {
        starCount: null,
        distance: null,
        circumbinary: null,
        moonsReported: null,

        // Отдельные физические компоненты звёздной системы
        components: []
    };

    // Положение на небе
    coordinates = {
        ra: null,
        dec: null
    };

    // Связанные планеты
    planets = [];

    // Метаданные измерений NASA
    measurements = {};

    // Результаты проверок
    flags = {
        conflictingMeasurements: false,
        multiStarDataComplete: null
    };
}
