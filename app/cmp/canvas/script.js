import * as THREE from 'three';
import { comparisonLayout, getPlanetRadius } from './comparison.js';
import { createPlanetAppearance, createSeededRandom, getAppearanceIdentity, hashPlanetName } from './appearance.js';
import { createSurfacePixels } from './surface-pixels.js';



// ==========================================
// НАСТРОЙКИ ВНЕШНЕГО ВИДА ПЛАНЕТЫ
// ==========================================
const planetState = { 
    style: 'noise',                // 'bands' (полосы) или 'noise' (континенты/кратеры)
    
    primaryColor: '#2a5298',     // Основной цвет
    secondaryColor: '#1e3c72',   // Цвет градиента
    detailColor: '#76d742',      // Цвет деталей
    atmosphereColor: '#2298ff',  // Цвет свечения по краям
    
    hasRings: false,               // Показывать ли кольца (true / false)
    ringColor: '#a1c4fd',        // Цвет колец
    
    rotationSpeed: 0.003,          // Скорость автовращения
    tiltDegrees: -18,              // Наклон оси в градусах
    
    showAxis: true,                // Показывать ли ось вращения (true / false)
    axisColor: '#abbeba',        // Цвет линии и маркеров полюсов
    axisLength: 1000,              // Длина оси (диаметр планеты равен 2.0)
    axisOpacity: 0.2,              // Прозрачность оси (от 0.1 до 1.0)noiseScale: 1.9,
    
    noiseScale: 1.5,               // Размер континентов: 1.0 (гигантские материки) — 4.5 (мелкие острова)
    noiseOctaves: 8,               // Детализация береговой линии: 1 (гладкие пятна) — 5 (изрезанные берега)
    landThreshold: 0.05,           // Доля суши: -0.25 (почти вся планета суша) — 0.25 (только мелкие архипелаги)
    noiseSeed: 12                  // Фиксированное зерно генерации (число или null для случайного при каждом вызове)
};



// 1. Получаем канвас и его ближайший родительский тег
const canvas = document.getElementById('planet-canvas');
const container = canvas.parentElement;
const workspace = canvas.closest('.planet-workspace');

const scene = new THREE.Scene();

// Берем стартовые размеры родителя (с запасным вариантом, если блок временно скрыт)
const initWidth = container.clientWidth || 300;
const initHeight = container.clientHeight || 300;
const initialRenderSize = Math.max(1, Math.ceil(Math.min(
    workspace.clientWidth || initWidth,
    workspace.clientHeight || initHeight
)));
let pendingRenderSize = initialRenderSize;
let renderSize = initialRenderSize;

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
const comparisonCamera = new THREE.OrthographicCamera(-3, 3, 3, -3, 0.1, 100);
comparisonCamera.position.z = 10;
let activeComparison = null;
let selectedPlanetId = 'earth-reference';
camera.position.set(0, 0, 4);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
// Третий параметр false важен: он запрещает Three.js жестко перезаписывать style.width и style.height в пикселях
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(initialRenderSize, initialRenderSize, false);

// ... весь ваш код генерации текстуры, планеты, оси и управления мышью остается без изменений ...



// ==========================================
// 1. ПРОСТЕЙШИЙ БЕСШОВНЫЙ 3D-ШУМ (FBM)
// ==========================================
const perm = new Uint8Array(512);
const noiseRandom = createSeededRandom(hashPlanetName('earth-surface-noise'));
for (let i = 0; i < 256; i++) perm[i] = i;
for (let i = 255; i > 0; i--) {
  const j = Math.floor(noiseRandom() * (i + 1));
  [perm[i], perm[j]] = [perm[j], perm[i]];
}
for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }
function grad(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function noise3D(x, y, z) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
  const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;

  return lerp(
    lerp(lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
         lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
    lerp(lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
         lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v),
    w
  );
}

// Складываем 4 слоя шума для красивой береговой линии
function fbm(x, y, z, octaves = 4) {
  let value = 0;
  let amplitude = 0.5;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise3D(x, y, z);
    x *= 2.05;
    y *= 2.05;
    z *= 2.05;
    amplitude *= 0.5;
  }
  return value;
}

