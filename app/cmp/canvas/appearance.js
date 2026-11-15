// Художественные пресеты размерных классов Worker, а не реконструкция состава.
// Источники и ограничения: app/README.md, раздел «Материалы планет».
const PROFILES = {
    mini: { style: 'rocky', palettes: [['#918779', '#302d2b', '#c1b7a2'], ['#a77b63', '#3e302b', '#cfac85']], roughness: 0.96, bumpScale: 0.055, craters: 18, glow: false, scale: 5 },
    terrestrial: { style: 'rocky', palettes: [['#a77c53', '#45392f', '#d3bc91'], ['#8d8e83', '#343a39', '#b9b6a4'], ['#a56a4d', '#47352f', '#d3a17d']], roughness: 0.92, bumpScale: 0.035, craters: 7, glow: false, scale: 3.5 },
    'super-earth': { style: 'rocky', palettes: [['#9f847e', '#3c3540', '#c5aaa1'], ['#b58c56', '#4b3931', '#e0c691'], ['#7c8797', '#303845', '#aab4c3']], roughness: 0.85, bumpScale: 0.025, craters: 3, glow: false, scale: 2.2 },
    'sub-neptune': { style: 'hazy', palettes: [['#b6b4ce', '#5f647f', '#ded5dc'], ['#bcb294', '#686c70', '#e6d6b6'], ['#7cbdc4', '#416e8d', '#b9e1dd']], roughness: 0.78, bumpScale: 0, craters: 0, glow: true, scale: 2.5, bands: 5, turbulence: 0.06 },
    neptune: { style: 'gas-bands', palettes: [['#387cae', '#133557', '#8abecb'], ['#5a8ba4', '#294967', '#b2cbd2'], ['#5478b0', '#263a70', '#96b8dd']], roughness: 0.72, bumpScale: 0, craters: 0, glow: true, scale: 3, bands: 7, turbulence: 0.07 },
    jupiter: { style: 'gas-bands', palettes: [['#c9ae8c', '#78553d', '#f0ddba'], ['#b69b88', '#69534d', '#e0cbb5'], ['#c2956f', '#684b48', '#e6c5a1']], roughness: 0.76, bumpScale: 0, craters: 0, glow: true, scale: 4, bands: 14, turbulence: 0.13 },
    mega: { style: 'gas-bands', palettes: [['#b87c68', '#553a44', '#d8b3a0'], ['#9d8baf', '#443d62', '#c8b9cf'], ['#b8a18f', '#5d5054', '#e0c7b4']], roughness: 0.74, bumpScale: 0, craters: 0, glow: true, scale: 4.5, bands: 10, turbulence: 0.2 },
    unknown: { style: 'rocky', palettes: [['#858793', '#343743', '#b1b2bd']], roughness: 0.9, bumpScale: 0.015, craters: 0, glow: false, scale: 3 },
};

export function hashPlanetName(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function createSeededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = Math.imul(state ^ (state >>> 15), state | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

export function getAppearanceIdentity(planet) {
    const name = typeof planet?.name === 'string' && planet.name.trim()
        ? planet.name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
        : `id:${planet?.id ?? 'unknown'}`;
    const rawClass = typeof planet?.classification?.sizeClass === 'string'
        ? planet.classification.sizeClass.trim().toLowerCase() : 'unknown';
    const materialClass = Object.hasOwn(PROFILES, rawClass) ? rawClass : 'unknown';
    return { name, materialClass, key: JSON.stringify([name, materialClass]) };
}

export function createPlanetAppearance(planet) {
    const identity = getAppearanceIdentity(planet);
    const seed = hashPlanetName(identity.name);
    const random = createSeededRandom(seed);
    const profile = PROFILES[identity.materialClass];
    const palette = profile.palettes[Math.floor(random() * profile.palettes.length)];
    // Небольшой согласованный сдвиг палитры даёт варианты внутри одного класса.
    const shift = [0, 0, 0].map(() => Math.round((random() - 0.5) * 20));
    const tint = hex => '#' + [0, 1, 2].map(i => Math.max(0, Math.min(255,
        parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) + shift[i]
    )).toString(16).padStart(2, '0')).join('');
    return {
        key: identity.key, seed, materialClass: identity.materialClass, style: profile.style,
        primaryColor: tint(palette[0]), secondaryColor: tint(palette[1]), detailColor: tint(palette[2]),
        atmosphereColor: tint(palette[2]), showAtmosphere: profile.glow,
        roughness: Math.min(1, profile.roughness + (random() - 0.5) * 0.08),
        metalness: random() * 0.025,
        bumpScale: profile.bumpScale * (0.8 + random() * 0.4),
        noiseScale: profile.scale * (0.8 + random() * 0.4),
        noiseOctaves: 4,
        noiseSeed: random() * 1000,
        bandCount: (profile.bands ?? 0) + Math.floor(random() * 4),
        turbulence: (profile.turbulence ?? 0) * (0.8 + random() * 0.4),
        craterCount: profile.craters + (profile.craters ? Math.floor(random() * 6) : 0),
        stormCount: profile.style === 'gas-bands' ? 1 + Math.floor(random() * 3) : 0,
    };
}
