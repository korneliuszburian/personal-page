/**
 * EventHandler.js
 * Completely fixed version that works with the provided AnimationManager
 */
import * as THREE from 'three';
import { APP_STATES } from './AppState';

// Simple helper function to check if we're on the home page
function isHomePage() {
  return window.location.pathname === '/' || window.location.pathname === '';
}

class EventHandlerClass {
  constructor() {
    // Event handling state
    this._initialized = false;
    this._boundHandlers = {};
    this._eventListeners = [];

    // Debug mode for detailed logging
    this._debugMode = true;

    // Make instance globally available
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
      this._log('Already initialized, cleaning up first');
      this.cleanup();
    }

    console.log('Initializing event handlers');
    this._initialized = true;

    // Create bound handler functions to maintain context
    this._bindHandlers();

    // Register global event listeners
    this._addListener(document, 'keydown', this._boundHandlers.keydown);
    this._addListener(document, 'keydown', this._boundHandlers.escape);

    // Set up scene click detection for logo
    const sceneContainer = document.getElementById('scene-container');
    if (sceneContainer) {
      console.log('Adding click handler to scene container');

      // Remove any existing handlers first
      sceneContainer.removeEventListener('click', this._boundHandlers.logoClick);

      // Add with capture to ensure we get the event first
      sceneContainer.addEventListener('click', this._boundHandlers.logoClick, true);

      // Store in our tracking array
      this._eventListeners.push({
        element: sceneContainer,
        eventType: 'click',
        handler: this._boundHandlers.logoClick
      });
    }

    // Handle menu background clicks
    const menu = document.getElementById('menu');
    if (menu) {
      this._addListener(menu, 'click', this._boundHandlers.menuBgClick);
    }

    // Handle menu item clicks specifically
    const menuItems = document.querySelectorAll('.menu nav ul li a:not(.strike)');
    menuItems.forEach(item => {
      this._addListener(item, 'click', this._boundHandlers.menuItemClick);
    });

    // Initialize back button
    this.initializeBackButton();

    // Add direct click handler on logo as backup
    this._setupDirectLogoClickHandler();

