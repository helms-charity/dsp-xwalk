import { button, div, span } from '../../scripts/dom-helpers.js';
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

  return button(
    {
      type: 'button',
      class: `${BLOCK_CLASS}-toggle`,
      'aria-expanded': true,
      'aria-controls': contentContainer.id,
      onClick: handleToggler,
    },
    span(
      { class: `${BLOCK_CLASS}-toggle-label` },
      BLOCK_EXPANDER_DEFAULT_OPEN ? BLOCK_COLLAPSE_TEXT : BLOCK_EXPAND_TEXT,
    ),
  );
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
  const contentInner = div({ class: `${BLOCK_CLASS}-content-inner` });
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

export default function decorate(block) {
  const hook = document.querySelector(HOOK);

  // don't do anything if the hook element is missing
  if (!hook) return;

  render(block);
  io(block, hook);
}