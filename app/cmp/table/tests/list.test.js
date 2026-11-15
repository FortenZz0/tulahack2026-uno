import test from "node:test";
import assert from "node:assert/strict";
import { PlanetCard } from "../list.js";

test("Пропуски и неконечный ESI не превращаются в ноль или текст null", () => {
    for (const value of [null, undefined, NaN, Infinity, -0.1, 1.1]) {
        const html = PlanetCard(1, null, null, value);
        assert.match(html, /Нет названия/);
        assert.match(html, /Звезда неизвестна/);
        assert.match(html, /Нет данных ESI/);
        assert.match(html, /—/);
        assert.doesNotMatch(html, /\b(null|undefined|NaN|Infinity)\b/);
    }
});

test("Нулевой ESI — существующее значение", () => {
    const html = PlanetCard(1, "Планета", "Звезда", 0);
    assert.match(html, /class="val">\s*0,00\s*</);
    assert.doesNotMatch(html, /unavailable/);
});

test("Названия из API выводятся как текст", () => {
    const html = PlanetCard(1, '<img src="x">', "A&B", 0.856);
    assert.match(html, /&lt;img src=&quot;x&quot;&gt;/);
    assert.match(html, /A&amp;B/);
    assert.match(html, /0,86/);
    assert.doesNotMatch(html, /<img/);
});

test("ESI содержит ровно два знака после запятой, номер строки не выводится", () => {
    for (const [esi, expected] of [[0.8, '0,80'], [0.999, '1,00'], [1, '1,00']]) {
        const html = PlanetCard(49, 'Планета', 'Звезда', esi, 'planet-a');
        assert.ok(html.includes(`>${expected}</span>`));
        assert.doesNotMatch(html, />\s*49\s*</);
        assert.match(html, /data-planet-id="planet-a"/);
        assert.doesNotMatch(html, /compare-button|Сравнить/);
    }
});
