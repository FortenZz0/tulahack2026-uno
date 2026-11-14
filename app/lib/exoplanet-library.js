import { fetchPlanets } from "./nasa.js";


export class ExoplanetLibrary {
    #planets = [];
    #status = "idle";
    #lastUpdated = null;
    #error = null;
    #listeners = new Map();
    #pendingRefresh = null;
    #maxAttempts;
    #retryDelay;

    constructor({ maxAttempts = 5, retryDelay = 1000 } = {}) {
        if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
            throw new RangeError("maxAttempts must be a positive integer");
        }

        if (!Number.isFinite(retryDelay) || retryDelay < 0) {
            throw new RangeError("retryDelay must be a non-negative number");
        }

        this.#maxAttempts = maxAttempts;
        this.#retryDelay = retryDelay;
    }

    async #fetchWithRetry() {
        for (let attempt = 1; attempt <= this.#maxAttempts; attempt++) {
            try {
                return await fetchPlanets();
            } catch (error) {
                if (attempt === this.#maxAttempts) {
                    throw error;
                }

                const delay = this.#retryDelay * 2 ** (attempt - 1);

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    get status() {
        return this.#status;
    }

    get lastUpdated() {
        return this.#lastUpdated;
    }

    get error() {
        return this.#error;
    }

    getPlanets() {
        return [...this.#planets];
    }

    subscribe(event, callback) {
        if (!["updated", "loading", "error"].includes(event)) {
            throw new RangeError(`Unknown event: ${event}`);
        }

        if (typeof callback !== "function") {
            throw new TypeError("Callback must be a function");
        }

        if (!this.#listeners.has(event)) {
            this.#listeners.set(event, new Set());
        }

        const listeners = this.#listeners.get(event);
        listeners.add(callback);

        return () => listeners.delete(callback);
    }

    #emit(event) {
        for (const callback of this.#listeners.get(event) ?? []) {
            try {
                callback();
            } catch (error) {
                console.error("ExoplanetLibrary listener error:", error);
            }
        }
    }

    refresh() {
        if (this.#pendingRefresh) {
            return this.#pendingRefresh;
        }

        this.#status = "loading";
        this.#error = null;
        this.#emit("loading");

        this.#pendingRefresh = (async () => {
            try {
                const planets = await this.#fetchWithRetry();

                this.#planets = planets;
                this.#lastUpdated = new Date();
                this.#status = "ready";
                this.#emit("updated");

                return this.getPlanets();
            } catch (error) {
                this.#error = error;
                this.#status = "error";
                this.#emit("error");
                throw error;
            } finally {
                this.#pendingRefresh = null;
            }
        })();

        return this.#pendingRefresh;
    }
}
