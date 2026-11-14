
import test from "node:test";
import assert from "node:assert/strict";

import {
    effectiveFlux,
    calculateHabitableZone,
    calculateHabitableTimeFraction,
} from "../habitable-zone.js";

function assertApprox(actual, expected, tolerance = 1e-6) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `Ожидалось ${expected}, получено ${actual}`
    );
}

test("Эффективный поток при солнечной температуре", () => {
    const coefficients = {
        s: 1.107,
        a: 1.332e-4,
        b: 1.580e-8,
        c: -8.308e-12,
        d: -1.931e-15,
    };

    assertApprox(effectiveFlux(5780, coefficients), 1.107);
});

test("Эффективный поток при другой температуре", () => {
    const coefficients = {
        s: 1,
        a: 0.01,
        b: 0.001,
        c: 0,
        d: 0,
    };

    assertApprox(effectiveFlux(5790, coefficients), 1.2);
});

test("Границы зоны обитаемости Солнца", () => {
    const zone = calculateHabitableZone(5780, 1);

    assertApprox(zone.optimistic.inner, 0.750, 0.001);
    assertApprox(zone.conservative.inner, 0.950, 0.001);
    assertApprox(zone.conservative.outer, 1.676, 0.001);
    assertApprox(zone.optimistic.outer, 1.768, 0.001);
});

test("Консервативная зона вложена в оптимистичную", () => {
    for (const temperature of [2600, 4000, 5780, 7200]) {
        const zone = calculateHabitableZone(temperature, 1);

        assert.ok(zone.optimistic.inner < zone.conservative.inner);
        assert.ok(zone.conservative.inner < zone.conservative.outer);
        assert.ok(zone.conservative.outer < zone.optimistic.outer);
    }
});

test("Расстояния пропорциональны корню из светимости", () => {
    const first = calculateHabitableZone(5780, 1);
    const second = calculateHabitableZone(5780, 4);

    for (const type of ["conservative", "optimistic"]) {
        assertApprox(
            second[type].inner,
            first[type].inner * 2
        );

        assertApprox(
            second[type].outer,
            first[type].outer * 2
        );
    }
});

test("Допустимые граничные температуры", () => {
    assert.doesNotThrow(() => calculateHabitableZone(2600, 1));
    assert.doesNotThrow(() => calculateHabitableZone(7200, 1));
});

test("Недопустимые температуры звезды", () => {
    for (const temperature of [
        -1, 0, 2599, 7201, NaN, Infinity, -Infinity,
    ]) {
        assert.throws(
            () => calculateHabitableZone(temperature, 1),
            RangeError
        );
    }
});

test("Недопустимая светимость звезды", () => {
    for (const luminosity of [
        -1, 0, NaN, Infinity, -Infinity,
    ]) {
        assert.throws(
            () => calculateHabitableZone(5780, luminosity),
            RangeError
        );
    }
});

const zone = {
    conservative: { inner: 1, outer: 2 },
    optimistic: { inner: 0.5, outer: 2.5 },
};

test("Круговая орбита внутри обеих зон", () => {
    const result = calculateHabitableTimeFraction(1.5, 0, zone);

    assertApprox(result.conservative, 1);
    assertApprox(result.optimistic, 1);
});

test("Круговая орбита только в оптимистичной зоне", () => {
    const result = calculateHabitableTimeFraction(0.75, 0, zone);

    assertApprox(result.conservative, 0);
    assertApprox(result.optimistic, 1);
});

test("Круговая орбита вне обеих зон", () => {
    const result = calculateHabitableTimeFraction(3, 0, zone);

    assertApprox(result.conservative, 0);
    assertApprox(result.optimistic, 0);
});

test("Эллиптическая орбита полностью внутри обеих зон", () => {
    const result = calculateHabitableTimeFraction(1.5, 0.2, zone);

    assertApprox(result.conservative, 1);
    assertApprox(result.optimistic, 1);
});

test("Эллиптическая орбита полностью вне обеих зон", () => {
    const result = calculateHabitableTimeFraction(4, 0.2, zone);

    assertApprox(result.conservative, 0);
    assertApprox(result.optimistic, 0);
});

test("Эллиптическая орбита пересекает границы зон", () => {
    const result = calculateHabitableTimeFraction(1.5, 0.5, zone);

    assert.ok(result.conservative > 0);
    assert.ok(result.conservative < 1);

    assert.ok(result.optimistic > result.conservative);
    assert.ok(result.optimistic <= 1);
});

test("Аналитический расчёт доли периода", () => {
    const result = calculateHabitableTimeFraction(
        2,
        0.5,
        {
            conservative: { inner: 1, outer: 2 },
            optimistic: { inner: 1, outer: 3 },
        }
    );

    // Для r = a эксцентрическая аномалия равна π/2
    const expected = 0.5 - 0.5 / Math.PI;

    assertApprox(result.conservative, expected);
    assertApprox(result.optimistic, 1);
});

test("Границы зоны совпадают с перицентром и апоцентром", () => {
    const result = calculateHabitableTimeFraction(
        2,
        0.5,
        {
            conservative: { inner: 1, outer: 3 },
            optimistic: { inner: 0.5, outer: 4 },
        }
    );

    assertApprox(result.conservative, 1);
    assertApprox(result.optimistic, 1);
});

test("Доля периода всегда находится между 0 и 1", () => {
    for (const eccentricity of [0, 0.1, 0.5, 0.9, 0.999]) {
        const result = calculateHabitableTimeFraction(
            1.5,
            eccentricity,
            zone
        );

        for (const fraction of Object.values(result)) {
            assert.ok(fraction >= 0);
            assert.ok(fraction <= 1);
        }

        assert.ok(result.optimistic >= result.conservative);
    }
});

test("Недопустимая большая полуось", () => {
    for (const semiMajorAxis of [
        -1, 0, NaN, Infinity, -Infinity,
    ]) {
        assert.throws(
            () => calculateHabitableTimeFraction(
                semiMajorAxis, 0.2, zone
            ),
            RangeError
        );
    }
});

test("Недопустимый эксцентриситет", () => {
    for (const eccentricity of [
        -0.1, 1, 1.5, NaN, Infinity, -Infinity,
    ]) {
        assert.throws(
            () => calculateHabitableTimeFraction(
                1.5, eccentricity, zone
            ),
            RangeError
        );
    }
});
