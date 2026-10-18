document.addEventListener('DOMContentLoaded', () => {
  const mainToggle = document.getElementById('mainToggle');
  const statusPill = document.getElementById('statusPill');
  const statusLabel = document.getElementById('statusLabel');
  const toggleDesc = document.getElementById('toggleDesc');
  const statVideoAds = document.getElementById('statVideoAds');
  const statBanners = document.getElementById('statBanners');
  const statTrackers = document.getElementById('statTrackers');
  const reloadTabBtn = document.getElementById('reloadTabBtn');
  const openTestBtn = document.getElementById('openTestBtn');
  const resetStatsBtn = document.getElementById('resetStatsBtn');

  function loadState() {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, response => {
      if (!response) return;

      const isEnabled = response.enabled !== false;
      mainToggle.checked = isEnabled;
      updateUIStatus(isEnabled);

      const stats = response.stats || {};
      statVideoAds.textContent = (stats.videoAds || 0).toLocaleString();
      statBanners.textContent = (stats.banners || 0).toLocaleString();
      statTrackers.textContent = (stats.trackers || 0).toLocaleString();
    });
  }

  function updateUIStatus(isEnabled) {
    if (isEnabled) {
      statusPill.classList.remove('disabled');
      statusLabel.textContent = 'Активен';
      toggleDesc.textContent = 'Прероллы, мидроллы и баннеры отключены';
    } else {
      statusPill.classList.add('disabled');
      statusLabel.textContent = 'Отключен';
      toggleDesc.textContent = 'Блокировка приостановлена';
    }
  }

  mainToggle.addEventListener('change', () => {
    const isEnabled = mainToggle.checked;
    updateUIStatus(isEnabled);
    chrome.runtime.sendMessage({ type: 'SET_ENABLED', enabled: isEnabled });
  });

  reloadTabBtn.addEventListener('click', async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs[0] && tabs[0].url && tabs[0].url.includes('rutube.ru')) {
        chrome.tabs.reload(tabs[0].id);
      } else {
        const rutubeTabs = await chrome.tabs.query({ url: '*://*.rutube.ru/*' });
        if (rutubeTabs.length > 0) {
          chrome.tabs.reload(rutubeTabs[0].id);
          chrome.tabs.update(rutubeTabs[0].id, { active: true });
        } else {
          chrome.tabs.create({ url: 'https://rutube.ru/' });
        }
      }
    } catch (e) {
      console.error(e);
    }
  });

  openTestBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://rutube.ru/' });
  });

  resetStatsBtn.addEventListener('click', () => {
    if (confirm('Сбросить статистику заблокированной рекламы?')) {
      chrome.runtime.sendMessage({ type: 'RESET_STATS' }, () => {
        statVideoAds.textContent = '0';
        statBanners.textContent = '0';
        statTrackers.textContent = '0';
      });
    }
  });

  loadState();
});
