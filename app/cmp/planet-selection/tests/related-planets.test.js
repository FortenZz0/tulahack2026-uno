import test from 'node:test';
import assert from 'node:assert/strict';
import { createRelatedPlanetLinks } from '../related-planets.js';

class Element {
    constructor(tag = 'p') { this.tag = tag; this.children = []; this.listeners = new Map(); this.value = ''; }
    get textContent() { return this.value + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this.value = value; this.children = []; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.value = ''; this.children = children; }
    addEventListener(event, callback) { this.listeners.set(event, callback); }
}
function documentFor(t) {
    const previous = globalThis.document;
    globalThis.document = {
        createElement: tag => new Element(tag),
        createTextNode: text => { const node = new Element('#text'); node.textContent = text; return node; },
    };
    t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
}

test('Названия других планет безопасно выводятся и выбирают объект по ID', t => {
    documentFor(t);
    const b = { id: 'b', name: "Teegarden's Star b" };
    const c = { id: 'c', name: '<img src=x>' };
    const library = { fullReady: true, getPlanet: id => ({ b, c })[id] ?? null };
    const container = new Element();
    let selected;
    const view = createRelatedPlanetLinks(container, library, planet => { selected = planet; });
    view.setPlanet(b, { planets: ['b', 'c', 'c'] });
    const buttons = container.children.filter(child => child.tag === 'button');
    assert.equal(buttons.length, 1);
    assert.equal(buttons[0].textContent, '<img src=x>');
    buttons[0].listeners.get('click')();
    assert.equal(selected, c);
});

test('Полный каталог добавляет ссылки, но поздний ответ не возвращает старую систему', async t => {
    documentFor(t);
    const planets = new Map([['b', { id: 'b', name: 'B' }]]);
    let complete;
    const full = new Promise(resolve => { complete = resolve; });
    const library = { fullReady: false, getPlanet: id => planets.get(id) ?? null, whenFullReady: () => full };
    const container = new Element();
    const view = createRelatedPlanetLinks(container, library, () => {});
    view.setPlanet({ id: 'b' }, { planets: ['b', 'c'] });
    assert.match(container.textContent, /Загрузка/);
    planets.set('c', { id: 'c', name: 'C' });
    library.fullReady = true;
    complete();
    await full;
    assert.equal(container.children.filter(child => child.tag === 'button')[0].textContent, 'C');

    library.fullReady = false;
    let finishOld;
    library.whenFullReady = () => new Promise(resolve => { finishOld = resolve; });
    view.setPlanet({ id: 'old' }, { planets: ['old', 'missing'] });
    view.setPlanet({ id: 'new' }, { planets: ['new', 'b'] });
    finishOld();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(container.textContent, 'Другие планеты: B.');
});

test('Возврат к Земле отменяет ожидающее обновление списка экзопланет', async t => {
    documentFor(t);
    let finish;
    const full = new Promise(resolve => { finish = resolve; });
    const library = { fullReady: false, getPlanet: () => null, whenFullReady: () => full };
    const container = new Element();
    const view = createRelatedPlanetLinks(container, library, () => {});
    view.setPlanet({ id: 'other' }, { planets: ['missing'] });
    view.setPlanet({ id: 'earth-reference' }, { id: 'sun-reference' });
    const earthText = container.textContent;
    assert.match(earthText, /Меркурий, Венера, Марс/);
    finish();
    await full;
    assert.equal(container.textContent, earthText);
});
