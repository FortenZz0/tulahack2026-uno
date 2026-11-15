import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonLayout, createComparisonState, getPlanetRadius } from '../comparison.js';

test('Общий масштаб сохраняет соотношение радиусов, в том числе у сильно разных планет', () => {
    for (const [a, b] of [[1, 1], [1, 2], [15, 0.1], [0.01, 25]]) {
        const layout = comparisonLayout(a, b);
        assert.ok(Math.abs(layout.firstScale / layout.secondScale - a / b) < 1e-10);
        assert.ok(layout.firstX + layout.firstScale < layout.secondX - layout.secondScale);
        assert.ok(Math.abs(layout.firstX) + layout.firstScale < layout.halfExtent);
        assert.ok(Math.abs(layout.secondX) + layout.secondScale < layout.halfExtent);
    }
});

test('Неизвестные радиусы и пределы измерений не подменяются размером Земли', () => {
    for (const radius of [null, undefined, NaN, Infinity, 0, -1]) {
        assert.equal(getPlanetRadius({ radius }), null);
        assert.equal(comparisonLayout(radius, 1), null);
        assert.equal(comparisonLayout(1, radius), null);
    }
    assert.equal(getPlanetRadius({ radius: 2, measurements: { radius: { lim: 1 } } }), null);
    assert.equal(getPlanetRadius({ radius: 2, measurements: { radius: { lim: -1 } } }), null);
    assert.equal(getPlanetRadius({ radius: 2, measurements: { radius: { lim: 0 } } }), 2);
});

test('Режим сравнения добавляет и заменяет вторую планету, не меняя основную', () => {
    const earth = { id: 'earth', radius: 1 };
    const a = { id: 'a', radius: 2 };
    const b = { id: 'b', radius: 3 };
    const state = createComparisonState(earth);
    state.toggleMode();
    assert.equal(state.active, true);
    state.choose(a);
    assert.equal(state.selected, earth);
    assert.equal(state.comparison, a);
    state.choose(b);
    assert.equal(state.comparison, b);
    state.cancel();
    assert.equal(state.active, false);
    assert.equal(state.comparison, null);
    state.choose(a);
    assert.equal(state.selected, a);
    assert.equal(state.comparison, null);
    state.toggleMode();
    state.choose(b);
    assert.equal(state.comparison, b);
    state.toggleMode();
    assert.equal(state.comparison, null);
});

test('Режим сравнения не допускает ту же планету и неизвестные радиусы', () => {
    const earth = { id: 'earth', radius: 1 };
    const unknown = { id: 'unknown', radius: null };
    const state = createComparisonState(earth);
    state.toggleMode();
    assert.equal(state.choose(unknown), false);
    assert.equal(state.choose(earth), false);
    assert.equal(state.comparison, null);
    assert.equal(state.selected, earth);
    assert.equal(state.active, true);
    state.cancel();
    state.choose(unknown);
    assert.equal(state.selected, unknown);
    state.toggleMode();
    assert.equal(state.active, false);
});
