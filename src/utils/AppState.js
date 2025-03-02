/**
 * AppState.js
 * Centralized state management for the entire application
 */

import { UIManager } from './UIManager';
import { AnimationManager } from './AnimationManager';

// Ensure correct typing for the global Scene instance
if (typeof window !== 'undefined') {
  window.sceneInstance = window.sceneInstance || null;
}

class AppStateManager {
  constructor() {
    this._currentState = 'INITIALIZING';
    this._previousState = null;
    this._lastStateChangeTime = 0;
    this._navigationBackToHome = false;
    this._stateDebounceTime = 300; // ms to prevent rapid state changes
  }
  
  /**
   * Get the current application state
   */
  get currentState() {
    return this._currentState;
  }
  
  /**
   * Check if we're currently transitioning between states
   */
  get isTransitioning() {
    return ['MENU_OPENING', 'MENU_CLOSING', 'TRANSITIONING_TO_SUBPAGE', 'TRANSITIONING_TO_HOME'].includes(this._currentState);
  }
  
  /**
   * Get the scene instance if available
   */
  get sceneInstance() {
    return window.sceneInstance || null;
  }
  
  /**
   * Initialize the AppState with the correct initial state based on URL
   */
  initialize() {
    // Determine initial state based on URL
    const isHomePage = this.isHomePage();
    
    if (isHomePage) {
      this._currentState = 'INITIALIZING';
    } else {
      this._currentState = 'SUBPAGE';
    }
    
    console.log(`[AppState] Initialized with state: ${this._currentState}`);
    
    // Listen for Astro page transitions
    document.addEventListener('astro:before-preparation', this.handleBeforePreparation.bind(this));
    document.addEventListener('astro:before-navigation', this.handleBeforeNavigation.bind(this));
    document.addEventListener('astro:after-navigation', this.handleAfterNavigation.bind(this));
    document.addEventListener('astro:page-load', this.handlePageLoad.bind(this));
  }
  
  /**
   * Transition to a new state with appropriate actions
   */
  transitionTo(newState) {
    // Prevent rapid state changes
    const now = Date.now();
    if (now - this._lastStateChangeTime < this._stateDebounceTime) {
      console.log(`[AppState] State transition debounced: ${this._currentState} → ${newState}`);
      return false;
    }
    
    console.log(`[AppState] State transition: ${this._currentState} → ${newState}`);
    this._previousState = this._currentState;
    this._currentState = newState;
    this._lastStateChangeTime = now;
    
    // Perform state-specific actions
    this.performStateActions(newState);
    
    // Dispatch state change event
    document.dispatchEvent(new CustomEvent('appStateChanged', { 
      detail: { 
        newState,
        previousState: this._previousState 
      }
    }));
    
    return true;
  }
  
  /**
   * Check if we're on the home page
   */
  isHomePage() {
    return window.location.pathname === '/' || window.location.pathname === '';
  }
  
  /**
   * Check if menu interaction is allowed
   */
  isMenuInteractionAllowed() {
    return this.isHomePage() && !this.isTransitioning;
  }
  
  /**
   * Flag that we're navigating back to home
   */
  setNavigatingBackToHome(value) {
    this._navigationBackToHome = value;
    console.log(`[AppState] Navigating back to home: ${value}`);
  }
  
  /**
   * Check if we're navigating back to home
   */
  isNavigatingBackToHome() {
    return this._navigationBackToHome;
  }
  
  /**
   * Reset transition state in the 3D scene
   */
  resetSceneTransitionState() {
    if (this.sceneInstance && typeof this.sceneInstance.resetTransitionState === 'function') {
      console.log('[AppState] Resetting scene transition state');
      this.sceneInstance.resetTransitionState();
    }
  }
  
  /**
   * Open the menu with animations
   */
  openMenu() {
    if (!this.isMenuInteractionAllowed()) {
      console.log('[AppState] Menu interaction not allowed');
      return;
    }
    
    if (this._currentState === 'IDLE') {
      this.transitionTo('MENU_OPENING');
      
      // Start menu opening animations
      UIManager.showMenu();
      if (this.sceneInstance && this.sceneInstance.logo) {
        AnimationManager.animateLogoForMenuOpen(this.sceneInstance.logo, () => {
          this.transitionTo('MENU_OPEN');
        });
      } else {
        // If no scene instance, still transition to MENU_OPEN
        setTimeout(() => this.transitionTo('MENU_OPEN'), 1000);
      }
    }
  }
  
