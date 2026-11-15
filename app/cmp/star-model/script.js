import * as THREE from 'three';
import { createStarAppearance } from './appearance.js';

export function createStarModel(root) {
    const stage = root.querySelector('.star-model-stage');
    const canvas = root.querySelector('canvas');
    const status = root.querySelector('.star-model-status');
    let appearance = createStarAppearance(null);
    let appearanceDirty = true;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let renderer;
    let scene;
    let camera;
    let sphere;
    let surface;
    let halo;
    let hasStar = false;
    let visible = false;
    let unavailable = false;
    let contextLost = false;
    let disposed = false;
    let needsResize = true;
    let frameId;
    let lastTime = null;
    let elapsed = 0;

    function showStatus(message = '') {
        status.textContent = message;
        status.hidden = !message;
        canvas.hidden = Boolean(message) || !renderer;
    }

    function initialize() {
        if (renderer || unavailable) return;
        try {
            renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
        } catch (error) {
            unavailable = true;
            console.warn('3D-модель звезды недоступна:', error);
            return;
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
        camera.position.z = 4.5;
        surface = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                lowColor: { value: new THREE.Color() },
                highColor: { value: new THREE.Color() },
                granuleScale: { value: 12 },
                contrast: { value: 0.5 },
                bandStrength: { value: 0 },
                seedOffset: { value: new THREE.Vector3() },
            },
            vertexShader: `
                varying vec3 surfacePosition;
                varying vec3 surfaceNormal;
                varying vec3 viewDirection;
                void main() {
                    surfacePosition = position;
                    surfaceNormal = normalize(normalMatrix * normal);
                    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
                    viewDirection = -viewPosition.xyz;
                    gl_Position = projectionMatrix * viewPosition;
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 lowColor;
                uniform vec3 highColor;
                uniform vec3 seedOffset;
                uniform float granuleScale;
                uniform float contrast;
                uniform float bandStrength;
                varying vec3 surfacePosition;
                varying vec3 surfaceNormal;
                varying vec3 viewDirection;
                float hash(vec3 p) {
                    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
                }
                float noise(vec3 p) {
                    vec3 i = floor(p);
                    vec3 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
                }
                void main() {
                    vec3 p = surfacePosition * granuleScale + seedOffset + vec3(time * 0.035, 0.0, 0.0);
                    float granules = noise(p) * 0.65 + noise(p * 2.7) * 0.35;
                    float bands = sin(surfacePosition.y * 24.0 + noise(p * 0.2) * 2.0);
                    float pattern = clamp(0.62 + (granules - 0.5) * contrast * 1.7 + bands * bandStrength, 0.0, 1.0);
                    vec3 color = mix(lowColor, highColor, pattern);
                    float facing = max(dot(normalize(surfaceNormal), normalize(viewDirection)), 0.0);
                    color *= 0.55 + 0.45 * pow(facing, 0.35);
                    gl_FragColor = vec4(color, 1.0);
                    #include <colorspace_fragment>
                }
            `,
        });
        sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), surface);
        sphere.rotation.z = 0.2;
        scene.add(sphere);
        halo = new THREE.ShaderMaterial({
            uniforms: {
                haloColor: { value: new THREE.Color() },
                glowStrength: { value: 0.3 },
                glowFalloff: { value: 10 },
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 haloColor;
                uniform float glowStrength;
                uniform float glowFalloff;
                varying vec2 vUv;
                void main() {
                    float radius = length(vUv - 0.5) * 2.0;
                    float glow = exp(-max(radius - 0.48, 0.0) * glowFalloff);
                    glow *= (1.0 - smoothstep(0.75, 1.0, radius)) * glowStrength;
                    gl_FragColor = vec4(haloColor, glow);
                    #include <colorspace_fragment>
                }
            `,
        });
        const corona = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), halo);
        corona.position.z = -0.05;
        scene.add(corona);
    }

    function draw() {
        if (appearanceDirty) {
            surface.uniforms.lowColor.value.set(appearance.lowColor);
            surface.uniforms.highColor.value.set(appearance.highColor);
            surface.uniforms.seedOffset.value.fromArray(appearance.seedOffset);
            surface.uniforms.granuleScale.value = appearance.granuleScale;
            surface.uniforms.contrast.value = appearance.contrast;
            surface.uniforms.bandStrength.value = appearance.bandStrength;
            halo.uniforms.haloColor.value.set(appearance.haloColor);
            halo.uniforms.glowStrength.value = appearance.glowStrength;
            halo.uniforms.glowFalloff.value = appearance.glowFalloff;
            appearanceDirty = false;
        }
        if (needsResize) {
            const width = stage.clientWidth;
            const height = stage.clientHeight;
            if (!width || !height) return;
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            needsResize = false;
        }
        sphere.rotation.y = elapsed * appearance.rotationSpeed;
        surface.uniforms.time.value = elapsed;
        renderer.render(scene, camera);
    }

    function animate(now) {
        frameId = requestAnimationFrame(animate);
        if (lastTime !== null && now - lastTime < 1000 / 30) return;
        if (lastTime !== null) elapsed += Math.min(now - lastTime, 100) / 1000;
        lastTime = now;
        draw();
    }

    function sync() {
        cancelAnimationFrame(frameId);
        lastTime = null;
        if (disposed || contextLost || !hasStar || !visible || document.hidden) return;
        initialize();
        if (unavailable) {
            showStatus('3D-модель недоступна. Характеристики звезды приведены ниже.');
            return;
        }
        showStatus();
        draw();
        if (!reducedMotion.matches) frameId = requestAnimationFrame(animate);
    }

    const intersection = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        sync();
    });
    intersection.observe(stage);
    const resize = new ResizeObserver(() => {
        needsResize = true;
        sync();
    });
    resize.observe(stage);
    document.addEventListener('visibilitychange', sync);
    reducedMotion.addEventListener('change', sync);
    function onContextLost(event) {
        event.preventDefault();
        contextLost = true;
        showStatus('3D-модель временно недоступна.');
        sync();
    }
    function onContextRestored() {
        contextLost = false;
        needsResize = true;
        sync();
    }
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    return {
        setStar(star) {
            hasStar = star != null;
            appearance = createStarAppearance(star);
            appearanceDirty = true;
            elapsed = 0;
            const name = typeof star?.name === 'string' && star.name.trim() ? star.name.trim() : 'звезды';
            canvas.setAttribute('aria-label', `Схематичная 3D-модель: ${name}`);
            showStatus(hasStar ? '' : 'Нет данных о звезде');
            sync();
        },
        dispose() {
            disposed = true;
            cancelAnimationFrame(frameId);
            intersection.disconnect();
            resize.disconnect();
            document.removeEventListener('visibilitychange', sync);
            reducedMotion.removeEventListener('change', sync);
            canvas.removeEventListener('webglcontextlost', onContextLost);
            canvas.removeEventListener('webglcontextrestored', onContextRestored);
            scene?.traverse(object => object.geometry?.dispose());
            surface?.dispose();
            halo?.dispose();
            renderer?.dispose();
        },
    };
}
