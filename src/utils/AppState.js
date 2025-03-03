/**
 * AppState.js
 * Centralized state management for the entire application
 */
import { UIManager } from './UIManager';
import { AnimationManager } from './AnimationManager';

// Define all possible app states
const APP_STATES = {
  INITIALIZING: 'INITIALIZING',    // Initial loading state
  IDLE: 'IDLE',                    // Home page with logo, continue prompt visible
  MENU_OPENING: 'MENU_OPENING',    // During menu opening animation
  MENU_OPEN: 'MENU_OPEN',          // Menu is visible
  MENU_CLOSING: 'MENU_CLOSING',    // During menu closing animation
  TRANSITIONING_TO_SUBPAGE: 'TRANSITIONING_TO_SUBPAGE',  // Navigating to subpage
  TRANSITIONING_TO_HOME: 'TRANSITIONING_TO_HOME',        // Navigating to home
  SUBPAGE: 'SUBPAGE'               // On a subpage
};

class AppStateManager {
  constructor() {
    this._currentState = APP_STATES.INITIALIZING;
    this._previousState = null;
    this._lastStateChangeTime = 0;
    this._navigationBackToHome = false;
    this._stateDebounceTime = 300; // ms to prevent rapid state changes
    this._stateChangeCallbacks = new Map();

    // Debug mode for logging state changes
    this._debugMode = false;
  }

  /**
   * Get the current application state
   */
  get currentState() {
    return this._currentState;
  }

