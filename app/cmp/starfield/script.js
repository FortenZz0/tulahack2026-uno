import * as THREE from 'three';

export function createStarfield(options) {
    // ????????? ????????? ?? ???????? canvas ? ????????? ???????? WebGL.
    const ranges = {
        density: [0, 5],
        brightness: [0, 3],
        twinkleFrequency: [0, 5],
        twinkleAmount: [0, 0.5],
        driftSpeed: [0, 10],
        starSize: [0.25, 3],
        glow: [0, 1],
        nebulaIntensity: [0, 3],
        maxFps: [1, 60],
        maxPixelRatio: [0.5, 2],
    };
    for (const [name, [min, max]] of Object.entries(ranges)) {
        if (!Number.isFinite(options?.[name]) || options[name] < min || options[name] > max) {
            throw new RangeError(`starfield.${name} must be a finite number between ${min} and ${max}`);
        }
    }
    options = { ...options };

    // Декоративный фон, не связанный с астрономическими данными каталога.
    const canvas = document.createElement('canvas');
    canvas.className = 'starfield-background';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
    } catch (error) {
        // Без WebGL остаётся тёмный CSS-градиент; приложение продолжает работать.
        canvas.remove();
        console.warn('Звёздный фон недоступен:', error);
    }

    if (renderer) {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;
        const material = new THREE.ShaderMaterial({
            depthTest: false,
            depthWrite: false,
            uniforms: {
                time: { value: 0 },
                resolution: { value: new THREE.Vector2(1, 1) },
                density: { value: options.density },
                starBrightness: { value: options.brightness },
                twinkleFrequency: { value: options.twinkleFrequency },
                twinkleAmount: { value: options.twinkleAmount },
                driftSpeed: { value: options.driftSpeed },
                starSize: { value: options.starSize },
                glow: { value: options.glow },
                nebulaIntensity: { value: options.nebulaIntensity },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position.xy, 0.0, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec2 resolution;
                uniform float density;
                uniform float starBrightness;
                uniform float twinkleFrequency;
                uniform float twinkleAmount;
                uniform float driftSpeed;
                uniform float starSize;
                uniform float glow;
                uniform float nebulaIntensity;
                varying vec2 vUv;

                vec2 hash(vec2 cell) {
                    return fract(sin(vec2(dot(cell, vec2(127.1, 311.7)),
                                          dot(cell, vec2(269.5, 183.3)))) * 43758.5453);
                }

                vec3 stars(vec2 pixels, float cellSize, float layer) {
                    cellSize /= sqrt(max(density, 0.001));
                    vec2 moving = pixels + time * driftSpeed * vec2(0.65, 0.25) * layer;
                    vec2 cell = floor(moving / cellSize);
                    vec2 random = hash(cell + layer * 29.0);
                    // Отступ от края ячейки сохраняет ореол при пересечении границ.
                    vec2 center = (0.15 + 0.7 * random) * cellSize;
                    float distanceToStar = length(mod(moving, cellSize) - center);
                    float radius = mix(0.5, 1.3, random.x * random.y) * starSize;
                    float core = 1.0 - smoothstep(0.0, radius, distanceToStar);
                    float halo = exp(-distanceToStar * distanceToStar / (8.0 * starSize * starSize)) * glow;
                    float twinkle = 1.0 - twinkleAmount + twinkleAmount * sin(time * 6.28318 * twinkleFrequency * (0.75 + random.x * 0.5) + random.y * 6.28318);
                    float brightness = mix(0.18, 0.85, random.y);
                    vec3 tint = mix(vec3(0.55, 0.68, 1.0), vec3(1.0, 0.92, 0.80), random.x);
                    return tint * (core + halo) * brightness * twinkle * starBrightness * step(0.001, density);
                }

                void main() {
                    vec2 uv = vUv;
                    float blueCloud = exp(-length((uv - vec2(0.18, 0.25)) * vec2(1.2, 1.8)) * 2.5);
                    float violetCloud = exp(-length((uv - vec2(0.78, 0.75)) * vec2(1.5, 1.2)) * 2.7);
                    float haze = 0.9 + 0.1 * sin(uv.x * 6.0 + uv.y * 4.0 + time * 0.035);
                    vec3 color = vec3(0.018, 0.025, 0.055);
                    color += vec3(0.012, 0.035, 0.075) * blueCloud * haze * nebulaIntensity;
                    color += vec3(0.055, 0.025, 0.085) * violetCloud * haze * nebulaIntensity;
                    vec2 pixels = uv * resolution;
                    color += stars(pixels, 110.0, 0.5) * 0.55;
                    color += stars(pixels, 165.0, 1.0) * 0.75;
                    color += stars(pixels, 240.0, 1.7);
                    gl_FragColor = vec4(color, 1.0);
                }
            `,
        });
        const geometry = new THREE.PlaneGeometry(2, 2);
        scene.add(new THREE.Mesh(geometry, material));

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        let frameId;
        let lastTime = null;
        let elapsed = 0;
        let needsResize = true;
        let contextLost = false;

        function draw() {
            if (needsResize) {
                const width = window.innerWidth;
                const height = window.innerHeight;
                renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.maxPixelRatio));
                renderer.setSize(width, height, false);
                material.uniforms.resolution.value.set(width, height);
                needsResize = false;
            }
            material.uniforms.time.value = reducedMotion.matches ? 0 : elapsed;
            renderer.render(scene, camera);
        }

        function animate(now) {
            frameId = requestAnimationFrame(animate);
            // Ограничиваем частоту фона: основной бюджет GPU оставляем 3D-планете.
            if (lastTime !== null && now - lastTime < 1000 / options.maxFps) return;
            if (lastTime !== null) elapsed += (now - lastTime) / 1000;
            lastTime = now;
            draw();
        }

        function syncAnimation() {
            cancelAnimationFrame(frameId);
            lastTime = null;
            if (contextLost || document.hidden) return;
            draw();
            if (!reducedMotion.matches) frameId = requestAnimationFrame(animate);
        }

        function onResize() {
            needsResize = true;
            syncAnimation();
        }
        window.addEventListener('resize', onResize);
        document.addEventListener('visibilitychange', syncAnimation);
        reducedMotion.addEventListener('change', syncAnimation);
        function onContextLost(event) {
            event.preventDefault();
            contextLost = true;
            canvas.style.visibility = 'hidden';
            syncAnimation();
        }
        function onContextRestored() {
            contextLost = false;
            needsResize = true;
            canvas.style.visibility = '';
            syncAnimation();
        }
        canvas.addEventListener('webglcontextlost', onContextLost);
        canvas.addEventListener('webglcontextrestored', onContextRestored);

        syncAnimation();

        return {
            dispose() {
                cancelAnimationFrame(frameId);
                window.removeEventListener('resize', onResize);
                document.removeEventListener('visibilitychange', syncAnimation);
                reducedMotion.removeEventListener('change', syncAnimation);
                canvas.removeEventListener('webglcontextlost', onContextLost);
                canvas.removeEventListener('webglcontextrestored', onContextRestored);
                renderer.dispose();
                geometry.dispose();
                material.dispose();
                canvas.remove();
            },
        };
    }

    return { dispose() {} };
}
