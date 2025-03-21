/**
 * Example usage:
 *
 * setAttributes(contentContainer, {
 *   id: 'isi-content',
 *   role: 'region',
 *   'aria-labelledby': title.id,
 *   'aria-hidden': !isOpen,
 *   style: {
 *     backgroundColor: '#000',
 *   },
 *   dataset: {
 *     year: '2023',
 *     month: 'June',
 *   },
 *   onClick: () => { ... }
 * });
 */

/**
 * Method that applies multiple attributes to a single DOM Element
 * @param {Element|HTMLElement} el  - DOM Element to attach the attributes to
 * @param {Object} attrs            - attributes object
 */
export default function setAttributes(el, attrs) {
  if (!(el instanceof Element || el instanceof HTMLElement)) return;

  Object.entries(attrs).forEach(([key, value]) => {
    if (typeof value === 'object') {
      Object.entries(value).forEach(([innerKey, innerValue]) => {
        el[key][innerKey] = innerValue;
      });
    } else if (key.startsWith('on')) {
      el.addEventListener(key.substring(2).toLowerCase(), value);
    } else {
      el.setAttribute(key, value);
    }
  });
}
