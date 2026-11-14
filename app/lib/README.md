# Exoplanet Library

Библиотека для получения и анализа данных об экзопланетах из NASA Exoplanet Archive.

## Использование

```javascript
import { ExoplanetLibrary } from "./lib/index.js";

const library = new ExoplanetLibrary({
    maxAttempts: 5,
    retryDelay: 1000,
});

library.subscribe("updated", () => {
    console.log("Каталог обновлён:", library.getPlanets());
});

library.subscribe("error", () => {
    console.error("Ошибка загрузки:", library.error);
});

await library.refresh();

const planets = library.getPlanets();
```

## API

### `new ExoplanetLibrary(options)`

Параметры:
- `maxAttempts` — максимальное число запросов, включая первый (по умолчанию 5).
- `retryDelay` — начальная задержка перед повтором в миллисекундах (по умолчанию 1000).

### Методы

- `refresh()` — загружает каталог из NASA и возвращает `Promise<Planet[]>`.
- `getPlanets()` — возвращает КОПИЮ массива загруженных планет.
- `subscribe(event, callback)` — подписывает на событие и возвращает функцию отписки.

```javascript
const unsubscribe = library.subscribe("updated", () => {
    console.log(library.getPlanets());
});

// Отмена подписки
unsubscribe();
```

Библиотека поддерживает три события:

- `loading` — начало загрузки каталога.
- `updated` — каталог успешно обновлён.
- `error` — загрузка завершилась ошибкой после всех попыток.


### Свойства

- `status` — `idle`, `loading`, `ready` или `error`.
- `lastUpdated` — дата последнего успешного обновления или `null`.
- `error` — последняя ошибка или `null`.

## Обновление данных

Каталог хранится в памяти. Загрузка выполняется только при вызове `refresh()`.

При ошибке библиотека повторяет запрос с увеличивающейся задержкой. Если все попытки неудачны, предыдущий каталог сохраняется.

Одновременные вызовы `refresh()` используют одну операцию загрузки.

## Тестирование

Из корня проекта:

```bash
npm run lib-test
```

Используются встроенные `node:test` и `node:assert/strict`.
