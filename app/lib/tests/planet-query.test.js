import test from "node:test";
import assert from "node:assert/strict";


import { queryPlanets } from "../planet-query.js";

function createPlanet(name, radius, esi, fraction) {
    const planet = { esi: {} };

    planet.name = name;
    planet.radius = radius;
    planet.esi.full = esi;
    planet.habitableTimeFraction = {
        conservative: fraction,
        optimistic: fraction,
    };

    return planet;
}

const planets = [
    createPlanet("Alpha", 1, 0.9, 1),
    createPlanet("Beta", 2, 0.7, 0.5),
    createPlanet("Gamma", 3, null, null),
    createPlanet("Delta", 1.5, 0.8, 0.75),
];

function names(result) {
    return result.map(planet => planet.name);
}

test("Без параметров возвращает копию массива", () => {
    const result = queryPlanets(planets);

    assert.deepEqual(result, planets);
    assert.notStrictEqual(result, planets);
});

test("Пустой каталог возвращает пустой массив", () => {
    assert.deepEqual(queryPlanets([]), []);
});

test("Фильтрация по минимальному значению", () => {
    const result = queryPlanets(planets, {
        filters: {
            "esi.full": { min: 0.8 },
        },
    });

    assert.deepEqual(names(result), ["Alpha", "Delta"]);
});

test("Фильтрация по максимальному значению", () => {
    const result = queryPlanets(planets, {
        filters: {
            radius: { max: 1.5 },
        },
    });

    assert.deepEqual(names(result), ["Alpha", "Delta"]);
});

test("Границы диапазона включены", () => {
    const result = queryPlanets(planets, {
        filters: {
            radius: { min: 1.5, max: 2 },
        },
    });

    assert.deepEqual(names(result), ["Beta", "Delta"]);
});

test("Несколько фильтров объединяются через И", () => {
    const result = queryPlanets(planets, {
        filters: {
            radius: { max: 2 },
            "esi.full": { min: 0.8 },
            "habitableTimeFraction.conservative": {
                min: 0.8,
            },
        },
    });

    assert.deepEqual(names(result), ["Alpha"]);
});

test("Отсутствующие значения исключаются при фильтрации", () => {
    const result = queryPlanets(planets, {
        filters: {
            "esi.full": { min: 0 },
        },
    });

    assert.deepEqual(names(result), [
        "Alpha",
        "Beta",
        "Delta",
    ]);
});

test("Сортировка чисел по возрастанию", () => {
    const result = queryPlanets(planets, {
        sort: {
            by: "radius",
            order: "asc",
        },
    });

    assert.deepEqual(names(result), [
        "Alpha",
        "Delta",
        "Beta",
        "Gamma",
    ]);
});

test("Сортировка чисел по убыванию", () => {
    const result = queryPlanets(planets, {
        sort: {
            by: "radius",
            order: "desc",
        },
    });

    assert.deepEqual(names(result), [
        "Gamma",
        "Beta",
        "Delta",
        "Alpha",
    ]);
});

test("Сортировка по вложенному полю", () => {
    const result = queryPlanets(planets, {
        sort: {
            by: "esi.full",
            order: "desc",
        },
    });

    assert.deepEqual(names(result), [
        "Alpha",
        "Delta",
        "Beta",
        "Gamma",
    ]);
});

test("Отсутствующие значения всегда в конце", () => {
    for (const order of ["asc", "desc"]) {
        const result = queryPlanets(planets, {
            sort: {
                by: "esi.full",
                order,
            },
        });

        assert.equal(result.at(-1).name, "Gamma");
    }
});

test("Сортировка строк по названию", () => {
    const result = queryPlanets(planets, {
        sort: {
            by: "name",
            order: "asc",
        },
    });

    assert.deepEqual(names(result), [
        "Alpha",
        "Beta",
        "Delta",
        "Gamma",
    ]);
});

test("offset пропускает элементы", () => {
    const result = queryPlanets(planets, {
        offset: 2,
    });

    assert.deepEqual(names(result), ["Gamma", "Delta"]);
});

test("limit ограничивает количество элементов", () => {
    const result = queryPlanets(planets, {
        limit: 2,
    });

    assert.deepEqual(names(result), ["Alpha", "Beta"]);
});

test("offset и limit работают вместе", () => {
    const result = queryPlanets(planets, {
        offset: 1,
        limit: 2,
    });

    assert.deepEqual(names(result), ["Beta", "Gamma"]);
});

test("limit равный нулю возвращает пустой массив", () => {
    assert.deepEqual(
        queryPlanets(planets, { limit: 0 }),
        []
    );
});

test("Фильтрация, сортировка и пагинация работают вместе", () => {
    const result = queryPlanets(planets, {
        filters: {
            "esi.full": { min: 0.7 },
        },
        sort: {
            by: "esi.full",
            order: "desc",
        },
        offset: 1,
        limit: 1,
    });

    assert.deepEqual(names(result), ["Delta"]);
});

test("Исходный массив не изменяется", () => {
    const original = [...planets];

    queryPlanets(planets, {
        sort: {
            by: "radius",
            order: "desc",
        },
    });

    assert.deepEqual(planets, original);
});

