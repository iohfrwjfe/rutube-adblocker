// ==UserScript==
// @name         Rutube AdBlocker
// @namespace    https://github.com/rutube-adblocker
// @version      1.0.0
// @description  Полная блокировка видеорекламы (прероллы, мидроллы), баннеров и трекеров на Rutube
// @author       dmavv
// @match        https://rutube.ru/*
// @match        https://*.rutube.ru/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rutube.ru
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  try {
    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function (child) {
      if (child && child.parentNode !== this) {
        if (child.parentNode) {
          return child.parentNode.removeChild(child);
        }
        return child;
      }
      return originalRemoveChild.call(this, child);
    };

    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function (newNode, referenceNode) {
      if (referenceNode && referenceNode.parentNode !== this) {
        return this.appendChild(newNode);
      }
      return originalInsertBefore.call(this, newNode, referenceNode);
    };
  } catch (e) {}

  try {
    Object.defineProperty(window, 'adBlockDetected', {
      get: () => false,
      set: () => {},
      configurable: false
    });
    Object.defineProperty(window, 'hasAdBlock', {
      get: () => false,
      set: () => {},
      configurable: false
    });
    window.__IS_ADBLOCK__ = false;

    window.Ya = window.Ya || {};
    window.Ya.Metrika2 = window.Ya.Metrika2 || function () {
      return {
        reachGoal: function () {},
        params: function () {},
        extLink: function () {},
        file: function () {},
        hit: function () {},
        notBounce: function () {}
      };
    };
    if (typeof window.ym === 'undefined') {
      window.ym = function () {};
    }
  } catch (e) {}

  function cleanPlayOptions(data) {
    if (!data || typeof data !== 'object') return data;

    if (Array.isArray(data.advert) && data.advert.length > 0) {
      console.log(`[Rutube AdBlocker Userscript] Removed ${data.advert.length} ad item(s)`);
      data.advert = [];
    } else if (!Array.isArray(data.advert)) {
      data.advert = [];
    }

    if (Array.isArray(data.cuepoints) && data.cuepoints.length > 0) {
      data.cuepoints = [];
    }

    if (data.yast) data.yast = null;
    if (data.yast_live_online) data.yast_live_online = null;

    if (data.meta && typeof data.meta === 'object') {
      if (data.meta.advert_rule_id) data.meta.advert_rule_id = null;
      if (data.meta.advert_limit_rule_id) data.meta.advert_limit_rule_id = null;
    }

    if (Array.isArray(data.stat)) {
      data.stat = data.stat.filter(s => {
        const name = (s && s.name) ? String(s.name).toLowerCase() : '';
        return !name.includes('adstart') && !name.includes('adreceive') && !name.includes('ad_end') && !name.includes('adsend');
      });
    }

    return data;
  }

  const originalJSONParse = JSON.parse;
  JSON.parse = function (text, reviver) {
    const res = originalJSONParse.call(this, text, reviver);
    if (res && typeof res === 'object') {
      if (Array.isArray(res.advert) || ('acl_access' in res && ('video_id' in res || 'has_video' in res))) {
        cleanPlayOptions(res);
      }
    }
    return res;
  };

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    let url = args[0];
    if (url instanceof Request) url = url.url;
    else if (url instanceof URL) url = url.href;

    if (typeof url === 'string' && url.includes('/api/play/options/')) {
      try {
        const response = await originalFetch.apply(this, args);
        const text = await response.text();
        let json;
        try {
          json = originalJSONParse(text);
          cleanPlayOptions(json);
        } catch (e) {
          return new Response(text, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        }
        return new Response(JSON.stringify(json), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      } catch (err) {
        return originalFetch.apply(this, args);
      }
    }

    if (typeof url === 'string' && (
      url.includes('playoptions.rutube.ru/adfoxsdk') ||
      url.includes('a.rutube.ru/api/v1/ad') ||
      url.includes('ssp.rutube.ru') ||
      url.includes('/api/advert/') ||
      url.includes('vigo.tech') ||
      url.includes('weborama-tech.ru') ||
      url.includes('/v2/banner/')
    )) {
      const isXml = url.includes('xml') || url.includes('vast');
      return Promise.resolve(new Response(
        isXml ? '<VAST version="3.0"/>' : JSON.stringify({ ads: [], status: 'ok' }),
        { status: 200, headers: { 'Content-Type': isXml ? 'application/xml' : 'application/json' } }
      ));
    }

    try {
      return await originalFetch.apply(this, args);
    } catch (err) {
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  };

  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._rutube_url = typeof url === 'string' ? url : (url ? url.toString() : '');
    return originalXhrOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const url = this._rutube_url;

    if (typeof url === 'string' && (
      url.includes('playoptions.rutube.ru/adfoxsdk') ||
      url.includes('a.rutube.ru/api/v1/ad') ||
      url.includes('ssp.rutube.ru') ||
      url.includes('/api/advert/') ||
      url.includes('vigo.tech') ||
      url.includes('weborama-tech.ru') ||
      url.includes('/v2/banner/')
    )) {
      Object.defineProperty(this, 'readyState', { value: 4, writable: false });
      Object.defineProperty(this, 'status', { value: 200, writable: false });
      Object.defineProperty(this, 'statusText', { value: 'OK', writable: false });
      Object.defineProperty(this, 'responseText', { value: '{"ads":[],"status":"ok"}', writable: false });
      Object.defineProperty(this, 'response', { value: '{"ads":[],"status":"ok"}', writable: false });

      setTimeout(() => {
        if (typeof this.onload === 'function') this.onload(new ProgressEvent('load'));
      }, 0);
      return;
    }

    if (typeof url === 'string' && url.includes('/api/play/options/')) {
      const self = this;
      self.addEventListener('readystatechange', function () {
        if (self.readyState === 4 && self.status === 200) {
          try {
            const parsed = originalJSONParse(self.responseText);
            cleanPlayOptions(parsed);
            const modified = JSON.stringify(parsed);
            Object.defineProperty(self, 'responseText', { get: () => modified, configurable: true });
            Object.defineProperty(self, 'response', { get: () => modified, configurable: true });
          } catch (e) {}
        }
      });
    }

    return originalXhrSend.call(this, body);
  };

  setInterval(() => {
    const skipBtns = document.querySelectorAll('button[class*="skip"], button[class*="Skip"], [class*="raichu-advert-skip"], [aria-label*="Пропустить"], [title*="Пропустить"]');
    for (const btn of skipBtns) {
      if (btn && btn.offsetParent !== null) {
        btn.click();
        break;
      }
    }

    const adContainers = document.querySelectorAll('[class*="rai_raichu-wrapper__advertWrapper"], #raichu_yasdk_container, #raichu-banner');
    if (adContainers.length > 0) {
      document.querySelectorAll('video').forEach(v => {
        if (!v.paused && v.duration > 0 && v.duration < 180) {
          v.muted = true;
          v.playbackRate = 16.0;
          if (isFinite(v.duration)) v.currentTime = v.duration;
        }
      });
    }
  }, 250);

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    #raichu-banner, #raichu_yasdk_container, [id^="adfox"],
    div[class*="rai_raichu-wrapper__advertWrapper"], span[class*="rai_raichu-advert-timers"],
    .raichu-player__ad-timer, .raichu-player__ad-ui,
    .wdp-recommended-ad-card-module__ad-banner-container,
    .additional-recommendations-module__grid-card:has([id^="adfox"]),
    aside[aria-label^="Реклама"], section[aria-label^="Реклама"], [aria-label="Реклама"],
    #communicationBanner, .footer-fixed-components-module__footerFixedPrior,
    .app-download-default-banner-module__appDownloadPopupButtonWrap,
    .app-download-topbar-module__appDownloadTopBar,
    .push-notification-popup-module__wrapper,
    .notification-container-module__infoNotifications,
    .wdp-promo-modal-module__wdpPromoModalOverlay,
    div[class^="cookie-message-"] {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    html, body { overflow: auto !important; }
  `;
  document.head ? document.head.appendChild(styleEl) : document.documentElement.appendChild(styleEl);
})();
