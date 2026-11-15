import { createSeededRandom } from './appearance.js';

const clamp = value => Math.max(0, Math.min(1, value));
const lerp = (a, b, t) => a + (b - a) * t;
const rgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));

function createNoise(seed) {
    const hash = (x, y, z) => {
        let n = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967296 * 2 - 1;
    };
    return (x, y, z) => {
        const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
        let fx = x - ix, fy = y - iy, fz = z - iz;
        fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
        return lerp(
            lerp(lerp(hash(ix, iy, iz), hash(ix + 1, iy, iz), fx), lerp(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), fx), fy),
            lerp(lerp(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), fx), lerp(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), fx), fy), fz
        );
    };
}

// Чистая генерация пикселей: нет DOM, времени, Math.random и зависимости от порядка выбора.
export function createSurfacePixels(config, width, height) {
    const pixels = new Uint8ClampedArray(width * height * 4);
    const noise = createNoise(config.seed);
    const random = createSeededRandom(config.seed ^ 0x51f15e);
    const dark = rgb(config.secondaryColor), base = rgb(config.primaryColor), light = rgb(config.detailColor);
    const spots = Array.from({ length: config.style === 'rocky' ? config.craterCount : config.stormCount }, () => {
        const y = random() * 1.8 - 0.9;
        const theta = random() * Math.PI * 2;
        const r = Math.sqrt(1 - y * y);
        return { x: r * Math.cos(theta), y, z: r * Math.sin(theta), radius: 0.05 + random() * 0.17 };
    });
    const scale = config.noiseScale;
    for (let y = 0; y < height; y++) {
        const phi = y / (height - 1) * Math.PI;
        const sinPhi = y === 0 || y === height - 1 ? 0 : Math.sin(phi);
        const ny = Math.cos(phi);
        for (let x = 0; x < width; x++) {
            const theta = x === width - 1 ? 0 : x / (width - 1) * Math.PI * 2;
            const nx = sinPhi * Math.cos(theta), nz = sinPhi * Math.sin(theta);
            const broad = noise(nx * scale, ny * scale, nz * scale);
            const medium = noise(nx * scale * 3.1, ny * scale * 3.1, nz * scale * 3.1);
            const grain = noise(nx * 65, ny * 65, nz * 65);
            let value;
            if (config.style === 'rocky') {
                value = 0.5 + broad * 0.42 + medium * 0.16 + grain * 0.07;
                for (const spot of spots) {
                    const distance = Math.sqrt(Math.max(0, 2 - 2 * (nx * spot.x + ny * spot.y + nz * spot.z))) / spot.radius;
                    if (distance < 1.4) {
                        value -= Math.exp(-distance * distance * 4) * 0.3;
                        value += Math.exp(-((distance - 1) ** 2) * 60) * 0.22;
                    }
                }
            } else {
                const latitude = ny + config.turbulence * (broad * 0.35 + medium * 0.08);
                const bands = Math.sin(latitude * config.bandCount * Math.PI + medium * 0.25);
                value = config.style === 'hazy'
                    ? 0.62 + broad * 0.17 + bands * 0.045 + grain * 0.01
                    : 0.51 + bands * 0.25 + broad * 0.13 + medium * 0.06;
                for (const spot of spots) {
                    const distance = Math.sqrt(Math.max(0, 2 - 2 * (nx * spot.x + ny * spot.y + nz * spot.z))) / spot.radius;
                    if (distance < 2) {
                        value += Math.cos(distance * 8 + broad * 4) * Math.exp(-distance * distance) * 0.28;
                    }
                }
            }
            const t = clamp(value);
            const index = (y * width + x) * 4;
            for (let channel = 0; channel < 3; channel++) {
                pixels[index + channel] = t < 0.5 ? lerp(dark[channel], base[channel], t * 2)
                    : lerp(base[channel], light[channel], (t - 0.5) * 2);
            }
            pixels[index + 3] = 255;
        }
    }
    return pixels;
}