  /**
   * Close the menu with animations
   */
  closeMenu() {
    if (this._currentState === 'MENU_OPEN') {
      this.transitionTo('MENU_CLOSING');
      
      // Start menu closing animations
      UIManager.hideMenu();
      if (this.sceneInstance && this.sceneInstance.logo) {
        AnimationManager.animateLogoForMenuClose(this.sceneInstance.logo, () => {
          this.transitionTo('IDLE');
        });
      } else {
        // If no scene instance, still transition to IDLE
        setTimeout(() => this.transitionTo('IDLE'), 1000);
      }
    }
  }
  
  /**
   * Prepare for transition between pages
   */
  prepareForTransition(toHomePage) {
    if (toHomePage) {
      this.transitionTo('TRANSITIONING_TO_HOME');
      this.setNavigatingBackToHome(true);
    } else {
      this.transitionTo('TRANSITIONING_TO_SUBPAGE');
    }
    
    // Prepare the scene for transition
    if (this.sceneInstance && typeof this.sceneInstance.prepareForTransition === 'function') {
      this.sceneInstance.prepareForTransition();
    }
  }
  
  /**
   * Handle actions specific to each state
   */
  performStateActions(state) {
    switch (state) {
      case 'INITIALIZING':
        // Show loading screen (already visible by default)
        break;
        
      case 'IDLE':
        // Show continue prompt, hide menu
        UIManager.showContinuePrompt();
        UIManager.ensureMenuHidden();
        break;
        
      case 'MENU_OPEN':
        // Hide continue prompt, show menu
        UIManager.hideContinuePrompt();
        UIManager.ensureMenuVisible();
        break;
        
      case 'MENU_CLOSING':
        // Menu closing animation handled by AnimationManager
        break;
        
      case 'MENU_OPENING':
        // Menu opening animation handled by AnimationManager
        break;
        
      case 'TRANSITIONING_TO_SUBPAGE':
        // Prepare scene for transition, handled elsewhere
        break;
        
      case 'TRANSITIONING_TO_HOME':
        // Prepare scene for transition, handled elsewhere
        break;
        
      case 'SUBPAGE':
        // Hide continue prompt, ensure menu is hidden
        UIManager.hideContinuePrompt();
        UIManager.ensureMenuHidden();
        break;
    }
  }
  
  /**
   * Event Handlers for Astro page transitions
   */
  handleBeforePreparation(e) {
    console.log('[AppState] Before preparation, navigating to:', e.to);
    
    // Detect if we're navigating to home
    const isNavigatingToHome = e.to === '/' || e.to.endsWith('/');
    const isLeavingHomePage = this.isHomePage();
    
    if (isNavigatingToHome && !isLeavingHomePage) {
      this.prepareForTransition(true);
    } else if (isLeavingHomePage) {
      this.prepareForTransition(false);
    }
  }
  
  handleBeforeNavigation(e) {
    console.log('[AppState] Before navigation');
    
    // Additional preparation before navigation starts
    if (this.isTransitioning) {
      // Make sure any animations are in a stable state
      AnimationManager.clearAnimations();
    }
  }
  
  handleAfterNavigation() {
    console.log('[AppState] After navigation');
    
    // Update state based on new URL
    if (this.isHomePage()) {
      // Reset scene state when arriving at home
      this.resetSceneTransitionState();
      
      // If we came from a subpage, ensure we're in IDLE state
      if (this._currentState === 'TRANSITIONING_TO_HOME') {
        this.transitionTo('IDLE');
      }
    } else {
      // We're on a subpage
      this.transitionTo('SUBPAGE');
    }
  }
  
  handlePageLoad() {
    console.log('[AppState] Page load');
    
    if (this.isHomePage()) {
      // Make sure scene is in the right state
      this.resetSceneTransitionState();
      
      // Check if we navigated back to home
      if (this.isNavigatingBackToHome()) {
        this.setNavigatingBackToHome(false);
        this.transitionTo('IDLE');
        UIManager.enforceCorrectUIState();
      }
    }
  }
}

// Export a singleton instance
export const AppState = new AppStateManager();