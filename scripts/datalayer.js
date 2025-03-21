import { loadScript } from './aem.js';

const defaultDigitalData = {
  page: {
    pageInfo: {
      domain: window.location.host,
      subDomain: '',
      url: window.location.href,
      path: window.location.pathname,
      pageName: '',
      title: document.title,
      prefix: '',
    },
    category: {
      primaryCategory: '',
      subCategory1: '',
      subCategory2: '',
    },
    attributes: {
      country: '',
      language: '',
      template: '',
      promoMatsNumber: '',
      globalISI: '',
      type: '',
    },
    journey: {
      content: '',
      patient: '',
      messageBucket: '',
    },
    product: {
      name: '',
      franchise: '',
      indication: '',
      division: '',
      brand: '',
    },
    site: {
      type: '',
      experience: '',
      audience: '',
    },
    modal: {
      type: '',
      name: '',
      position: '',
      enabled: '',
      displayed: '',
    },
    search: {
      autoPosition: '',
      term: '',
      count: '',
      type: '',
      filterType: '',
      filterValue: '',
      filterCategory: '',
      sortByInit: '',
      origin: '',
      originURL: '',
    },
  },
};

const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

// const populateForms = () => {
//   // TODO
// };

let allInteractionData = {};
let allInteractionTypeData = {};

export function getInteractionData(
  matcher,
  matchMultiple = false,
  dataSource = allInteractionData,
) {
  let result = {};
  dataSource.forEach((d) => {
    let isMatch = true;
    const updatedEntries = {};
    Object.entries(d).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        const keys = key.split('.');
        if (keys.length === 1) {
          const matcherValue = matcher[key];
          if (Array.isArray(matcherValue)) {
            const isArrayMatch = value.split(',').every((x) => matcherValue.includes(x));
            isMatch = isMatch && isArrayMatch;
          } else if (key === 'url' && matcherValue !== undefined && matcherValue !== null && matcherValue !== '') {
            isMatch = isMatch && matcherValue.split('?')[0] === value.split('?')[0];
          } else {
            isMatch = isMatch && matcherValue === value;
          }
        } else {
          updatedEntries[key] = value;
        }
      }
    });

    if (isMatch === true) {
      if (matchMultiple) {
        Object.assign(result, updatedEntries);
      } else {
        result = updatedEntries;
      }
    }
  });
  return result;
}

function updateDigitalData(digitalData, kvData) {
  Object.entries(kvData).forEach(([key, value]) => {
    if (value !== null && value !== '') {
      const keys = key.split('.');
      if (keys.length > 1) {
        const primaryKey = keys[keys.length - 2];
        const secondaryKey = keys[keys.length - 1];
        if (digitalData.page[primaryKey]) digitalData.page[primaryKey][secondaryKey] = value;
      }
    }
  });
}

function convertToKvData(digitalData = {}, result = {}, prefix = '') {
  Object.entries(digitalData).forEach(([key, value]) => {
    if (typeof value !== 'object') {
      result[prefix + key] = value;
    } else {
      convertToKvData(value, result, `${prefix}${key}.`);
    }
  });
  return result;
}

function trackVideoDetails(videoDigitalData, videoIframe, interactionType) {
  // load video data from Iframe Attributes
  videoDigitalData.page.component.title = '';
  videoDigitalData.page.component.l10title = '';
  videoDigitalData.page.link.url = videoIframe.getAttribute('src');
  videoDigitalData.page.video.playback = videoIframe.dataset.playback;
  if (
    !videoIframe.dataset.highestPlayback
    || videoIframe.dataset.highestPlayback * 1 < videoIframe.dataset.playback * 1
  ) {
    videoIframe.dataset.highestPlayback = videoIframe.dataset.playback;
  }
  if (videoIframe.dataset.action === 'replay') videoIframe.dataset.highestPlayback = '0';
  videoDigitalData.page.video.length = videoIframe.dataset.length;
  const percent = Math.floor(
    (videoIframe.dataset.highestPlayback * 100)
    / Math.floor(videoIframe.dataset.length)
    + 0.01,
  );
  videoDigitalData.page.video.milestone = (Math.floor(percent / 25 + 0.01) * 25).toString();
  if (interactionType.includes('video-milestone')) {
    videoDigitalData.page.link.displayTitle = videoDigitalData.page.link.displayTitle.replace(
      '0%',
      `${videoDigitalData.page.video.milestone}%`,
    );
  }
  if (videoIframe.dataset.action === 'milestone') {
    videoDigitalData.page.video.action = `${videoDigitalData.page.video.milestone}%`;
  }
  if (videoIframe.dataset.chapters > 0) videoDigitalData.page.video.type = 'multiple';
  videoDigitalData.page.video.id = videoIframe.dataset.video_id;
}