  /**
   * Set debug mode on/off
   */
  setDebugMode(enabled) {
    this._debugMode = !!enabled;
    this._log(`Debug mode ${this._debugMode ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if we're currently transitioning between states
   */
  get isTransitioning() {
    return [
      APP_STATES.MENU_OPENING,
      APP_STATES.MENU_CLOSING,
      APP_STATES.TRANSITIONING_TO_SUBPAGE,
      APP_STATES.TRANSITIONING_TO_HOME
    ].includes(this._currentState);
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
    this._currentState = this.isHomePage() ? APP_STATES.INITIALIZING : APP_STATES.SUBPAGE;

    this._log(`Initialized with state: ${this._currentState}`);

    // Listen for Astro page transitions
    document.addEventListener('astro:before-preparation', this.handleBeforePreparation.bind(this));
    document.addEventListener('astro:before-navigation', this.handleBeforeNavigation.bind(this));
    document.addEventListener('astro:after-navigation', this.handleAfterNavigation.bind(this));
    document.addEventListener('astro:page-load', this.handlePageLoad.bind(this));

    // Initialize UI manager
    UIManager.initialize();

    // Move to IDLE state after initialization if on home page
    if (this.isHomePage() && this._currentState === APP_STATES.INITIALIZING) {
      // Small delay to allow scene setup
      setTimeout(() => {
        this.transitionTo(APP_STATES.IDLE);
      }, 200);
    }
  }

  /**
   * Register callback for a specific state change
   * @param {string} fromState - State to transition from (or '*' for any)
   * @param {string} toState - State to transition to (or '*' for any)
   * @param {Function} callback - Function to call when transition occurs
   * @returns {string} Unique ID for unregistering
   */
  onStateChange(fromState, toState, callback) {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this._stateChangeCallbacks.set(id, { fromState, toState, callback });
    return id;
  }

  /**
   * Unregister a state change callback
   * @param {string} id - ID returned from onStateChange
   */
  offStateChange(id) {
    if (this._stateChangeCallbacks.has(id)) {
      this._stateChangeCallbacks.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Transition to a new state with appropriate actions
   * @param {string} newState - Target state from APP_STATES
   * @returns {boolean} Success of transition
   */
  transitionTo(newState) {
    // Prevent rapid state changes
    const now = Date.now();
    if (now - this._lastStateChangeTime < this._stateDebounceTime) {
      this._log(`State transition debounced: ${this._currentState} → ${newState}`);
      return false;
    }

    // Validate state
    if (!Object.values(APP_STATES).includes(newState)) {
      console.error(`Invalid state: ${newState}`);
      return false;
    }

    this._log(`State transition: ${this._currentState} → ${newState}`);
    this._previousState = this._currentState;
    this._currentState = newState;
    this._lastStateChangeTime = now;

    // Perform state-specific actions
    this.performStateActions(newState, this._previousState);

    // Dispatch custom event
    document.dispatchEvent(new CustomEvent('appStateChanged', {
      detail: {
        newState,
        previousState: this._previousState
      }
    }));

    // Execute registered callbacks
    this._stateChangeCallbacks.forEach(({ fromState, toState, callback }) => {
      if ((fromState === '*' || fromState === this._previousState) &&
          (toState === '*' || toState === newState)) {
        callback(newState, this._previousState);
      }
    });

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
    this._log(`Navigating back to home: ${value}`);
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
      this._log('Resetting scene transition state');
      this.sceneInstance.resetTransitionState();
    }
  }

  /**
   * Open the menu with animations
   */
  openMenu() {
    if (!this.isMenuInteractionAllowed()) {
      this._log('Menu interaction not allowed');
      return false;
    }

    if (this._currentState === APP_STATES.IDLE) {
      // Transition to opening state
      if (!this.transitionTo(APP_STATES.MENU_OPENING)) {
        return false;
      }

      const menu = document.getElementById('menu');
      const prompt = document.getElementById('continue-prompt');

      // Hide continue prompt
      if (prompt) {
        AnimationManager.animateContinuePromptOut(prompt);
      }

      // Apply distortion effect
      AnimationManager.animateDistortion(0.1, 2000, 'menuOpen');

      // Animate logo if it exists
      if (this.sceneInstance && this.sceneInstance.logo) {
        AnimationManager.animateLogoForMenuOpen(this.sceneInstance.logo, () => {
          // When logo animation completes, show menu
          if (menu) {
            AnimationManager.animateMenuIn(menu, () => {
              this.transitionTo(APP_STATES.MENU_OPEN);
            });
          } else {
            this.transitionTo(APP_STATES.MENU_OPEN);
          }
        });
      } else {
        // No logo, just show menu
        if (menu) {
          AnimationManager.animateMenuIn(menu, () => {
            this.transitionTo(APP_STATES.MENU_OPEN);
          });
        } else {
          this.transitionTo(APP_STATES.MENU_OPEN);
        }
      }

      return true;
    }

    return false;
  }

  /**
   * Close the menu with animations
   */
  closeMenu() {
    if (this._currentState !== APP_STATES.MENU_OPEN) {
      this._log('Cannot close menu: not in MENU_OPEN state');
      return false;
    }

    // Transition to closing state
    if (!this.transitionTo(APP_STATES.MENU_CLOSING)) {
      return false;
    }

    const menu = document.getElementById('menu');

    // Apply distortion effect
    AnimationManager.animateDistortion(0.15, 1500, 'menuClose');

    // Animate menu out
    if (menu) {
      AnimationManager.animateMenuOut(menu);
    }

    // Animate logo if it exists and we're on home page
    if (this.sceneInstance && this.sceneInstance.logo && this.isHomePage()) {
      const initialState = {
        position: this.sceneInstance.initialLogoPosition,
        rotation: this.sceneInstance.initialLogoRotation
      };

      AnimationManager.animateLogoForMenuClose(this.sceneInstance.logo, initialState, () => {
        this.transitionTo(APP_STATES.IDLE);

        // Show continue prompt when menu is closed
        const prompt = document.getElementById('continue-prompt');
        if (prompt) {
          AnimationManager.animateContinuePromptIn(prompt);
        }
      });
    } else {
      // No logo animation, just complete transition
      setTimeout(() => {
        this.transitionTo(APP_STATES.IDLE);

        // Show continue prompt when menu is closed if on home page
        if (this.isHomePage()) {
          const prompt = document.getElementById('continue-prompt');
          if (prompt) {
            AnimationManager.animateContinuePromptIn(prompt);
          }
        }
      }, 500);
    }

    return true;
  }

  /**
   * Prepare for transition between pages
   */
  prepareForTransition(toHomePage) {
    // Set state based on direction
    this.transitionTo(toHomePage ? APP_STATES.TRANSITIONING_TO_HOME : APP_STATES.TRANSITIONING_TO_SUBPAGE);

    // Flag for back-to-home navigation
    if (toHomePage) {
      this.setNavigatingBackToHome(true);
    }

    // Prepare the scene for transition
    if (this.sceneInstance && typeof this.sceneInstance.prepareForTransition === 'function') {
      this.sceneInstance.prepareForTransition();
    }

    // Create transition overlay effect
    AnimationManager.createTransitionOverlay('out');
  }

  /**
   * Handle actions specific to each state
   */
  performStateActions(newState, previousState) {
    // Clear any existing animations for clean state
    AnimationManager.clearAnimations();

    // Perform specific actions for each state
    switch (newState) {
      case APP_STATES.INITIALIZING:
        // Initial state, no specific actions needed
        break;

      case APP_STATES.IDLE:
        UIManager.ensureMenuHidden();
        if (this.isHomePage()) {
          UIManager.showContinuePrompt();
        }
        break;

      case APP_STATES.MENU_OPEN:
        UIManager.hideContinuePrompt();
        UIManager.ensureMenuVisible();
        break;

      case APP_STATES.MENU_OPENING:
      case APP_STATES.MENU_CLOSING:
        // Transition states, animations handled elsewhere
        break;

      case APP_STATES.TRANSITIONING_TO_SUBPAGE:
      case APP_STATES.TRANSITIONING_TO_HOME:
        // Transition states, animations handled elsewhere
        break;

      case APP_STATES.SUBPAGE:
        UIManager.hideContinuePrompt();
        UIManager.ensureMenuHidden();
        break;
    }
  }

  /**
   * Event Handlers for Astro page transitions
   */
  handleBeforePreparation(e) {
    this._log('Before preparation, navigating to:', e.to);

    // Detect navigation direction
    const isNavigatingToHome = e.to === '/' || e.to.endsWith('/');
    const isLeavingHomePage = this.isHomePage();

    if (isNavigatingToHome && !isLeavingHomePage) {
      this.prepareForTransition(true);
    } else if (isLeavingHomePage) {
      this.prepareForTransition(false);
    }
  }

  handleBeforeNavigation(e) {
    this._log('Before navigation');

    // Additional preparation before navigation starts
    if (this.isTransitioning) {
      // Make sure any animations are in a stable state
      AnimationManager.clearAnimations();
    }
  }

  handleAfterNavigation() {
    this._log('After navigation');

    // Create entrance transition effect
    AnimationManager.createTransitionOverlay('in');

    // Update state based on new URL
    if (this.isHomePage()) {
      // Reset scene state when arriving at home
      this.resetSceneTransitionState();

      // If we came from a subpage, ensure we're in IDLE state
      if (this._currentState === APP_STATES.TRANSITIONING_TO_HOME) {
        this.transitionTo(APP_STATES.IDLE);
      }
    } else {
      // We're on a subpage
      this.transitionTo(APP_STATES.SUBPAGE);
    }
  }

  handlePageLoad() {
    this._log('Page load');

    if (this.isHomePage()) {
      // Reset scene state
      this.resetSceneTransitionState();

      // Check if we navigated back to home
      if (this.isNavigatingBackToHome()) {
        this.setNavigatingBackToHome(false);

        // Special handling for back-to-home navigation
        if (this.sceneInstance && typeof this.sceneInstance.handleReturnToHome === 'function') {
          this.sceneInstance.handleReturnToHome();
        }

        this.transitionTo(APP_STATES.IDLE);
        UIManager.enforceCorrectUIState();
      }
    }
  }

  /**
   * Conditional logging
   */
  _log(...args) {
    if (this._debugMode) {
      console.log('[AppState]', ...args);
    }
  }
}

// Export APP_STATES enum for external use
export { APP_STATES };

// Export a singleton instance
export const AppState = new AppStateManager();
