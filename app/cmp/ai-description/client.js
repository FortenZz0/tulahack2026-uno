export function createDescriptionClient({ baseUrl, fetchImpl = (...args) => fetch(...args), timeoutMs = 90000 } = {}) {
    const cache = new Map();
    const pending = new Map();
    const controllers = new Set();
    let disposed = false;

    function getDescription(id) {
        if (disposed) return Promise.reject(new Error('Description client disposed'));
        if (typeof id !== 'string' || !id.trim()) return Promise.reject(new TypeError('Planet ID required'));
        if (cache.has(id)) return Promise.resolve(cache.get(id));
        if (pending.has(id)) return pending.get(id);
        const controller = new AbortController();
        controllers.add(controller);
        const request = (async () => {
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const base = new URL(baseUrl);
                base.pathname = `${base.pathname.replace(/\/+$/, '')}/`;
                const url = new URL('desc', base);
                url.searchParams.set('id', id);
                const response = await fetchImpl(url.toString(), { signal: controller.signal });
                if (!response.ok) {
                    const error = new Error(`Description request failed: ${response.status}`);
                    error.status = response.status;
                    throw error;
                }
                const data = await response.json();
                if (!data || data.id !== id || typeof data.description !== 'string' || !data.description.trim()) {
                    throw new TypeError('Invalid description response');
                }
                const result = { id: data.id, description: data.description.trim() };
                if (!disposed) cache.set(id, result);
                return result;
            } finally {
                clearTimeout(timer);
                controllers.delete(controller);
            }
        })();
        pending.set(id, request);
        // Ошибки не кэшируются: пользователь может повторить запрос.
        void request.then(() => pending.delete(id), () => pending.delete(id));
        return request;
    }

    return {
        getDescription,
        dispose() {
            disposed = true;
            controllers.forEach(controller => controller.abort());
            controllers.clear();
            pending.clear();
            cache.clear();
        },
    };
}
