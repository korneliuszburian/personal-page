/**
 * UIManager.js
 * Handles all direct DOM manipulations for the application
 * Provides a clean interface for UI operations while avoiding state management
 */
import { APP_STATES } from './AppState';

class UIManagerClass {
  constructor() {
    // Element cache to avoid repeated DOM queries
    this._elements = {
      menu: null,
      continuePrompt: null,
      loadingScreen: null,
      sceneContainer: null,
      homeContent: null
    };

    // Track last UI enforcement time to prevent flicker
    this._lastEnforcementTime = 0;

    // Debug mode
    this._debugMode = false;

    // Make this instance globally available
    if (typeof window !== 'undefined') {
      window.UIManager = this;
    }
  }

  /**
   * Set debug mode on/off
   */
  setDebugMode(enabled) {
    this._debugMode = !!enabled;
    this._log(`Debug mode ${this._debugMode ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get animation manager if available
   */
  get animationManager() {
    return window.AnimationManager || null;
  }

  /**
   * Initialize and cache DOM elements
   */
  initialize() {
    this._elements = {
      menu: document.getElementById('menu'),
      continuePrompt: document.getElementById('continue-prompt'),
      loadingScreen: document.getElementById('loading-screen'),
      sceneContainer: document.getElementById('scene-container'),
      homeContent: document.querySelector('.home-content')
    };

    this._log('UI elements cached');

    // Apply any needed initial styles
    this._fixInitialStyles();
  }

  /**
   * Fix any initial style issues when page loads
   */
  _fixInitialStyles() {
    // Ensure menu has no leftover inline styles
    if (this._elements.menu) {
      this._elements.menu.style.opacity = '';

      const menuItems = this._elements.menu.querySelectorAll('nav ul li');
      menuItems.forEach(item => {
        item.style.opacity = '';
        item.style.transform = '';
      });
    }
  }

  /**
   * Get a cached DOM element or query for it if not cached
   */
  getElement(key) {
    if (!this._elements[key]) {
      this._elements[key] = document.getElementById(key) || document.querySelector(`.${key}`);
    }
    return this._elements[key];
  }

  /**
   * Show the menu immediately (without animation)
   */
  ensureMenuVisible() {
    const menu = this.getElement('menu');
    if (!menu) return;

    menu.classList.remove('hidden');
    menu.classList.add('visible');
    menu.style.opacity = '';

    // Also make home content visible if it exists
    const homeContent = this.getElement('homeContent');
    if (homeContent) {
      homeContent.style.opacity = '1';
    }

    this._log('Menu visibility enforced');
  }

  /**
   * Hide the menu immediately (without animation)
   */
  ensureMenuHidden() {
    const menu = this.getElement('menu');
    if (!menu) return;

    menu.classList.remove('visible');
    menu.classList.add('hidden');
    menu.style.opacity = '';

    // Reset menu items
    const menuItems = menu.querySelectorAll('nav ul li');
    menuItems.forEach(item => {
      item.style.opacity = '';
      item.style.transform = '';
    });

    this._log('Menu hidden state enforced');
  }

  /**
   * Show the continue prompt with animation
   */
  showContinuePrompt() {
    const prompt = this.getElement('continuePrompt');
    if (!prompt) return;

    this._log('Showing continue prompt');

    if (this.animationManager) {
      this.animationManager.animateContinuePromptIn(prompt);
    } else {
      // Simple fallback if AnimationManager not available
      prompt.classList.remove('hidden');
      prompt.style.opacity = '1';
    }
  }

  /**
   * Hide the continue prompt
   */
  hideContinuePrompt() {
    const prompt = this.getElement('continuePrompt');
    if (!prompt) return;

    this._log('Hiding continue prompt');

    if (this.animationManager) {
      this.animationManager.animateContinuePromptOut(prompt);
    } else {
      // Simple fallback if AnimationManager not available
      prompt.style.opacity = '0';
      setTimeout(() => {
        prompt.classList.add('hidden');
      }, 600);
    }
  }

  /**
   * Hide the loading screen
   */
  hideLoadingScreen() {
    const loadingScreen = this.getElement('loadingScreen');
    if (!loadingScreen) return;

    this._log('Hiding loading screen');
    loadingScreen.style.opacity = '0';

    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 500);
  }

  /**
   * Show the home content
   */
  showHomeContent() {
    const homeContent = this.getElement('homeContent');
    if (!homeContent) return;

    homeContent.style.opacity = '1';
  }

  /**
   * Hide the home content
   */
  hideHomeContent() {
    const homeContent = this.getElement('homeContent');
    if (!homeContent) return;

    homeContent.style.opacity = '0';
  }

  /**
   * Enforce correct UI state based on App State
   * Acts as a recovery mechanism for when state gets out of sync
   */
  enforceCorrectUIState(appState) {
    // Don't run too frequently to prevent flickering
    const now = Date.now();
    if (now - this._lastEnforcementTime < 300) return;
    this._lastEnforcementTime = now;

    if (!appState) {
      this._log('Cannot enforce UI state: AppState required');
      return;
    }

    this._log('Enforcing correct UI state for', appState.currentState);

    const menu = this.getElement('menu');
    const continuePrompt = this.getElement('continuePrompt');
    const homeContent = this.getElement('homeContent');

    if (!menu || !continuePrompt) return;

    // Fix menu item styles to ensure they're ready for animation
    const menuItems = menu.querySelectorAll('nav ul li');

    // Enforce correct UI based on app state
    switch (appState.currentState) {
      case APP_STATES.IDLE:
        // Should show continue prompt, hide menu
        if (continuePrompt.classList.contains('hidden')) {
          continuePrompt.classList.remove('hidden');
          continuePrompt.style.opacity = '1';
        }

        if (menu.classList.contains('visible')) {
          this.ensureMenuHidden();
        }

        if (homeContent) {
          homeContent.style.opacity = '0';
        }
        break;

      case APP_STATES.MENU_OPEN:
        // Should hide continue prompt, show menu
        if (!continuePrompt.classList.contains('hidden')) {
          continuePrompt.classList.add('hidden');
          continuePrompt.style.opacity = '0';
        }

        if (!menu.classList.contains('visible')) {
          this.ensureMenuVisible();

          // Ensure menu items are visible and in correct position
          menuItems.forEach(item => {
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
          });
        }

        if (homeContent) {
          homeContent.style.opacity = '1';
        }
        break;

      case APP_STATES.SUBPAGE:
        // On subpage, ensure menu is hidden and prompt is hidden
        if (!continuePrompt.classList.contains('hidden')) {
          continuePrompt.classList.add('hidden');
        }

        if (menu.classList.contains('visible')) {
          this.ensureMenuHidden();
        }
        break;

      default:
        // For transition states, don't enforce changes to avoid conflicts
        // with ongoing animations
        break;
    }
  }

  /**
   * Handle page transition effects
   */
  handlePageTransition(isLeavingPage, isHomePage) {
    if (isLeavingPage) {
      // Leaving current page
      this._log(`Transitioning away from ${isHomePage ? 'home' : 'subpage'}`);

      // Fade out content
      const content = isHomePage ? this.getElement('homeContent') : document.querySelector('.photos-container');

      if (content) {
        content.style.opacity = '0';
      }
    } else {
      // Entering new page
      this._log(`Transitioning to ${isHomePage ? 'home' : 'subpage'}`);

      // Fade in content with delay to allow for scene transition
      const content = isHomePage ? this.getElement('homeContent') : document.querySelector('.photos-container');

      if (content) {
        // Reset opacity first
        content.style.opacity = '0';

        // Trigger fade in with delay
        setTimeout(() => {
          content.style.opacity = '1';
        }, 200);
      }
    }
  }

  /**
   * Conditional logging
   */
  _log(...args) {
    if (this._debugMode) {
      console.log('[UIManager]', ...args);
    }
  }
}

// Export a singleton instance
export const UIManager = new UIManagerClass();
