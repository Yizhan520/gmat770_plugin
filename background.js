/**
 * GMAT 错题整理助手 - Background Service Worker v2.0
 * 
 * 仅负责：
 * - 下载历史记录管理
 * - 消息中转
 */

const STORAGE_KEYS = {
  DOWNLOAD_HISTORY: 'gmat_download_history',
  SETTINGS: 'gmat_settings'
};

/**
 * 记录下载历史
 */
async function recordDownloadHistory(count, filename) {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.DOWNLOAD_HISTORY);
    const history = data[STORAGE_KEYS.DOWNLOAD_HISTORY] || [];

    history.push({
      count: count,
      filename: filename,
      timestamp: Date.now(),
      date: new Date().toLocaleString('zh-CN')
    });

    // 保留最近 30 条
    while (history.length > 30) history.shift();

    await chrome.storage.local.set({ [STORAGE_KEYS.DOWNLOAD_HISTORY]: history });
  } catch (error) {
    console.error('[GMAT Helper] Error recording history:', error);
  }
}

/**
 * 获取下载历史
 */
async function getDownloadHistory() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.DOWNLOAD_HISTORY);
  return data[STORAGE_KEYS.DOWNLOAD_HISTORY] || [];
}

/**
 * 清空下载历史
 */
async function clearDownloadHistory() {
  await chrome.storage.local.set({ [STORAGE_KEYS.DOWNLOAD_HISTORY]: [] });
}

/**
 * 监听消息
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[GMAT Helper BG] Received:', request.action);

  if (request.action === 'recordDownload') {
    recordDownloadHistory(request.count, request.filename).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'getDownloadHistory') {
    getDownloadHistory().then(history => {
      sendResponse({ success: true, history: history });
    });
    return true;
  }

  if (request.action === 'clearHistory') {
    clearDownloadHistory().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  return false;
});

console.log('[GMAT Helper] Background service worker v2.0 loaded');
