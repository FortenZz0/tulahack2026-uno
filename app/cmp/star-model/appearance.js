import { createSeededRandom, hashPlanetName } from '../canvas/appearance.js';

// Условные цветовые образы: https://science.nasa.gov/exoplanets/stars/
// Детали поверхности и свечения не являются наблюдениями конкретной звезды.
const PROFILES = {
    O: { low: '#5b79c0', high: '#c1d6ff', glow: '#91b7ff', scale: 25, contrast: 0.16, strength: 0.4, falloff: 8 },
    B: { low: '#7e96c7', high: '#d9e8ff', glow: '#a9cbff', scale: 23, contrast: 0.2, strength: 0.34, falloff: 9 },
    A: { low: '#a9b8d1', high: '#f0f3ff', glow: '#d2e2ff', scale: 21, contrast: 0.24, strength: 0.27, falloff: 10 },
    F: { low: '#c7b69c', high: '#fff3ce', glow: '#fff0cf', scale: 18, contrast: 0.35, strength: 0.27, falloff: 10 },
    G: { low: '#c68635', high: '#fff0b8', glow: '#ffcc76', scale: 13, contrast: 0.55, strength: 0.3, falloff: 10 },
    K: { low: '#ad5429', high: '#ffd194', glow: '#ff9f58', scale: 11, contrast: 0.62, strength: 0.28, falloff: 11 },
    M: { low: '#8c2d20', high: '#ffb878', glow: '#f97742', scale: 9, contrast: 0.7, strength: 0.25, falloff: 12 },
    L: { low: '#56251d', high: '#c0784a', glow: '#a7593d', scale: 7, contrast: 0.6, strength: 0.15, falloff: 14, bands: 0.15 },
    T: { low: '#352729', high: '#926955', glow: '#976045', scale: 6, contrast: 0.6, strength: 0.1, falloff: 16, bands: 0.2 },
    Y: { low: '#28252c', high: '#63504c', glow: '#685149', scale: 5, contrast: 0.6, strength: 0.06, falloff: 18, bands: 0.25 },
    WD: { low: '#879fb5', high: '#e9f3ff', glow: '#d0e3ff', scale: 30, contrast: 0.08, strength: 0.12, falloff: 18 },
    unknown: { low: '#6a7384', high: '#c3cad8', glow: '#9fa9bf', scale: 16, contrast: 0.25, strength: 0.12, falloff: 14 },
};

export function parseSpectralType(value) {
    const raw = typeof value === 'string' ? value.trim() : '';
    // '+' в Ia+ — часть класса светимости, а не разделитель компонентов.
    const componentSeparator = /\+\s*(?=[A-Za-z])/;
    const primary = raw.split(componentSeparator)[0].trim();
    const composite = componentSeparator.test(raw);
    if (/^D(?:[ABCOQZX]+)?(?=\d|\s|$)/i.test(primary)) {
        return { raw, spectralClass: 'WD', luminosityClass: null, composite };
    }
    // Буква класса должна быть отдельной или сопровождаться числовым подклассом.
    const match = /^(?:sd)?([OBAFGKMLTY])(?=\d|\s|$)(?:\d(?:\.\d+)?)?(.*)$/i.exec(primary);
    if (!match) return { raw, spectralClass: null, luminosityClass: null, composite };
    const tail = match[2].trim();
    const luminosity = /^(Iab|Ia\+?|Ib|III|II|IV|VI|V|I)(?=$|[^IVX])/i.exec(tail);
    return { raw, spectralClass: match[1].toUpperCase(), luminosityClass: luminosity?.[1].toUpperCase() ?? null, composite };
}

function temperaturePalette(temperature) {
    if (!Number.isFinite(temperature) || temperature <= 0) return null;
    // Приблизительные диапазоны, только для палитры; тип звезды в каталоге не меняем.
    if (temperature >= 30000) return 'O';
    if (temperature >= 10000) return 'B';
    if (temperature >= 7500) return 'A';
    if (temperature >= 6000) return 'F';
    if (temperature >= 5200) return 'G';
    if (temperature >= 3700) return 'K';
    if (temperature >= 2400) return 'M';
    if (temperature >= 1300) return 'L';
    if (temperature >= 500) return 'T';
    return 'Y';
}

export function createStarAppearance(star) {
    const type = parseSpectralType(star?.spectralType);
    const temperatureClass = temperaturePalette(star?.temperature);
    // Для белого карлика при наличии температуры корректируем только цвет, а не профиль поверхности.
    const colorClass = type.spectralClass === 'WD' ? temperatureClass ?? 'WD'
        : type.spectralClass ?? temperatureClass ?? 'unknown';
    const profile = PROFILES[type.spectralClass === 'WD' ? 'WD' : colorClass];
    const colors = PROFILES[colorClass];
    const giant = ['I', 'IA', 'IA+', 'IAB', 'IB', 'II', 'III'].includes(type.luminosityClass);
    const identity = typeof star?.name === 'string' && star.name.trim()
        ? star.name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase() : `id:${star?.id ?? 'unknown'}`;
    const random = createSeededRandom(hashPlanetName(identity));
    const seedOffset = [random() * 100, random() * 100, random() * 100];
    let caption = type.spectralClass ? `Спектральный тип: ${type.raw}`
        : temperatureClass ? `Условный цвет по температуре ${star.temperature.toLocaleString('ru-RU')} K`
            : 'Тип звезды неизвестен · нейтральная палитра';
    if (type.composite && type.spectralClass) caption += ' · образ первого компонента';
    if (giant) caption += ' · гигантская звезда';
    return {
        ...type, source: type.spectralClass ? 'spectralType' : temperatureClass ? 'temperature' : 'unknown',
        lowColor: colors.low, highColor: colors.high, haloColor: colors.glow,
        granuleScale: profile.scale * (giant ? 0.6 : 1) * (0.9 + random() * 0.2),
        contrast: profile.contrast,
        glowStrength: profile.strength * (giant ? 1.15 : 1),
        glowFalloff: profile.falloff * (giant ? 0.85 : 1),
        bandStrength: profile.bands ?? 0,
        rotationSpeed: 0.05 + random() * 0.025,
        seedOffset,
        caption: `${caption}. Поверхность и свечение стилизованы; масштаб условный.`,
    };
}
