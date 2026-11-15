import { fetchCatalog } from "./api.js";
import { queryPlanets } from "./planet-query.js";

export class ExoplanetLibrary {
    #catalog = null;
    #fullReady = false;

    #initPromise = null;
    #previewPromise = null;
    #fullPromise = null;

    #maxAttempts;
    #retryDelay;

    constructor({ maxAttempts = 5, retryDelay = 1000 } = {}) {
        if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
            throw new RangeError("maxAttempts must be a positive integer");
        }

        if (!Number.isFinite(retryDelay) || retryDelay < 0) {
            throw new RangeError("retryDelay must be a non-negative number");
        }

        this.#maxAttempts = maxAttempts;
        this.#retryDelay = retryDelay;
    }

    get initialized() {
        return this.#catalog !== null;
    }

    get fullReady() {
        return this.#fullReady;
    }

    get lastUpdated() {
        return this.#catalog
            ? new Date(this.#catalog.updatedAt)
            : null;
    }

    init() {
        if (this.initialized) {
            return Promise.resolve();
        }

        if (this.#initPromise) {
            return this.#initPromise;
        }

        // Оба запроса запускаются одновременно.
        const preview = this.#loadPreview();
        const full = this.#loadFull();

        // Достаточно первого успешно загруженного каталога.
        const pending = Promise.any([preview, full]);

        this.#initPromise = pending;

        void pending.then(
            () => {
                if (this.#initPromise === pending) {
                    this.#initPromise = null;
                }
            },
            () => {
                if (this.#initPromise === pending) {
                    this.#initPromise = null;
                }
            }
        );

        return pending;
    }

    getPlanets(options = {}) {
        return queryPlanets(
            this.#getCatalog().planets,
            options
        );
    }

    getTopPlanets() {
        return this.#getCatalog().planets
            .filter(planet =>
                Number.isFinite(planet.esi?.simple)
            )
            .sort((a, b) =>
                b.esi.simple - a.esi.simple ||
                a.id.localeCompare(b.id)
            )
            .slice(0, 50);
    }

    getStars() {
        return this.#getCatalog().stars;
    }

    getPlanet(id) {
        return this.#getCatalog()
            .planetsById.get(id) ?? null;
    }

    getStar(id) {
        return this.#getCatalog()
            .starsById.get(id) ?? null;
    }

    getPlanetStar(planet) {
        return this.getStar(planet.starId);
    }

    async getFullPlanets(options = {}) {
        await this.#loadFull();

        return this.getPlanets(options);
    }

    async getFullStars() {
        await this.#loadFull();

        return this.getStars();
    }

    whenFullReady() {
        return this.#loadFull();
    }

    refresh() {
        return this.#loadFull(true);
    }

    #getCatalog() {
        if (this.#catalog === null) {
            throw new Error("Library is not initialized");
        }

        return this.#catalog;
    }

    #setCatalog(data) {
        this.#catalog = {
            updatedAt: data.updatedAt,
            planets: data.planets,
            stars: data.stars,

            planetsById: new Map(
                data.planets.map(planet => [
                    planet.id,
                    planet
                ])
            ),

            starsById: new Map(
                data.stars.map(star => [
                    star.id,
                    star
                ])
            )
        };
    }

    async #fetchWithRetry(mode) {
        for (
            let attempt = 1;
            attempt <= this.#maxAttempts;
            attempt++
        ) {
            try {
                return await fetchCatalog(mode);
            } catch (error) {
                if (attempt === this.#maxAttempts) {
                    throw error;
                }

                const delay =
                    this.#retryDelay * 2 ** (attempt - 1);

                await new Promise(resolve =>
                    setTimeout(resolve, delay)
                );
            }
        }
    }

    #loadPreview() {
        if (this.#fullReady) {
            return Promise.resolve();
        }

        if (this.#previewPromise) {
            return this.#previewPromise;
        }

        const pending = this.#fetchWithRetry("preview")
            .then(data => {
                // Полный каталог нельзя заменить превью.
                if (!this.#fullReady) {
                    this.#setCatalog(data);
                }
            });

        this.#previewPromise = pending;

        void pending.then(
            () => {
                if (this.#previewPromise === pending) {
                    this.#previewPromise = null;
                }
            },
            () => {
                if (this.#previewPromise === pending) {
                    this.#previewPromise = null;
                }
            }
        );

        return pending;
    }

    #loadFull(force = false) {
        if (this.#fullPromise) {
            return this.#fullPromise;
        }

        if (this.#fullReady && !force) {
            return Promise.resolve();
        }

        const pending = this.#fetchWithRetry("full")
            .then(data => {
                this.#setCatalog(data);
                this.#fullReady = true;
            });

        this.#fullPromise = pending;

        void pending.then(
            () => {
                if (this.#fullPromise === pending) {
                    this.#fullPromise = null;
                }
            },
            () => {
                if (this.#fullPromise === pending) {
                    this.#fullPromise = null;
                }
            }
        );

        return pending;
    }
}