export function trackInteraction(element, overrides = {}) {
  try {
    const interactionDigitalData = deepCopy(defaultDigitalData);
    const kvOverrides = convertToKvData(overrides);

    let block = element.closest('.block');
    const section = element.closest('.section');

    let blockName = '';
    if (block === null) {
      const wrapper = element.closest('[class$="-wrapper"]');
      if (wrapper) {
        wrapper.classList.forEach((name) => {
          if (name.endsWith('-wrapper')) {
            blockName = name.substring(0, name.lastIndexOf('-wrapper'));
            block = wrapper.querySelector(`.${blockName}`);
          }
        });
      }
    }
    if (block) {
      blockName = block.dataset.blockName;
    }

    const sectionStyles = [];
    if (section) {
      section.classList.forEach((name) => {
        if (name === 'section') return;
        if (name === 'nav-detector') return;
        if (name.endsWith('container')) return;
        sectionStyles.push(name);
      });
    }

    let header = null;
    document.querySelectorAll('h1,h2').forEach((h) => {
      if (h.classList.contains('scroll-animation-heading')) return;
      if (h.compareDocumentPosition(element) === Node.DOCUMENT_POSITION_FOLLOWING) header = h;
    });
    let headerText = '';
    if (header && blockName !== 'header' && blockName !== 'footer') {
      headerText = header.textContent.toString().trim();
    } else {
      headerText = element.textContent.toString().trim();
    }

    let subHeader = null;
    document.querySelectorAll('h1,h2,h3,h4').forEach((h) => {
      if (h.classList.contains('scroll-animation-heading')) return;
      if (h.compareDocumentPosition(element) === Node.DOCUMENT_POSITION_FOLLOWING) subHeader = h;
    });
    let subHeaderText = '';
    if (subHeader && blockName !== 'header' && blockName !== 'footer') {
      subHeaderText = subHeader.innerText.replace('\n', ' ').trim();
    } else {
      subHeaderText = element.innerText.replace('\n', ' ').trim();
    }

    let imageContent = element.querySelector('img');
    if (element.tagName === 'IMG') imageContent = element;
    let imageTitle = '';
    if (imageContent && imageContent.alt != null) {
      imageTitle = imageContent.alt.toString().trim();
    }

    let name = element.textContent.toString().trim();
    if (name === '') name = imageTitle;
    const displayTitle = name;

    let componentType = 'content';
    if (['header', 'footer'].includes(blockName)) componentType = blockName;

    // set default structure and dynamic contents applicable to all interactions
    interactionDigitalData.page.link = {
      name,
      displayTitle,
      type: '',
      url: '',
    };

    interactionDigitalData.page.component = {
      type: componentType,
      l10title: headerText,
      title: headerText,
      name: '',
      position: componentType,
    };

    interactionDigitalData.page.content = {
      type: '',
      title: '',
      name: '',
    };

    interactionDigitalData.page.interaction = {
      type: '',
      name: '',
    };

    interactionDigitalData.page.mva = {
      name: '',
      tier: '',
      type: '',
      category: '',
    };

    interactionDigitalData.page.tool = {
      name: '',
      type: '',
    };

    // load defaults from Spreadsheet
    const defaults = getInteractionData({ interactionType: 'any' }, false, allInteractionTypeData);
    updateDigitalData(interactionDigitalData, defaults);

    // determine interaction type
    const interactionType = [];
    if (element.tagName === 'A' || element.tagName === 'IMG') {
      interactionType.push('link');
      const link = element.closest('a');
      if (
        link.origin === window.location.origin
        && link.pathname === window.location.pathname
        && link.hash === '#0'
        && link.querySelector('.video-thumbnail') !== null
      ) {
        return;
      }
      if (
        link.origin === window.location.origin
        && link.pathname === window.location.pathname
        && link.hash !== '#0'
        && componentType === 'header'
      ) {
        interactionType.push('link-header');
      }

      if (link.host !== window.location.host) {
        interactionType.push('link-external');
      }

      if (link.href.includes('pdf')) {
        interactionType.push('link-download');
      }

      if (
        link.classList.contains('results__item-address-phone')
        && link.classList.contains('results__item-address-directions')
        && link.classList.contains('results__item-address-website')
      ) {
        interactionType.push('link-doctor-locator');
      }
    } else if (element.classList.contains('video-iframe')) {
      if (element.dataset.action === 'click') {
        interactionType.push('video-link');
      } else {
        interactionDigitalData.page.video = {
          name: '',
          id: '',
          player: '',
          length: '',
          action: '', // play, pause, resume, stop, end, milestone
          playback: '', // elapsed time at above actions
          milestone: '', // video portion that has been viewed
          type: '',
        };
        interactionType.push('video');
        let videoAction = element.dataset.action;
        if (kvOverrides['page.video.action'] === 'milestone') videoAction = 'milestone';
        interactionType.push(`video-${videoAction}`);
      }
    } else if (blockName === 'header') {
      interactionType.push('navigation');
    } else if (element.classList.contains('faq-header')) {
      interactionType.push('accordion');
      const expanded = element.parentElement.getAttribute('faq-expanded');
      if (expanded === 'true') {
        interactionType.push('accordion-open');
      } else {
        interactionType.push('accordion-close');
      }
    } else if (
      element.classList.contains('carousel-nav-button')
      || element.classList.contains('carousel-dot-button')
    ) {
      interactionType.push('carousel');

      if (element.classList.contains('carousel-nav-right')) {
        interactionType.push('carousel-right');
      }
      if (element.classList.contains('carousel-nav-left')) {
        interactionType.push('carousel-left');
      }
      if (element.classList.contains('carousel-dot-button')) {
        interactionType.push('carousel-dot-button');
      }
    } else if (element.classList.contains('scroll-animation-heading')) {
      interactionType.push('scroll-animation');
      const scrollAnimationBlock = element.closest('.block');
      if (scrollAnimationBlock.dataset.toolInitiation !== 'done') {
        scrollAnimationBlock.dataset.toolInitiation = 'done';
        interactionType.push('scroll-animation-initiation');
      }
    } else if (element.classList.contains('isi-toggle')) {
      interactionType.push('isi-floater');
    } else if (blockName === 'find-a-doctor') {
      const form = element.closest('form');

      if (form) {
        interactionDigitalData.page.form = {
          name: '',
          category: '',
          subCategory: '',
          stepName: '',
        };

        interactionType.push('form');
      } else if (element.tagName !== 'A') {
        interactionType.push('doctor-locator');
      }
    } else {
      // eslint-disable-next-line no-console
      console.log(`Unknown interaction type in: ${blockName} with ${element} (${element.classList})`);
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`Tracking ${interactionType[0].replace('-', ' ')} interaction.`);

    // load interaction type defaults from Spreadsheet
    const typeMatcher = {
      interactionType,
      displayTitle: interactionDigitalData.page.link.displayTitle,
      tagName: element.tagName,
      id: element.id,
      classes: Array.from(element.classList).concat(Array.from(element.closest('div').classList)),
      blockName,
      sectionStyles,
      headerText,
    };

    const interactionTypeDefaults = getInteractionData(typeMatcher, true, allInteractionTypeData);
    updateDigitalData(interactionDigitalData, interactionTypeDefaults);

    // apply overrides received from parameters
    updateDigitalData(interactionDigitalData, kvOverrides);

    // fill in interaction type dependent calculated fields
    if (interactionType.includes('link')) {
      const link = element.closest('a');
      if (link) {
        interactionDigitalData.page.link.url = link.href;
      }
      if (interactionType.includes('link-download')) {
        interactionDigitalData.page.link.name = `${interactionDigitalData.page.link.name} ${name}`;
      }

      if (interactionType.includes('link-doctor-locator')) {
        const { doctorName } = element.dataset;

        interactionDigitalData.page.link.name = `${interactionDigitalData.page.link.name} ${doctorName}`;
        delete interactionDigitalData.page.link.url;
      }
    } else if (interactionType.includes('accordion')) {
      interactionDigitalData.page.link.name = `${interactionDigitalData.page.link.displayTitle} ${interactionDigitalData.page.link.name}`;
    } else if (interactionType.includes('carousel')) {
      if (subHeaderText !== '') {
        interactionDigitalData.page.component.title = subHeaderText;
        interactionDigitalData.page.component.l10title = subHeaderText;
      }

      if (interactionType.includes('carousel-dot-button')) {
        interactionDigitalData.page.link.displayTitle = element.getAttribute('aria-label');
      }

      if (interactionDigitalData.page.component.title === '') {
        interactionDigitalData.page.component.title = interactionDigitalData.page.link.displayTitle;
        // eslint-disable-next-line max-len
        interactionDigitalData.page.component.l10title = interactionDigitalData.page.link.displayTitle;
      }

      interactionDigitalData.page.link.name = interactionDigitalData.page.link.displayTitle;
    } else if (interactionType.includes('video')) {
      trackVideoDetails(interactionDigitalData, element, interactionType);
    } else if (interactionType.includes('video-link')) {
      interactionDigitalData.page.component.title = '';
      interactionDigitalData.page.component.l10title = '';
      interactionDigitalData.page.link.url = element.getAttribute('src');
    } else if (interactionType.includes('form')) {
      const form = element.closest('form');
      const isValid = form.dataset.invalid === undefined;

      if (element.type === 'submit' && isValid) {
        // merge the form values
        const formData = new FormData(form);
        let fieldValues = '';

        /* eslint-disable-next-line no-restricted-syntax */
        for (const pair of formData.entries()) {
          const field = form.querySelector(`[name="${pair[0]}"]`);
          const data = getInteractionData({ id: field.id, blockName });
          const fieldName = data['digitalData.page.form.fieldName'];
          const fieldValue = fieldName === 'Zipcode' ? pair[1].replace(/.{2}$/g, 'xx') : pair[1];

          fieldValues += `${fieldName}:${fieldValue}|`;
        }

        interactionDigitalData.page.form.fieldValues = fieldValues.slice(0, -1); // remove last '|'
      }
    } else if (interactionType.includes('doctor-locator')) {
      const { doctorName } = element.dataset;

      interactionDigitalData.page.link.displayTitle = doctorName;
      interactionDigitalData.page.link.name = `${interactionDigitalData.page.link.name} ${doctorName}`;

      delete interactionDigitalData.page.link.url;
    }

    // load interaction data from Spreadsheet
    const matcher = {
      interactionType,
      url: interactionDigitalData.page.link.url,
      displayTitle: interactionDigitalData.page.link.displayTitle,
      tagName: element.tagName,
      id: element.id,
      classes: Array.from(element.classList).concat(Array.from(element.closest('div').classList)),
      blockName,
      sectionStyles,
      headerText,
    };

    const interactionData = getInteractionData(matcher);
    updateDigitalData(interactionDigitalData, interactionData);
    updateDigitalData(interactionDigitalData, kvOverrides);

    window.digitalData = interactionDigitalData;
    // eslint-disable-next-line no-console
    console.log(window.digitalData);
    try {
      // eslint-disable-next-line no-undef
      _satellite.track('trackAction');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(error);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(error);
  }
}

export async function trackInteractionData(document) {
  document.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', (e) => {
      try {
        trackInteraction(e.target);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log(error);
      }
    });
  });
}