test("Неизвестное поле сортировки вызывает ошибку", () => {
    assert.throws(() => {
        queryPlanets(planets, {
            sort: {
                by: "unknown",
                order: "asc",
            },
        });
    }, RangeError);
});

test("Неизвестное поле фильтрации вызывает ошибку", () => {
    assert.throws(() => {
        queryPlanets(planets, {
            filters: {
                "esi.unknown": { min: 0.5 },
            },
        });
    }, RangeError);
});

test("Нельзя сортировать по целому объекту", () => {
    assert.throws(() => {
        queryPlanets(planets, {
            sort: {
                by: "esi",
                order: "asc",
            },
        });
    }, RangeError);
});

test("Нельзя фильтровать название числовым диапазоном", () => {
    assert.throws(() => {
        queryPlanets(planets, {
            filters: {
                name: { min: 1 },
            },
        });
    }, RangeError);
});

test("Минимум не может превышать максимум", () => {
    assert.throws(() => {
        queryPlanets(planets, {
            filters: {
                radius: { min: 3, max: 1 },
            },
        });
    }, RangeError);
});

test("Пустой диапазон вызывает ошибку", () => {
    assert.throws(() => {
        queryPlanets(planets, {
            filters: {
                radius: {},
            },
        });
    }, RangeError);
});

test("Некорректное направление сортировки вызывает ошибку", () => {
    assert.throws(() => {
        queryPlanets(planets, {
            sort: {
                by: "radius",
                order: "random",
            },
        });
    }, RangeError);
});

test("Отрицательный offset вызывает ошибку", () => {
    assert.throws(
        () => queryPlanets(planets, { offset: -1 }),
        RangeError
    );
});

test("Дробный limit вызывает ошибку", () => {
    assert.throws(
        () => queryPlanets(planets, { limit: 1.5 }),
        RangeError
    );
});

test("Некорректный тип filters вызывает ошибку", () => {
    assert.throws(
        () => queryPlanets(planets, { filters: null }),
        TypeError
    );
});

test("Некорректный тип sort вызывает ошибку", () => {
    assert.throws(
        () => queryPlanets(planets, { sort: null }),
        TypeError
    );
});

test("Некорректный тип диапазона вызывает ошибку", () => {
    assert.throws(
        () => queryPlanets(planets, {
            filters: {
                radius: null,
            },
        }),
        TypeError
    );
});


test("Нечисловые и неконечные значения исключаются из числовых фильтров", () => {
    const values = [null, undefined, NaN, Infinity, -Infinity, "1", 0, 1];
    const input = values.map(radius => ({ radius }));
    assert.deepEqual(queryPlanets(input, {
        filters: { radius: { min: 0, max: 1 } },
    }).map(p => p.radius), [0, 1]);
});

test("Все отсутствующие значения остаются в конце при обоих направлениях", () => {
    const input = [null, NaN, 2, undefined, Infinity, 1].map(radius => ({ radius }));
    for (const order of ["asc", "desc"]) {
        const result = queryPlanets(input, { sort: { by: "radius", order } });
        assert.deepEqual(result.slice(0, 2).map(p => p.radius), order === "asc" ? [1, 2] : [2, 1]);
        assert.deepEqual(result.slice(2), [input[0], input[1], input[3], input[4]]);
    }
});

test("Некорректные пути полей отклоняются даже для пустого каталога", () => {
    for (const by of ["", ".radius", "esi.", "esi..full", "__proto__", "constructor", "esi.unknown"]) {
        assert.throws(() => queryPlanets([], { sort: { by, order: "asc" } }), RangeError);
        assert.throws(() => queryPlanets([], { filters: { [by]: { min: 0 } } }), RangeError);
    }
});

test("Пагинация отклоняет недопустимые числа и типы", () => {
    for (const field of ["offset", "limit"]) {
        for (const value of [-1, 0.5, NaN, Infinity, "1", null, Number.MAX_SAFE_INTEGER + 1]) {
            assert.throws(() => queryPlanets([], { [field]: value }), RangeError);
        }
    }
    assert.deepEqual(queryPlanets(planets, { offset: 100 }), []);
});

test("Границы диапазона должны быть конечными числами", () => {
    for (const key of ["min", "max"]) {
        for (const value of [NaN, Infinity, -Infinity, "1", null]) {
            assert.throws(() => queryPlanets([], {
                filters: { radius: { [key]: value } },
            }), TypeError);
        }
    }
});

test("Worker id и starId поддерживают строковую сортировку", () => {
    const input = [
        { id: "b", starId: "alpha" },
        { id: "a", starId: null },
        { id: "c", starId: "beta" },
    ];
    assert.deepEqual(queryPlanets(input, {
        sort: { by: "id", order: "asc" },
    }).map(p => p.id), ["a", "b", "c"]);
    assert.deepEqual(queryPlanets(input, {
        sort: { by: "starId", order: "desc" },
    }).map(p => p.id), ["c", "b", "a"]);
    for (const field of ["id", "starId"]) {
        assert.throws(() => queryPlanets([], {
            filters: { [field]: { min: 0 } },
        }), RangeError);
    }
});
