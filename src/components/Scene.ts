import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import anime from 'animejs/lib/anime.es.js';

// Define distortion shader - keeping the original implementation
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

/**
 * Helper function to check if we're on the home page
 */
function isHomePage() {
    return window.location.pathname === '/' || window.location.pathname === '';
}

export class Scene {
    private scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    public logo: THREE.Group | null = null;
    public isTransitioning: boolean = false;
    private composer: EffectComposer;
    public initialLogoPosition: THREE.Vector3 | null = null;
    public initialLogoRotation: THREE.Euler | null = null;
    private isMenuOpen: boolean = false;
    private mainBeam!: THREE.SpotLight;
    private beamMesh!: THREE.Mesh;
    private secondaryBeamMesh!: THREE.Mesh;
    public distortionPass!: ShaderPass;
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
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.65,  // Moderate strength
            0.4,   // Moderate radius
            0.85
        );
        this.composer.addPass(bloomPass);

        // Add custom distortion shader
        this.distortionPass = new ShaderPass(distortionShader);
        this.distortionPass.uniforms["uDistortionAmount"].value = 0.0; // Start with no distortion
        this.composer.addPass(this.distortionPass);

        this.setupScene();
        this.setupParticles();
        this.setupGrid();
        this.animate();
        this.handleResize();
        this.setupMouseTracking();
        this.setupMenuNavigation();

        // Register this instance globally for access by other modules
        window.sceneInstance = this;
    }

    /**
     * Setup menu navigation click handling
     */
    private setupMenuNavigation() {
        // Add event listener to all menu items
        const menuItems = document.querySelectorAll('.menu nav ul li a:not(.strike)');
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                // Animate menu away when navigating
                this.animateMenuAway();
            });
        });
    }

    /**
     * Animate the menu away when navigating
     */
    private animateMenuAway() {
        const menu = document.getElementById('menu');
        if (!menu || !menu.classList.contains('visible')) return;

        // Animate menu items out
        anime({
            targets: '.menu nav ul li',
            translateY: [0, -20],
            opacity: [1, 0],
            duration: 400,
            delay: anime.stagger(50, { direction: 'reverse' }),
            easing: 'easeOutQuad'
        });

        // Then fade out menu
        anime({
            targets: menu,
            opacity: 0,
            duration: 500,
            easing: 'easeOutQuad',
            complete: () => {
                menu.classList.add('hidden');
                menu.classList.remove('visible');
            }
        });
    }

    private setupScene() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        this.mainBeam = new THREE.SpotLight(0xffffff, 120);
        this.mainBeam.position.set(0, 15, 8);
        this.mainBeam.angle = Math.PI / 4.5;
        this.mainBeam.penumbra = 0.4;
        this.mainBeam.decay = 0.9;
        this.mainBeam.distance = 30;
        this.mainBeam.castShadow = true;
        this.scene.add(this.mainBeam);

        const frontLight = new THREE.DirectionalLight(0xffffff, 0.8);
        frontLight.position.set(0, 0, 10);
        frontLight.castShadow = false;
        this.scene.add(frontLight);

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
                console.log('Model loaded successfully');
                this.logo = gltf.scene;

                const box = new THREE.Box3().setFromObject(this.logo);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());

                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 6 / maxDim;
                this.logo.scale.setScalar(scale);

                this.logo.position.sub(center.multiplyScalar(scale));
                this.scene.add(this.logo);

                this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
                this.cubeCamera = new THREE.CubeCamera(1, 1000, this.cubeRenderTarget);
                this.scene.add(this.cubeCamera);

                const envLight = new THREE.HemisphereLight(0xffffff, 0x404040, 0.8);
                this.scene.add(envLight);

                const logoMaterial = new THREE.MeshPhysicalMaterial({
                    color: 0xaaccff,
                    metalness: 0.85,
                    roughness: 0.2,
                    reflectivity: 0.8,
                    clearcoat: 0.8,
                    clearcoatRoughness: 0.2,
                    envMap: this.cubeRenderTarget.texture,
                    envMapIntensity: 1.0,
                    emissive: 0x101020,
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

                // Only show continue prompt on home page
                if (isHomePage()) {
                    this.showContinuePrompt();
                }

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
                this.hideLoadingScreen();

                // Create a simple fallback cube
                const geometry = new THREE.BoxGeometry(2, 2, 2);
                const material = new THREE.MeshStandardMaterial({ color: 0x6666ff, metalness: 0.8 });
                const cube = new THREE.Mesh(geometry, material);
                this.scene.add(cube);
                this.logo = new THREE.Group();
                this.logo.add(cube);
                this.scene.add(this.logo);
                this.initialLogoPosition = this.logo.position.clone();
                this.initialLogoRotation = this.logo.rotation.clone();

                // Only show continue prompt on home page
                if (isHomePage()) {
                    this.showContinuePrompt();
                }
            }
        );
    }

    private setupParticles() {
        const particleCount = 2000;
        this.particlesGeometry = new THREE.BufferGeometry();

        const positions = new Float32Array(particleCount * 3);
        const scales = new Float32Array(particleCount);
        const opacities = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
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

        const particleMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                attribute float scale;
                attribute float opacity;
                varying float vOpacity;
                uniform float uTime;

                void main() {
                    vec3 pos = position;
                    float offset = position.x + position.y + position.z;
                    pos.x += sin(uTime * 0.2 + offset * 0.1) * 0.5;
                    pos.y += cos(uTime * 0.3 + offset * 0.05) * 0.5;
                    pos.z += sin(uTime * 0.4 + offset * 0.07) * 0.5;

                    vOpacity = opacity * (0.5 + 0.5 * sin(uTime * 0.3 + offset * 0.2));

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = scale * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying float vOpacity;

                void main() {
                    float dist = length(gl_PointCoord - vec2(0.5));
                    float alpha = smoothstep(0.5, 0.3, dist) * vOpacity;

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
        this.particles.renderOrder = -1;
        this.scene.add(this.particles);
    }

    private setupGrid() {
        const size = 30;
        const gridGeometry = new THREE.PlaneGeometry(size, size, 32, 32);

        const gridMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                uniform float uTime;
                uniform vec2 uMouse;
                varying vec2 vUv;

                void main() {
                    vUv = uv;

                    vec3 pos = position;
                    float dist = distance(vec2(0.5), uv);
                    float ripple = sin(dist * 10.0 - uTime * 0.5) * 0.2;

                    float mouseStrength = 2.0;
                    float mouseDist = distance(uMouse, uv);
                    float mouseDeformation = smoothstep(0.5, 0.0, mouseDist) * mouseStrength;

                    pos.z += ripple * (1.0 - dist * 2.0);
                    pos.z += mouseDeformation * (1.0 - mouseDist * 2.0);

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                varying vec2 vUv;

                void main() {
                    vec2 grid = abs(fract(vUv * 15.0 - 0.5) - 0.5) / fwidth(vUv * 15.0);
                    float line = min(grid.x, grid.y);
                    float gridPattern = 1.0 - min(line, 1.0);

                    vec3 baseColor = vec3(0.2, 0.4, 0.8);
                    baseColor += 0.1 * sin(uTime * 0.2 + vUv.x * 5.0) * vec3(0.5, 0.0, 0.5);

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

    private setupMouseTracking() {
        window.addEventListener('mousemove', (e) => {
            this.mousePosition.x = e.clientX / window.innerWidth;
            this.mousePosition.y = 1 - (e.clientY / window.innerHeight);

            if (this.distortionPass) {
                this.distortionPass.uniforms.uMouse.value = this.mousePosition;
            }

            if (this.gridPlane && this.gridPlane.material instanceof THREE.ShaderMaterial) {
                this.gridPlane.material.uniforms.uMouse.value = this.mousePosition;
            }
        });
    }

    // Updated handleContinue method for Scene.ts

    public handleContinue() {
        // Check if we can open the menu
        if (this.isMenuOpen || this.isTransitioning) {
            console.log('Cannot handle continue: menu open or transitioning', {
                isMenuOpen: this.isMenuOpen,
                isTransitioning: this.isTransitioning
            });
            return;
        }
    
        // Only handle continue on home page
        if (!isHomePage()) {
            console.log('Cannot handle continue: not on home page');
            return;
        }
    
        console.log('Handling continue action - opening menu with animations');
        this.isTransitioning = true;
        const menu = document.getElementById('menu');
        const prompt = document.getElementById('continue-prompt');
    
        this.isMenuOpen = true;
    
        // Store current position for our animations
        const currentY = this.logo ? this.logo.position.y : 0;
    
        // Hide continue prompt with animation
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
        if (this.distortionPass) {
            anime({
                targets: this.distortionPass.uniforms.uDistortionAmount,
                value: [0, 0.1, 0],
                duration: 2000,
                easing: 'easeInOutQuad'
            });
        }
    
        // Only animate logo if it exists
        if (this.logo) {
            const timeline = anime.timeline({
                easing: 'easeInOutQuad'
            });
    
            timeline
                .add({
                    targets: this.logo.position,
                    y: currentY + 3,
                    duration: 1200,
                    easing: 'easeOutQuad'
                })
                .add({
                    targets: this.logo.rotation,
                    y: Math.PI * 3,
                    duration: 1200,
                    easing: 'easeInOutQuad'
                }, '-=1200')
                .add({
                    targets: this.logo.position,
                    y: currentY - 1,
                    duration: 800,
                    easing: 'easeOutBounce'
                })
                .add({
                    targets: this.logo.rotation,
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
                            // IMPORTANT FIX: Clear any inline opacity style before showing the menu
                            menu.style.opacity = '';
                            
                            // Ensure menu is visible first
                            menu.classList.remove('hidden');
                            menu.classList.add('visible');
    
                            // FIXED: Explicitly reset menu item styles
                            const menuItems = menu.querySelectorAll('nav ul li');
                            menuItems.forEach(item => {
                                (item as HTMLElement).style.opacity = '1';
                                (item as HTMLElement).style.transform = 'translateY(0)';
                            });
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
                        console.log('Menu animation complete, transitioning state:', this.isTransitioning);
                    }
                });
        } else {
            // If no logo, just show the menu
            if (menu) {
                // IMPORTANT FIX: Clear any inline opacity style before showing the menu
                menu.style.opacity = '';
                
                menu.classList.remove('hidden');
                menu.classList.add('visible');
    
                // FIXED: Explicitly reset menu item styles
                const menuItems = menu.querySelectorAll('nav ul li');
                menuItems.forEach(item => {
                    (item as HTMLElement).style.opacity = '1';
                    (item as HTMLElement).style.transform = 'translateY(0)';
                });
            }
    
            anime({
                targets: '.menu nav ul li',
                translateY: [20, 0],
                opacity: [0, 1],
                duration: 600,
                delay: anime.stagger(80),
                complete: () => {
                    this.isTransitioning = false;
                }
            });
        }
    }
    public closeMenu() {
        if (this.isTransitioning) {
            console.log('Cannot close menu: transitioning');
            return;
        }
    
        if (!this.isMenuOpen) {
            console.log('Cannot close menu: menu not open');
            return;
        }
    
        this.isTransitioning = true;
    
        const menu = document.getElementById('menu');
    
        // Only animate logo if it exists and we're on the home page
        if (this.logo && isHomePage()) {
            const currentY = this.logo.position.y;
    
            // Add distortion effect when closing menu
            if (this.distortionPass) {
                anime({
                    targets: this.distortionPass.uniforms.uDistortionAmount,
                    value: [0, 0.15, 0],
                    duration: 1500,
                    easing: 'easeInOutQuad'
                });
            }
    
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
                            
                            // IMPORTANT FIX: Schedule a cleanup of inline styles
                            setTimeout(() => {
                                if (menu) menu.style.opacity = '';
                            }, 100);
                        }
                    }
                })
                .add({
                    targets: this.logo.position,
                    y: currentY + 2,
                    duration: 800,
                    easing: 'easeOutQuad'
                })
                .add({
                    targets: this.logo.rotation,
                    y: this.initialLogoRotation ? this.initialLogoRotation.y : 0,
                    duration: 1200,
                    easing: 'easeInOutQuad'
                }, '-=800')
                .add({
                    targets: this.logo.position,
                    y: this.initialLogoPosition ? this.initialLogoPosition.y : 0,
                    duration: 1000,
                    easing: 'easeOutElastic(1, 0.8)',
                    complete: () => {
                        this.isTransitioning = false;
                        this.isMenuOpen = false;
    
                        // Show continue prompt again
                        this.showContinuePrompt();
                        console.log('Menu closed, transitioning state:', this.isTransitioning);
                    }
                });
        } else {
            // Simpler animation if no logo or not on home page
            anime({
                targets: '.menu nav ul li',
                translateY: [0, -20],
                opacity: [1, 0],
                duration: 400,
                delay: anime.stagger(50, { direction: 'reverse' })
            });
    
            anime({
                targets: '.menu',
                opacity: 0,
                duration: 400,
                complete: () => {
                    if (menu) {
                        menu.classList.add('hidden');
                        menu.classList.remove('visible');
                        
                        // IMPORTANT FIX: Schedule a cleanup of inline styles
                        setTimeout(() => {
                            if (menu) menu.style.opacity = '';
                        }, 100);
                    }
    
                    this.isTransitioning = false;
                    this.isMenuOpen = false;
    
                    // Only show continue prompt on home page
                    if (isHomePage()) {
                        this.showContinuePrompt();
                    }
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
            // Apply different animations based on menu state
            if (this.isMenuOpen && !this.isTransitioning) {
                // Menu open animation
                this.logo.rotation.y += 0.0005;
                const pulseIntensity = Math.sin(time * 0.5) * 0.3 + 0.7;
                this.mainBeam.intensity = 120 + (30 * pulseIntensity);
                (this.beamMesh.material as THREE.MeshBasicMaterial).opacity = 0.2 + (0.1 * pulseIntensity);
                (this.secondaryBeamMesh.material as THREE.MeshBasicMaterial).opacity = 0.15 + (0.05 * pulseIntensity);
                this.scene.fog = new THREE.FogExp2(0x000000, 0.004 + (0.001 * pulseIntensity));

                // Subtle glow animation
                this.logo.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhysicalMaterial) {
                        child.material.emissiveIntensity = 0.1 + 0.05 * pulseIntensity;
                    }
                });
            } else if (!this.isTransitioning) {
                // Idle state animation
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
                this.logo.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhysicalMaterial) {
                        child.material.emissiveIntensity = 0.08 + 0.03 * breatheIntensity;
                    }
                });
            }

            // Update environment map periodically for better reflections
            if (Math.floor(time * 10) % 10 === 0) {
                this.updateLogoEnvMap();
            }
        }

        this.composer.render();
    }

    public prepareForTransition() {
        if (!this.logo) return;

        console.log('Preparing for transition');
        this.isTransitioning = true;

        // Set transition direction based on current state
        if (this.isMenuOpen) {
            this.transitionDirection = 'out';
        } else {
            this.transitionDirection = 'in';
        }

        // Add visual effects during page transitions
        if (this.distortionPass) {
            anime({
                targets: this.distortionPass.uniforms.uDistortionAmount,
                value: [0, 0.2, 0],
                duration: 1000,
                easing: 'easeInOutQuad'
            });
        }

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
        } else if (this.logo) {  // Fixed TypeScript null check
            anime({
                targets: this.logo.scale,
                x: this.logo.scale.x * 1.2,
                y: this.logo.scale.y * 1.2,
                z: this.logo.scale.z * 1.2,
                duration: 500,
                easing: 'easeOutQuad',
                complete: () => {
                    if (this.logo) {  // Additional null check for callback
                        anime({
                            targets: this.logo.scale,
                            x: this.logo.scale.x / 1.2,
                            y: this.logo.scale.y / 1.2,
                            z: this.logo.scale.z / 1.2,
                            duration: 800,
                            easing: 'easeOutElastic(1, 0.5)'
                        });
                    }
                }
            });
        }

        // Make sure we reset transition state after animation
        setTimeout(() => {
            this.resetTransitionState();
        }, 800);
    }

    // Just the resetTransitionState method update for Scene.ts

    // Corrected resetTransitionState method for Scene.ts

    public resetTransitionState() {
        console.log('Explicitly resetting transition state from:', this.isTransitioning, 'to false');
        this.isTransitioning = false;

        // Completely reset the menu state if needed
        if (isHomePage()) {
            // On home page, reset menu state
            const menu = document.getElementById('menu');
            if (menu) {
                if (menu.classList.contains('visible')) {
                    this.isMenuOpen = true;
                } else {
                    this.isMenuOpen = false;
                    // Show continue prompt if menu isn't open
                    this.showContinuePrompt();
                }
            }

            // Force event handler reinitialization
            if (window.EventHandler && typeof window.EventHandler.initialize === 'function') {
                console.log('Reinitializing event handlers after navigation');
                window.EventHandler.initialize();
            }
        }
    }

    // A special method to handle returning to the home page from a subpage
    public handleReturnToHome() {
        console.log('Handling return to home page');
    
        // Reset critical state flags
        this.isTransitioning = false;
        this.isMenuOpen = false;
    
        // Reset logo position if needed
        if (this.logo && this.initialLogoPosition && this.initialLogoRotation) {
            // Cancel any existing animations
            anime.remove(this.logo.position);
            anime.remove(this.logo.rotation);
    
            // Reset the logo to its initial state
            this.logo.position.copy(this.initialLogoPosition);
            this.logo.rotation.copy(this.initialLogoRotation);
    
            // Set balanced lighting values for default state
            this.mainBeam.intensity = 100;
            (this.beamMesh.material as THREE.MeshBasicMaterial).opacity = 0.18;
            (this.secondaryBeamMesh.material as THREE.MeshBasicMaterial).opacity = 0.12;
            this.scene.fog = new THREE.FogExp2(0x000000, 0.004);
        }
    
        // IMPORTANT FIX: Reset the menu's inline styles
        const menu = document.getElementById('menu');
        if (menu) {
            // Remove any inline styles that might override CSS transitions
            menu.style.opacity = '';
            menu.classList.remove('visible');
            menu.classList.add('hidden');
            
            // Also reset menu items to ensure they're ready for the next animation
            const menuItems = menu.querySelectorAll('nav ul li');
            menuItems.forEach(item => {
                (item as HTMLElement).style.opacity = '';
                (item as HTMLElement).style.transform = '';
            });
        }
    
        // Show continue prompt
        this.showContinuePrompt();
    
        // Force event handler reinitialization
        if (window.EventHandler && typeof window.EventHandler.initialize === 'function') {
            window.EventHandler.initialize();
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
                    child.material.envMap = this.cubeRenderTarget?.texture || null;
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
        // Only show on home page
        if (!isHomePage()) return;

        const prompt = document.getElementById('continue-prompt');
        if (!prompt) return;

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