export async function initDigitalData() {
  const response = await fetch('/datalayer.json');
  const datalayer = await response.json();

  // Initialize default digital data from datalayer.json
  Object.entries(datalayer).forEach(([key, value]) => {
    if (key in defaultDigitalData.page) {
      value.data.forEach((d) => {
        defaultDigitalData.page[key][d.param] = d.value;
      });
    }
    if (key === 'page-attr') {
      value.data.forEach((d) => {
        if (d.path === window.location.pathname) {
          defaultDigitalData.page.pageInfo.pageName = d['data-name'];
          defaultDigitalData.page.category.primaryCategory = d['data-name'];
          defaultDigitalData.page.category.subCategory1 = d['sub-category-1'];
          defaultDigitalData.page.category.subCategory2 = d['sub-category-2'];
          defaultDigitalData.page.attributes.type = d['attr-type'];
          defaultDigitalData.page.journey.content = d['journey-content'];
        }
      });
    }

    if (key === 'all-interaction-data') {
      allInteractionData = value.data;
    }

    if (key === 'interaction-types') {
      allInteractionTypeData = value.data;
    }
  });
  window.digitalData = defaultDigitalData;
  // eslint-disable-next-line no-console
  console.log(window.digitalData);
}

export function trackVideoData(videoIframe, action) {
  if (action === 'milestone') {
    const actionOverride = {
      page: {
        video: {
          action: 'milestone',
        },
      },
    };
    trackInteraction(videoIframe, actionOverride);
  } else {
    trackInteraction(videoIframe);
  }
}

export function trackPageData() {
  window.digitalData = deepCopy(defaultDigitalData);
  // eslint-disable-next-line no-console
  console.log('Tracking pageData');
  // eslint-disable-next-line no-console
  console.log(window.digitalData);
  // eslint-disable-next-line no-undef
  _satellite.track('trackState');
}

// export async function initDataLayer(document) {
//   await initDigitalData();
//   populateForms();
//   trackInteractionData(document);
//   populateVideos();
// }

export async function loadAdobeLaunch(isProd) {
  // Adobe launch script start
  await loadScript(
    `${
      isProd
        ? 'https://assets.adobedtm.com/acb96670c057/31fbd82ca9ee/launch-46b4037bbe69.min.js'
        : 'https://assets.adobedtm.com/acb96670c057/31fbd82ca9ee/launch-e1209d05f350-development.min.js'
    }`,
    {
      async: '',
      type: 'text/javascript',
      charset: 'UTF-8',
    },
  );
  trackPageData();
  trackInteractionData(document);
}
