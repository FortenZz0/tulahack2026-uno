import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlanetAppearance, createSeededRandom, getAppearanceIdentity, hashPlanetName } from '../appearance.js';
import { createSurfacePixels } from '../surface-pixels.js';

const planet = (name, sizeClass = 'terrestrial', id = 'test') => ({ name, id, classification: { sizeClass } });

test('Имя задаёт повторяемые параметры независимо от ID и порядка выбора', () => {
    const first = createPlanetAppearance(planet('Kepler-186 f'));
    createPlanetAppearance(planet('Другая планета', 'jupiter'));
    assert.deepEqual(createPlanetAppearance(planet('  KEPLER-186   f ', 'terrestrial', 'another-id')), first);
    assert.notDeepEqual(createPlanetAppearance(planet('Kepler-186 g')), first);
    assert.equal(hashPlanetName('Планета b'), hashPlanetName('Планета b'));
    const a = createSeededRandom(0), b = createSeededRandom(0);
    for (let i = 0; i < 20; i++) {
        const value = a();
        assert.equal(value, b());
        assert.ok(value >= 0 && value < 1);
    }
});

test('Все реальные классы Worker имеют пресет; неизвестный класс не определяется по радиусу', () => {
    const styles = { MINI: 'rocky', terrestrial: 'rocky', 'super-earth': 'rocky', 'sub-neptune': 'hazy', neptune: 'gas-bands', jupiter: 'gas-bands', MEGA: 'gas-bands' };
    for (const [sizeClass, style] of Object.entries(styles)) {
        const config = createPlanetAppearance(planet('Одна планета', sizeClass));
        assert.equal(config.materialClass, sizeClass.toLowerCase());
        assert.equal(config.style, style);
        assert.ok(config.roughness >= 0 && config.roughness <= 1);
        assert.match(config.primaryColor, /^#[0-9a-f]{6}$/);
    }
    assert.equal(createPlanetAppearance({ radius: 15, name: 'Неизвестная' }).materialClass, 'unknown');
    assert.equal(createPlanetAppearance(planet('Неизвестная', 'unrecognized')).materialClass, 'unknown');
    assert.notEqual(getAppearanceIdentity(planet('A', 'neptune')).key, getAppearanceIdentity(planet('A', 'jupiter')).key);
});

test('Отсутствие имени использует стабильный ID', () => {
    assert.deepEqual(createPlanetAppearance(planet(null)), createPlanetAppearance(planet(null)));
    assert.notEqual(createPlanetAppearance(planet(null, 'terrestrial', 'a')).seed,
        createPlanetAppearance(planet(null, 'terrestrial', 'b')).seed);
});

test('Пиксели повторяются без Math.random и имеют бесшовный стык долгот', t => {
    t.mock.method(Math, 'random', () => { throw new Error('Нестабильная случайность'); });
    for (const sizeClass of ['MINI', 'super-earth', 'sub-neptune', 'neptune', 'jupiter', 'MEGA']) {
        const config = createPlanetAppearance(planet('Тест b', sizeClass));
        const first = createSurfacePixels(config, 64, 32);
        assert.deepEqual(first, createSurfacePixels(createPlanetAppearance(planet('Тест b', sizeClass)), 64, 32));
        assert.equal(first.length, 64 * 32 * 4);
        for (let y = 0; y < 32; y++) {
            assert.deepEqual(first.slice(y * 64 * 4, y * 64 * 4 + 4), first.slice((y * 64 + 63) * 4, (y * 64 + 64) * 4));
        }
        assert.ok(new Set(first).size > 30);
    }
});

test('Рисунок меняется между именами и классами, газовые полосы неоднородны по долготе', () => {
    const base = createSurfacePixels(createPlanetAppearance(planet('A', 'jupiter')), 64, 32);
    assert.notDeepEqual(base, createSurfacePixels(createPlanetAppearance(planet('B', 'jupiter')), 64, 32));
    assert.notDeepEqual(base, createSurfacePixels(createPlanetAppearance(planet('A', 'terrestrial')), 64, 32));
    const row = Array.from({ length: 64 }, (_, x) => base[(16 * 64 + x) * 4]);
    assert.ok(new Set(row).size > 5);
});
