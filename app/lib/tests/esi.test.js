
import test from "node:test";
import assert from "node:assert/strict";

import {
    calculateESIcomponent,
    calculateESI,
    calculateSimpleESI,
} from "../esi.js";

const EPSILON = 1e-10;

function assertAlmostEqual(actual, expected) {
    assert.ok(
        Math.abs(actual - expected) < EPSILON,
        `Ожидалось ${expected}, получено ${actual}`
    );
}

test("ESI component: одинаковые значения", () => {
    assert.equal(calculateESIcomponent(1, 1, 0.57), 1);
    assert.equal(calculateESIcomponent(288, 288, 5.58), 1);
});

test("ESI component: известные значения", () => {
    assertAlmostEqual(
        calculateESIcomponent(2, 1, 1),
        2 / 3
    );

    assertAlmostEqual(
        calculateESIcomponent(3, 1, 2),
        0.25
    );
});

test("ESI component: симметрия", () => {
    assertAlmostEqual(
        calculateESIcomponent(2, 1, 0.57),
        calculateESIcomponent(1, 2, 0.57)
    );
});

test("ESI component: диапазон [0, 1]", () => {
    for (const value of [0.1, 0.5, 1, 2, 10, 100]) {
        const result = calculateESIcomponent(value, 1, 0.57);

        assert.ok(result >= 0 && result <= 1);
    }
});

test("Full ESI: параметры Земли", () => {
    assertAlmostEqual(
        calculateESI(1, 5.51, 11.186, 288),
        1
    );
});

test("Full ESI: известное значение", () => {
    const expected = (2 / 3) ** (0.57 / 4);

    assertAlmostEqual(
        calculateESI(2, 5.51, 11.186, 288),
        expected
    );
});

test("Full ESI: снижение при отклонении параметров", () => {
    const earth = calculateESI(1, 5.51, 11.186, 288);
    const other = calculateESI(2, 8, 15, 350);

    assert.ok(other < earth);
    assert.ok(other >= 0);
});

test("Simple ESI: параметры Земли", () => {
    assertAlmostEqual(calculateSimpleESI(1, 1), 1);
});

test("Simple ESI: отклонение радиуса", () => {
    const expected = 1 - Math.sqrt((1 / 9) / 2);

    assertAlmostEqual(
        calculateSimpleESI(2, 1),
        expected
    );
});

test("Simple ESI: отклонение потока", () => {
    const expected = 1 - Math.sqrt((1 / 9) / 2);

    assertAlmostEqual(
        calculateSimpleESI(1, 2),
        expected
    );
});

test("Simple ESI: отклонение обоих параметров", () => {
    assertAlmostEqual(
        calculateSimpleESI(2, 2),
        2 / 3
    );
});

test("Simple ESI: симметрия параметров", () => {
    assertAlmostEqual(
        calculateSimpleESI(2, 0.5),
        calculateSimpleESI(0.5, 2)
    );
});

test("Simple ESI: уменьшение при отклонении от Земли", () => {
    const earth = calculateSimpleESI(1, 1);
    const moderate = calculateSimpleESI(1, 2);
    const extreme = calculateSimpleESI(1, 10);

    assert.ok(earth > moderate);
    assert.ok(moderate > extreme);
});

test("Simple ESI: нулевой поток", () => {
    assertAlmostEqual(
        calculateSimpleESI(1, 0),
        1 - Math.sqrt(0.5)
    );
});

test("Full и Simple ESI: диапазон результатов", () => {
    for (const radius of [0.5, 1, 2, 5]) {
        for (const flux of [0, 0.5, 1, 2, 10]) {
            const simple = calculateSimpleESI(radius, flux);

            assert.ok(simple >= 0 && simple <= 1);
        }

        for (const temperature of [100, 288, 500]) {
            const full = calculateESI(
                radius, 5.51, 11.186, temperature
            );

            assert.ok(full >= 0 && full <= 1);
        }
    }
});
