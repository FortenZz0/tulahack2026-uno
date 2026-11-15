// Небольшое безопасное подмножество Markdown. HTML не интерпретируется.
function inline(text) {
    const result = [];
    const pattern = /\*\*([^*\n]+)\*\*|__([^_\n]+)__|`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)|\*([^*\n]+)\*/g;
    let offset = 0;
    for (const match of text.matchAll(pattern)) {
        if (match.index > offset) result.push({ type: 'text', text: text.slice(offset, match.index) });
        if (match[1] || match[2]) result.push({ type: 'strong', text: match[1] ?? match[2] });
        else if (match[3]) result.push({ type: 'code', text: match[3] });
        else if (match[4]) {
            let href = null;
            try {
                const url = new URL(match[5]);
                if (['https:', 'http:'].includes(url.protocol)) href = url.href;
            } catch { /* Неподдерживаемая ссылка остаётся текстом. */ }
            result.push(href ? { type: 'a', text: match[4], href } : { type: 'text', text: match[4] });
        } else result.push({ type: 'em', text: match[6] });
        offset = match.index + match[0].length;
    }
    if (offset < text.length) result.push({ type: 'text', text: text.slice(offset) });
    return result;
}

const heading = line => /^(?:#{1,6}\s+(.+)|\*\*([^*]+)\*\*)$/.exec(line.trim());
const listItem = line => /^\s*(?:([-+*])\s+|(\d+)[.)]\s+)(.+)$/.exec(line);

export function parseDescriptionMarkdown(value) {
    const lines = value.replace(/\r\n?/g, '\n').split('\n');
    const blocks = [];
    let index = 0;
    while (index < lines.length) {
        if (!lines[index].trim()) { index++; continue; }
        const title = heading(lines[index]);
        if (title) {
            blocks.push({ type: 'h4', tokens: inline(title[1] ?? title[2]) });
            index++;
            continue;
        }
        const firstItem = listItem(lines[index]);
        if (firstItem) {
            const ordered = Boolean(firstItem[2]);
            const items = [];
            while (index < lines.length) {
                const item = listItem(lines[index]);
                if (!item || Boolean(item[2]) !== ordered) break;
                items.push(inline(item[3]));
                index++;
            }
            blocks.push({ type: ordered ? 'ol' : 'ul', items });
            continue;
        }
        const paragraph = [];
        while (index < lines.length && lines[index].trim() && !heading(lines[index]) && !listItem(lines[index])) {
            paragraph.push(lines[index++]);
        }
        blocks.push({ type: 'p', tokens: inline(paragraph.join('\n')) });
    }
    return blocks;
}

export function renderDescriptionMarkdown(value, documentImpl = document) {
    const fragment = documentImpl.createDocumentFragment();
    function appendInline(parent, tokens) {
        for (const token of tokens) {
            if (token.type === 'text') parent.append(documentImpl.createTextNode(token.text));
            else {
                const element = documentImpl.createElement(token.type);
                element.textContent = token.text;
                if (token.type === 'a') {
                    element.href = token.href;
                    element.target = '_blank';
                    element.rel = 'noopener noreferrer';
                }
                parent.append(element);
            }
        }
    }
    for (const block of parseDescriptionMarkdown(value)) {
        const element = documentImpl.createElement(block.type);
        if (block.items) {
            for (const tokens of block.items) {
                const item = documentImpl.createElement('li');
                appendInline(item, tokens);
                element.append(item);
            }
        } else appendInline(element, block.tokens);
        fragment.append(element);
    }
    return fragment;
}
