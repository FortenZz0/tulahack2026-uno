import { fetchPlanets } from "./nasa.js";


export class ExoplanetLibrary {
    #planets = [];
    #status = "idle";
    #lastUpdated = null;
    #error = null;
    #listeners = new Map();
    #pendingRefresh = null;

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
                const planets = await fetchPlanets();

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
