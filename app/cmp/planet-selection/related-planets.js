export function createRelatedPlanetLinks(container, library, onSelect) {
    let revision = 0;

    function render(ids, loading = false, failed = false) {
        container.replaceChildren(document.createTextNode('Другие планеты: '));
        const planets = ids.map(id => library.getPlanet(id)).filter(Boolean);
        if (!planets.length && !loading) {
            container.append(document.createTextNode(failed ? 'не удалось загрузить данные.' : 'нет данных в загруженном каталоге.'));
            return;
        }
        planets.forEach((planet, index) => {
            if (index) container.append(document.createTextNode(', '));
            const link = document.createElement('button');
            link.type = 'button';
            link.className = 'related-planet-link';
            link.textContent = typeof planet.name === 'string' && planet.name.trim() ? planet.name.trim() : 'Планета без названия';
            link.addEventListener('click', () => onSelect(library.getPlanet(planet.id) ?? planet));
            container.append(link);
        });
        if (planets.length) container.append(document.createTextNode('.'));
        if (loading) container.append(document.createTextNode(' Загрузка остальных планет системы…'));
        else if (failed) container.append(document.createTextNode(' Не все данные удалось загрузить.'));
    }

    return {
        setPlanet(planet, star) {
            const current = ++revision;
            if (planet.id === 'earth-reference') {
                container.textContent = 'Другие планеты: Меркурий, Венера, Марс, Юпитер, Сатурн, Уран, Нептун.';
                return;
            }
            const ids = [...new Set(Array.isArray(star?.planets)
                ? star.planets.filter(id => typeof id === 'string' && id !== planet.id) : [])];
            const missing = ids.some(id => !library.getPlanet(id));
            render(ids, missing && !library.fullReady);
            if (missing && !library.fullReady) {
                // Используем уже выполняющийся общий Promise полного каталога.
                void library.whenFullReady().then(() => {
                    if (current === revision) render(ids);
                }, () => {
                    if (current === revision) render(ids, false, true);
                });
            }
        },
    };
}
