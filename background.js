const DEFAULT_STATE = {
  enabled: true,
  stats: {
    videoAds: 0,
    banners: 0,
    trackers: 0
  }
};

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['enabled', 'stats']);
  if (data.enabled === undefined) {
    await chrome.storage.local.set({ enabled: true });
  }
  if (!data.stats) {
    await chrome.storage.local.set({ stats: DEFAULT_STATE.stats });
  }
  updateBadge();
});

async function updateBadge() {
  const data = await chrome.storage.local.get(['enabled', 'stats']);
  const isEnabled = data.enabled !== false;
  const stats = data.stats || DEFAULT_STATE.stats;
  const total = (stats.videoAds || 0) + (stats.banners || 0) + (stats.trackers || 0);

  if (!isEnabled) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#757575' });
  } else if (total > 0) {
    chrome.action.setBadgeText({ text: total > 999 ? '999+' : String(total) });
    chrome.action.setBadgeBackgroundColor({ color: '#00C853' });
  } else {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#00B0FF' });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INCREMENT_STAT') {
    handleIncrementStat(message.category, message.count || 1);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'GET_STATE') {
    chrome.storage.local.get(['enabled', 'stats']).then(data => {
      sendResponse({
        enabled: data.enabled !== false,
        stats: data.stats || DEFAULT_STATE.stats
      });
    });
    return true;
  }

  if (message.type === 'SET_ENABLED') {
    const isEnabled = Boolean(message.enabled);
    chrome.storage.local.set({ enabled: isEnabled }).then(async () => {
      try {
        await chrome.declarativeNetRequest.updateEnabledRulesets({
          [isEnabled ? 'enableRulesetIds' : 'disableRulesetIds']: ['ruleset_1']
        });
      } catch (e) {}

      updateBadge();
      sendResponse({ ok: true, enabled: isEnabled });
    });
    return true;
  }

  if (message.type === 'RESET_STATS') {
    chrome.storage.local.set({ stats: { videoAds: 0, banners: 0, trackers: 0 } }).then(() => {
      updateBadge();
      sendResponse({ ok: true });
    });
    return true;
  }
});

async function handleIncrementStat(category, count) {
  const data = await chrome.storage.local.get('stats');
  const stats = data.stats || { videoAds: 0, banners: 0, trackers: 0 };

  if (category === 'video_ads' || category === 'auto_skips') {
    stats.videoAds = (stats.videoAds || 0) + count;
  } else if (category === 'banners') {
    stats.banners = (stats.banners || 0) + count;
  } else if (category === 'ad_requests') {
    stats.trackers = (stats.trackers || 0) + count;
  }

  await chrome.storage.local.set({ stats });
  updateBadge();
}
