import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSpectralType, createStarAppearance } from '../appearance.js';

test('Спектральный тип отделяется от подкласса и класса светимости', () => {
    for (const [value, spectral, luminosity] of [
        ['G2V', 'G', 'V'], ['M2.5 V', 'M', 'V'], ['K1 III', 'K', 'III'],
        ['F6 IV', 'F', 'IV'], ['B0 Iab', 'B', 'IAB'], ['O9Ia+', 'O', 'IA+'],
        ['sdM3', 'M', null], ['DA2.5', 'WD', null], ['DB', 'WD', null],
        ['L5', 'L', null], ['T8', 'T', null], ['Y1', 'Y', null],
    ]) {
        const result = parseSpectralType(value);
        assert.equal(result.spectralClass, spectral, value);
        assert.equal(result.luminosityClass, luminosity, value);
    }
    assert.equal(parseSpectralType('K0V+M4V').composite, true);
    for (const value of [null, '', 'Unknown', 'Galaxy', 'Mars', 'DAta']) {
        assert.equal(parseSpectralType(value).spectralClass, null);
    }
});

test('O–M получают семь разных палитр; M без III не объявляется гигантом', () => {
    const palettes = new Set();
    for (const type of ['O5V', 'B2V', 'A1V', 'F5V', 'G2V', 'K3V', 'M4V']) {
        const profile = createStarAppearance({ name: 'Same star', spectralType: type });
        assert.equal(profile.source, 'spectralType');
        assert.match(profile.lowColor, /^#[0-9a-f]{6}$/);
        palettes.add(profile.highColor);
        assert.doesNotMatch(profile.caption, /гигантская/);
    }
    assert.equal(palettes.size, 7);
    assert.match(createStarAppearance({ spectralType: 'M3III' }).caption, /гигантская/);
});

test('Детали звезды повторяются по имени и не используют Math.random', t => {
    t.mock.method(Math, 'random', () => { throw new Error('Нестабильная случайность'); });
    const a = createStarAppearance({ name: 'Kepler-22', spectralType: 'G5V' });
    assert.deepEqual(a, createStarAppearance({ name: ' KEPLER-22 ', spectralType: 'G5V' }));
    assert.notDeepEqual(a.seedOffset, createStarAppearance({ name: 'Kepler-23', spectralType: 'G5V' }).seedOffset);
});

test('Отсутствующие данные остаются неизвестными; температура используется только как палитра', () => {
    const unknown = createStarAppearance(null);
    assert.equal(unknown.source, 'unknown');
    assert.equal(unknown.spectralClass, null);
    for (const temperature of [null, undefined, NaN, Infinity, 0, -1, '5772']) {
        assert.equal(createStarAppearance({ temperature }).source, 'unknown');
    }
    const warm = createStarAppearance({ temperature: 4500 });
    assert.equal(warm.source, 'temperature');
    assert.equal(warm.spectralClass, null);
    assert.match(warm.caption, /температуре/);
    const typed = createStarAppearance({ spectralType: 'M3V', temperature: 15000 });
    assert.equal(typed.source, 'spectralType');
    assert.equal(typed.highColor, createStarAppearance({ spectralType: 'M3V' }).highColor);
});

test('Белый карлик отличается от звезды A и использует температуру для цвета, если она известна', () => {
    const wd = createStarAppearance({ name: 'A', spectralType: 'DA2' });
    const a = createStarAppearance({ name: 'A', spectralType: 'A2V' });
    assert.notEqual(wd.contrast, a.contrast);
    assert.notEqual(wd.glowFalloff, a.glowFalloff);
    const cool = createStarAppearance({ spectralType: 'DA', temperature: 4500 });
    assert.equal(cool.spectralClass, 'WD');
    assert.equal(cool.highColor, createStarAppearance({ spectralType: 'K3V' }).highColor);
});
