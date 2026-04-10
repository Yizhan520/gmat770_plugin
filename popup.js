/**
 * GMAT 错题整理助手 - Popup Script v3.0
 * 
 * 使用 ExcelJS 生成 Excel，支持直接在 Excel 中嵌入截图
 */

(function () {
  'use strict';

  // DOM 元素
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const statusCount = document.getElementById('statusCount');
  const downloadBtn = document.getElementById('downloadBtn');
  const uploadBtn = document.getElementById('uploadBtn');
  const messageBar = document.getElementById('messageBar');
  const historyList = document.getElementById('historyList');
  const includeScreenshots = document.getElementById('includeScreenshots');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const settingScreenshots = document.getElementById('settingScreenshots');
  const settingSiteBaseUrl = document.getElementById('settingSiteBaseUrl');
  const settingAdminKey = document.getElementById('settingAdminKey');
  const closeSettings = document.getElementById('closeSettings');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  let pageInfo = null;

  /**
   * 初始化
   */
  async function init() {
    await loadSettings();
    await checkPage();
    await loadHistory();
    bindEvents();
  }

  /**
   * 检查当前页面
   */
  async function checkPage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.url || !tab.url.includes('gaofengo.com')) {
        setStatus('error', '请在 GMAT 网站使用此插件', '');
        setActionButtonsDisabled(true);
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'checkPage' });

      if (response && response.success && response.isValidPage) {
        pageInfo = response;
        const pageLabel = response.pageLabel || '页面';
        if (response.errorCount > 0) {
          setStatus('ok', `已检测到${pageLabel}`, `共 ${response.totalCount} 题，其中 ${response.errorCount} 道错题`);
          setActionButtonsDisabled(false);
        } else {
          setStatus('warn', `${pageLabel}中没有错题`, `共 ${response.totalCount} 题，全部正确`);
          setActionButtonsDisabled(true);
        }
      } else {
        setStatus('warn', '未检测到可提取页面', '请进入题目解析页或模考报告页');
        setActionButtonsDisabled(true);
      }
    } catch (error) {
      console.error('[GMAT Helper] checkPage error:', error);
      setStatus('error', '无法连接页面', '请刷新页面后重试');
      setActionButtonsDisabled(true);
    }
  }

  function setActionButtonsDisabled(disabled) {
    downloadBtn.disabled = disabled;
    uploadBtn.disabled = disabled;
  }

  function setStatus(type, text, count) {
    statusDot.className = 'status-dot ' + type;
    statusText.textContent = text;
    statusCount.textContent = count || '';
  }

  function showMessage(type, text) {
    messageBar.className = 'message-bar show ' + type;
    messageBar.textContent = text;
  }

  function hideMessage() {
    messageBar.className = 'message-bar';
  }

  /**
   * 处理下载
   */
  async function handleDownload() {
    try {
      setActionButtonsDisabled(true);
      downloadBtn.classList.add('loading');
      showMessage('info', '正在提取错题数据...');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const withScreenshots = includeScreenshots.checked;

      if (withScreenshots) {
        showMessage('info', '正在提取错题并截图，请耐心等待...');
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractAllWrongQuestions',
        includeScreenshots: withScreenshots
      });

      if (!response || !response.success || !response.data || response.data.length === 0) {
        showMessage('error', '未能提取到错题数据，请确认页面上有错题');
        resetButtons();
        return;
      }

      const wrongQuestions = response.data;
      showMessage('info', `已提取 ${wrongQuestions.length} 道错题，正在生成 Excel...`);

      // 使用 ExcelJS 生成 Excel（支持嵌入图片）
      const filename = await generateExcelWithImages(wrongQuestions, withScreenshots);

      // 记录历史
      await chrome.runtime.sendMessage({
        action: 'recordDownload',
        count: wrongQuestions.length,
        filename: filename
      });

      showMessage('success', `已下载 ${wrongQuestions.length} 道错题到 ${filename}`);
      setTimeout(loadHistory, 500);
      setTimeout(() => { resetButtons(); hideMessage(); }, 4000);

    } catch (error) {
      console.error('[GMAT Helper] Download error:', error);
      showMessage('error', '下载失败: ' + error.message);
      resetButtons();
    }
  }

  function resetButtons() {
    setActionButtonsDisabled(false);
    downloadBtn.classList.remove('loading');
    uploadBtn.classList.remove('loading');
  }

  function getSettings() {
    return {
      includeScreenshots: includeScreenshots.checked,
      siteBaseUrl: (settingSiteBaseUrl.value || '').trim(),
      adminKey: (settingAdminKey.value || '').trim()
    };
  }

  function normalizeSiteBaseUrl(value) {
    return value.replace(/\/+$/, '');
  }

  async function extractWrongQuestions(withScreenshots) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return chrome.tabs.sendMessage(tab.id, {
      action: 'extractAllWrongQuestions',
      includeScreenshots: withScreenshots
    });
  }

  async function handleUpload() {
    try {
      const settings = getSettings();
      if (!settings.siteBaseUrl || !settings.adminKey) {
        settingsOverlay.classList.add('show');
        showMessage('error', '请先在设置里填写网站地址和 Admin Key');
        return;
      }

      setActionButtonsDisabled(true);
      uploadBtn.classList.add('loading');
      showMessage('info', '正在提取错题并上传到网站...');

      const response = await extractWrongQuestions(settings.includeScreenshots);
      if (!response || !response.success || !response.data || response.data.length === 0) {
        showMessage('error', '未能提取到错题数据，请确认页面上有错题');
        resetButtons();
        return;
      }

      const uploadResponse = await fetch(normalizeSiteBaseUrl(settings.siteBaseUrl) + '/api/import/extension', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + settings.adminKey
        },
        body: JSON.stringify({
          questions: response.data
        })
      });

      const payload = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok) {
        throw new Error(payload.error || '网站返回了错误');
      }

      const importedCount = typeof payload.importedCount === 'number' ? payload.importedCount : 0;
      const skippedCount = typeof payload.skippedCount === 'number' ? payload.skippedCount : 0;
      const duplicateSuffix = payload.duplicate ? '（检测到重复批次）' : '';
      showMessage('success', `上传完成：新增 ${importedCount} 条，跳过 ${skippedCount} 条 ${duplicateSuffix}`.trim());
      setTimeout(() => { resetButtons(); hideMessage(); }, 4500);
    } catch (error) {
      console.error('[GMAT Helper] Upload error:', error);
      showMessage('error', '上传失败: ' + error.message);
      resetButtons();
    }
  }

  /**
   * 将 base64 data URL 转为纯 base64 字符串
   */
  function dataUrlToBase64(dataUrl) {
    if (!dataUrl) return null;
    const idx = dataUrl.indexOf(',');
    return idx >= 0 ? dataUrl.substring(idx + 1) : dataUrl;
  }

  /**
   * 使用 ExcelJS 生成带截图的 Excel 文件
   */
  async function generateExcelWithImages(wrongQuestions, withScreenshots) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GMAT 错题整理助手';
    workbook.created = new Date();

    // ===== Sheet 1: 错题记录 =====
    const ws = workbook.addWorksheet('错题记录');

    // 定义列
    const columns = [
      { header: '题号', key: 'num', width: 8 },
      { header: '题型', key: 'type', width: 8 },
      { header: '题目标识', key: 'title', width: 35 },
      { header: '问题', key: 'question', width: 50 },
      { header: '选项', key: 'options', width: 40 },
      { header: '我的答案', key: 'myAnswer', width: 10 },
      { header: '正确答案', key: 'correctAnswer', width: 10 },
      { header: '用时', key: 'time', width: 10 },
      { header: '文字解析', key: 'analysis', width: 60 },
      { header: '提取时间', key: 'timestamp', width: 20 }
    ];

    // 如果包含截图，添加截图列
    if (withScreenshots) {
      columns.push({ header: '题目截图', key: 'qScreenshot', width: 60 });
      columns.push({ header: '解析截图', key: 'aScreenshot', width: 60 });
    }

    ws.columns = columns;

    // 设置表头样式
    const headerRow = ws.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A73E8' }
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
      };
    });

    // 添加数据行
    for (let i = 0; i < wrongQuestions.length; i++) {
      const q = wrongQuestions[i];
      const rowIndex = i + 2; // 从第2行开始（第1行是表头）

      const rowData = {
        num: q.questionNumber || '',
        type: q.questionType || '',
        title: q.examTitle || '',
        question: q.questionText || '',
        options: (q.options || []).join('\n'),
        myAnswer: q.myAnswer || '',
        correctAnswer: q.correctAnswer || '',
        time: q.timeSpent || '',
        analysis: q.analysis || '',
        timestamp: new Date(q.timestamp).toLocaleString('zh-CN')
      };

      const row = ws.addRow(rowData);

      // 默认行高
      let rowHeight = 80;

      // 设置数据行样式
      row.eachCell((cell, colNumber) => {
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE8E8E8' } },
          bottom: { style: 'thin', color: { argb: 'FFE8E8E8' } },
          left: { style: 'thin', color: { argb: 'FFE8E8E8' } },
          right: { style: 'thin', color: { argb: 'FFE8E8E8' } }
        };
        // 交替行背景色
        if (i % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8F9FA' }
          };
        }
      });

      // 我的答案标红（如果是错题）
      const myAnswerCell = row.getCell('myAnswer');
      myAnswerCell.font = { color: { argb: 'FFEA4335' }, bold: true };

      // 正确答案标绿
      const correctAnswerCell = row.getCell('correctAnswer');
      correctAnswerCell.font = { color: { argb: 'FF34A853' }, bold: true };

      // 嵌入截图
      if (withScreenshots) {
        if (q.questionScreenshot) {
          try {
            const base64 = dataUrlToBase64(q.questionScreenshot);
            const imageId = workbook.addImage({
              base64: base64,
              extension: 'png'
            });
            // 截图列是第 11 列（K 列）
            ws.addImage(imageId, {
              tl: { col: 10, row: rowIndex - 1 },
              ext: { width: 400, height: 250 }
            });
            rowHeight = Math.max(rowHeight, 200);
          } catch (e) {
            console.error('[GMAT Helper] Failed to embed question screenshot:', e);
            row.getCell('qScreenshot').value = '截图嵌入失败';
          }
        }

        if (q.analysisScreenshot) {
          try {
            const base64 = dataUrlToBase64(q.analysisScreenshot);
            const imageId = workbook.addImage({
              base64: base64,
              extension: 'png'
            });
            // 解析截图列是第 12 列（L 列）
            ws.addImage(imageId, {
              tl: { col: 11, row: rowIndex - 1 },
              ext: { width: 400, height: 250 }
            });
            rowHeight = Math.max(rowHeight, 200);
          } catch (e) {
            console.error('[GMAT Helper] Failed to embed analysis screenshot:', e);
            row.getCell('aScreenshot').value = '截图嵌入失败';
          }
        }
      }

      row.height = rowHeight;
    }

    // ===== Sheet 2: 文章原文（如果有阅读题） =====
    if (wrongQuestions.some(q => q.articleContent)) {
      const wsArticle = workbook.addWorksheet('文章原文');
      wsArticle.columns = [
        { header: '题号', key: 'num', width: 8 },
        { header: '题型', key: 'type', width: 8 },
        { header: '题目标识', key: 'title', width: 35 },
        { header: '文章原文', key: 'article', width: 100 }
      ];

      // 表头样式
      const artHeaderRow = wsArticle.getRow(1);
      artHeaderRow.height = 28;
      artHeaderRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D47A1' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });

      wrongQuestions.forEach(q => {
        if (!q.articleContent) return;
        const row = wsArticle.addRow({
          num: q.questionNumber || '',
          type: q.questionType || '',
          title: q.examTitle || '',
          article: q.articleContent || ''
        });
        row.height = 120;
        row.eachCell(cell => {
          cell.alignment = { vertical: 'top', wrapText: true };
        });
      });
    }

    // ===== 生成并下载文件 =====
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `GMAT_错题_${dateStr}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return filename;
  }

  /**
   * 加载设置
   */
  async function loadSettings() {
    try {
      const data = await chrome.storage.local.get('gmat_settings');
      const settings = data.gmat_settings || {};
      includeScreenshots.checked = settings.includeScreenshots || false;
      settingScreenshots.checked = settings.includeScreenshots || false;
      settingSiteBaseUrl.value = settings.siteBaseUrl || '';
      settingAdminKey.value = settings.adminKey || '';
    } catch (e) {
      console.error('[GMAT Helper] loadSettings error:', e);
    }
  }

  /**
   * 保存设置
   */
  async function saveSettings() {
    try {
      const settings = getSettings();
      await chrome.storage.local.set({
        gmat_settings: settings
      });
    } catch (e) {
      console.error('[GMAT Helper] saveSettings error:', e);
    }
  }

  /**
   * 加载历史
   */
  async function loadHistory() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getDownloadHistory' });
      if (response && response.success && response.history && response.history.length > 0) {
        historyList.innerHTML = '';
        response.history.slice(-5).reverse().forEach(record => {
          const item = document.createElement('div');
          item.className = 'history-item';
          item.innerHTML = `
            <span class="history-count">${record.count} 道错题</span>
            <span class="history-time">${record.date}</span>
          `;
          historyList.appendChild(item);
        });
      } else {
        historyList.innerHTML = '<div class="empty-state">暂无下载记录</div>';
      }
    } catch (e) {
      console.error('[GMAT Helper] loadHistory error:', e);
    }
  }

  /**
   * 绑定事件
   */
  function bindEvents() {
    downloadBtn.addEventListener('click', handleDownload);
    uploadBtn.addEventListener('click', handleUpload);

    includeScreenshots.addEventListener('change', () => {
      settingScreenshots.checked = includeScreenshots.checked;
      saveSettings();
    });
    settingScreenshots.addEventListener('change', () => {
      includeScreenshots.checked = settingScreenshots.checked;
      saveSettings();
    });
    settingSiteBaseUrl.addEventListener('change', saveSettings);
    settingAdminKey.addEventListener('change', saveSettings);

    settingsBtn.addEventListener('click', () => settingsOverlay.classList.add('show'));
    closeSettings.addEventListener('click', () => settingsOverlay.classList.remove('show'));
    settingsOverlay.addEventListener('click', (e) => {
      if (e.target === settingsOverlay) settingsOverlay.classList.remove('show');
    });

    clearHistoryBtn.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ action: 'clearHistory' });
      historyList.innerHTML = '<div class="empty-state">暂无下载记录</div>';
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
