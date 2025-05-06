import setAttributes from '../../scripts/set-attributes.js';
import { trackInteraction } from '../../scripts/datalayer.js';

const BLOCK_CLASS = 'isi';
const BLOCK_EXPAND_TEXT = 'expand';
const BLOCK_COLLAPSE_TEXT = 'collapse';
const BLOCK_EXPANDER_DEFAULT_OPEN = true;
const HOOK = '[data-isi-hook]';

/**
 * Define an IntersectionObserver for the block
 * @param {HTMLElement} block - element to change
 * @param {string}      hook  - class of the observed target
 */
function io(block, hook) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      block.classList.toggle(
        `is-${BLOCK_CLASS}-visible`,
        !entry.isIntersecting,
      );
    });
  });

  observer.observe(hook);
}

/**
 * Set the expander
 * @param {HTMLElement} title             - title element used for ARIA
 * @param {HTMLElement} contentContainer  - content element used for ARIA
 * @returns {HTMLElement}                 - expander button
 */
function setExpander(title, contentContainer) {
  let isOpen = BLOCK_EXPANDER_DEFAULT_OPEN;
  const handleToggler = (e) => {
    trackInteraction(e.currentTarget);
    isOpen = !isOpen;
    e.currentTarget.querySelector(`.${BLOCK_CLASS}-toggle-label`).innerText = isOpen
      ? BLOCK_COLLAPSE_TEXT
      : BLOCK_EXPAND_TEXT;
    e.currentTarget.setAttribute('aria-expanded', isOpen);
    contentContainer.setAttribute('aria-hidden', !isOpen);
  };

  setAttributes(contentContainer, {
    id: `${BLOCK_CLASS}-content`,
    role: 'region',
    'aria-labelledby': title.id,
    'aria-hidden': !isOpen,
  });

  const buttonElement = document.createElement('button');
  buttonElement.type = 'button';
  buttonElement.className = `${BLOCK_CLASS}-toggle`;
  buttonElement.setAttribute('aria-expanded', true);
  buttonElement.setAttribute('aria-controls', contentContainer.id);
  buttonElement.addEventListener('click', handleToggler);

  const spanElement = document.createElement('span');
  spanElement.className = `${BLOCK_CLASS}-toggle-label`;
  spanElement.innerText = BLOCK_EXPANDER_DEFAULT_OPEN ? BLOCK_COLLAPSE_TEXT : BLOCK_EXPAND_TEXT;
  buttonElement.appendChild(spanElement);

  return buttonElement;
}

/**
 * Renders / decorates the block
 * @param {HTMLElement} block - component block
 */
function render(block) {
  const titleContainer = block.querySelector(':scope > div:first-child');
  const titleInner = titleContainer.querySelector(':scope > div');
  const title = titleInner.querySelector(':scope > *');
  const contentContainer = block.querySelector(':scope > div:last-child');
  const contentWrap = contentContainer.querySelector(':scope > div');
  const contentInner = document.createElement('div');
  contentInner.className = `${BLOCK_CLASS}-content-inner`;
  const expanderButton = setExpander(title, contentContainer);

  titleContainer.classList.add(`${BLOCK_CLASS}-title-container`);
  titleInner.classList.add(`${BLOCK_CLASS}-title-inner`);
  title.classList.add(`${BLOCK_CLASS}-title`);
  contentContainer.classList.add(`${BLOCK_CLASS}-content-container`);
  contentContainer.id = `${BLOCK_CLASS}-content`;
  contentWrap.classList.add(`${BLOCK_CLASS}-content-wrap`);

  titleInner.append(expanderButton);
  contentInner.append(...contentWrap.childNodes);
  contentWrap.append(contentInner);
}

/**
 * Toggles the "isi-wrapper" div as a popup snackbar
 */
function toggleISIPopup() {
  const isiWrapper = document.querySelector('.isi-wrapper');
  if (!isiWrapper) {
    console.error('Element with class "isi-wrapper" not found.');
    return;
  }

  const isiBlock = document.querySelector('.isi');
  if (!isiBlock) {
    console.error('Element with class "isi" block not found.');
    return;
  }

  let isExpanded = false;

  const toggleHeight = () => {
    isExpanded = !isExpanded;
    isiWrapper.style.height = isExpanded ? 'calc(100% - 185px)' : '273px';
    isiWrapper.classList.toggle('is-isi-visible', isExpanded);
    isiBlock.classList.toggle('is-isi-visible', isExpanded);
    toggleButton.innerText = isExpanded ? 'Collapse' : 'Expand';
    toggleButton.style.top = isExpanded ? '10px' : '130px';
  };

  // Initial setup
  isiWrapper.style.position = 'fixed';
  isiWrapper.style.bottom = '0';
  isiWrapper.style.left = '0';
  isiWrapper.style.right = '0';
  isiWrapper.style.height = '273px'; // Default to collapsed height
  isiWrapper.style.transition = 'height 0.35s ease-out';
  isiWrapper.style.zIndex = '101'; // Ensure it sits above other elements

  // Add a toggle button
  const toggleButton = document.createElement('button');
  toggleButton.innerText = 'Expand';
  toggleButton.style.position = 'absolute';
  toggleButton.style.top = '130px';
  toggleButton.style.right = '20px';
  toggleButton.style.zIndex = '102';
  toggleButton.addEventListener('click', toggleHeight);

  isiWrapper.appendChild(toggleButton);
}

// Call the function to initialize the popup
toggleISIPopup();

export default function decorate(block) {
  const hook = document.querySelector(HOOK);

  // don't do anything if the hook element is missing
  if (!hook) return;

  render(block);
  io(block, hook);
}