// Вспомогательная функция перевода HEX в RGB
function hexToRgb(hex) {
  const num = parseInt(hex.replace('#', ''), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

// Вспомогательная функция плавного перехода (убирает пиксельные лесенки)
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Смешивание двух RGB-цветов (исправлено с индексами, [1], [2])
function mixRgb(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t)
  ];
}

// ==========================================
// ИСПРАВЛЕННЫЙ ЧЁТКИЙ ГЕНЕРАТОР ТЕКСТУРЫ
// ==========================================
function generateSurfaceTexture(config) {
  const width = 512;
  const height = ['rocky', 'hazy', 'gas-bands'].includes(config.style) ? 256 : 512;
  const texCanvas = document.createElement('canvas');
  texCanvas.width = width;
  texCanvas.height = height;
  const ctx = texCanvas.getContext('2d');

  if (['rocky', 'hazy', 'gas-bands'].includes(config.style)) {
    const image = ctx.createImageData(width, height);
    image.data.set(createSurfacePixels(config, width, height));
    ctx.putImageData(image, 0, 0);
  } else if (config.style === 'bands') {
    // Повторная генерация для той же планеты сохраняет рисунок полос.
    let bandSeed = Math.floor((config.noiseSeed ?? 12) * 10000) || 1;
    const random = () => {
      bandSeed ^= bandSeed << 13;
      bandSeed ^= bandSeed >>> 17;
      bandSeed ^= bandSeed << 5;
      return (bandSeed >>> 0) / 4294967296;
    };
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, config.secondaryColor);
    grad.addColorStop(0.5, config.primaryColor);
    grad.addColorStop(1, config.secondaryColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 18; i++) {
      const y = random() * height;
      const bandH = 6 + random() * 24;
      const bandGrad = ctx.createLinearGradient(0, y, 0, y + bandH);
      bandGrad.addColorStop(0, 'transparent');
      bandGrad.addColorStop(0.5, config.detailColor);
      bandGrad.addColorStop(1, 'transparent');

      ctx.globalAlpha = 0.1 + random() * 0.22;
      ctx.fillStyle = bandGrad;
      ctx.fillRect(0, y, width, bandH);
    }
    // Полосы не должны быть осесимметричными: иначе вращение поверхности не видно.
    // Периодические неоднородности по долготе сохраняют бесшовность текстуры.
    const bandImage = ctx.getImageData(0, 0, width, height);
    for (let y = 0; y < height; y++) {
      const latitude = y / height * Math.PI;
      for (let x = 0; x < width; x++) {
        const longitude = x / width * Math.PI * 2;
        const variation = 1 + 0.18 * Math.sin(latitude) * (
          Math.sin(longitude * 3 + Math.sin(latitude * 5) * 2 + (config.noiseSeed ?? 12))
          + 0.4 * Math.sin(longitude * 7 - latitude * 9)
        );
        const index = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          bandImage.data[index + channel] *= variation;
        }
      }
    }
    ctx.putImageData(bandImage, 0, 0);
  } else {
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const cOcean = hexToRgb(config.primaryColor);
    const cDeep = hexToRgb(config.secondaryColor);
    const cLand = hexToRgb(config.detailColor);
    const cShore = mixRgb(cOcean, [255, 255, 255], 0.25);

    // Читаем параметры шума из настроек планеты
    const scale = config.noiseScale ?? 1.9;
    const octaves = Math.max(1, Math.min(6, Math.round(config.noiseOctaves ?? 4)));
    const threshold = config.landThreshold ?? 0.01;
    const seed = typeof config.noiseSeed === 'number' ? config.noiseSeed : 12;

    for (let y = 0; y < height; y++) {
      const phi = (y / height) * Math.PI;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      for (let x = 0; x < width; x++) {
        const theta = (x / width) * Math.PI * 2;

        const nx = sinPhi * Math.cos(theta);
        const ny = cosPhi;
        const nz = sinPhi * Math.sin(theta);

        const n = fbm(nx * scale + seed, ny * scale + seed, nz * scale + seed, octaves);

        // 1. Плавный градиент глубины океана относительно порога суши
        const depthFactor = smoothstep(threshold - 0.36, threshold - 0.03, n);
        let color = mixRgb(cDeep, cOcean, depthFactor);

        // 2. Мягкая береговая кайма
        const shoreFactor = smoothstep(threshold - 0.045, threshold - 0.015, n);
        color = mixRgb(color, cShore, shoreFactor);

        // 3. Чёткий, сглаженный край суши
        const landFactor = smoothstep(threshold - 0.005, threshold + 0.01, n);
        color = mixRgb(color, cLand, landFactor);

        const idx = (y * width + x) * 4;
        data[idx] = color[0];
        data[idx + 1] = color[1];
        data[idx + 2] = color[2];
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const texture = new THREE.CanvasTexture(texCanvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  return texture;
}

// 3. Сборка планеты
const planetGroup = new THREE.Group();
planetGroup.rotation.z = THREE.MathUtils.degToRad(planetState.tiltDegrees);
scene.add(planetGroup);

const sphereGeo = new THREE.SphereGeometry(1, 64, 64);
const sphereMat = new THREE.MeshStandardMaterial({
    map: generateSurfaceTexture(planetState),
    roughness: 0.85,
    metalness: 0.05
});
const planetMesh = new THREE.Mesh(sphereGeo, sphereMat);
const earthTexture = sphereMat.map;

// Миниатюра использует геометрию и текстуру той же Земли, независимо от выбранной планеты.
export function createEarthPreview(previewCanvas) {
    if (!previewCanvas) return null;
    let previewRenderer;
    try {
        previewRenderer = new THREE.WebGLRenderer({ canvas: previewCanvas, antialias: true, alpha: true });
    } catch {
        previewCanvas.replaceWith(document.createTextNode('🌍'));
        return null;
    }
    previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    previewRenderer.setSize(60, 60, false);
    const previewScene = new THREE.Scene();
    const previewCamera = new THREE.PerspectiveCamera(45, 1, .1, 10);
    previewCamera.position.z = 3.2;
    const group = new THREE.Group();
    group.rotation.z = THREE.MathUtils.degToRad(planetState.tiltDegrees);
    const material = new THREE.MeshStandardMaterial({ map: earthTexture, roughness: .85, metalness: .05 });
    const globe = new THREE.Mesh(sphereGeo, material);
    group.add(globe);
    previewScene.add(group);
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(-5, 3, 4);
    previewScene.add(light, new THREE.AmbientLight(0xffffff, .35));

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let frame = 0;
    let lastTime = null;
    let disposed = false;
    function tick(time) {
        frame = requestAnimationFrame(tick);
        if (lastTime !== null && time - lastTime < 1000 / 30) return;
        const delta = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, .1);
        lastTime = time;
        globe.rotation.y += planetState.rotationSpeed * delta * 60;
        previewRenderer.render(previewScene, previewCamera);
    }
    function update() {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = null;
        if (disposed || !visible || document.hidden) return;
        previewRenderer.render(previewScene, previewCamera);
        if (!motion.matches) frame = requestAnimationFrame(tick);
    }
    const observer = new IntersectionObserver(entries => {
        visible = entries.some(entry => entry.isIntersecting);
        update();
    });
    observer.observe(previewCanvas);
    document.addEventListener('visibilitychange', update);
    motion.addEventListener('change', update);
    return {
        dispose() {
            disposed = true;
            cancelAnimationFrame(frame);
            observer.disconnect();
            document.removeEventListener('visibilitychange', update);
            motion.removeEventListener('change', update);
            material.dispose();
            previewRenderer.dispose();
        },
    };
}

planetMesh.userData.planetId = 'earth-reference';
planetGroup.add(planetMesh);
const comparisonGroup = new THREE.Group();
const comparisonMaterial = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 });
const comparisonMesh = new THREE.Mesh(sphereGeo, comparisonMaterial);
comparisonGroup.add(comparisonMesh);
comparisonGroup.visible = false;
scene.add(comparisonGroup);

