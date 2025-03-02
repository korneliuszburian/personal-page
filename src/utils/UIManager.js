/**
 * UIManager.js
 * Handles all direct DOM manipulations for the application
 */

import anime from 'animejs/lib/anime.es.js';
import { AppState } from './AppState';

class UIManagerClass {
  constructor() {
    // Cache for DOM elements to avoid repeated querySelector calls
    this._elements = {
      menu: null,
      continuePrompt: null,
      loadingScreen: null,
      sceneContainer: null
    };
    
    // Last enforcement time to prevent too frequent UI updates
    this._lastEnforcementTime = 0;
  }
  
  /**
   * Initialize and cache DOM elements
   */
  initialize() {
    this._elements = {
      menu: document.getElementById('menu'),
      continuePrompt: document.getElementById('continue-prompt'),
      loadingScreen: document.getElementById('loading-screen'),
      sceneContainer: document.getElementById('scene-container')
    };
    
    console.log('[UIManager] Initialized DOM elements');
  }
  
  /**
   * Get a DOM element, initializing the cache if needed
   */
  getElement(key) {
    if (!this._elements[key]) {
      this._elements[key] = document.getElementById(key);
    }
    return this._elements[key];
  }
  
  /**
   * Show the menu with animation effects
   */
  showMenu() {
    const menu = this.getElement('menu');
    if (!menu) return;
    
    console.log('[UIManager] Showing menu');
    
    // Make menu visible
    menu.classList.remove('hidden');
    menu.classList.add('visible');
    
    // Add ripple effect for visual interest
    this.addRippleEffect(menu);
    
    // Animate menu items
    anime({
      targets: '.menu nav ul li',
      translateY: [20, 0],
      opacity: [0, 1],
      duration: 600,
      delay: anime.stagger(80)
    });
    
    // Hide continue prompt
    this.hideContinuePrompt();
    
    // Scale scene container slightly for depth effect
    const sceneContainer = this.getElement('sceneContainer');
    if (sceneContainer) {
      sceneContainer.style.transition = 'transform 1.5s cubic-bezier(0.19, 1, 0.22, 1)';
      sceneContainer.style.transform = 'scale(1.05)';
    }
    
    // Make home content visible if it exists
    const homeContent = document.querySelector('.home-content');
    if (homeContent) {
      homeContent.style.opacity = '1';
    }
  }
  
  /**
   * Hide the menu with animation effects
   */
  hideMenu() {
    const menu = this.getElement('menu');
    if (!menu) return;
    
    console.log('[UIManager] Hiding menu');
    
    // Fade out menu items with staggered animation
    const menuItems = menu.querySelectorAll('nav ul li');
    menuItems.forEach((item, index) => {
      setTimeout(() => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(-20px)';
      }, index * 50);
    });
    
    // Reset scene container scale
    const sceneContainer = this.getElement('sceneContainer');
    if (sceneContainer) {
      sceneContainer.style.transform = 'scale(1)';
    }
    
    // Fade out menu background
    setTimeout(() => {
      menu.classList.remove('visible');
      
      // Finally hide the menu completely
      setTimeout(() => {
        menu.classList.add('hidden');
        
        // Reset menu items for next time
        menuItems.forEach(item => {
          item.style.opacity = '';
          item.style.transform = '';
        });
      }, 500);
    }, menuItems.length * 50 + 100);
    
    // Show continue prompt if on home page
    if (AppState.isHomePage()) {
      this.showContinuePrompt();
    }
  }
  
  /**
   * Ensure menu is hidden (immediately, without animation)
   */
  ensureMenuHidden() {
    const menu = this.getElement('menu');
    if (!menu) return;
    
    menu.classList.remove('visible');
    menu.classList.add('hidden');
  }
  
  /**
   * Ensure menu is visible (immediately, without animation)
   */
  ensureMenuVisible() {
    const menu = this.getElement('menu');
    if (!menu) return;
    
    menu.classList.remove('hidden');
    menu.classList.add('visible');
  }
  
  /**
   * Show the continue prompt with animation
   */
  showContinuePrompt() {
    const prompt = this.getElement('continuePrompt');
    if (!prompt) return;
    
    console.log('[UIManager] Showing continue prompt');
    
    // Make prompt visible
    prompt.classList.remove('hidden');
    
    // Format text for letter-by-letter animation
    const text = prompt.textContent || '';
    prompt.innerHTML = text.split('').map(char =>
      char === ' ' ? ' ' : `<span>${char}</span>`
    ).join('');
    
    // Animate prompt appearance
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
  
  /**
   * Hide the continue prompt
   */
  hideContinuePrompt() {
    const prompt = this.getElement('continuePrompt');
    if (!prompt) return;
    
    console.log('[UIManager] Hiding continue prompt');
    
    // Animate fadeout
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
  
  /**
   * Hide the loading screen
   */
  hideLoadingScreen() {
    const loadingScreen = this.getElement('loadingScreen');
    if (!loadingScreen) return;
    
    console.log('[UIManager] Hiding loading screen');
    
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 500);
  }
  
  /**
   * Add a ripple effect to an element
   */
  addRippleEffect(element) {
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
  
  /**
   * Enforce the correct UI state based on current app state
   * This is a recovery mechanism for when state gets out of sync
   */
  enforceCorrectUIState() {
    // Don't run this too frequently
    const now = Date.now();
    if (now - this._lastEnforcementTime < 300) return;
    this._lastEnforcementTime = now;
    
    console.log('[UIManager] Enforcing correct UI state');
    
    // Only enforce on home page
    if (!AppState.isHomePage()) return;
    
    const menu = this.getElement('menu');
    const continuePrompt = this.getElement('continuePrompt');
    
    if (!menu || !continuePrompt) return;
    
    // Enforce correct UI based on app state
    switch (AppState.currentState) {
      case 'IDLE':
        // Should show continue prompt, hide menu
        if (continuePrompt.classList.contains('hidden')) {
          continuePrompt.classList.remove('hidden');
        }
        if (menu.classList.contains('visible')) {
          menu.classList.remove('visible');
          menu.classList.add('hidden');
        }
        break;
        
      case 'MENU_OPEN':
        // Should hide continue prompt, show menu
        if (!continuePrompt.classList.contains('hidden')) {
          continuePrompt.classList.add('hidden');
        }
        if (!menu.classList.contains('visible')) {
          menu.classList.remove('hidden');
          menu.classList.add('visible');
        }
        break;
        
      default:
        // For other states, don't enforce anything
        break;
    }
  }
}

// Export a singleton instance
export const UIManager = new UIManagerClass();