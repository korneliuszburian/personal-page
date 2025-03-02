/**
 * AnimationManager.js
 * Centralized animation management for the application
 */

import anime from 'animejs/lib/anime.es.js';

class AnimationManagerClass {
  constructor() {
    // Track active animations for cleanup
    this._activeAnimations = [];
  }
  
  /**
   * Clear all active animations to prevent conflicts
   */
  clearAnimations() {
    console.log(`[AnimationManager] Clearing ${this._activeAnimations.length} active animations`);
    
    this._activeAnimations.forEach(anim => {
      if (anim && typeof anim.pause === 'function') {
        anim.pause();
      }
    });
    
    this._activeAnimations = [];
  }
  
  /**
   * Animate the 3D logo for menu opening
   */
  animateLogoForMenuOpen(logo, onComplete) {
    if (!logo) return;
    
    console.log('[AnimationManager] Animating logo for menu open');
    this.clearAnimations();
    
    // Store current position for reference
    const currentY = logo.position.y;
    
    // Start distortion effect during menu animation
    this.animateDistortionEffect(0.1, 2000);
    
    // Create animation timeline for coordinated effects
    const timeline = anime.timeline({
      easing: 'easeInOutQuad'
    });
    
    timeline
      .add({
        targets: logo.position,
        y: currentY + 3,
        duration: 1200,
        easing: 'easeOutQuad'
      })
      .add({
        targets: logo.rotation,
        y: Math.PI * 3,
        duration: 1200,
        easing: 'easeInOutQuad'
      }, '-=1200')
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
    
    this._activeAnimations.push(timeline);
  }
  
  /**
   * Animate the 3D logo for menu closing
   */
  animateLogoForMenuClose(logo, onComplete) {
    if (!logo) return;
    
    console.log('[AnimationManager] Animating logo for menu close');
    this.clearAnimations();
    
    // Get initial position for reference (should have been saved on open)
    const currentY = logo.position.y;
    const initialY = logo.initialLogoPosition?.y || 0;
    const initialRotationY = logo.initialLogoRotation?.y || 0;
    
    // Add distortion effect when closing menu
    this.animateDistortionEffect(0.15, 1500);
    
    // Create animation timeline
    const closeTimeline = anime.timeline({
      easing: 'easeInOutQuad'
    });
    
    closeTimeline
      .add({
        targets: logo.position,
        y: currentY + 2,
        duration: 800,
        easing: 'easeOutQuad'
      })
      .add({
        targets: logo.rotation,
        y: initialRotationY,
        duration: 1200,
        easing: 'easeInOutQuad'
      }, '-=800')
      .add({
        targets: logo.position,
        y: initialY,
        duration: 1000,
        easing: 'easeOutElastic(1, 0.8)',
        complete: () => {
          if (onComplete) onComplete();
        }
      });
    
    this._activeAnimations.push(closeTimeline);
  }
  
  /**
   * Animate distortion effect for transitions
   */
  animateDistortionEffect(amount, duration) {
    // Find the scene instance to access uniforms
    const sceneInstance = window.sceneInstance;
    
    if (sceneInstance && sceneInstance.distortionPass) {
      console.log(`[AnimationManager] Animating distortion effect: ${amount}`);
      
      const distortionAnim = anime({
        targets: sceneInstance.distortionPass.uniforms.uDistortionAmount,
        value: [0, amount, 0],
        duration: duration,
        easing: 'easeInOutQuad'
      });
      
      this._activeAnimations.push(distortionAnim);
    }
  }
  
  /**
   * Animate the logo for page transitions
   */
  animateLogoForPageTransition(logo, direction) {
    if (!logo) return;
    
    console.log(`[AnimationManager] Animating logo for page transition: ${direction}`);
    this.clearAnimations();
    
    // Apply distortion effect during transitions
    this.animateDistortionEffect(0.2, 1000);
    
    // Clear any existing position/rotation animations
    anime.remove(logo.position);
    anime.remove(logo.rotation);
    
    // Different animations based on direction
    if (direction === 'out') {
      // Scaling down and moving down when leaving
      anime({
        targets: logo.scale,
        x: logo.scale.x * 0.8,
        y: logo.scale.y * 0.8,
        z: logo.scale.z * 0.8,
        duration: 500,
        easing: 'easeInQuad'
      });
      
      anime({
        targets: logo.position,
        y: logo.position.y - 2,
        duration: 500,
        easing: 'easeInQuad'
      });
    } else {
      // Scaling up and bouncing when entering
      anime({
        targets: logo.scale,
        x: logo.scale.x * 1.2,
        y: logo.scale.y * 1.2,
        z: logo.scale.z * 1.2,
        duration: 500,
        easing: 'easeOutQuad',
        complete: () => {
          anime({
            targets: logo.scale,
            x: logo.scale.x / 1.2,
            y: logo.scale.y / 1.2,
            z: logo.scale.z / 1.2,
            duration: 800,
            easing: 'easeOutElastic(1, 0.5)'
          });
        }
      });
    }
  }
}

// Export a singleton instance
export const AnimationManager = new AnimationManagerClass();