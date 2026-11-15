import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDescriptionMarkdown } from '../markdown.js';

test('Формат ответа Worker разбирается на подзаголовки и абзацы', () => {
    const blocks = parseDescriptionMarkdown('**Что известно**\n\nПланета **больше Земли**.\n\n**Чего мы не знаем**\n\nНет данных об атмосфере.');
    assert.deepEqual(blocks.map(block => block.type), ['h4', 'p', 'h4', 'p']);
    assert.equal(blocks[0].tokens[0].text, 'Что известно');
    assert.equal(blocks[1].tokens[1].type, 'strong');
});

test('HTML остаётся текстом, ссылки разрешены только по HTTP(S)', () => {
    const [paragraph] = parseDescriptionMarkdown('<img src=x onerror=alert(1)> [опасная](javascript:alert) [источник](https://example.org/paper)');
    assert.match(paragraph.tokens[0].text, /<img/);
    assert.equal(paragraph.tokens[1].type, 'text');
    const link = paragraph.tokens.find(token => token.type === 'a');
    assert.equal(link.href, 'https://example.org/paper');
    assert.equal(paragraph.tokens.filter(token => token.type === 'a').length, 1);
});

test('Списки и переносы строк не смешиваются с заголовками', () => {
    const blocks = parseDescriptionMarkdown('## Орбита\r\n\r\n- Раз\r\n- Два\r\n\r\n1. Три\r\n2. Четыре');
    assert.deepEqual(blocks.map(block => block.type), ['h4', 'ul', 'ol']);
    assert.equal(blocks[1].items.length, 2);
    assert.equal(blocks[2].items.length, 2);
});
