import {
  sampleRUM,
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForLCP,
  loadBlocks,
  loadCSS,
} from './aem.js';

import {
  div, domEl, h4, h6, button,
} from './dom-helpers.js';

import { initDigitalData, trackVideoData } from './datalayer.js';

const LCP_BLOCKS = ['carousel']; // add your LCP blocks to the list

// media query match that indicates mobile/tablet width
export const isDesktop = window.matchMedia('(min-width: 992px)');

/**
 * Builds a section divider
 * @param {Element} main The container element
 */
function buildSectionDivider(main) {
  const sectionDividers = main.querySelectorAll('code');

  sectionDividers.forEach((el) => {
    const alt = el.innerText.trim();
    const lower = alt.toLowerCase();
    if (lower === 'divider') {
      el.innerText = '';
      el.classList.add('section-divider');
    }
  });
}

/**
 * Builds a media-dependent picture
 * @param {Element} main The container element
 */
function buildMediaDependentPicture(main) {
  const mediaTags = main.querySelectorAll('code');

  mediaTags.forEach((el) => {
    const alt = el.innerText.trim();
    const lower = alt.toLowerCase();
    const mediaTypes = [
      'mobile',
      'tablet',
      'laptop',
      'desktop',
      'hd',
      'tablet-plus',
      'laptop-plus',
      'desktop-plus',
      'tablet-minus',
      'laptop-minus',
      'desktop-minus',
    ];
    if (
      mediaTypes.includes(lower)
      && el.previousElementSibling != null
      && el.previousElementSibling.classList != null
    ) {
      el.previousElementSibling.classList.add(`media-${lower}`);
      el.innerText = '';
      el.remove();
    }
  });
}

