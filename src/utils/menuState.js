// src/utils/menuState.js
// A simplified utility to manage menu state without sessionStorage

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
 * Shows the menu by setting the appropriate classes
 * This is a direct DOM manipulation
 */
export function showMenu() {
  // Don't automatically show menu on subpages
  if (isSubPage()) {
    console.log('Menu not shown - on subpage');
    return false;
  }

  const menu = document.getElementById('menu');
  const continuePrompt = document.getElementById('continue-prompt');

  if (menu) {
    // Make sure hidden class is removed
    menu.classList.remove('hidden');
    // Add visible class
    menu.classList.add('visible');

    // Also hide the continue prompt as it's not needed when menu is shown
    if (continuePrompt) {
      continuePrompt.classList.add('hidden');
    }

    // Make home content visible if it exists
    const homeContent = document.querySelector('.home-content');
    if (homeContent) {
      homeContent.style.opacity = '1';
    }

    console.log('Menu shown');
    return true;
  }
  return false;
}

/**
 * Hides the menu by setting the appropriate classes
 */
export function hideMenu() {
  const menu = document.getElementById('menu');
  if (menu) {
    menu.classList.remove('visible');
    menu.classList.add('hidden');
    return true;
  }
  return false;
}

/**
 * Initializes the back button to show the menu when clicked
 * Should be called when the app initializes
 */
export function initializeBackButton() {
  // Wait for DOM to be fully loaded
  document.addEventListener('DOMContentLoaded', () => {
    const backButton = document.getElementById('back-to-home');
    if (backButton) {
      // Keep the default navigation behavior but add menu display
      backButton.addEventListener('click', (event) => {
        // If we're already on the home page, just show the menu
        if (!isSubPage()) {
          event.preventDefault(); // Prevent navigation if already home
          showMenu();
        }
        // Otherwise let the navigation happen normally
      });
    }
  });
}

/**
 * Function to be called on home page load to prepare the menu
 * This should be called in your home page component or main app entry
 * BUT it will NOT automatically show the menu anymore
 */
export function setupHomePage() {
  // Check if we're on the home page
  if (!isSubPage()) {
    // Show the continue prompt instead of automatically showing the menu
    const continuePrompt = document.getElementById('continue-prompt');
    if (continuePrompt) {
      continuePrompt.classList.remove('hidden');
    }

    // Ensure menu is hidden until user interaction
    const menu = document.getElementById('menu');
    if (menu) {
      menu.classList.add('hidden');
      menu.classList.remove('visible');
    }
  }
}

/**
 * Handle user interaction (space key or logo click)
 * Only works on home page
 * @returns {boolean} Whether menu was shown
 */
export function handleUserTrigger() {
  // Only allow on home page
  if (!isMenuInteractionAllowed()) {
    return false;
  }

  const menu = document.getElementById('menu');
  if (menu && !menu.classList.contains('visible')) {
    return showMenu();
  }

  return false;
}

// Export the helper functions
export { isMenuInteractionAllowed };
