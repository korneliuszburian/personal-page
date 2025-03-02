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
  // Don't automatically show menu on subpages
  if (isSubPage()) {
    console.log('Menu not shown - on subpage');
    return false;
  }

  const menu = document.getElementById('menu');
  const continuePrompt = document.getElementById('continue-prompt');
  const scene = document.getElementById('scene-container');

  if (menu) {
    // Make sure hidden class is removed
    menu.classList.remove('hidden');

    // Add visible class with animation
    menu.classList.add('visible');

    // Apply ripple effect to menu background
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

    menu.appendChild(ripple);

    // Animate ripple
    setTimeout(() => {
      ripple.style.transition = 'transform 1s cubic-bezier(0.19, 1, 0.22, 1)';
      ripple.style.transform = 'translate(-50%, -50%) scale(50)';

      // Clean up after animation
      setTimeout(() => {
        ripple.remove();
      }, 1000);
    }, 10);

    // Also hide the continue prompt as it's not needed when menu is shown
    if (continuePrompt) {
      continuePrompt.classList.add('hidden');
    }

    // Make home content visible if it exists
    const homeContent = document.querySelector('.home-content');
    if (homeContent) {
      homeContent.style.opacity = '1';
    }

    // Add subtle camera movement to the scene
    if (scene) {
      scene.style.transition = 'transform 1.5s cubic-bezier(0.19, 1, 0.22, 1)';
      scene.style.transform = 'scale(1.05)';
    }

    console.log('Menu shown with enhanced animation');
    return true;
  }
  return false;
}

/**
 * Hides the menu with enhanced animation
 */
export function hideMenu() {
  const menu = document.getElementById('menu');
  const scene = document.getElementById('scene-container');

  if (menu) {
    // Fade out menu items first
    const menuItems = menu.querySelectorAll('nav ul li');
    menuItems.forEach((item, index) => {
      setTimeout(() => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(-20px)';
      }, index * 50);
    });

    // Then fade out the menu background
    setTimeout(() => {
      menu.classList.remove('visible');

      // Reset scene scale
      if (scene) {
        scene.style.transform = 'scale(1)';
      }

      // Finally hide the menu
      setTimeout(() => {
        menu.classList.add('hidden');

        // Reset menu items for next time
        menuItems.forEach(item => {
          item.style.opacity = '';
          item.style.transform = '';
        });
      }, 500);
    }, menuItems.length * 50 + 100);

    return true;
  }
  return false;
}

/**
 * Initializes the back button with custom view transition
 */
export function initializeBackButton() {
  document.addEventListener('DOMContentLoaded', () => {
    const backButton = document.getElementById('back-to-home');
    if (backButton) {
      // Keep the default navigation behavior but add transition effect
      backButton.addEventListener('click', (event) => {
        // If we're already on the home page, just show the menu
        if (!isSubPage()) {
          event.preventDefault(); // Prevent navigation if already home
          showMenu();
        } else {
          // Apply custom transition when navigating to home page
          // This works in conjunction with Astro's View Transitions
          // by adding additional visual effects
          triggerCustomTransition();
        }
      });
    }
  });
}

/**
 * Triggers a custom DOM-based transition effect
 * This works alongside Astro's View Transitions
 */
function triggerCustomTransition() {
  // Create a transition overlay
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
  // Astro's View Transitions will handle the rest
  setTimeout(() => {
    overlay.remove();
  }, 800);
}

/**
 * Function to be called on home page load to prepare the menu
 * Enhanced with improved animations
 */
export function setupHomePage() {
  // Check if we're on the home page
  if (!isSubPage()) {
    // Show the continue prompt
    const continuePrompt = document.getElementById('continue-prompt');
    if (continuePrompt) {
      continuePrompt.classList.remove('hidden');

      // Add subtle pulse animation to make it more noticeable
      const pulseAnimation = document.createElement('style');
      pulseAnimation.textContent = `
        @keyframes promptPulse {
          0%, 100% { transform: translateX(-50%) scale(1); }
          50% { transform: translateX(-50%) scale(1.05); }
        }
        #continue-prompt {
          animation: glowPulse 3s infinite, promptPulse 2s infinite;
        }
      `;
      document.head.appendChild(pulseAnimation);
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
 * Enhanced with improved animations
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

/**
 * Registers custom view transitions with Astro
 * Should be called early in the application lifecycle
 */
export function registerViewTransitions() {
  if (typeof document !== 'undefined') {
    document.addEventListener('astro:before-preparation', (event) => {
      // Access the Astro View Transitions event
      const astroEvent = event;

      // Check if this is a navigation between specific pages
      const fromPath = window.location.pathname;
      const toPath = new URL(astroEvent.to).pathname;

      // Apply custom transitions based on route patterns
      if (fromPath === '/' && toPath === '/photos') {
        // From home to photos: use particle transition
        astroEvent.direction = 'forward';
        astroEvent.transition = customTransitions.particleDissolve;
      }
      else if (fromPath === '/photos' && toPath === '/') {
        // From photos to home: use distortion transition
        astroEvent.direction = 'backward';
        astroEvent.transition = customTransitions.distortion;
      }
      else {
        // Default enhanced transition for other routes
        astroEvent.transition = customTransitions.slide3D;
      }
    });
  }
}

// Export the helper functions
export { isMenuInteractionAllowed };
