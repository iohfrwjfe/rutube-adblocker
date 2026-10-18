(function () {
  'use strict';

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'RUTUBE_ADBLOCK_STATS') {
      try {
        chrome.runtime.sendMessage({
          type: 'INCREMENT_STAT',
          category: event.data.category,
          count: event.data.count || 1
        });
      } catch (e) {}
    }
  });

  const cosmeticAdSelectors = [
    '#communicationBanner',
    '#raichu-banner',
    '#raichu_yasdk_container',
    '[id^="adfox"]',
    'div[class*="rai_raichu-wrapper__advertWrapper"]',
    'span[class*="rai_raichu-advert-timers"]',
    '.wdp-recommended-ad-card-module__ad-banner-container',
    '.push-notification-popup-module__wrapper',
    '.wdp-onboardings-inventory-banner-module__wrapper-section',
    '.footer-fixed-components-module__footerFixedPrior',
    '.app-download-default-banner-module__appDownloadPopupButtonWrap',
    '.app-download-topbar-module__appDownloadTopBar',
    'div[class^="cookie-message-"]',
    '.notification-container-module__infoNotifications',
    '.wdp-promo-modal-module__wdpPromoModalOverlay',
    'aside[aria-label^="Реклама"]',
    'section[aria-label^="Реклама"]',
    '[aria-label="Реклама"]'
  ];

  function cleanBanners() {
    for (const selector of cosmeticAdSelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (!el.dataset.adblockCleaned) {
          el.dataset.adblockCleaned = 'true';
          el.remove();
          try {
            chrome.runtime.sendMessage({
              type: 'INCREMENT_STAT',
              category: 'banners',
              count: 1
            });
          } catch (e) {}
        }
      });
    }

    if (document.body && document.body.style.overflow === 'hidden') {
      document.body.style.setProperty('overflow', 'auto', 'important');
    }
    if (document.documentElement && document.documentElement.style.overflow === 'hidden') {
      document.documentElement.style.setProperty('overflow', 'auto', 'important');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanBanners);
  } else {
    cleanBanners();
  }

  const observer = new MutationObserver(function () {
    cleanBanners();
  });

  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });
})();
