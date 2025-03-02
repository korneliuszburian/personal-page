/**
 * EventHandler.js
 * Fixed to ensure proper re-initialization after navigation
 */

import * as THREE from 'three';

// Simple helper function to check if we're on the home page
function isHomePage() {
  return window.location.pathname === '/' || window.location.pathname === '';
}

class EventHandlerClass {
  constructor() {
    this._initialized = false;
    this._boundHandlers = {
      keydown: null,
      click: null,
      menuBgClick: null,
      escape: null
    };
    
    // Make this instance globally available
    if (typeof window !== 'undefined') {
      window.EventHandler = this;
    }
  }
  
  /**
   * Initialize all event listeners
   */
  initialize() {
    // Prevent double initialization
    if (this._initialized) {
      this.cleanup(); // Remove existing handlers first
    }
    
    console.log('[EventHandler] Initializing event handlers');
    this._initialized = true;
    
    // Bind methods to maintain 'this' context
    this._boundHandlers.keydown = this.handleKeyDown.bind(this);
    this._boundHandlers.click = this.handleLogoClick.bind(this);
    this._boundHandlers.menuBgClick = this.handleMenuBackgroundClick.bind(this);
    this._boundHandlers.escape = this.handleEscapeKey.bind(this);
    
    // Add global event listeners for keyboard
    document.addEventListener('keydown', this._boundHandlers.keydown);
    
    // Add escape key handler
    document.addEventListener('keydown', this._boundHandlers.escape);
    
    // Set up scene click detection for logo
    const sceneContainer = document.getElementById('scene-container');
    if (sceneContainer) {
      sceneContainer.addEventListener('click', this._boundHandlers.click);
    }
    
    // Handle menu background clicks
    const menu = document.getElementById('menu');
    if (menu) {
      menu.addEventListener('click', this._boundHandlers.menuBgClick);
    }
    
    // Initialize back button
    this.initializeBackButton();
    
    // Handle navigation transitions for menu items
    this.setupMenuNavigationHandling();
    
    console.log('[EventHandler] Event handlers initialized');
  }
  
  /**
   * Set up handlers for menu item clicks
   */
  setupMenuNavigationHandling() {
    // Add event listeners to menu items
    const menuLinks = document.querySelectorAll('.menu nav ul li a:not(.strike)');
    menuLinks.forEach((link) => {
      link.addEventListener('click', () => {
        if (window.sceneInstance && typeof window.sceneInstance.animateMenuAway === 'function') {
          window.sceneInstance.animateMenuAway();
        }
      });
    });
  }
  
  /**
   * Clean up all event listeners
   */
  cleanup() {
    console.log('[EventHandler] Cleaning up event handlers');
    
    if (this._boundHandlers.keydown) {
      document.removeEventListener('keydown', this._boundHandlers.keydown);
    }
    
    if (this._boundHandlers.escape) {
      document.removeEventListener('keydown', this._boundHandlers.escape);
    }
    
    const sceneContainer = document.getElementById('scene-container');
    if (sceneContainer && this._boundHandlers.click) {
      sceneContainer.removeEventListener('click', this._boundHandlers.click);
    }
    
    const menu = document.getElementById('menu');
    if (menu && this._boundHandlers.menuBgClick) {
      menu.removeEventListener('click', this._boundHandlers.menuBgClick);
    }
    
    // Reset bound handlers
    this._boundHandlers = {
      keydown: null,
      click: null,
      menuBgClick: null,
      escape: null
    };
    
    this._initialized = false;
  }
  
  /**
   * Handle space key press
   */
  handleKeyDown(e) {
    if (e.code === 'Space' && isHomePage()) {
      console.log('[EventHandler] Space key pressed, handling continue');
      if (window.sceneInstance && typeof window.sceneInstance.handleContinue === 'function') {
        window.sceneInstance.handleContinue();
      } else {
        console.error('[EventHandler] SceneInstance or handleContinue not available');
      }
      
      // Prevent space from scrolling the page
      e.preventDefault();
    }
  }
  
  /**
   * Handle logo clicks via raycasting
   */
  handleLogoClick(e) {
    if (!isHomePage()) return;
    
    const scene = window.sceneInstance;
    if (!scene || !scene.logo || !scene.camera) {
      console.log('[EventHandler] Scene not ready for logo detection');
      return;
    }
    
    console.log('[EventHandler] Scene click detected, checking logo intersection');
    
    // Set up raycaster for logo detection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    
    raycaster.setFromCamera(mouse, scene.camera);
    const intersects = raycaster.intersectObject(scene.logo, true);
    
    if (intersects.length > 0) {
      console.log('[EventHandler] Logo click detected');
      scene.handleContinue();
    }
  }
  
  /**
   * Handle menu background clicks to close menu
   */
  handleMenuBackgroundClick(e) {
    if (e.target === e.currentTarget) { // Only if clicked directly on menu bg, not its children
      console.log('[EventHandler] Menu background click detected');
      if (window.sceneInstance && typeof window.sceneInstance.closeMenu === 'function') {
        window.sceneInstance.closeMenu();
      }
    }
  }
  
  /**
   * Handle escape key to close menu
   */
  handleEscapeKey(e) {
    if (e.code === 'Escape') {
      console.log('[EventHandler] Escape key pressed');
      if (window.sceneInstance && typeof window.sceneInstance.closeMenu === 'function') {
        window.sceneInstance.closeMenu();
      }
    }
  }
  
  /**
   * Initialize back button
   */
  initializeBackButton() {
    const backButton = document.getElementById('back-to-home');
    if (backButton) {
      console.log('[EventHandler] Initializing back button');
      
      // Remove existing click listeners to prevent duplicates
      const newBackButton = backButton.cloneNode(true);
      if (backButton.parentNode) {
        backButton.parentNode.replaceChild(newBackButton, backButton);
      }
      
      newBackButton.addEventListener('click', (e) => {
        // If already on home page, just trigger menu
        if (isHomePage()) {
          e.preventDefault();
          if (window.sceneInstance && typeof window.sceneInstance.handleContinue === 'function') {
            window.sceneInstance.handleContinue();
          }
        } else {
          // On subpage, apply transition effect
          this.triggerCustomTransition();
          window.navBackToHome = true;
        }
      });
    }
  }
  
  /**
   * Create a custom transition overlay effect
   */
  triggerCustomTransition() {
    console.log('[EventHandler] Triggering custom transition effect');
    
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
      opacity: 0;
      transition: opacity 0.4s ease;
    `;
    
    document.body.appendChild(overlay);
    
    // Fade in overlay
    requestAnimationFrame(() => {
      overlay.style.opacity = '0.8';
    });
    
    // Clean up overlay after navigation
    setTimeout(() => {
      overlay.remove();
    }, 800);
  }
}

// Export a singleton instance
export const EventHandler = new EventHandlerClass();