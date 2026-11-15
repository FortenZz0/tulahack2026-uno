import test from "node:test";
import assert from "node:assert/strict";
import { orbitPosition } from "../orbit-math.js";

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≈ ${expected}`);

test("Круговая орбита: постоянный поток и равномерная фаза", () => {
    const position = orbitPosition(0.25, 2, 0, 4);
    near(position.x, 0);
    near(position.y, 2);
    near(position.radius, 2);
    near(position.flux, 1);
});

test("Перицентр и апоцентр: звезда в фокусе, поток обратно пропорционален r²", () => {
    const peri = orbitPosition(0, 1, 0.4, 1);
    const apo = orbitPosition(0.5, 1, 0.4, 1);
    near(peri.x, 0.6);
    near(apo.x, -1.4);
    near(peri.radius, 0.6);
    near(apo.radius, 1.4);
    near(peri.flux / apo.flux, (1.4 / 0.6) ** 2);
});

test("Фаза соответствует времени по уравнению Кеплера, а не углу", () => {
    const e = 0.6;
    const position = orbitPosition(0.25, 1, e, 1);
    const E = Math.atan2(position.y / Math.sqrt(1 - e ** 2), position.x + e);
    near(E - e * Math.sin(E), Math.PI / 2);
    near(orbitPosition(1, 1, e, 1).x, orbitPosition(0, 1, e, 1).x);
});

test("Земля остаётся в заданных границах зоны на всём обороте", () => {
    for (let i = 0; i <= 100; i++) {
        const { radius, flux } = orbitPosition(i / 100, 1, 0.0167, 1);
        assert.ok(radius > 0.9504 && radius < 1.6760);
        assert.ok(flux > 0.96 && flux < 1.04);
    }
});

test("Недопустимые орбитальные параметры отклоняются", () => {
    for (const parameters of [[0, 0, 0, 1], [0, 1, 1, 1], [0, 1, -0.1, 1], [0, 1, 0, 0], [NaN, 1, 0, 1]]) {
        assert.throws(() => orbitPosition(...parameters), RangeError);
    }
});

test('Геометрия и положение доступны без светимости, поток остаётся неизвестным', () => {
    const position = orbitPosition(0.5, 2, 0.5);
    near(position.x, -3);
    near(position.radius, 3);
    assert.equal(position.flux, null);
});

test('Равные промежутки времени дают равные заметённые площади и разную угловую скорость', () => {
    const e = 0.8;
    const sweptArea = phase => {
        const { x, y } = orbitPosition(phase, 1, e);
        const E = Math.atan2(y / Math.sqrt(1 - e ** 2), x + e);
        return 0.5 * Math.sqrt(1 - e ** 2) * (E - e * Math.sin(E));
    };
    near(sweptArea(0.2) - sweptArea(0.1), sweptArea(0.4) - sweptArea(0.3));
    const angle = phase => {
        const { x, y } = orbitPosition(phase, 1, e);
        return Math.atan2(y, x);
    };
    assert.ok(angle(0.001) > angle(0.5) - angle(0.499));
});
