import test from 'node:test';
import assert from 'node:assert/strict';
import { getEsiExplanation } from '../model.js';

test('Компоненты соответствуют отклонениям Worker, итог берётся без пересчёта', () => {
    const planet = { id: 'a', radius: 2, flux: 0.5, esi: { simple: 0.12345 } };
    const result = getEsiExplanation(planet, [{ id: 'other' }, planet]);
    assert.ok(Math.abs(result.radiusSimilarity - 2 / 3) < 1e-12);
    assert.ok(Math.abs(result.fluxSimilarity - 2 / 3) < 1e-12);
    assert.equal(result.esi, 0.12345);
    assert.equal(result.rankText, '2 из 2');
    assert.match(result.explanation, /сходство одинаково/);
});

test('Земные параметры дают единичные шкалы, но не выдуманный итог ESI', () => {
    const result = getEsiExplanation({ id: 'earth-reference', radius: 1, flux: 1 });
    assert.equal(result.radiusSimilarity, 1);
    assert.equal(result.fluxSimilarity, 1);
    assert.equal(result.esi, null);
    assert.equal(result.rankText, 'Земля — эталон');
});

test('Пропуски, строки, бесконечности и пределы измерений не превращаются в ноль', () => {
    for (const value of [null, undefined, NaN, Infinity, -1, '1']) {
        const result = getEsiExplanation({ radius: value, flux: value, esi: { simple: value } });
        assert.equal(result.radiusSimilarity, null);
        assert.equal(result.fluxSimilarity, null);
        assert.equal(result.esi, null);
        assert.equal(result.explanation, 'Недостаточно данных');
    }
    const limited = getEsiExplanation({ radius: 2, flux: 1, measurements: { radius: { lim: 1 } } });
    assert.equal(limited.radiusSimilarity, null);
    assert.equal(limited.fluxSimilarity, 1);
});

test('Нулевой поток разрешён формулой сервера, нулевой радиус недопустим', () => {
    const result = getEsiExplanation({ radius: 0, flux: 0, esi: { simple: 0 } });
    assert.equal(result.radiusSimilarity, null);
    assert.equal(result.fluxSimilarity, 0);
    assert.equal(result.esi, 0);
});

test('Место соответствует порядку показанного рейтинга, за пределами 50 мест не выдаётся', () => {
    const top = Array.from({ length: 51 }, (_, i) => ({ id: String(i) }));
    assert.equal(getEsiExplanation({ id: '49' }, top).rankText, '50 из 50');
    assert.equal(getEsiExplanation({ id: '50' }, top).rankText, 'Вне топ-50');
    assert.equal(getEsiExplanation({ id: '0' }).rankText, 'Недостаточно данных');
});

test('Объяснение описывает физические различия и параметр с большим сходством', () => {
    const result = getEsiExplanation({ radius: 1.1, flux: 3, esi: { simple: 0.6 } });
    assert.match(result.explanation, /Радиус 1,1 R⊕/);
    assert.match(result.explanation, /Поток 3 S⊕/);
    assert.match(result.explanation, /По радиусу планета ближе/);
    assert.doesNotMatch(result.explanation, /%|вероятность|обитаема/);
});
