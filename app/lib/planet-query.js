// формат options {
//   filters: {...},
//   sort: { by: ..., order: "asc" | "desc" },
//   offset: number,
//   limit: number
// } 
// filter = {min: number, max: number}


import { Planet } from "./planet.js";

function getValue(object, path) {
    return path.split(".").reduce(
        (value, key) => value?.[key],
        object
    );
}

function validateField(path) {
    if (
        typeof path !== "string" ||
        !path ||
        path.split(".").some(key => !key)
    ) {
        throw new RangeError(`Invalid planet field: ${path}`);
    }

    let value = new Planet();

    for (const key of path.split(".")) {
        if (
            value === null ||
            typeof value !== "object" ||
            !Object.hasOwn(value, key)
        ) {
            throw new RangeError(`Unknown planet field: ${path}`);
        }

        value = value[key];
    }

    if (value !== null && typeof value === "object") {
        throw new RangeError(`Field is not sortable: ${path}`);
    }
}

function validateOptions({ filters, sort, offset, limit }) {
    if (!Number.isSafeInteger(offset) || offset < 0) {
        throw new RangeError("offset must be a non-negative integer");
    }

    if (
        limit !== undefined &&
        (!Number.isSafeInteger(limit) || limit < 0)
    ) {
        throw new RangeError("limit must be a non-negative integer");
    }

    if (sort !== undefined) {
        if (
            sort === null ||
            typeof sort !== "object" ||
            Array.isArray(sort)
        ) {
            throw new TypeError("sort must be an object");
        }

        validateField(sort.by);

        if (!["asc", "desc"].includes(sort.order)) {
            throw new RangeError("sort.order must be asc or desc");
        }
    }

    if (
        filters === null ||
        typeof filters !== "object" ||
        Array.isArray(filters)
    ) {
        throw new TypeError("filters must be an object");
    }

    for (const [path, range] of Object.entries(filters)) {
        validateField(path);

        if (path === "name") {
            throw new RangeError("Name cannot use numeric filters");
        }

        if (
            range === null ||
            typeof range !== "object" ||
            Array.isArray(range)
        ) {
            throw new TypeError(`Invalid range for ${path}`);
        }

        if (
            range.min === undefined &&
            range.max === undefined
        ) {
            throw new RangeError(`Empty range for ${path}`);
        }

        for (const value of [range.min, range.max]) {
            if (
                value !== undefined &&
                (typeof value !== "number" || !Number.isFinite(value))
            ) {
                throw new TypeError(`Invalid range for ${path}`);
            }
        }

        if (
            range.min !== undefined &&
            range.max !== undefined &&
            range.min > range.max
        ) {
            throw new RangeError(`min exceeds max for ${path}`);
        }
    }
}

export function queryPlanets(planets, options = {}) {
    const {
        filters = {},
        sort,
        offset = 0,
        limit,
    } = options;

    validateOptions({ filters, sort, offset, limit });

    let result = [...planets];

    for (const [path, range] of Object.entries(filters)) {
        result = result.filter(planet => {
            const value = getValue(planet, path);

            if (typeof value !== "number" || !Number.isFinite(value)) {
                return false;
            }

            if (range.min !== undefined && value < range.min) {
                return false;
            }

            if (range.max !== undefined && value > range.max) {
                return false;
            }

            return true;
        });
    }

    if (sort !== undefined) {
        const direction = sort.order === "asc" ? 1 : -1;

        result.sort((a, b) => {
            const valueA = getValue(a, sort.by);
            const valueB = getValue(b, sort.by);

            const missingA = valueA == null || (
                typeof valueA === "number" && !Number.isFinite(valueA)
            );

            const missingB = valueB == null || (
                typeof valueB === "number" && !Number.isFinite(valueB)
            );

            if (missingA && missingB) return 0;
            if (missingA) return 1;
            if (missingB) return -1;

            if (typeof valueA === "string" && typeof valueB === "string") {
                return valueA.localeCompare(valueB) * direction;
            }

            return (valueA - valueB) * direction;
        });
    }

    return result.slice(
        offset,
        limit === undefined ? undefined : offset + limit
    );
}
