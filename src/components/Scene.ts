// src/components/Scene.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import anime from 'animejs/lib/anime.es.js';

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
    private mainBeam: THREE.SpotLight;
    private beamMesh: THREE.Mesh;
    private secondaryBeamMesh: THREE.Mesh;

    constructor(container: HTMLElement) {
        console.log("Constructing Scene");

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.005); // Reduced fog density

        this.camera = new THREE.PerspectiveCamera(
            45, // Reduced FOV for better perspective
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
        this.renderer.setPixelRatio(window.devicePixelRatio); // Full resolution
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Very important: the renderer canvas must be added to the container
        container.appendChild(this.renderer.domElement);

        // Enhanced post-processing
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.5,
            0.4,
            0.85
        );
        this.composer.addPass(bloomPass);

        this.setupScene();
        this.animate();
        this.handleResize();
        this.setupInteractions();
    }

    private setupScene() {
        // Enhanced lighting setup
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambientLight);

        // Enhanced beam setup
        this.mainBeam = new THREE.SpotLight(0xffffff, 150);
        this.mainBeam.position.set(0, 15, 5);
        this.mainBeam.angle = Math.PI / 5;
        this.mainBeam.penumbra = 0.3;
        this.mainBeam.decay = 1.2;
        this.mainBeam.distance = 25;
        this.mainBeam.castShadow = true;
        this.scene.add(this.mainBeam);

        // Enhanced volumetric beam effect
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

        // Enhanced secondary beam
        this.secondaryBeamMesh = this.beamMesh.clone();
        const secondaryMaterial = beamMaterial.clone();
        secondaryMaterial.opacity = 0.1;
        secondaryMaterial.color.setHex(0x6666ff);
        this.secondaryBeamMesh.material = secondaryMaterial;
        this.secondaryBeamMesh.scale.set(1.8, 1.2, 1.8);
        this.scene.add(this.secondaryBeamMesh);

        // Camera setup for better view
        this.camera.position.set(0, 1, 12); // Moved camera back
        this.camera.lookAt(0, 0, 0);

        // Load logo with path
        const loader = new GLTFLoader();

        // Check if model file exists in the public directory
        // Adjust the path as needed - this should match where you place your model
        const modelPath = '/glass-like-logo-2.glb';

        console.log('Loading model from:', modelPath);

        loader.load(
            modelPath,
            (gltf) => {
                console.log('Model loaded successfully:', gltf);
                this.logo = gltf.scene;

                // Center and scale the model
                const box = new THREE.Box3().setFromObject(this.logo);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());

                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 6 / maxDim; // Increased scale
                this.logo.scale.setScalar(scale);

                this.logo.position.sub(center.multiplyScalar(scale));
                this.scene.add(this.logo);

                const logoMaterial = new THREE.MeshStandardMaterial({
                    metalness: 1.0,
                });

                this.logo.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.material = logoMaterial;
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                // Store initial position and rotation
                this.initialLogoPosition = this.logo.position.clone();
                this.initialLogoRotation = this.logo.rotation.clone();

                this.hideLoadingScreen();
                this.showContinuePrompt();
            },
            (progress) => {
                const percentComplete = (progress.loaded / progress.total) * 100;
                console.log('Loading progress:', percentComplete.toFixed(2) + '%');
            },
            (error) => {
                console.error('Error loading model:', error);
                console.error('Model path attempted:', modelPath);

                // Hide loading screen even if there's an error
                this.hideLoadingScreen();

                // Create a fallback cube if model loading fails
                const geometry = new THREE.BoxGeometry(2, 2, 2);
                const material = new THREE.MeshStandardMaterial({ color: 0x6666ff, metalness: 0.8 });
                const cube = new THREE.Mesh(geometry, material);
                this.scene.add(cube);
                this.logo = new THREE.Group();
                this.logo.add(cube);
                this.scene.add(this.logo);

                // Store initial position and rotation
                this.initialLogoPosition = this.logo.position.clone();
                this.initialLogoRotation = this.logo.rotation.clone();

                this.showContinuePrompt();
            }
        );
    }

    private setupInteractions() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this.isTransitioning) {
                this.handleContinue();
            }
        });

        window.addEventListener('click', (e) => {
            if (this.logo && !this.isTransitioning) {
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

    private handleContinue() {
        if (this.isMenuOpen || this.isTransitioning) return;

        this.isTransitioning = true;
        const menu = document.getElementById('menu');
        const prompt = document.getElementById('continue-prompt');

        this.isMenuOpen = true;
        const currentY = this.logo!.position.y;

        // Smooth prompt fade out animation
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
                y: Math.PI * 3, // Increased rotation
                duration: 1200, // Faster rotation
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

        // Close menu animation
        const closeMenu = () => {
            if (!this.isTransitioning && this.isMenuOpen) {
                this.isTransitioning = true;

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
                    // Return animation with up/down motion
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

        // Add menu close handlers
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

        if (this.logo) {
            const time = performance.now() * 0.001;

            if (this.isMenuOpen && !this.isTransitioning) {
                // Enhanced background effects
                this.logo.rotation.y += 0.0005;

                // Pulsing beam effect
                const pulseIntensity = Math.sin(time * 0.5) * 0.3 + 0.7;
                this.mainBeam.intensity = 150 + (50 * pulseIntensity);

                // Dynamic beam opacity
                (this.beamMesh.material as THREE.MeshBasicMaterial).opacity = 0.2 + (0.1 * pulseIntensity);
                (this.secondaryBeamMesh.material as THREE.MeshBasicMaterial).opacity = 0.1 + (0.05 * pulseIntensity);

                // Dynamic fog density
                this.scene.fog = new THREE.FogExp2(0x000000, 0.005 + (0.002 * pulseIntensity));
            } else if (!this.isTransitioning) {
                // Normal animation state
                this.logo.rotation.y += 0.001;
                this.logo.position.y = Math.sin(time * 0.5) * 0.1 + Math.sin(time * 0.2) * 0.03;
                this.logo.rotation.x = Math.sin(time * 0.3) * 0.02;
                this.logo.rotation.z = Math.cos(time * 0.2) * 0.02;

                // Reset effects
                this.mainBeam.intensity = 100;
                (this.beamMesh.material as THREE.MeshBasicMaterial).opacity = 0.15;
                (this.secondaryBeamMesh.material as THREE.MeshBasicMaterial).opacity = 0.08;
                this.scene.fog = new THREE.FogExp2(0x000000, 0.005);
            }
        }

        this.composer.render();
    }

    // Method to handle page transitions
    public prepareForTransition() {
        if (this.logo) {
            // During transitions, just keep rotating gently
            this.isTransitioning = true;

            // Cancel any active animations
            anime.remove(this.logo.position);
            anime.remove(this.logo.rotation);

            // After a short delay, we'll return to normal animations
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

            // Split text for letter animation
            const text = prompt.textContent || '';
            prompt.innerHTML = text.split('').map(char =>
                char === ' ' ? ' ' : `<span>${char}</span>`
            ).join('');

            // Staggered letter animation
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
                    prompt.style.opacity = '1'; // Enable CSS animation
                }
            }, '-=400');
        }
    }
}
