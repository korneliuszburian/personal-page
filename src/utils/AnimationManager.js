/**
 * AnimationManager.js
 * Centralized animation management for the application
 * Handles all animations to ensure consistency and prevent conflicts
 */
import anime from 'animejs/lib/anime.es.js';

class AnimationManagerClass {
  constructor() {
    // Store active animations for proper cleanup
    this._activeAnimations = new Map();

    // Animation timing configurations
    this.timings = {
      menuItemStagger: 80,
      distortionDuration: 1500,
      logoRotationDuration: 1200,
      promptFadeOutDuration: 600,
      menuFadeInDuration: 400,
      menuFadeOutDuration: 400
    };
  }

  /**
   * Clear all active animations or a specific group
   * @param {string} groupId - Optional group ID to clear
   */
  clearAnimations(groupId = null) {
    if (groupId && this._activeAnimations.has(groupId)) {
      // Clear specific animation group
      const animations = this._activeAnimations.get(groupId);
      console.log(`[AnimationManager] Clearing ${animations.length} animations in group '${groupId}'`);

      animations.forEach(anim => {
        if (anim && typeof anim.pause === 'function') {
          anim.pause();
        }
      });

      this._activeAnimations.delete(groupId);
    } else if (!groupId) {
      // Clear all animations
      console.log(`[AnimationManager] Clearing all animations from ${this._activeAnimations.size} groups`);

      this._activeAnimations.forEach(animations => {
        animations.forEach(anim => {
          if (anim && typeof anim.pause === 'function') {
            anim.pause();
          }
        });
      });

      this._activeAnimations.clear();
    }
  }

  /**
   * Add animation to tracking
   * @param {string} groupId - Group identifier for the animation
   * @param {Object} animation - AnimeJS animation instance
   */
  _trackAnimation(groupId, animation) {
    if (!this._activeAnimations.has(groupId)) {
      this._activeAnimations.set(groupId, []);
    }

    this._activeAnimations.get(groupId).push(animation);
    return animation;
  }

  /**
   * Animate distortion effect for transitions
   * @param {number} amount - Max distortion amount (0-1)
   * @param {number} duration - Animation duration in ms
   * @param {string} groupId - Animation group identifier
   */
  animateDistortion(amount, duration, groupId = 'distortion') {
    const sceneInstance = window.sceneInstance;

    if (sceneInstance && sceneInstance.distortionPass) {
      console.log(`[AnimationManager] Animating distortion effect: ${amount}`);

      const animation = anime({
        targets: sceneInstance.distortionPass.uniforms.uDistortionAmount,
        value: [0, amount, 0],
        duration: duration,
        easing: 'easeInOutQuad'
      });

      return this._trackAnimation(groupId, animation);
    }

    return null;
  }

  /**
   * Show menu with animation
   * @param {HTMLElement} menu - The menu element
   * @param {Function} onComplete - Callback when animation completes
   */
  animateMenuIn(menu, onComplete = null) {
    if (!menu) return null;

    console.log('[AnimationManager] Animating menu in');
    this.clearAnimations('menu');

    // Prepare menu for animation
    menu.classList.remove('hidden');
    menu.classList.add('visible');

    // Reset inline styles that might interfere
    menu.style.opacity = '';

    // Reset menu items for animation
    const menuItems = menu.querySelectorAll('nav ul li');
    menuItems.forEach(item => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(20px)';
    });

    // Animate menu items
    const animation = anime({
      targets: '.menu nav ul li',
      translateY: [20, 0],
      opacity: [0, 1],
      duration: 600,
      delay: anime.stagger(this.timings.menuItemStagger),
      easing: 'easeOutQuad',
      complete: () => {
        if (onComplete) onComplete();
      }
    });

