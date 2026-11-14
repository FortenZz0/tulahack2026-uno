import test from "node:test";
import assert from "node:assert/strict";

import {
    calculateESIcomponent,
    calculateESI,
    calculateSimpleESI
} from "../esi.js";


// сравнение с учетом погрешности JS
const EPSILON = 1e-10; // 0.0000000001
function assertAlmostEqual(actual, expected) {
    assert.ok(
        Math.abs(actual - expected) < EPSILON,
        `Ожидалось ${expected}, получено ${actual}`
    );
}

/* ТЕСТЫ */

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
    // Все параметры, кроме радиуса, равны земным.
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
    assertAlmostEqual(
        calculateSimpleESI(1, 288),
        1
    );
});

test("Simple ESI: известное значение", () => {
    const expected = (2 / 3) ** (0.57 / 2);

    assertAlmostEqual(
        calculateSimpleESI(2, 288),
        expected
    );
});

test("Simple ESI: влияние температуры", () => {
    const earth = calculateSimpleESI(1, 288);
    const colder = calculateSimpleESI(1, 200);
    const muchColder = calculateSimpleESI(1, 100);

    assert.ok(earth > colder);
    assert.ok(colder > muchColder);
});

test("Full и Simple ESI: диапазон результатов", () => {
    for (const radius of [0.5, 1, 2, 5]) {
        for (const temperature of [100, 288, 500]) {
            const full = calculateESI(
                radius, 5.51, 11.186, temperature
            );

            const simple = calculateSimpleESI(
                radius, temperature
            );

            assert.ok(full >= 0 && full <= 1);
            assert.ok(simple >= 0 && simple <= 1);
        }
    }
});