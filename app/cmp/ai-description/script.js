import { renderDescriptionMarkdown } from './markdown.js';
import { earth, earthDescription } from '../planet-selection/earth.js';

export function createAiDescription(root, client) {
    const title = root.querySelector('[data-description-title]');
    const status = root.querySelector('[data-description-status]');
    const body = root.querySelector('[data-description-body]');
    const retry = root.querySelector('[data-description-retry]');
    let selectedId = null;
    let revision = 0;
    let visible = false;
    let loading = false;
    let loaded = false;
    let failed = false;
    let disposed = false;
    let timer;

    function setStatus(message) {
        status.textContent = message;
        status.hidden = !message;
    }

    async function load() {
        if (disposed || !selectedId || loading || loaded) return;
        const current = revision;
        const id = selectedId;
        loading = true;
        failed = false;
        retry.hidden = true;
        root.setAttribute('aria-busy', 'true');
        setStatus('Загрузка нейроописания…');
        try {
            const result = await client.getDescription(id);
            // Смена выбора не отменяет общий запрос, но старый ответ не меняет текущую карточку.
            if (disposed || current !== revision) return;
            body.replaceChildren(renderDescriptionMarkdown(result.description));
            body.hidden = false;
            loaded = true;
            setStatus('');
        } catch (error) {
            if (disposed || current !== revision) return;
            failed = true;
            setStatus(error.status === 404 ? 'Описание этой планеты пока недоступно.'
                : error.status === 429 ? 'Сервис описаний занят. Попробуйте позже.'
                    : error.name === 'AbortError' ? 'Сервис не успел подготовить описание. Попробуйте ещё раз.'
                        : 'Не удалось загрузить описание. Попробуйте ещё раз.');
            retry.hidden = false;
        } finally {
            if (!disposed && current === revision) {
                loading = false;
                root.setAttribute('aria-busy', 'false');
            }
        }
    }

    function schedule() {
        clearTimeout(timer);
        if (visible && selectedId && !loading && !loaded && !failed && !disposed) {
            // Не запускаем генерацию при быстром пролистывании или смене планет.
            timer = setTimeout(load, 250);
        }
    }
    const observer = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting && entries[0].intersectionRect.height > 0;
        schedule();
    });
    observer.observe(root);
    const onRetry = () => { failed = false; void load(); };
    retry.addEventListener('click', onRetry);

    return {
        setPlanet(planet) {
            const id = typeof planet?.id === 'string' && planet.id.trim() ? planet.id : null;
            if (id === selectedId && revision > 0) return;
            selectedId = id;
            revision++;
            loading = false;
            loaded = false;
            failed = false;
            root.setAttribute('aria-busy', 'false');
            body.replaceChildren();
            body.hidden = true;
            retry.hidden = true;
            title.textContent = id === earth.id ? 'Описание Земли' : 'ИИ-описание';
            if (id === earth.id) {
                body.replaceChildren(renderDescriptionMarkdown(earthDescription));
                body.hidden = false;
                loaded = true;
                setStatus('');
                schedule();
                return;
            }
            setStatus(id ? 'Описание загрузится при просмотре этого раздела.' : 'Выберите планету из рейтинга, чтобы прочитать нейроописание.');
            schedule();
        },
        dispose() {
            disposed = true;
            revision++;
            clearTimeout(timer);
            observer.disconnect();
            retry.removeEventListener('click', onRetry);
        },
    };
}