function decorateSectionAnchors(main) {
  main.querySelectorAll('.section[data-anchor]').forEach((section) => {
    const { anchor } = section.dataset;
    section.id = anchor;
  });
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    buildSectionDivider(main);
    buildMediaDependentPicture(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/**
 * Returns a picture element with webp and fallbacks
 * @param {string} src The image URL
 * @param {string} [alt] The image alternative text
 * @param {boolean} [eager] Set loading attribute to eager
 * @param {Array} [breakpoints] Breakpoints and corresponding params (eg. width)
 * @returns {Element} The picture element
 */
export function createOptimizedPicture(
  src,
  alt = '',
  eager = false,
  breakpoints = [{ media: '(min-width: 600px)', width: '2000' }, { width: '750' }],
) {
  const url = new URL(src, window.location.href);
  const picture = document.createElement('picture');
  const { pathname } = url;
  const ext = pathname.substring(pathname.lastIndexOf('.') + 1);

  // webp
  breakpoints.forEach((br) => {
    const source = document.createElement('source');
    if (br.media) source.setAttribute('media', br.media);
    source.setAttribute('type', 'image/webp');
    source.setAttribute('srcset', `${pathname}?width=${br.width}&format=webply&optimize=low`);
    picture.appendChild(source);
  });

  // fallback
  breakpoints.forEach((br, i) => {
    if (i < breakpoints.length - 1) {
      const source = document.createElement('source');
      if (br.media) source.setAttribute('media', br.media);
      source.setAttribute('srcset', `${pathname}?width=${br.width}&format=${ext}&optimize=low`);
      picture.appendChild(source);
    } else {
      const img = document.createElement('img');
      img.setAttribute('loading', eager ? 'eager' : 'lazy');
      img.setAttribute('alt', alt);
      picture.appendChild(img);
      img.setAttribute('src', `${pathname}?width=${br.width}&format=${ext}&optimize=low`);
    }
  });

  return picture;
}

function linkPicture(picture) {
  const checkAndAppendLink = (anchor) => {
    if (anchor && anchor.textContent.trim().startsWith('https://')) {
      anchor.innerHTML = '';
      anchor.className = '';
      anchor.appendChild(picture);
    }
  };

  // Handle case where link is directly after image, or with a <br> between.
  let nextSib = picture.nextElementSibling;
  if (nextSib?.tagName === 'BR') {
    const br = nextSib;
    nextSib = nextSib.nextElementSibling;
    br.remove();
  }

  if (nextSib?.tagName === 'A') {
    checkAndAppendLink(nextSib);
    return;
  }

  // Handle case where link is in a separate paragraph
  const parent = picture.parentElement;
  const parentSibling = parent.nextElementSibling;
  if (parent.tagName === 'P' && parentSibling?.tagName === 'P') {
    const maybeA = parentSibling.children?.[0];
    if (parentSibling.children?.length === 1 && maybeA?.tagName === 'A') {
      checkAndAppendLink(maybeA);
      if (parent.children.length === 0) {
        parent.remove();
      }
    }
  }
}

export function findHighestParent(element) {
  let highestParent = element.closest('.section');
  if (highestParent === null) {
    highestParent = element;
  }
  return highestParent;
}

export function decorateAnchors(block, closeNavCallback = null) {
  const currentOrigin = window.location.origin;
  const currentPathName = window.location.pathname;
  const marginTop = 10;
  block.querySelectorAll('a').forEach((link) => {
    const linkOrigin = link.origin;
    const linkPathName = link.pathname;
    const linkHash = link.hash;
    if (currentOrigin === linkOrigin && currentPathName === linkPathName && linkHash !== '#0') {
      link.addEventListener('click', (e) => {
        const { hash } = e.target;
        const targetElement = document.querySelector(hash);
        if (targetElement === null) return;
        e.preventDefault();
        const highestParent = findHighestParent(targetElement);
        let sectionStart = highestParent.firstElementChild;
        if (sectionStart === null) {
          sectionStart = highestParent;
        }
        let headerHeight = document.getElementsByClassName('nav-brand')[0].offsetHeight;
        if (isDesktop.matches) {
          headerHeight = document.getElementsByClassName('nav-sections')[0].offsetHeight;
        } else if (closeNavCallback !== null) {
          closeNavCallback();
        }
        window.scrollTo({
          top: highestParent.getBoundingClientRect().y + window.scrollY - headerHeight - marginTop,
          left: 0,
          behavior: 'smooth',
        });

        /**
         * Update the hash in the URL
         * We use the history to prevent triggering the hashChange event
         */
        window.history.pushState({}, '', hash);
      });
    }
  });
}

export function decorateLinkedPictures(block) {
  block.querySelectorAll('picture').forEach((picture) => {
    linkPicture(picture);
  });
}

export function postVideoMessage(player, method, params) {
  let message = {
    method,
  };

  if (params !== undefined) {
    message.value = params;
  }

  message = JSON.stringify(message);

  player.contentWindow.postMessage(message, '*');
}

export function configureVideoMessages(videoIframe) {
  postVideoMessage(videoIframe, 'getDuration', '');
  postVideoMessage(videoIframe, 'getChapters', '');
  postVideoMessage(videoIframe, 'getVideoTitle', '');
  postVideoMessage(videoIframe, 'getVideoId', '');
  postVideoMessage(videoIframe, 'addEventListener', 'play');
  postVideoMessage(videoIframe, 'addEventListener', 'pause');
  postVideoMessage(videoIframe, 'addEventListener', 'ended');
  postVideoMessage(videoIframe, 'addEventListener', 'finish');
  postVideoMessage(videoIframe, 'addEventListener', 'seeked');
  postVideoMessage(videoIframe, 'addEventListener', 'cuepoint');
  postVideoMessage(videoIframe, 'addCuePoint', { time: 0, data: {} });
}

export function createModal(document, title, message, buttons) {
  const main = document.querySelector('main');
  const container = div({ class: 'modal-container' });
  const modal = div({ class: 'modal' });
  const close = div({ class: 'modal-close' });
  const modalTitle = h4({ class: 'modal-title' });
  modalTitle.textContent = title;
  const modalMessage = h6({ class: 'modal-message' });
  modalMessage.textContent = message;
  const buttonsDiv = div({ class: 'modal-buttons' });
  buttons.forEach((b) => {
    if (b.name && b.action) {
      const bComponent = button({ class: `${b.class} modal-button` });
      bComponent.textContent = b.name;
      bComponent.addEventListener('click', b.action);
      buttonsDiv.append(bComponent);
    }
  });

  close.addEventListener('click', (e) => {
    e.preventDefault();
    container.remove();
  });

  modal.append(close, modalTitle, modalMessage, buttonsDiv);
  container.append(modal);
  main.append(container);
}

export function createVideoModal(main, src, autoplay) {
  if (
    main.querySelector('.video-container') !== null
    && main.querySelector('.video-iframe') !== null
    && !main.querySelector('.video-iframe').getAttribute('src').startsWith(src)
  ) {
    const videoIframe = main.querySelector('.video-iframe');
    videoIframe.setAttribute('src', `${src}&api=1&autoplay=${autoplay}`);
    window.setTimeout(() => postVideoMessage(videoIframe, 'addEventListener', 'ready'), 500);
    delete videoIframe.dataset.highestPlayback;
    delete videoIframe.dataset.action;
    configureVideoMessages(videoIframe);
  }

  if (main.querySelector('.video-container') === null) {
    const videoContainer = div({ class: 'video-container' });
    const videoModal = div({ class: 'video-modal' });
    const videoWrap = div({ class: 'video-wrap' });
    const close = div({ class: 'video-close' });
    const videoIframe = domEl('iframe', { class: 'video-iframe', allow: 'autoplay' });

    videoIframe.setAttribute('src', `${src}&api=1&autoplay=${autoplay}`);

    window.setTimeout(() => postVideoMessage(videoIframe, 'addEventListener', 'ready'), 500);

    window.addEventListener('message', (event) => {
      // Handle messages from the vimeo player only
      if (!/^https?:\/\/player.vimeo.com/.test(event.origin)) {
        return false;
      }

      const eventData = JSON.parse(event.data);
      if (eventData.event === 'ready') {
        configureVideoMessages(videoIframe);
        if (videoModal.classList.contains('fade-in')) {
          postVideoMessage(videoIframe, 'play', '');
        }
      } else if (eventData.method === 'getDuration') {
        videoIframe.dataset.length = eventData.value;
        postVideoMessage(videoIframe, 'addCuePoint', { time: (1 * eventData.value) / 4 });
        postVideoMessage(videoIframe, 'addCuePoint', { time: (2 * eventData.value) / 4 });
        postVideoMessage(videoIframe, 'addCuePoint', { time: (3 * eventData.value) / 4 });
        postVideoMessage(videoIframe, 'addCuePoint', { time: (4 * eventData.value) / 4 });
      } else if (eventData.method === 'getChapters') {
        videoIframe.dataset.chapters = eventData.value.length;
      } else if (eventData.method === 'getVideoTitle') {
        videoIframe.dataset.video_title = eventData.value;
      } else if (eventData.method === 'getVideoId') {
        videoIframe.dataset.video_id = eventData.value;
      } else if (eventData.event === 'cuepoint') {
        if (eventData.data) {
          videoIframe.dataset.playback = eventData.data.time;
        }
        trackVideoData(videoIframe, 'milestone');
      } else if (
        eventData.event === 'play'
        || eventData.event === 'pause'
        || eventData.event === 'finish'
        || eventData.event === 'ended'
        || eventData.event === 'seek'
      ) {
        if (eventData.data) {
          videoIframe.dataset.playback = eventData.data.seconds;
          videoIframe.dataset.length = eventData.data.duration;
        }
        if (eventData.event === 'play') {
          if (videoIframe.dataset.action === 'pause') {
            videoIframe.dataset.action = 'resume';
          } else if (videoIframe.dataset.action === 'end') {
            videoIframe.dataset.action = 'replay';
          } else {
            videoIframe.dataset.action = 'play';
          }
        }
        if (eventData.event === 'pause') {
          videoIframe.dataset.action = 'pause';
        }
        if (eventData.event === 'ended' || eventData.event === 'finish') {
          videoIframe.dataset.action = 'end';
        }
        trackVideoData(videoIframe, eventData.event);
      }
      return true;
    });
    videoWrap.append(videoIframe);
    videoModal.append(close, videoWrap);
    videoContainer.append(videoModal);
    main.append(videoContainer);
  }
}

export function startVideoModal(main, src) {
  createVideoModal(main, src, 1);

  const closeButton = main.querySelector('.video-close');
  const videoContainer = main.querySelector('.video-container');
  const videoModal = main.querySelector('.video-modal');
  const videoIframe = main.querySelector('.video-iframe');
  videoIframe.dataset.action = 'click';
  trackVideoData(videoIframe, 'click');
  if (videoModal) {
    videoModal.classList.add('fade-in');
  }
  if (videoContainer) {
    videoContainer.classList.add('fade-in');
  }
  if (videoIframe && videoModal) {
    videoModal.onanimationend = () => {
      videoIframe.contentWindow.postMessage('{"method":"play"}', '*');
    };
  }
  if (closeButton) {
    const fadeOut = () => {
      videoIframe.contentWindow.postMessage('{"method":"pause"}', '*');
      videoModal.classList.add('fade-out');
      videoModal.classList.remove('fade-in');
      videoContainer.classList.add('fade-out');
      videoContainer.classList.remove('fade-in');
      videoModal.onanimationend = () => {
        if (videoModal.classList.contains('fade-out')) {
          videoModal.classList.remove('fade-out');
          videoContainer.classList.remove('fade-out');
        }
      };
    };
    closeButton.addEventListener('click', (e) => {
      e.preventDefault();
      fadeOut();
    });

    document.addEventListener('keydown', (event) => {
      if (event.keyCode === 27 || event.key === 'Escape') {
        fadeOut();
      }
    });
  }
}

export function decorateVideo(main) {
  const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.querySelector('picture').dispatchEvent(new Event('hover'));
      }
    });
  });

  main.querySelectorAll('a').forEach((link) => {
    // look for picture that have a link after wards
    const href = link.getAttribute('href');
    if (href.includes('vimeo')) {
      const pictures = link.closest('p').nextElementSibling.querySelectorAll('picture');
      if (pictures.length > 0) {
        const videoPlaceHolder = pictures[0];
        videoPlaceHolder.classList.add('video-thumbnail');
        const videoThumbnailWrapper = link.parentElement;
        videoThumbnailWrapper.classList.add('video-thumbnail-wrapper');
        videoObserver.observe(videoThumbnailWrapper);
        link.innerHTML = '';
        link.className = '';
        link.href = '#0';
        link.onclick = () => false;
        link.appendChild(videoPlaceHolder);
        link.addEventListener('mouseover', () => {
          createVideoModal(main, href, 0);
        });
        link.addEventListener('click', () => {
          startVideoModal(main, href);
        });
      }
    }
  });
}

