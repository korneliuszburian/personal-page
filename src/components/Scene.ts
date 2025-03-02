import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import anime from 'animejs/lib/anime.es.js';
import { isMenuInteractionAllowed } from '../utils/menuState.js';

const distortionShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "uTime": { value: 0 },
        "uDistortionAmount": { value: 0.0 },
        "uDistortionScale": { value: 10.0 },
        "uMouse": { value: new THREE.Vector2(0.5, 0.5) }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uDistortionAmount;
        uniform float uDistortionScale;
        uniform vec2 uMouse;
        varying vec2 vUv;

        void main() {
            // Create distortion effect using sine waves
            vec2 distortion = vec2(
                sin(vUv.y * uDistortionScale + uTime * 0.5) * uDistortionAmount,
                sin(vUv.x * uDistortionScale + uTime * 0.5) * uDistortionAmount
            );

            // Apply mouse influence (interactive)
            float mouseDistance = distance(vUv, uMouse);
            float mouseInfluence = smoothstep(0.5, 0.0, mouseDistance) * 0.05;
            vec2 mouseDistortion = normalize(vUv - uMouse) * mouseInfluence * uDistortionAmount * 5.0;

            // Combine effects
            vec2 distortedUv = vUv + distortion + mouseDistortion;

            // Sample the texture with our distorted coordinates
            vec4 color = texture2D(tDiffuse, distortedUv);

            // Add subtle color aberration
            float aberrationAmount = 0.003 * uDistortionAmount;
            color.r = texture2D(tDiffuse, distortedUv + vec2(aberrationAmount, 0.0)).r;
            color.b = texture2D(tDiffuse, distortedUv - vec2(aberrationAmount, 0.0)).b;

            gl_FragColor = color;
        }
    `
};

export class Scene {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private logo: THREE.Group | null = null;
    private isTransitioning: boolean = false;
    private composer: EffectComposer;
    private initialLogoPosition: THREE.Vector3 | null = null;
    private initialLogoRotation: THREE.Euler | null = null;
    private isMenuOpen: boolean = false;
    private mainBeam!: THREE.SpotLight;
    private beamMesh!: THREE.Mesh;
    private secondaryBeamMesh!: THREE.Mesh;
    private distortionPass!: ShaderPass;
    private particles: THREE.Points | null = null;
    private particlesGeometry: THREE.BufferGeometry | null = null;
    private mousePosition: THREE.Vector2 = new THREE.Vector2(0.5, 0.5);
    private clock: THREE.Clock = new THREE.Clock();
    private transitionDirection: 'in' | 'out' = 'in';
    private gridPlane: THREE.Mesh | null = null;
    private cubeCamera: THREE.CubeCamera | null = null;
    private cubeRenderTarget: THREE.WebGLCubeRenderTarget | null = null;

    constructor(container: HTMLElement) {
        console.log("Constructing Scene");

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.004); // Balanced fog density

        this.camera = new THREE.PerspectiveCamera(
            45,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        container.appendChild(this.renderer.domElement);

        // Post-processing setup
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // Add bloom effect
        // More balanced bloom effect
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.65,  // Moderate strength
            0.4,   // Moderate radius
            0.85
        );
        this.composer.addPass(bloomPass);

        // Add custom distortion shader (inspired by Codrops distorted-sphere-custom-material)
        this.distortionPass = new ShaderPass(distortionShader);
        this.distortionPass.uniforms["uDistortionAmount"].value = 0.0; // Start with no distortion
        this.composer.addPass(this.distortionPass);

        this.setupScene();
        this.setupParticles(); // Add particle system (inspired by codrops-dreamy-particles)
        this.setupGrid(); // Add grid (inspired by grid-deformation-effect)
        this.animate();
        this.handleResize();
        this.setupInteractions();
        this.setupMouseTracking();
    }

    private setupScene() {
        // Balanced ambient light - not too dark, not too bright
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // More balanced main spotlight
        this.mainBeam = new THREE.SpotLight(0xffffff, 120);
        this.mainBeam.position.set(0, 15, 8);
        this.mainBeam.angle = Math.PI / 4.5;
        this.mainBeam.penumbra = 0.4;
        this.mainBeam.decay = 0.9;
        this.mainBeam.distance = 30;
        this.mainBeam.castShadow = true;
        this.scene.add(this.mainBeam);

        // Subtler front light
        const frontLight = new THREE.DirectionalLight(0xffffff, 0.8);
        frontLight.position.set(0, 0, 10);
        frontLight.castShadow = false;
        this.scene.add(frontLight);

        // Subtle rim lights for definition
        const rimLight1 = new THREE.DirectionalLight(0xa0c0ff, 0.5);
        rimLight1.position.set(10, 3, 5);
        this.scene.add(rimLight1);

        const rimLight2 = new THREE.DirectionalLight(0xf0f8ff, 0.5);
        rimLight2.position.set(-10, 3, 5);
        this.scene.add(rimLight2);

        const beamGeometry = new THREE.CylinderGeometry(0.2, 2.5, 15, 32, 1, true);
        const beamMaterial = new THREE.MeshBasicMaterial({
            color: 0x4444ff,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        this.beamMesh = new THREE.Mesh(beamGeometry, beamMaterial);
        this.beamMesh.position.copy(this.mainBeam.position);
        this.beamMesh.rotation.x = Math.PI;
        this.scene.add(this.beamMesh);

        this.secondaryBeamMesh = this.beamMesh.clone();
        const secondaryMaterial = beamMaterial.clone();
        secondaryMaterial.opacity = 0.1;
        secondaryMaterial.color.setHex(0x6666ff);
        this.secondaryBeamMesh.material = secondaryMaterial;
        this.secondaryBeamMesh.scale.set(1.8, 1.2, 1.8);
        this.scene.add(this.secondaryBeamMesh);

        this.camera.position.set(0, 1, 12);
        this.camera.lookAt(0, 0, 0);

        const loader = new GLTFLoader();
        const modelPath = '/glass-like-logo-2.glb';
        console.log('Loading model from:', modelPath);

        loader.load(
            modelPath,
            (gltf) => {
                console.log('Model loaded successfully:', gltf);
                this.logo = gltf.scene;

                const box = new THREE.Box3().setFromObject(this.logo);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());

                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 6 / maxDim;
                this.logo.scale.setScalar(scale);

                this.logo.position.sub(center.multiplyScalar(scale));
                this.scene.add(this.logo);

                // Create environment map for reflections
                this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
                this.cubeCamera = new THREE.CubeCamera(1, 1000, this.cubeRenderTarget);
                this.scene.add(this.cubeCamera);

                // More balanced hemisphere light
                const envLight = new THREE.HemisphereLight(0xffffff, 0x404040, 0.8);
                this.scene.add(envLight);

                // Balanced material - visible but not too bright
                const logoMaterial = new THREE.MeshPhysicalMaterial({
                    color: 0xaaccff, // Slightly bluish tint
                    metalness: 0.85,
                    roughness: 0.2,  // Still fairly reflective
                    reflectivity: 0.8,
                    clearcoat: 0.8,
                    clearcoatRoughness: 0.2,
                    envMap: this.cubeRenderTarget.texture,
                    envMapIntensity: 1.0,
                    emissive: 0x101020, // Very subtle self-illumination
                    emissiveIntensity: 0.1
                });

                this.logo.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.material = logoMaterial;
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                this.initialLogoPosition = this.logo.position.clone();
                this.initialLogoRotation = this.logo.rotation.clone();

                this.hideLoadingScreen();
                this.showContinuePrompt();

                // Create a subtle entrance animation
                this.logo.scale.set(0.01, 0.01, 0.01);
                this.logo.rotation.y = Math.PI * 2;
                anime({
                    targets: this.logo.scale,
                    x: scale,
                    y: scale,
                    z: scale,
                    duration: 1500,
                    easing: 'easeOutElastic(1, 0.5)'
                });
                anime({
                    targets: this.logo.rotation,
                    y: 0,
                    duration: 1500,
                    easing: 'easeOutQuad'
                });
            },
            (progress) => {
                const percentComplete = (progress.loaded / progress.total) * 100;
                console.log('Loading progress:', percentComplete.toFixed(2) + '%');
            },
            (error) => {
                console.error('Error loading model:', error);
                console.error('Model path attempted:', modelPath);
                this.hideLoadingScreen();
                const geometry = new THREE.BoxGeometry(2, 2, 2);
                const material = new THREE.MeshStandardMaterial({ color: 0x6666ff, metalness: 0.8 });
                const cube = new THREE.Mesh(geometry, material);
                this.scene.add(cube);
                this.logo = new THREE.Group();
                this.logo.add(cube);
                this.scene.add(this.logo);
                this.initialLogoPosition = this.logo.position.clone();
                this.initialLogoRotation = this.logo.rotation.clone();
                this.showContinuePrompt();
            }
        );
    }

    // Setup particle system inspired by codrops-dreamy-particles
    private setupParticles() {
        const particleCount = 2000;
        this.particlesGeometry = new THREE.BufferGeometry();

        const positions = new Float32Array(particleCount * 3);
        const scales = new Float32Array(particleCount);
        const opacities = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
            // Position particles in a spherical volume
            const radius = 20 + Math.random() * 30;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);

            scales[i] = Math.random() * 0.5 + 0.1;
            opacities[i] = Math.random() * 0.5 + 0.1;
        }

        this.particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.particlesGeometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
        this.particlesGeometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

        // Create custom shader material for particles
        const particleMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                attribute float scale;
                attribute float opacity;
                varying float vOpacity;
                uniform float uTime;

                void main() {
                    // Animate particles
                    vec3 pos = position;
                    float offset = position.x + position.y + position.z;
                    pos.x += sin(uTime * 0.2 + offset * 0.1) * 0.5;
                    pos.y += cos(uTime * 0.3 + offset * 0.05) * 0.5;
                    pos.z += sin(uTime * 0.4 + offset * 0.07) * 0.5;

                    // Pass to fragment shader
                    vOpacity = opacity * (0.5 + 0.5 * sin(uTime * 0.3 + offset * 0.2));

                    // Calculate position
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = scale * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying float vOpacity;

                void main() {
                    // Circular particle with soft edge
                    float dist = length(gl_PointCoord - vec2(0.5));
                    float alpha = smoothstep(0.5, 0.3, dist) * vOpacity;

                    // Blue/purple glow color
                    vec3 color = mix(vec3(0.3, 0.4, 1.0), vec3(0.5, 0.2, 1.0), vOpacity);

                    gl_FragColor = vec4(color, alpha);
                }
            `,
            uniforms: {
                uTime: { value: 0 }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.particles = new THREE.Points(this.particlesGeometry, particleMaterial);
        this.particles.renderOrder = -1; // Render before other objects
        this.scene.add(this.particles);
    }

    // Setup grid inspired by grid-deformation-effect
    private setupGrid() {
        const size = 30;
        const gridGeometry = new THREE.PlaneGeometry(size, size, 32, 32);

        // Custom grid material with distortion
        const gridMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                uniform float uTime;
                uniform vec2 uMouse;
                varying vec2 vUv;

                void main() {
                    vUv = uv;

                    // Create ripple effect from center
                    vec3 pos = position;
                    float dist = distance(vec2(0.5), uv);
                    float ripple = sin(dist * 10.0 - uTime * 0.5) * 0.2;

                    // Mouse influence
                    float mouseStrength = 2.0;
                    float mouseDist = distance(uMouse, uv);
                    float mouseDeformation = smoothstep(0.5, 0.0, mouseDist) * mouseStrength;

                    // Apply deformations only to z-axis
                    pos.z += ripple * (1.0 - dist * 2.0);
                    pos.z += mouseDeformation * (1.0 - mouseDist * 2.0);

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                varying vec2 vUv;

                void main() {
                    // Create grid pattern
                    vec2 grid = abs(fract(vUv * 15.0 - 0.5) - 0.5) / fwidth(vUv * 15.0);
                    float line = min(grid.x, grid.y);
                    float gridPattern = 1.0 - min(line, 1.0);

                    // Add some animated color variation
                    vec3 baseColor = vec3(0.2, 0.4, 0.8);
                    baseColor += 0.1 * sin(uTime * 0.2 + vUv.x * 5.0) * vec3(0.5, 0.0, 0.5);

                    // Apply grid pattern with a glow effect
                    vec3 finalColor = mix(baseColor * 0.3, baseColor, gridPattern);
                    float alpha = 0.1 + gridPattern * 0.3;

                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            uniforms: {
                uTime: { value: 0 },
                uMouse: { value: new THREE.Vector2(0.5, 0.5) }
            },
            transparent: true,
            side: THREE.DoubleSide,
            wireframe: false,
            blending: THREE.AdditiveBlending
        });

        this.gridPlane = new THREE.Mesh(gridGeometry, gridMaterial);
        this.gridPlane.position.set(0, -5, 0);
        this.gridPlane.rotation.x = -Math.PI / 2;
        this.gridPlane.receiveShadow = true;
        this.scene.add(this.gridPlane);
    }

    private setupInteractions() {
        window.addEventListener('keydown', (e) => {
            // Only respond to space key if menu interaction is allowed (on home page)
            if (e.code === 'Space' && !this.isTransitioning && isMenuInteractionAllowed()) {
                this.handleContinue();
            }
        });

        window.addEventListener('click', (e) => {
            // Only respond to logo click if menu interaction is allowed (on home page)
            if (this.logo && !this.isTransitioning && isMenuInteractionAllowed()) {
                const raycaster = new THREE.Raycaster();
                const mouse = new THREE.Vector2(
                    (e.clientX / window.innerWidth) * 2 - 1,
                    -(e.clientY / window.innerHeight) * 2 + 1
                );
                raycaster.setFromCamera(mouse, this.camera);
                const intersects = raycaster.intersectObject(this.logo, true);
                if (intersects.length > 0) {
                    this.handleContinue();
                }
            }
        });
    }

    private setupMouseTracking() {
        // Track mouse for interactive effects
        window.addEventListener('mousemove', (e) => {
            // Convert mouse position to normalized coordinates (0-1)
            this.mousePosition.x = e.clientX / window.innerWidth;
            this.mousePosition.y = 1 - (e.clientY / window.innerHeight);

            // Update shader uniforms that use mouse position
            if (this.distortionPass) {
                this.distortionPass.uniforms.uMouse.value = this.mousePosition;
            }

            if (this.gridPlane && this.gridPlane.material instanceof THREE.ShaderMaterial) {
                this.gridPlane.material.uniforms.uMouse.value = this.mousePosition;
            }
        });
    }

    private handleContinue() {
        if (this.isMenuOpen || this.isTransitioning) return;
        this.isTransitioning = true;
        const menu = document.getElementById('menu');
        const prompt = document.getElementById('continue-prompt');

        this.isMenuOpen = true;
        const currentY = this.logo!.position.y;

        if (prompt) {
            anime({
                targets: prompt,
                opacity: [1, 0],
                translateY: [0, 30],
                scale: [1, 0.95],
                duration: 600,
                easing: 'easeOutExpo',
                complete: () => prompt.classList.add('hidden')
            });
        }

        // Start distortion effect during menu animation
        anime({
            targets: this.distortionPass.uniforms.uDistortionAmount,
            value: [0, 0.1, 0],
            duration: 2000,
            easing: 'easeInOutQuad'
        });

        const timeline = anime.timeline({
            easing: 'easeInOutQuad'
        });

        timeline
            .add({
                targets: this.logo!.position,
                y: currentY + 3,
                duration: 1200,
                easing: 'easeOutQuad'
            })
            .add({
                targets: this.logo!.rotation,
                y: Math.PI * 3,
                duration: 1200,
                easing: 'easeInOutQuad'
            }, '-=1200')
            .add({
                targets: this.logo!.position,
                y: currentY - 1,
                duration: 800,
                easing: 'easeOutBounce'
            })
            .add({
                targets: this.logo!.rotation,
                y: Math.PI * 4,
                duration: 1000,
                easing: 'easeOutQuad'
            }, '-=800')
            .add({
                targets: '#continue-prompt',
                opacity: 0,
                duration: 300
            }, '-=1000')
            .add({
                begin: () => {
                    if (menu) {
                        menu.classList.remove('hidden');
                        menu.classList.add('visible');
                    }
                }
            })
            .add({
                targets: '.menu nav ul li',
                translateY: [20, 0],
                opacity: [0, 1],
                duration: 600,
                delay: anime.stagger(80),
                complete: () => {
                    this.isTransitioning = false;
                }
            });

        const closeMenu = () => {
            if (!this.isTransitioning && this.isMenuOpen) {
                this.isTransitioning = true;

                // Add distortion effect when closing menu
                anime({
                    targets: this.distortionPass.uniforms.uDistortionAmount,
                    value: [0, 0.15, 0],
                    duration: 1500,
                    easing: 'easeInOutQuad'
                });

                const closeTimeline = anime.timeline({
                    easing: 'easeInOutQuad'
                });

                closeTimeline
                    .add({
                        targets: '.menu nav ul li',
                        translateY: [0, -20],
                        opacity: [1, 0],
                        duration: 400,
                        delay: anime.stagger(50, { direction: 'reverse' })
                    })
                    .add({
                        targets: '.menu',
                        opacity: 0,
                        duration: 400,
                        complete: () => {
                            if (menu) {
                                menu.classList.add('hidden');
                                menu.classList.remove('visible');
                            }
                        }
                    })
                    .add({
                        targets: this.logo!.position,
                        y: currentY + 2,
                        duration: 800,
                        easing: 'easeOutQuad'
                    })
                    .add({
                        targets: this.logo!.rotation,
                        y: this.initialLogoRotation!.y,
                        duration: 1200,
                        easing: 'easeInOutQuad'
                    }, '-=800')
                    .add({
                        targets: this.logo!.position,
                        y: this.initialLogoPosition!.y,
                        duration: 1000,
                        easing: 'easeOutElastic(1, 0.8)',
                        complete: () => {
                            this.isTransitioning = false;
                            this.isMenuOpen = false;
                        }
                    });
            }
        };

        if (menu) {
            menu.addEventListener('click', (e) => {
                if (e.target === menu) {
                    closeMenu();
                }
            });

            window.addEventListener('keydown', (e) => {
                if (e.code === 'Escape' && this.isMenuOpen) {
                    closeMenu();
                }
            });
        }
    }

    private animate = () => {
        requestAnimationFrame(this.animate);

        const time = this.clock.getElapsedTime();

        // Update shader uniforms with time
        if (this.distortionPass) {
            this.distortionPass.uniforms.uTime.value = time;
        }

        // Update particle animation
        if (this.particles && this.particles.material instanceof THREE.ShaderMaterial) {
            this.particles.material.uniforms.uTime.value = time;
        }

        // Update grid animation
        if (this.gridPlane && this.gridPlane.material instanceof THREE.ShaderMaterial) {
            this.gridPlane.material.uniforms.uTime.value = time;
        }

        if (this.logo) {
            // Balanced lighting with subtle pulsing effects
            if (this.isMenuOpen && !this.isTransitioning) {
                this.logo.rotation.y += 0.0005;
                const pulseIntensity = Math.sin(time * 0.5) * 0.3 + 0.7;
                this.mainBeam.intensity = 120 + (30 * pulseIntensity);
                (this.beamMesh.material as THREE.MeshBasicMaterial).opacity = 0.2 + (0.1 * pulseIntensity);
                (this.secondaryBeamMesh.material as THREE.MeshBasicMaterial).opacity = 0.15 + (0.05 * pulseIntensity);
                this.scene.fog = new THREE.FogExp2(0x000000, 0.004 + (0.001 * pulseIntensity));

                // Subtle glow animation
                if (this.logo) {
                    this.logo.traverse((child) => {
                        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhysicalMaterial) {
                            child.material.emissiveIntensity = 0.1 + 0.05 * pulseIntensity;
                        }
                    });
                }
            } else if (!this.isTransitioning) {
                this.logo.rotation.y += 0.001;
                this.logo.position.y = Math.sin(time * 0.5) * 0.1 + Math.sin(time * 0.2) * 0.03;
                this.logo.rotation.x = Math.sin(time * 0.3) * 0.02;
                this.logo.rotation.z = Math.cos(time * 0.2) * 0.02;

                // Balanced intensity for good visibility
                this.mainBeam.intensity = 100;
                (this.beamMesh.material as THREE.MeshBasicMaterial).opacity = 0.18;
                (this.secondaryBeamMesh.material as THREE.MeshBasicMaterial).opacity = 0.12;
                this.scene.fog = new THREE.FogExp2(0x000000, 0.004);

                // Very subtle breathing effect
                const breatheIntensity = Math.sin(time * 0.4) * 0.1 + 0.9;
                if (this.logo) {
                    this.logo.traverse((child) => {
                        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhysicalMaterial) {
                            child.material.emissiveIntensity = 0.08 + 0.03 * breatheIntensity;
                        }
                    });
                }
            }

            // Update environment map every few frames for better reflections
            if (Math.floor(time * 10) % 10 === 0) {
                this.updateLogoEnvMap();
            }
        }

        this.composer.render();
    }

    public prepareForTransition() {
        if (this.logo) {
            this.isTransitioning = true;

            // Set transition direction based on current state
            if (this.isMenuOpen) {
                this.transitionDirection = 'out';
            } else {
                this.transitionDirection = 'in';
            }

            // Add visual effects during page transitions
            anime({
                targets: this.distortionPass.uniforms.uDistortionAmount,
                value: [0, 0.2, 0],
                duration: 1000,
                easing: 'easeInOutQuad'
            });

            anime.remove(this.logo.position);
            anime.remove(this.logo.rotation);

            // Page transition animation
            if (this.transitionDirection === 'out') {
                anime({
                    targets: this.logo.scale,
                    x: this.logo.scale.x * 0.8,
                    y: this.logo.scale.y * 0.8,
                    z: this.logo.scale.z * 0.8,
                    duration: 500,
                    easing: 'easeInQuad'
                });

                anime({
                    targets: this.logo.position,
                    y: this.logo.position.y - 2,
                    duration: 500,
                    easing: 'easeInQuad'
                });
            } else {
                anime({
                    targets: this.logo.scale,
                    x: this.logo.scale.x * 1.2,
                    y: this.logo.scale.y * 1.2,
                    z: this.logo.scale.z * 1.2,
                    duration: 500,
                    easing: 'easeOutQuad',
                    complete: () => {
                        anime({
                            targets: this.logo.scale,
                            x: this.logo.scale.x / 1.2,
                            y: this.logo.scale.y / 1.2,
                            z: this.logo.scale.z / 1.2,
                            duration: 800,
                            easing: 'easeOutElastic(1, 0.5)'
                        });
                    }
                });
            }

            setTimeout(() => {
                this.isTransitioning = false;
            }, 800);
        }
    }

    private handleResize = () => {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.composer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    /**
     * Updates the environment map for the logo to enhance reflections
     */
    private updateLogoEnvMap() {
        if (this.logo && this.cubeCamera && this.cubeRenderTarget) {
            // Temporarily hide the logo for environment capture
            this.logo.visible = false;

            // Update the cube camera
            this.cubeCamera.update(this.renderer, this.scene);

            // Make the logo visible again
            this.logo.visible = true;

            // Update the material's environment map for all meshes in the logo
            this.logo.traverse((child) => {
                if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhysicalMaterial) {
                    child.material.envMap = this.cubeRenderTarget.texture;
                }
            });
        }
    }

    private hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }

    private showContinuePrompt() {
        const prompt = document.getElementById('continue-prompt');
        if (prompt) {
            prompt.classList.remove('hidden');
            const text = prompt.textContent || '';
            prompt.innerHTML = text.split('').map(char =>
                char === ' ' ? ' ' : `<span>${char}</span>`
            ).join('');

            anime.timeline({
                easing: 'easeOutElastic(1, 0.8)'
            })
            .add({
                targets: prompt,
                opacity: 1,
                translateY: [30, 0],
                duration: 800
            })
            .add({
                targets: '#continue-prompt span',
                translateY: [-20, 0],
                opacity: [0, 1],
                delay: anime.stagger(30),
                duration: 600,
                complete: () => {
                    prompt.style.opacity = '1';
                }
            }, '-=400');
        }
    }
}
