/**
 * menuState.js - Compatibility Layer
 * 
 * This version preserves the old API while adding compatibility with the new system
 */

// Ensure we have the global navigation flag
if (typeof window !== 'undefined') {
  window.navBackToHome = window.navBackToHome || false;
}

/**
 * Checks if current page is a subpage (not home)
 * @returns {boolean} true if on a subpage
 */
function isSubPage() {
  return window.location.pathname !== '/' && window.location.pathname !== '';
}

/**
 * Checks if menu interaction should be allowed
 * Only allowed on home page
 * @returns {boolean} true if menu interaction is allowed
 */
function isMenuInteractionAllowed() {
  return !isSubPage();
}

/**
 * Shows the menu with enhanced animation
 * This is a direct DOM manipulation with advanced animations
 */
export function showMenu() {
  // Now delegates to Scene.handleContinue() if available
  if (window.sceneInstance && typeof window.sceneInstance.handleContinue === 'function') {
    window.sceneInstance.handleContinue();
    return true;
  }
  
  // Fallback to direct DOM manipulation
  if (isSubPage()) {
    console.log('Menu not shown - on subpage');
    return false;
  }

  const menu = document.getElementById('menu');
  const continuePrompt = document.getElementById('continue-prompt');
  
  if (menu) {
    menu.classList.remove('hidden');
    menu.classList.add('visible');
    
    if (continuePrompt) {
      continuePrompt.classList.add('hidden');
    }
    
    return true;
  }
  return false;
}

/**
 * Hides the menu with enhanced animation
 */
export function hideMenu() {
  // Delegate to Scene.closeMenu() if available
  if (window.sceneInstance && typeof window.sceneInstance.closeMenu === 'function') {
    window.sceneInstance.closeMenu();
    return true;
  }
  
  // Fallback to direct DOM manipulation
  const menu = document.getElementById('menu');
  
  if (menu) {
    menu.classList.remove('visible');
    setTimeout(() => {
      menu.classList.add('hidden');
    }, 500);
    
    const continuePrompt = document.getElementById('continue-prompt');
    if (continuePrompt && (window.location.pathname === '/' || window.location.pathname === '')) {
      continuePrompt.classList.remove('hidden');
    }
    
    return true;
  }
  return false;
}

/**
 * Initializes the back button with custom view transition
 */
export function initializeBackButton() {
  // Delegate to EventHandler if available
  if (typeof EventHandler !== 'undefined' && EventHandler.initializeBackButton) {
    EventHandler.initializeBackButton();
    return;
  }
  
  // Fallback implementation
  const backButton = document.getElementById('back-to-home');
  if (backButton) {
    backButton.addEventListener('click', (event) => {
      if (!isSubPage()) {
        event.preventDefault();
        showMenu();
      } else {
        window.navBackToHome = true;
      }
    });
  }
}

/**
 * Function to be called on home page load to prepare the menu
 */
export function setupHomePage() {
  if (!isSubPage()) {
    const continuePrompt = document.getElementById('continue-prompt');
    const menu = document.getElementById('menu');
    
    // Check for back navigation
    if (window.navBackToHome) {
      if (window.sceneInstance && typeof window.sceneInstance.handleContinue === 'function') {
        setTimeout(() => {
          window.sceneInstance.handleContinue();
          window.navBackToHome = false;
        }, 200);
      }
    } else if (menu && !menu.classList.contains('visible') && continuePrompt) {
      continuePrompt.classList.remove('hidden');
    }
  }
}

/**
 * Handle user interaction (space key or logo click)
 */
export function handleUserTrigger() {
  if (!isMenuInteractionAllowed()) return false;
  
  // Delegate to Scene.handleContinue if available
  if (window.sceneInstance && typeof window.sceneInstance.handleContinue === 'function') {
    window.sceneInstance.handleContinue();
    return true;
  }
  
  return showMenu();
}

/**
 * Enforce the correct state of the continue prompt
 */
export function enforceContinuePromptState() {
  const menu = document.getElementById('menu');
  const continuePrompt = document.getElementById('continue-prompt');
  
  if (!menu || !continuePrompt) return;
  
  // If menu is visible, ensure prompt is hidden
  if (menu.classList.contains('visible')) {
    continuePrompt.classList.add('hidden');
  } else if (window.location.pathname === '/' || window.location.pathname === '') {
    // If on home page and menu is not visible, ensure prompt is shown
    continuePrompt.classList.remove('hidden');
  }
  
  console.log('Enforced continue prompt state');
}

// Export the helper functions
export { isMenuInteractionAllowed };