export function decorateLinks(main) {
  const faqSection = main.querySelector('.resource-faq');
  if (faqSection) {
    const links = faqSection.querySelectorAll('.columns a');

    links.forEach((link) => {
      if (link.host !== window.location.host) {
        link.target = '_blank';
      }
    });
  }
}

/**
 * Get the URL hash and scroll to the target element
 * by clicking on the corresponding anchor
 */
function scrollToHash() {
  const { hash } = window.location;
  const element = hash ? document.querySelector(`[href="/${hash}"]`) : false;

  if (hash && element) element.click();
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateLinkedPictures(main);
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateSectionAnchors(main);
  decorateBlocks(main);
  decorateVideo(main);
  decorateAnchors(main);
  decorateLinks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await waitForLCP(LCP_BLOCKS);
  }
}

/**
 * Adds the favicon.
 * @param {string} href The favicon URL
 */
export function addFavIcon(href) {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = href;
  const existingLink = document.querySelector('head link[rel="icon"]');
  if (existingLink) {
    existingLink.parentElement.replaceChild(link, existingLink);
  } else {
    document.getElementsByTagName('head')[0].appendChild(link);
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadBlocks(main);
  await loadHeader(doc.querySelector('header'));
  await loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  addFavIcon(`${window.hlx.codeBasePath}/icons/favicon.png`);
  sampleRUM('lazy');
  sampleRUM.observe(main.querySelectorAll('div[data-block-name]'));
  sampleRUM.observe(main.querySelectorAll('picture > img'));
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  await initDigitalData(document);
  loadDelayed();
  scrollToHash();
}

loadPage();