// Атмосфера
const atmoGeo = new THREE.SphereGeometry(1.04, 64, 64);
const atmoMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
    glowColor: { value: new THREE.Color(planetState.atmosphereColor) }
    },
    vertexShader: `
    varying vec3 vNormal;
    void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
    fragmentShader: `
    uniform vec3 glowColor;
    varying vec3 vNormal;
    void main() {
        float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
        gl_FragColor = vec4(glowColor, intensity * 0.85);
    }
    `
});
const atmosphereMesh = new THREE.Mesh(atmoGeo, atmoMat);
planetGroup.add(atmosphereMesh);
const comparisonAtmosphereMaterial = atmoMat.clone();
const comparisonAtmosphereMesh = new THREE.Mesh(atmoGeo, comparisonAtmosphereMaterial);
comparisonGroup.add(comparisonAtmosphereMesh);

// Храним лёгкие настройки по имени и классу; на GPU — только видимые текстуры и Земля.
const appearances = new Map();
function getAppearance(planet) {
    if (planet.id === 'earth-reference') return { ...planetState, roughness: 0.85, metalness: 0.05, bumpScale: 0, showAtmosphere: true, key: 'earth-reference' };
    const { key } = getAppearanceIdentity(planet);
    if (!appearances.has(key)) appearances.set(key, createPlanetAppearance(planet));
    return appearances.get(key);
}

function setSurface(mesh, planet) {
    const config = getAppearance(planet);
    if (mesh.userData.appearanceKey === config.key) return;
    if (mesh.material.map && mesh.material.map !== earthTexture) mesh.material.map.dispose();
    mesh.material.map = planet.id === 'earth-reference' ? earthTexture : generateSurfaceTexture(config);
    mesh.material.color.set('#ffffff');
    mesh.material.roughness = config.roughness;
    mesh.material.metalness = config.metalness;
    mesh.material.bumpMap = config.bumpScale > 0 ? mesh.material.map : null;
    mesh.material.bumpScale = config.bumpScale;
    mesh.material.needsUpdate = true;
    mesh.userData.planetId = planet.id;
    mesh.userData.appearanceKey = config.key;
}

// Кольца
const ringGeo = new THREE.RingGeometry(1.35, 1.85, 64);
const ringMat = new THREE.MeshBasicMaterial({
    color: planetState.ringColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.4
});
const ringMesh = new THREE.Mesh(ringGeo, ringMat);
ringMesh.rotation.x = Math.PI / 2.1;
ringMesh.visible = planetState.hasRings;
planetGroup.add(ringMesh);

// 4. Освещение
const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
sunLight.position.set(-5, 3, 4);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.35));

 // 5. Плавное вращение мышью с остановкой при захвате (grab)
let isDragging = false;
let prevMouse = { x: 0, y: 0 };
let velocity = { x: 0, y: 0 };
// При FOV 45° планета с атмосферой целиком помещается в квадратный canvas с запасом.
const minZoom = 3.2;
const maxZoom = 7.0;
let targetZoom = 4.25;

canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    isDragging = true;
    velocity.x = 0; // Мгновенно гасим остаточную инерцию при захвате
    velocity.y = 0;
    prevMouse = { x: e.clientX, y: e.clientY };
});

window.addEventListener('pointerup', () => {
    isDragging = false;
});
canvas.addEventListener('pointercancel', () => { isDragging = false; });
canvas.addEventListener('lostpointercapture', () => { isDragging = false; });
window.addEventListener('blur', () => {
    isDragging = false;
    velocity.x = 0;
    velocity.y = 0;
});

window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    velocity.x = (e.clientX - prevMouse.x) * 0.005;
    velocity.y = (e.clientY - prevMouse.y) * 0.005;
    prevMouse = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    targetZoom = THREE.MathUtils.clamp(targetZoom + e.deltaY * 0.002, minZoom, maxZoom);
}, { passive: false });



// ==========================================
// ВИЗУАЛИЗАЦИЯ ОСИ ВРАЩЕНИЯ И ПОЛЮСОВ
// ==========================================
const axisGroup = new THREE.Group();
axisGroup.visible = planetState.showAxis;
planetGroup.add(axisGroup);

// 1. Линия оси (используем базовую длину 1, чтобы легко масштабировать по Y)
const axisPoints = [
    new THREE.Vector3(0, -0.5, 0),
    new THREE.Vector3(0, 0.5, 0)
];
const axisGeo = new THREE.BufferGeometry().setFromPoints(axisPoints);
const axisMat = new THREE.LineBasicMaterial({
    color: planetState.axisColor,
    transparent: true,
    opacity: planetState.axisOpacity
});
const axisLine = new THREE.Line(axisGeo, axisMat);
axisLine.scale.y = planetState.axisLength;
axisGroup.add(axisLine);
const comparisonAxisGroup = axisGroup.clone();
comparisonGroup.add(comparisonAxisGroup);
comparisonGroup.rotation.z = THREE.MathUtils.degToRad(planetState.tiltDegrees);



// ==========================================
// ФУНКЦИЯ БЫСТРОГО ОБНОВЛЕНИЯ ПЛАНЕТЫ
// ==========================================
window.updatePlanet = function(newProps) {
      Object.assign(planetState, newProps);

      // Перерисовываем текстуру только если изменились цвета, стиль или параметры шума
      const needTextureUpdate = [
        'style', 'primaryColor', 'secondaryColor', 'detailColor',
        'noiseScale', 'noiseOctaves', 'landThreshold', 'noiseSeed'
      ].some(key => key in newProps);

      if (needTextureUpdate) {
        if (sphereMat.map) sphereMat.map.dispose();
        sphereMat.map = generateSurfaceTexture(planetState);
        sphereMat.needsUpdate = true;
      }

      // Обновление атмосферы, колец, наклона и оси (срабатывает мгновенно без пересчета шума)
      atmoMat.uniforms.glowColor.value.set(planetState.atmosphereColor);
      ringMat.color.set(planetState.ringColor);
      ringMesh.visible = planetState.hasRings;
      planetGroup.rotation.z = THREE.MathUtils.degToRad(planetState.tiltDegrees);

      axisGroup.visible = planetState.showAxis;
      comparisonAxisGroup.visible = planetState.showAxis;
      axisMat.color.set(planetState.axisColor);
      axisMat.opacity = planetState.axisOpacity;

      axisLine.scale.y = planetState.axisLength;
      comparisonAxisGroup.children[0].scale.y = planetState.axisLength;
    };

// Один renderer и две сферы: контекст и геометрия переиспользуются при переключении.
export function setScenePlanets(selected, comparison = null) {
    const hasRadius = getPlanetRadius(selected) !== null;
    if (selectedPlanetId !== selected.id) {
        selectedPlanetId = selected.id;
        planetGroup.rotation.set(0, 0, THREE.MathUtils.degToRad(planetState.tiltDegrees));
        velocity.x = 0;
        velocity.y = 0;
    }
    // Внешний вид экзопланет условный; данные о поверхности не предполагаем.
    setSurface(planetMesh, selected);
    const appearance = getAppearance(selected);
    atmoMat.uniforms.glowColor.value.set(appearance.atmosphereColor);
    atmosphereMesh.visible = appearance.showAtmosphere;
    ringMesh.visible = false;
    // Линия обозначает ось условной модели, а не измеренный наклон экзопланеты.
    axisGroup.visible = planetState.showAxis;
    comparisonAxisGroup.visible = planetState.showAxis;
    planetGroup.visible = hasRadius;
    activeComparison = comparison ? comparisonLayout(getPlanetRadius(selected), getPlanetRadius(comparison)) : null;
    comparisonGroup.visible = activeComparison !== null;
    if (activeComparison) {
        setSurface(comparisonMesh, comparison);
        const comparedAppearance = getAppearance(comparison);
        comparisonAtmosphereMaterial.uniforms.glowColor.value.set(comparedAppearance.atmosphereColor);
        comparisonAtmosphereMesh.visible = comparedAppearance.showAtmosphere;
    } else if (comparisonMesh.userData.planetId) {
        if (comparisonMaterial.map && comparisonMaterial.map !== earthTexture) comparisonMaterial.map.dispose();
        comparisonMaterial.map = null;
        comparisonMaterial.bumpMap = null;
        comparisonMaterial.needsUpdate = true;
        delete comparisonMesh.userData.planetId;
        delete comparisonMesh.userData.appearanceKey;
    }
    planetGroup.scale.setScalar(activeComparison?.firstScale ?? 1);
    planetGroup.position.x = activeComparison?.firstX ?? 0;
    comparisonGroup.scale.setScalar(activeComparison?.secondScale ?? 1);
    comparisonGroup.position.x = activeComparison?.secondX ?? 0;
    canvas.setAttribute('aria-label', comparison
        ? `Сравнение размеров: ${selected.name ?? 'Планета'} и ${comparison.name ?? 'Планета'}`
        : `Условная 3D-визуализация: ${selected.name ?? 'Планета'}`);
}


// 6. Адаптив и цикл рендера
// window.addEventListener('resize', () => {
//     camera.aspect = window.innerWidth / window.innerHeight;
//     camera.updateProjectionMatrix();
//     renderer.setSize(window.innerWidth, window.innerHeight);
// });

let lastFrameTime = null;
function animate(time) {
    requestAnimationFrame(animate);
    const deltaSeconds = lastFrameTime === null ? 0 : Math.min((time - lastFrameTime) / 1000, 0.05);
    lastFrameTime = time;

    // Изменение буфера очищает canvas, поэтому сразу рисуем в нём новый кадр.
    // Раскрытие панели меняет только CSS-размер квадратного canvas.
    if (pendingRenderSize !== renderSize) {
        renderSize = pendingRenderSize;
        renderer.setSize(renderSize, renderSize, false);
    }

    // Применяем вращение от мыши и плавно гасим инерцию
    planetGroup.rotation.y += velocity.x;
    planetGroup.rotation.x = Math.max(-1.2, Math.min(1.2, planetGroup.rotation.x + velocity.y));
    comparisonGroup.rotation.y += velocity.x;
    comparisonGroup.rotation.x = Math.max(-1.2, Math.min(1.2, comparisonGroup.rotation.x + velocity.y));
    velocity.x *= 0.92;
    velocity.y *= 0.92;

    // Плавное приближение колесиком мыши
    camera.position.z += (targetZoom - camera.position.z) * 0.08;

    // Крутим планету автоматически ТОЛЬКО когда она не захвачена мышью
    if (!isDragging) {
    planetMesh.rotation.y += planetState.rotationSpeed * deltaSeconds * 60;
    comparisonMesh.rotation.y += planetState.rotationSpeed * deltaSeconds * 60;
    }

    if (activeComparison) {
        // Единая ортографическая проекция: видимые диаметры строго пропорциональны R⊕.
        const extent = activeComparison.halfExtent * camera.position.z / minZoom;
        comparisonCamera.left = -extent;
        comparisonCamera.right = extent;
        comparisonCamera.top = extent;
        comparisonCamera.bottom = -extent;
        comparisonCamera.updateProjectionMatrix();
    }
    renderer.render(scene, activeComparison ? comparisonCamera : camera);
}
requestAnimationFrame(animate);


// 6. Автоматическое отслеживание размеров родительского контейнера
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const width = entry.contentRect.width;
    const height = entry.contentRect.height;

    // Пропускаем обновление, если родительский блок скрыт (display: none)
    if (width === 0 || height === 0) return;

    pendingRenderSize = Math.max(1, Math.ceil(Math.min(width, height)));
  }
});

// Запускаем слежение за родительским тегом
// Наблюдаем всю правую область: её размер не меняется при раскрытии панели.
resizeObserver.observe(workspace);
