(function () {
  'use strict';

  if (window.__RUTUBE_ADBLOCK_INJECTED__) return;
  window.__RUTUBE_ADBLOCK_INJECTED__ = true;

  console.log('[Rutube AdBlocker] Injected into page context (MAIN)');

  function notifyAdBlocked(category, count = 1) {
    try {
      window.postMessage({
        type: 'RUTUBE_ADBLOCK_STATS',
        category: category,
        count: count
      }, '*');
    } catch (e) {}
  }

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

    let modified = false;

    if (Array.isArray(data.advert) && data.advert.length > 0) {
      const adCount = data.advert.length;
      console.log(`[Rutube AdBlocker] Removed ${adCount} ad item(s) from play options`);
      data.advert = [];
      modified = true;
      notifyAdBlocked('video_ads', adCount);
    } else if (!Array.isArray(data.advert)) {
      data.advert = [];
    }

    if (Array.isArray(data.cuepoints) && data.cuepoints.length > 0) {
      data.cuepoints = [];
      modified = true;
    }

    if (data.yast) {
      data.yast = null;
      modified = true;
    }
    if (data.yast_live_online) {
      data.yast_live_online = null;
      modified = true;
    }

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

  function isPlayOptionsUrl(url) {
    return typeof url === 'string' && url.includes('/api/play/options/');
  }

  function isAdNetworkUrl(url) {
    if (typeof url !== 'string') return false;
    return (
      url.includes('playoptions.rutube.ru/adfoxsdk') ||
      url.includes('a.rutube.ru/api/v1/ad') ||
      url.includes('ssp.rutube.ru') ||
      url.includes('/api/advert/') ||
      url.includes('an.yandex.ru') ||
      url.includes('ads.adfox.ru') ||
      url.includes('betacdn.rutube.ru/adv') ||
      url.includes('vigo.tech') ||
      url.includes('weborama-tech.ru') ||
      url.includes('/v2/banner/')
    );
  }

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    let url = args[0];
    if (url instanceof Request) {
      url = url.url;
    } else if (url instanceof URL) {
      url = url.href;
    }

    if (isPlayOptionsUrl(url)) {
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

        const modifiedText = JSON.stringify(json);
        return new Response(modifiedText, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      } catch (err) {
        return originalFetch.apply(this, args);
      }
    }

    if (isAdNetworkUrl(url)) {
      notifyAdBlocked('ad_requests', 1);
      const isXml = typeof url === 'string' && (url.includes('xml') || url.includes('vast'));
      const dummyBody = isXml ? '<VAST version="3.0"/>' : JSON.stringify({ ads: [], status: 'ok' });
      const contentType = isXml ? 'application/xml' : 'application/json';

      return Promise.resolve(
        new Response(dummyBody, {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': contentType }
        })
      );
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

    if (isAdNetworkUrl(url)) {
      notifyAdBlocked('ad_requests', 1);
      Object.defineProperty(this, 'readyState', { value: 4, writable: false });
      Object.defineProperty(this, 'status', { value: 200, writable: false });
      Object.defineProperty(this, 'statusText', { value: 'OK', writable: false });
      Object.defineProperty(this, 'responseText', { value: '{"ads":[],"status":"ok"}', writable: false });
      Object.defineProperty(this, 'response', { value: '{"ads":[],"status":"ok"}', writable: false });

      setTimeout(() => {
        if (typeof this.onreadystatechange === 'function') {
          this.onreadystatechange(new Event('readystatechange'));
        }
        if (typeof this.onload === 'function') {
          this.onload(new ProgressEvent('load'));
        }
      }, 0);
      return;
    }

    if (isPlayOptionsUrl(url)) {
      const self = this;
      self.addEventListener('readystatechange', function () {
        if (self.readyState === 4 && self.status === 200) {
          try {
            const raw = self.responseText;
            const parsed = originalJSONParse(raw);
            cleanPlayOptions(parsed);
            const modified = JSON.stringify(parsed);

            Object.defineProperty(self, 'responseText', {
              get: () => modified,
              configurable: true
            });
            Object.defineProperty(self, 'response', {
              get: () => (self.responseType === 'json' ? parsed : modified),
              configurable: true
            });
          } catch (e) {}
        }
      });
    }

    return originalXhrSend.call(this, body);
  };

  function runWatchdog() {
    const skipSelectors = [
      'button[class*="skip"]',
      'button[class*="Skip"]',
      '[class*="raichu-advert-skip"]',
      '[class*="advert-skip"]',
      '[aria-label*="Пропустить"]',
      '[title*="Пропустить"]',
      '.raichu-player__ad-skip-button',
      '[data-testid*="ad-skip"]'
    ];

    for (const sel of skipSelectors) {
      const btn = document.querySelector(sel);
      if (btn && btn.offsetParent !== null) {
        try {
          btn.click();
          console.log('[Rutube AdBlocker] Auto-clicked ad skip button');
          notifyAdBlocked('auto_skips', 1);
          break;
        } catch (e) {}
      }
    }

    const adContainerSelectors = [
      '[class*="rai_raichu-wrapper__advertWrapper"]',
      '[class*="rai_raichu-advert-timers"]',
      '#raichu_yasdk_container',
      '#raichu-banner',
      '[class*="ad-timer"]'
    ];

    let isAdOverlayActive = false;
    for (const sel of adContainerSelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) {
        isAdOverlayActive = true;
        break;
      }
    }

    if (isAdOverlayActive) {
      const videos = document.querySelectorAll('video');
      videos.forEach(v => {
        if (!v.paused && v.duration > 0 && v.duration < 180) {
          try {
            v.muted = true;
            v.playbackRate = 16.0;
            if (isFinite(v.duration)) {
              v.currentTime = v.duration;
            }
          } catch (e) {}
        }
      });
    }
  }

  setInterval(runWatchdog, 300);
})();