    return this._trackAnimation('menu', animation);
  }

  /**
   * Hide menu with animation
   * @param {HTMLElement} menu - The menu element
   * @param {Function} onComplete - Callback when animation completes
   */
  animateMenuOut(menu, onComplete = null) {
    if (!menu) return null;

    console.log('[AnimationManager] Animating menu out');
    this.clearAnimations('menu');

    // Animate menu items out first
    const menuItems = anime({
      targets: '.menu nav ul li',
      translateY: [0, -20],
      opacity: [1, 0],
      duration: 400,
      delay: anime.stagger(50, { direction: 'reverse' }),
      easing: 'easeOutQuad'
    });

    this._trackAnimation('menu', menuItems);

    // Then fade out the menu background
    const menuBg = anime({
      targets: menu,
      opacity: 0,
      duration: this.timings.menuFadeOutDuration,
      easing: 'easeOutQuad',
      complete: () => {
        menu.classList.add('hidden');
        menu.classList.remove('visible');

        // Schedule cleanup of inline styles
        setTimeout(() => {
          if (menu) menu.style.opacity = '';

          // Reset menu items for next animation
          const items = menu.querySelectorAll('nav ul li');
          items.forEach(item => {
            item.style.opacity = '';
            item.style.transform = '';
          });
        }, 100);

        if (onComplete) onComplete();
      }
    });

    return this._trackAnimation('menu', menuBg);
  }

  /**
   * Animate logo for menu opening
   * @param {THREE.Group} logo - The 3D logo object
   * @param {Function} onComplete - Callback when animation completes
   */
  animateLogoForMenuOpen(logo, onComplete = null) {
    if (!logo) return null;

    console.log('[AnimationManager] Animating logo for menu open');
    this.clearAnimations('logo');

    // Store current position for reference
    const currentY = logo.position.y;

    // Create animation timeline
    const timeline = anime.timeline({
      easing: 'easeInOutQuad'
    });

    timeline
      // Move logo up with rotation
      .add({
        targets: logo.position,
        y: currentY + 3,
        duration: 1200,
        easing: 'easeOutQuad'
      })
      .add({
        targets: logo.rotation,
        y: Math.PI * 3,
        duration: this.timings.logoRotationDuration,
        easing: 'easeInOutQuad'
      }, '-=1200')
      // Move logo down with bounce
      .add({
        targets: logo.position,
        y: currentY - 1,
        duration: 800,
        easing: 'easeOutBounce'
      })
      .add({
        targets: logo.rotation,
        y: Math.PI * 4,
        duration: 1000,
        easing: 'easeOutQuad',
        complete: () => {
          if (onComplete) onComplete();
        }
      }, '-=800');

    return this._trackAnimation('logo', timeline);
  }

  /**
   * Animate logo for menu closing
   * @param {THREE.Group} logo - The 3D logo object
   * @param {Object} initialState - Initial logo state {position, rotation}
   * @param {Function} onComplete - Callback when animation completes
   */
  animateLogoForMenuClose(logo, initialState, onComplete = null) {
    if (!logo) return null;

    console.log('[AnimationManager] Animating logo for menu close');
    this.clearAnimations('logo');

    // Get values for animation
    const currentY = logo.position.y;
    const initialY = initialState.position ? initialState.position.y : 0;
    const initialRotationY = initialState.rotation ? initialState.rotation.y : 0;

    // Create animation timeline
    const timeline = anime.timeline({
      easing: 'easeInOutQuad'
    });

    timeline
      // Move logo up
      .add({
        targets: logo.position,
        y: currentY + 2,
        duration: 800,
        easing: 'easeOutQuad'
      })
      // Rotate logo back to initial rotation
      .add({
        targets: logo.rotation,
        y: initialRotationY,
        duration: this.timings.logoRotationDuration,
        easing: 'easeInOutQuad'
      }, '-=800')
      // Move logo to initial position with elastic effect
      .add({
        targets: logo.position,
        y: initialY,
        duration: 1000,
        easing: 'easeOutElastic(1, 0.8)',
        complete: () => {
          if (onComplete) onComplete();
        }
      });

    return this._trackAnimation('logo', timeline);
  }

  /**
   * Animate logo for page transition
   * @param {THREE.Group} logo - The 3D logo object
   * @param {string} direction - Transition direction ('in' or 'out')
   * @param {Function} onComplete - Callback when animation completes
   */
  animateLogoForPageTransition(logo, direction, onComplete = null) {
    if (!logo) return null;

    console.log(`[AnimationManager] Animating logo for page transition: ${direction}`);
    this.clearAnimations('logo');

    // Clear any existing position/rotation animations
    anime.remove(logo.position);
    anime.remove(logo.rotation);

    if (direction === 'out') {
      // Scale down and move down when leaving
      const scaleAnim = anime({
        targets: logo.scale,
        x: logo.scale.x * 0.8,
        y: logo.scale.y * 0.8,
        z: logo.scale.z * 0.8,
        duration: 500,
        easing: 'easeInQuad'
      });

      const posAnim = anime({
        targets: logo.position,
        y: logo.position.y - 2,
        duration: 500,
        easing: 'easeInQuad',
        complete: () => {
          if (onComplete) onComplete();
        }
      });

      this._trackAnimation('logo', scaleAnim);
      return this._trackAnimation('logo', posAnim);
    } else {
      // Scale up and bounce when entering
      return this._trackAnimation('logo', anime({
        targets: logo.scale,
        x: logo.scale.x * 1.2,
        y: logo.scale.y * 1.2,
        z: logo.scale.z * 1.2,
        duration: 500,
        easing: 'easeOutQuad',
        complete: () => {
          if (logo) {
            // Scale back down with elastic effect
            const bounceAnim = anime({
              targets: logo.scale,
              x: logo.scale.x / 1.2,
              y: logo.scale.y / 1.2,
              z: logo.scale.z / 1.2,
              duration: 800,
              easing: 'easeOutElastic(1, 0.5)',
              complete: () => {
                if (onComplete) onComplete();
              }
            });

            this._trackAnimation('logo', bounceAnim);
          } else if (onComplete) {
            onComplete();
          }
        }
      }));
    }
  }

  /**
   * Animate logo entrance (when first loaded)
   * @param {THREE.Group} logo - The 3D logo object
   * @param {Function} onComplete - Callback when animation completes
   */
  animateLogoEntrance(logo, onComplete = null) {
    if (!logo) return null;

    console.log('[AnimationManager] Animating logo entrance');
    this.clearAnimations('logo');

    // Store original scale
    const originalScale = logo.scale.x;

    // Start with tiny scale and full rotation
    logo.scale.set(0.01, 0.01, 0.01);
    logo.rotation.y = Math.PI * 2;

    // Scale up with elastic effect
    const scaleAnim = anime({
      targets: logo.scale,
      x: originalScale,
      y: originalScale,
      z: originalScale,
      duration: 1500,
      easing: 'easeOutElastic(1, 0.5)'
    });

    // Rotate to default position
    const rotateAnim = anime({
      targets: logo.rotation,
      y: 0,
      duration: 1500,
      easing: 'easeOutQuad',
      complete: () => {
        if (onComplete) onComplete();
      }
    });

    this._trackAnimation('logo', scaleAnim);
    return this._trackAnimation('logo', rotateAnim);
  }

  /**
   * Reset logo to initial state without animation
   * @param {THREE.Group} logo - The 3D logo object
   * @param {Object} initialState - Initial values {position, rotation}
   */
  resetLogoState(logo, initialState) {
    if (!logo || !initialState) return;

    console.log('[AnimationManager] Resetting logo state immediately');
    this.clearAnimations('logo');

    // Cancel any existing animations
    anime.remove(logo.position);
    anime.remove(logo.rotation);
    anime.remove(logo.scale);

    // Reset to initial values
    if (initialState.position) {
      logo.position.copy(initialState.position);
    }

    if (initialState.rotation) {
      logo.rotation.copy(initialState.rotation);
    }
  }

  /**
   * Create fade overlay for transitions
   * @param {string} direction - 'in' or 'out'
   * @param {Function} onComplete - Callback when animation completes
   */
  createTransitionOverlay(direction = 'in', onComplete = null) {
    console.log(`[AnimationManager] Creating ${direction} transition overlay`);

    // Create overlay element
    const overlay = document.createElement('div');
    overlay.classList.add('page-transition-overlay');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: #000;
      z-index: 999;
      pointer-events: none;
      opacity: ${direction === 'in' ? '0.8' : '0'};
      transition: opacity 0.4s ease;
    `;

    document.body.appendChild(overlay);

    // Animate overlay
    if (direction === 'in') {
      // Already visible, fade out
      setTimeout(() => {
        overlay.style.opacity = '0';

        // Remove after transition
        setTimeout(() => {
          overlay.remove();
          if (onComplete) onComplete();
        }, 400);
      }, 10);
    } else {
      // Fade in
      requestAnimationFrame(() => {
        overlay.style.opacity = '0.8';

        // Remove after transition
        setTimeout(() => {
          overlay.remove();
          if (onComplete) onComplete();
        }, 400);
      });
    }
  }

  /**
   * Add ripple effect to element
   * @param {HTMLElement} element - Target element
   */
  addRippleEffect(element) {
    if (!element) return;

    // Create ripple element
    const ripple = document.createElement('div');
    ripple.classList.add('menu-ripple');
    ripple.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0);
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(100,149,237,0.3) 0%, transparent 70%);
      pointer-events: none;
      z-index: -1;
    `;

    element.appendChild(ripple);

    // Animate ripple expansion
    setTimeout(() => {
      ripple.style.transition = 'transform 1s cubic-bezier(0.19, 1, 0.22, 1)';
      ripple.style.transform = 'translate(-50%, -50%) scale(50)';

      // Remove after animation completes
      setTimeout(() => {
        ripple.remove();
      }, 1000);
    }, 10);
  }
}

// Export a singleton instance
export const AnimationManager = new AnimationManagerClass();
