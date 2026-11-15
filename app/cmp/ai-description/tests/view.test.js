import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiDescription } from '../script.js';

class Element {
    constructor(tag = 'div') { this.tag = tag; this.children = []; this.attributes = new Map(); this.listeners = new Map(); this.ownText = ''; }
    set textContent(text) { this.ownText = text; this.children = []; }
    get textContent() { return this.ownText + this.children.map(child => child.textContent).join(''); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; this.ownText = ''; }
    setAttribute(key, value) { this.attributes.set(key, value); }
    addEventListener(type, callback) { this.listeners.set(type, callback); }
    removeEventListener(type) { this.listeners.delete(type); }
}

function setup(t, client) {
    const nodes = Object.fromEntries(['title', 'status', 'body', 'retry'].map(key => [key, new Element()]));
    const root = new Element();
    root.querySelector = selector => nodes[/data-description-(\w+)/.exec(selector)[1]];
    const previousDocument = globalThis.document;
    const previousObserver = globalThis.IntersectionObserver;
    globalThis.document = {
        createElement: tag => new Element(tag),
        createTextNode: text => { const node = new Element('#text'); node.textContent = text; return node; },
        createDocumentFragment: () => new Element('fragment'),
    };
    let visibility;
    globalThis.IntersectionObserver = class {
        constructor(callback) { visibility = callback; }
        observe() {}
        disconnect() {}
    };
    let scheduled;
    t.mock.method(globalThis, 'setTimeout', callback => { scheduled = callback; return 1; });
    t.mock.method(globalThis, 'clearTimeout', () => { scheduled = null; });
    const view = createAiDescription(root, client);
    t.after(() => {
        view.dispose();
        if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
        if (previousObserver === undefined) delete globalThis.IntersectionObserver; else globalThis.IntersectionObserver = previousObserver;
    });
    return { ...nodes, root, view,
        visible(value) { visibility([{ isIntersecting: value, intersectionRect: { height: value ? 10 : 0 } }]); },
        run() { const callback = scheduled; scheduled = null; return callback?.(); },
    };
}

test('Земля не вызывает API, скрытый раздел не запускает генерацию', async t => {
    const calls = [];
    const ui = setup(t, { getDescription: async id => { calls.push(id); return { id, description: 'Описание' }; } });
    ui.view.setPlanet({ id: 'earth-reference' });
    ui.visible(true);
    await ui.run();
    assert.equal(calls.length, 0);
    assert.equal(ui.title.textContent, 'Описание Земли');
    assert.equal(ui.body.hidden, false);
    assert.match(ui.body.textContent, /Земля — каменистая планета/);
    assert.match(ui.body.textContent, /ESI равен 1/);
    ui.visible(false);
    ui.view.setPlanet({ id: 'a' });
    await ui.run();
    assert.equal(calls.length, 0);
    ui.visible(true);
    await ui.run();
    assert.deepEqual(calls, ['a']);
    assert.equal(ui.body.textContent, 'Описание');
    assert.equal(ui.title.textContent, 'ИИ-описание');
});

test('Возврат к Земле показывает справочный текст и защищает его от старого ответа API', async t => {
    let finish;
    const ui = setup(t, { getDescription: () => new Promise(resolve => { finish = resolve; }) });
    ui.visible(true);
    ui.view.setPlanet({ id: 'a' });
    const pending = ui.run();
    ui.view.setPlanet({ id: 'earth-reference' });
    finish({ id: 'a', description: 'Устаревшее описание экзопланеты' });
    await pending;
    assert.equal(ui.title.textContent, 'Описание Земли');
    assert.match(ui.body.textContent, /Земля — каменистая планета/);
    assert.doesNotMatch(ui.body.textContent, /Устаревшее/);
    assert.equal(ui.retry.hidden, true);
    assert.equal(ui.root.attributes.get('aria-busy'), 'false');
});

test('Запоздалый ответ предыдущей планеты не заменяет текущий текст', async t => {
    const pending = new Map();
    const ui = setup(t, { getDescription: id => new Promise(resolve => pending.set(id, resolve)) });
    ui.visible(true);
    ui.view.setPlanet({ id: 'a' });
    const first = ui.run();
    ui.view.setPlanet({ id: 'b' });
    const second = ui.run();
    pending.get('b')({ id: 'b', description: '**Планета B**\n\nТекущий текст' });
    await second;
    pending.get('a')({ id: 'a', description: 'Старый текст A' });
    await first;
    assert.match(ui.body.textContent, /Планета B/);
    assert.doesNotMatch(ui.body.textContent, /Старый текст/);
    assert.equal(ui.root.attributes.get('aria-busy'), 'false');
});

test('Ошибка даёт кнопку повторения, успешный повтор заменяет состояние ошибки', async t => {
    let calls = 0;
    const ui = setup(t, { getDescription: async id => {
        if (++calls === 1) throw new Error('Offline');
        return { id, description: 'Успех' };
    } });
    ui.view.setPlanet({ id: 'a' });
    ui.visible(true);
    await ui.run();
    assert.equal(ui.retry.hidden, false);
    assert.match(ui.status.textContent, /Не удалось/);
    ui.retry.listeners.get('click')();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(ui.retry.hidden, true);
    assert.equal(ui.body.textContent, 'Успех');
});
