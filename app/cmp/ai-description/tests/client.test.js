import test from 'node:test';
import assert from 'node:assert/strict';
import { createDescriptionClient } from '../client.js';

const baseUrl = 'https://worker.example';
const response = (id, description = '**Что известно**\n\nТекст') => ({ ok: true, json: async () => ({ id, description }) });

test('ID с апострофом и пробелами кодируется, параллельные вызовы объединяются и кэшируются', async () => {
    const id = "planet:teegarden's star b & c#1";
    let resolve;
    let calls = 0;
    const client = createDescriptionClient({ baseUrl, fetchImpl: (url, options) => {
        calls++;
        assert.equal(new URL(url).pathname, '/desc');
        assert.equal(new URL(url).searchParams.get('id'), id);
        assert.ok(options.signal instanceof AbortSignal);
        return new Promise(done => { resolve = done; });
    } });
    const first = client.getDescription(id);
    assert.equal(first, client.getDescription(id));
    resolve(response(id));
    const result = await first;
    assert.equal((await client.getDescription(id)), result);
    assert.equal(calls, 1);
    client.dispose();
});

test('Ошибка не кэшируется, повтор может успешно загрузить описание', async () => {
    let calls = 0;
    const client = createDescriptionClient({ baseUrl, fetchImpl: async () => ++calls === 1
        ? { ok: false, status: 503 } : response('a') });
    await assert.rejects(client.getDescription('a'), { status: 503 });
    assert.equal((await client.getDescription('a')).id, 'a');
    assert.equal(calls, 2);
    client.dispose();
});

test('Ответ другой планеты, пустое описание и некорректный JSON отклоняются', async () => {
    for (const data of [null, { id: 'b', description: 'Текст' }, { id: 'a', description: null }, { id: 'a', description: '  ' }]) {
        const client = createDescriptionClient({ baseUrl, fetchImpl: async () => ({ ok: true, json: async () => data }) });
        await assert.rejects(client.getDescription('a'), TypeError);
        client.dispose();
    }
});

test('При таймауте и освобождении клиента запросы отменяются', async () => {
    const fetchImpl = (url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
    const timed = createDescriptionClient({ baseUrl, fetchImpl, timeoutMs: 10 });
    await assert.rejects(timed.getDescription('a'), { name: 'AbortError' });
    timed.dispose();
    const client = createDescriptionClient({ baseUrl, fetchImpl });
    const pending = assert.rejects(client.getDescription('b'), { name: 'AbortError' });
    client.dispose();
    await pending;
    await assert.rejects(client.getDescription('a'), /disposed/);
});