    console.log('Event handlers initialized - all click handlers ready');
  }

  /**
   * Set up a direct click handler on the center area as a backup
   */
  _setupDirectLogoClickHandler() {
    const sceneContainer = document.getElementById('scene-container');
    if (!sceneContainer) return;

    // Create an overlay for the center area
    let centerOverlay = document.getElementById('logo-click-overlay');

    // If it already exists, remove it
    if (centerOverlay) {
      centerOverlay.remove();
    }

    // Create a new overlay
    centerOverlay = document.createElement('div');
    centerOverlay.id = 'logo-click-overlay';
    centerOverlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 200px;
      height: 200px;
      cursor: pointer;
      z-index: 10;
      opacity: 0;
    `;

    document.body.appendChild(centerOverlay);

    // Add click handler
    centerOverlay.addEventListener('click', (e) => {
      console.log('Center overlay clicked');
      this.handleLogoClick(e);
    });

    this._eventListeners.push({
      element: centerOverlay,
      eventType: 'click',
      handler: this.handleLogoClick.bind(this)
    });
  }

  /**
   * Bind event handler methods to maintain 'this' context
   */
  _bindHandlers() {
    this._boundHandlers = {
      keydown: this.handleKeyDown.bind(this),
      escape: this.handleEscapeKey.bind(this),
      logoClick: this.handleLogoClick.bind(this),
      menuBgClick: this.handleMenuBackgroundClick.bind(this),
      menuItemClick: this.handleMenuItemClick.bind(this),
      backButton: this.handleBackButtonClick.bind(this)
    };
  }

  /**
   * Add event listener with tracking for cleanup
   */
  _addListener(element, eventType, handler, options) {
    if (!element) return;

    element.addEventListener(eventType, handler, options);
    this._eventListeners.push({ element, eventType, handler });

    return { element, eventType, handler };
  }

  /**
   * Remove a specific event listener
   */
  _removeListener(listener) {
    if (!listener || !listener.element) return false;

    listener.element.removeEventListener(listener.eventType, listener.handler);
    return true;
  }

  /**
   * Initialize back button
   */
  initializeBackButton() {
    // Find back button
    const backButton = document.getElementById('back-to-home');
    if (backButton) {
      console.log('Initializing back button');

      // Remove existing listeners to prevent duplicates
      const newBackButton = backButton.cloneNode(true);
      if (backButton.parentNode) {
        backButton.parentNode.replaceChild(newBackButton, backButton);
      }

      // Add new listener
      this._addListener(newBackButton, 'click', this._boundHandlers.backButton);
    }
  }

  /**
   * Clean up all event listeners
   */
  cleanup() {
    console.log(`Cleaning up ${this._eventListeners.length} event handlers`);

    // Remove all registered event listeners
    this._eventListeners.forEach(listener => {
      this._removeListener(listener);
    });

    this._eventListeners = [];
    this._initialized = false;
  }

  /**
   * Handle space key press to trigger menu
   */
  handleKeyDown(e) {
    if (e.code === 'Space' && isHomePage()) {
      console.log('Space key pressed, handling continue');
      this.triggerContinueAction();

      // Prevent space from scrolling the page
      e.preventDefault();
    }
  }

  /**
   * Handle logo clicks via raycasting
   */
  handleLogoClick(e) {
    if (!isHomePage()) return;

    console.log('Scene container click detected');

    const scene = window.sceneInstance;
    if (!scene) {
      console.log('Scene not ready');
      return;
    }

    // Center of the screen
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // Check if the click is near the center (where the logo is)
    const distanceFromCenter = Math.sqrt(
      Math.pow(e.clientX - centerX, 2) +
      Math.pow(e.clientY - centerY, 2)
    );

    // Logo click is detected if:
    // 1. Click is within 150px of center or
    // 2. Raycasting hits the logo (if logo and camera are available)
    let logoClicked = distanceFromCenter < 150;

    // Try raycasting if logo and camera are available
    if (scene.logo && scene.camera) {
      // Set up raycaster for logo detection
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );

      raycaster.setFromCamera(mouse, scene.camera);
      const intersects = raycaster.intersectObject(scene.logo, true);

      if (intersects.length > 0) {
        logoClicked = true;
        console.log('Logo hit by raycaster');
      }
    }

    if (logoClicked) {
      console.log('Logo click detected - triggering continue');
      this.triggerContinueAction();
      e.preventDefault();
      e.stopPropagation();
    }
  }

  /**
   * Trigger the continue action (menu opening)
   */
  triggerContinueAction() {
    // Try using Scene's handleContinue first
    if (window.sceneInstance && typeof window.sceneInstance.handleContinue === 'function') {
      window.sceneInstance.handleContinue();
      return;
    }

    // Try using AppState as fallback
    if (window.AppState && typeof window.AppState.openMenu === 'function') {
      window.AppState.openMenu();
      return;
    }

    console.warn('No method found to handle continue action');
  }

  /**
   * Handle menu background clicks to close menu
   */
  handleMenuBackgroundClick(e) {
    // Only if clicked directly on menu background, not its children
    if (e.target === e.currentTarget) {
      console.log('Menu background click detected');
      this.closeMenu();
    }
  }

  /**
   * Handle menu item clicks
   */
  handleMenuItemClick(e) {
    console.log('Menu item clicked');

    const href = e.currentTarget.getAttribute('href');

    // Only handle animation for navigation within site
    // (not for external links or anchors)
    if (href && !href.startsWith('http') && !href.startsWith('#')) {
      console.log('Internal navigation detected, closing menu');

      // Get the scene instance
      const scene = window.sceneInstance;
      if (scene && typeof scene.animateMenuAway === 'function') {
        scene.animateMenuAway();
      } else {
        // Fallback to manual closing
        this.closeMenu();
      }
    }
  }

  /**
   * Close the menu
   */
  closeMenu() {
    // Try using Scene's closeMenu first
    if (window.sceneInstance && typeof window.sceneInstance.closeMenu === 'function') {
      window.sceneInstance.closeMenu();
      return;
    }

    // Try using AppState as fallback
    if (window.AppState && typeof window.AppState.closeMenu === 'function') {
      window.AppState.closeMenu();
      return;
    }

    // Direct manipulation as last resort
    const menu = document.getElementById('menu');
    if (menu) {
      menu.classList.remove('visible');
      menu.classList.add('hidden');
    }
  }

  /**
   * Handle escape key to close menu
   */
  handleEscapeKey(e) {
    if (e.code === 'Escape') {
      console.log('Escape key pressed');
      this.closeMenu();
    }
  }

  /**
   * Handle back button clicks
   */
  handleBackButtonClick(e) {
    // If already on home page, just trigger menu
    if (isHomePage()) {
      e.preventDefault();
      this.triggerContinueAction();
    } else {
      // On subpage, apply transition effect
      this.triggerCustomTransition();
      window.navBackToHome = true;
    }
  }

  /**
   * Create a custom transition overlay effect
   */
  triggerCustomTransition() {
    console.log('Triggering custom transition effect');

    // Use AnimationManager if available
    if (window.AnimationManager && typeof window.AnimationManager.createTransitionOverlay === 'function') {
      window.AnimationManager.createTransitionOverlay('out');
      return;
    }

    // Fallback - create overlay manually
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

  /**
   * Conditional logging
   */
  _log(...args) {
    if (this._debugMode) {
      console.log('[EventHandler]', ...args);
    }
  }
}

// Export a singleton instance
export const EventHandler = new EventHandlerClass();
