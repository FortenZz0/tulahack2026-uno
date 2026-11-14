import { fetchPlanets } from "./nasa.js";
import { queryPlanets } from "./planet-query.js";

export class ExoplanetLibrary {
    #planets = [];
    #lastUpdated = null;
    #pendingRefresh = null;
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

    get lastUpdated() {
        return this.#lastUpdated;
    }

    init() {
        if (this.#pendingRefresh) return this.#pendingRefresh;
        if (this.#lastUpdated !== null) return Promise.resolve();
        return this.refresh();
    }

    getPlanets(options = {}) {
        if (this.#lastUpdated === null) {
            throw new Error("Library is not initialized");
        }
        return queryPlanets(this.#planets, options);
    }

    async #fetchWithRetry() {
        for (let attempt = 1; attempt <= this.#maxAttempts; attempt++) {
            try {
                return await fetchPlanets();
            } catch (error) {
                if (attempt === this.#maxAttempts) throw error;
                const delay = this.#retryDelay * 2 ** (attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    refresh() {
        if (this.#pendingRefresh) return this.#pendingRefresh;

        const pending = this.#fetchWithRetry().then(planets => {
            this.#planets = planets;
            this.#lastUpdated = new Date();
        });
        this.#pendingRefresh = pending;
        void pending.then(
            () => { if (this.#pendingRefresh === pending) this.#pendingRefresh = null; },
            () => { if (this.#pendingRefresh === pending) this.#pendingRefresh = null; },
        );
        return pending;
    }
}
