import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrbitViewData } from '../orbit-data.js';

test('Данные выбранной планеты задают орбиту и масштаб обеих зон', () => {
    const planet = {
        orbit: { semiMajorAxis: 2, eccentricity: 0.4, period: 100 },
        habitableZone: { conservative: { inner: 1, outer: 3 }, optimistic: { inner: 0.8, outer: 4 } },
    };
    const data = getOrbitViewData(planet, { luminosity: 2 });
    assert.equal(data.hasOrbit, true);
    assert.equal(data.semiMajorAxis, 2);
    assert.equal(data.eccentricity, 0.4);
    assert.equal(data.periodDays, 100);
    assert.equal(data.luminosity, 2);
    assert.deepEqual(data.zones, planet.habitableZone);
    assert.equal(data.zones.optimistic.outer * data.scale, 136);
    assert.ok(data.semiMajorAxis * (1 + data.eccentricity) * data.scale < 136);
});

test('Нулевой эксцентриситет допустим, пропуски и неположительные полуоси — нет', () => {
    assert.equal(getOrbitViewData({ orbit: { semiMajorAxis: 1, eccentricity: 0 } }, null).hasOrbit, true);
    for (const value of [null, undefined, NaN, Infinity, -1, '1']) {
        assert.equal(getOrbitViewData({ orbit: { semiMajorAxis: value, eccentricity: 0 } }, null).hasOrbit, false);
        assert.equal(getOrbitViewData({ orbit: { semiMajorAxis: 1, eccentricity: value } }, null).hasOrbit, false);
    }
    assert.equal(getOrbitViewData({ orbit: { semiMajorAxis: 0, eccentricity: 0 } }, null).hasOrbit, false);
    assert.equal(getOrbitViewData({ orbit: { semiMajorAxis: 1, eccentricity: 1 } }, null).hasOrbit, false);
});

test('Отсутствие периода, светимости и одной из зон не уничтожает геометрию', () => {
    const data = getOrbitViewData({
        orbit: { semiMajorAxis: 1, eccentricity: 0.5, period: null },
        habitableZone: { conservative: { inner: 2, outer: 1 }, optimistic: { inner: 1, outer: 2 } },
    }, null);
    assert.equal(data.hasOrbit, true);
    assert.equal(data.periodDays, null);
    assert.equal(data.luminosity, null);
    assert.equal(data.zones.conservative, null);
    assert.deepEqual(data.zones.optimistic, { inner: 1, outer: 2 });
});

test('Новый объект с пропусками не получает значения предыдущей планеты', () => {
    getOrbitViewData({ orbit: { semiMajorAxis: 1, eccentricity: 0, period: 365 } }, { luminosity: 1 });
    const data = getOrbitViewData(null, null);
    assert.equal(data.hasOrbit, false);
    assert.equal(data.periodDays, null);
    assert.equal(data.scale, null);
    assert.deepEqual(data.zones, { conservative: null, optimistic: null });
});

test('Светимость одной звезды не моделирует общий поток многозвёздной системы', () => {
    const data = getOrbitViewData({ orbit: { semiMajorAxis: 1, eccentricity: 0 } }, {
        luminosity: 2, system: { starCount: 2 },
    });
    assert.equal(data.multipleStars, true);
    assert.equal(data.luminosity, null);
});
