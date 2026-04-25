/**
 * GMAT 错题整理助手 - Content Script v2.0
 * 
 * 基于实际页面 DOM 结构：
 * - .subject_main > .subject_detailed  → 题目详解区域
 * - .examTitle                         → 题目标识（含题型）
 * - .article_content                   → 文章正文
 * - .examQuestion                      → 问题文本
 * - #quant-answer ul li label          → 选项列表
 * - .subject_main > .iconfont (第1个)  → 我的答案 (.this_answer)
 * - .subject_main > .iconfont (第2个)  → 正确答案 (.is_true)
 * - .text_analysis .text_jiexi         → 文字解析
 * - .lis_bor_ul li                     → 题号导航
 * - li.subject_type_error              → 错题标记
 */

(function () {
  'use strict';

  console.log('[GMAT Helper] Content script v2.0 loaded on:', window.location.href);

  const DESKTOP_CAPTURE_MIN_WIDTH = 1200;
  const CAPTURE_SCALE = 1.5;
  const CAPTURE_MAX_IMAGE_BYTES = 650 * 1024;
  const CAPTURE_JPEG_QUALITIES = [0.82, 0.74, 0.68];
  const CAPTURE_RESIZE_RATIOS = [0.9, 0.8, 0.7, 0.6];

  function normalizeText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function waitForNextPaint() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function dedupeTextList(items) {
    return Array.from(new Set(items.map(normalizeText).filter(Boolean)));
  }

  function getClassList(element) {
    const actionElement = element?.querySelector('a, button');
    return [
      ...(element?.className ? String(element.className).split(/\s+/) : []),
      ...(actionElement?.className ? String(actionElement.className).split(/\s+/) : [])
    ]
      .map(item => item.trim())
      .filter(Boolean);
  }

  /**
   * 检查当前页面是否是题目解析页面
   */
  function isExercisePage() {
    const { pathname } = window.location;
    return /\/(?:index\/)?exercise\/(?:exercisebg|exerciseresult)\//i.test(pathname);
  }

  function isDryrunReportPage() {
    const { pathname } = window.location;
    return /\/(?:index\/)?dryrun\/report\//i.test(pathname);
  }

  function isSupportedPage() {
    return isExercisePage() || isDryrunReportPage();
  }

  function getPageLabel() {
    if (isDryrunReportPage()) return '模考报告页';
    if (isExercisePage()) return '题目解析页面';
    return '未知页面';
  }

  /**
   * 等待指定选择器出现
   */
  function waitForSelector(selector, timeout = 6000) {
    return new Promise((resolve) => {
      const found = document.querySelector(selector);
      if (found) {
        resolve(found);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          clearTimeout(timer);
          resolve(element);
        }
      });

      const timer = setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    });
  }

  /**
   * 等待题号列表就绪
   */
  async function waitForQuestionList(timeout = 6000) {
    await waitForSelector('.lis_bor_ul li, li[onclick*="ajaxGetDetail"]', timeout);
    return getQuestionList();
  }

  /**
   * 从 examTitle 文本中提取题型
   */
  function detectQuestionType(examTitleText) {
    if (!examTitleText) return '未知';
    const text = examTitleText.trim();
    const upperText = text.toUpperCase();
    if (text.includes('阅读') || /\bRC\b/.test(upperText)) return 'RC';
    if (text.includes('逻辑') || /\bCR\b/.test(upperText)) return 'CR';
    if (text.includes('数学PS') || text.includes('问题求解') || /\bPS\b/.test(upperText)) return 'PS';
    if (text.includes('数据充分') || /\bDS\b/.test(upperText)) return 'DS';
    if (/\bMSR\b/.test(upperText)) return 'MSR';
    if (/\bTPA\b/.test(upperText)) return 'TPA';
    if (/\bGI\b/.test(upperText)) return 'GI';
    if (/\bTA\b/.test(upperText)) return 'TA';
    if (text.includes('数据洞察') || text.includes('Data Insights') || /\bIR\b/.test(upperText)) return 'IR';
    if (text.includes('句子改错') || /\bSC\b/.test(upperText)) return 'SC';
    return '未知';
  }

  function inferQuestionMeta(element, fallbackTitle = '') {
    const classList = getClassList(element);
    const joined = classList.join(' ').toLowerCase();
    let questionType = '未知';
    let sectionHint = '';

    if (joined.includes('subject_type_quant_ps')) {
      questionType = 'PS';
      sectionHint = 'quant';
    } else if (joined.includes('subject_type_quant_ds')) {
      questionType = 'DS';
      sectionHint = 'quant';
    } else if (joined.includes('subject_type_verbal_cr')) {
      questionType = 'CR';
      sectionHint = 'logic';
    } else if (joined.includes('subject_type_verbal_rc')) {
      questionType = 'RC';
      sectionHint = 'reading';
    } else if (joined.includes('subject_type_data_ins_msr')) {
      questionType = 'MSR';
      sectionHint = 'data_insights';
    } else if (joined.includes('subject_type_data_ins_tpa')) {
      questionType = 'TPA';
      sectionHint = 'data_insights';
    } else if (joined.includes('subject_type_data_ins_gi')) {
      questionType = 'GI';
      sectionHint = 'data_insights';
    } else if (joined.includes('subject_type_data_ins_ta')) {
      questionType = 'TA';
      sectionHint = 'data_insights';
    } else if (joined.includes('subject_type_data_ins_ds')) {
      questionType = 'DS';
      sectionHint = 'data_insights';
    }

    if (questionType === '未知') {
      questionType = detectQuestionType(fallbackTitle);
    }

    if (!sectionHint) {
      if (['MSR', 'TPA', 'GI', 'TA', 'IR'].includes(questionType)) {
        sectionHint = 'data_insights';
      } else if (questionType === 'CR') {
        sectionHint = 'logic';
      } else if (questionType === 'RC') {
        sectionHint = 'reading';
      } else if (questionType === 'PS' || questionType === 'DS') {
        sectionHint = joined.includes('subject_type_data_ins') ? 'data_insights' : 'quant';
      }
    }

    return {
      questionType,
      sectionHint
    };
  }

  /**
   * 获取所有题号及其错题状态
   */
  function getQuestionList() {
    const items = document.querySelectorAll('.lis_bor_ul li, li[onclick*="ajaxGetDetail"]');
    return Array.from(items).map((li, index) => {
      const classList = getClassList(li);
      const meta = inferQuestionMeta(li);
      const isError = classList.some(name =>
        name === 'subject_type_error' || (name.startsWith('subject_type_') && name.endsWith('_error'))
      );
      const isSlow = classList.includes('subject_type_times') || !!li.querySelector('img[src*="clock"]');

      return {
        index: index,
        number: normalizeText(li.textContent),
        isError: isError,
        isSlow: isSlow,
        element: li,
        questionType: meta.questionType,
        sectionHint: meta.sectionHint
      };
    });
  }

  /**
   * 展开文字解析（如果隐藏）
   */
  function expandAnalysis() {
    return new Promise((resolve) => {
      const textAnalysis = document.querySelector('.text_analysis');
      if (textAnalysis && window.getComputedStyle(textAnalysis).display === 'none') {
        const btn = document.querySelector('.check_text_btn a.date_is_text');
        if (btn) {
          btn.click();
          setTimeout(resolve, 1000);
          return;
        }
      }
      resolve();
    });
  }

  function getCaptureDimensions(element) {
    const rect = element.getBoundingClientRect();
    return {
      width: Math.ceil(Math.max(rect.width, element.scrollWidth, element.offsetWidth, 0)),
      height: Math.ceil(Math.max(rect.height, element.scrollHeight, element.offsetHeight, 0))
    };
  }

  function isRenderableElement(element) {
    if (!element) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    const { width, height } = getCaptureDimensions(element);
    return width > 4 && height > 4;
  }

  function normalizeCapturedDataUrl(canvas, dataUrl) {
    if (!canvas || canvas.width <= 4 || canvas.height <= 4) {
      return null;
    }

    if (!dataUrl || dataUrl === 'data:,') {
      return null;
    }

    return dataUrl;
  }

  function estimateDataUrlBytes(dataUrl) {
    if (!dataUrl) return 0;
    const commaIndex = dataUrl.indexOf(',');
    const base64Length = commaIndex >= 0 ? dataUrl.length - commaIndex - 1 : dataUrl.length;
    return Math.ceil(base64Length * 3 / 4);
  }

  function resizeCanvas(sourceCanvas, ratio) {
    const width = Math.max(1, Math.round(sourceCanvas.width * ratio));
    const height = Math.max(1, Math.round(sourceCanvas.height * ratio));
    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = width;
    resizedCanvas.height = height;

    const ctx = resizedCanvas.getContext('2d');
    if (!ctx) return sourceCanvas;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
    return resizedCanvas;
  }

  function encodeCanvasForUpload(canvas) {
    const pngDataUrl = canvas.toDataURL('image/png');
    if (estimateDataUrlBytes(pngDataUrl) <= CAPTURE_MAX_IMAGE_BYTES) {
      return pngDataUrl;
    }

    for (const quality of CAPTURE_JPEG_QUALITIES) {
      const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
      if (estimateDataUrlBytes(jpegDataUrl) <= CAPTURE_MAX_IMAGE_BYTES) {
        return jpegDataUrl;
      }
    }

    for (const ratio of CAPTURE_RESIZE_RATIOS) {
      const resizedCanvas = resizeCanvas(canvas, ratio);
      for (const quality of CAPTURE_JPEG_QUALITIES) {
        const jpegDataUrl = resizedCanvas.toDataURL('image/jpeg', quality);
        if (estimateDataUrlBytes(jpegDataUrl) <= CAPTURE_MAX_IMAGE_BYTES) {
          return jpegDataUrl;
        }
      }
    }

    const smallestCanvas = resizeCanvas(canvas, CAPTURE_RESIZE_RATIOS[CAPTURE_RESIZE_RATIOS.length - 1]);
    return smallestCanvas.toDataURL('image/jpeg', CAPTURE_JPEG_QUALITIES[CAPTURE_JPEG_QUALITIES.length - 1]);
  }

  function shouldForceSurfaceCapture(element, options = {}) {
    if (!element || !options || typeof options.minWidth !== 'number') {
      return false;
    }

    return getCaptureDimensions(element).width < options.minWidth;
  }

  async function renderToDataUrl(target) {
    const canvas = await html2canvas(target, {
      useCORS: true,
      allowTaint: true,
      scale: CAPTURE_SCALE,
      logging: false,
      backgroundColor: '#ffffff'
    });

    return normalizeCapturedDataUrl(canvas, encodeCanvasForUpload(canvas));
  }

  function prepareCloneForCapture(node) {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    node.classList.remove('hide_text_box');
    node.style.display = 'block';
    node.style.visibility = 'visible';
    node.style.height = 'auto';
    node.style.maxHeight = 'none';
    node.style.overflow = 'visible';
    node.style.opacity = '1';

    Array.from(node.querySelectorAll('.hide_text_box')).forEach((child) => {
      child.classList.remove('hide_text_box');
      child.style.display = 'block';
      child.style.visibility = 'visible';
      child.style.height = 'auto';
      child.style.maxHeight = 'none';
      child.style.overflow = 'visible';
      child.style.opacity = '1';
    });
  }

  function pruneAnalysisClone(node) {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    Array.from(node.querySelectorAll('img, picture, video, iframe, object, embed')).forEach((media) => {
      media.remove();
    });

    Array.from(node.querySelectorAll('p, div, section')).reverse().forEach((child) => {
      if (child === node) return;
      if (normalizeText(child.textContent)) return;
      if (child.querySelector('table, ul, ol, canvas, svg')) return;
      child.remove();
    });
  }

  function createCaptureSurface(elements, options = {}) {
    const validElements = elements.filter(Boolean);
    if (validElements.length === 0) {
      return null;
    }

    const maxWidth = Math.max(
      options.minWidth || 0,
      ...validElements.map((element) => getCaptureDimensions(element).width)
    );

    const surface = document.createElement('div');
    surface.style.position = 'fixed';
    surface.style.left = '-100000px';
    surface.style.top = '0';
    surface.style.zIndex = '-1';
    surface.style.pointerEvents = 'none';
    surface.style.background = '#ffffff';
    surface.style.padding = '24px';
    surface.style.width = `${Math.max(maxWidth, 320)}px`;
    surface.style.boxSizing = 'border-box';

    validElements.forEach((element, index) => {
      const clone = element.cloneNode(true);
      prepareCloneForCapture(clone);
      if (typeof options.prepareClone === 'function') {
        options.prepareClone(clone, element);
      }
      clone.style.width = '100%';
      clone.style.margin = index === 0 ? '0' : '16px 0 0';
      surface.appendChild(clone);
    });

    document.body.appendChild(surface);
    return surface;
  }

  /**
   * 点击指定题号并等待页面更新
   */
  function clickQuestionNumber(questionElement) {
    return new Promise((resolve) => {
      if (questionElement) {
        const previousKey = [
          document.querySelector('.examTitle')?.textContent?.trim() || '',
          document.querySelector('.examQuestion')?.textContent?.trim() || ''
        ].join('||');

        const finish = () => {
          observer.disconnect();
          clearTimeout(timer);
          resolve();
        };

        const observer = new MutationObserver(() => {
          const nextKey = [
            document.querySelector('.examTitle')?.textContent?.trim() || '',
            document.querySelector('.examQuestion')?.textContent?.trim() || ''
          ].join('||');

          if (nextKey && nextKey !== previousKey) {
            finish();
          }
        });

        const timer = setTimeout(finish, 1800);
        observer.observe(document.querySelector('.subject_main') || document.body, {
          childList: true,
          subtree: true,
          characterData: true
        });

        questionElement.click();
      } else {
        resolve();
      }
    });
  }

  function extractOptions(answerRoot) {
    if (!answerRoot) {
      return [];
    }

    const labelOptions = dedupeTextList(
      Array.from(answerRoot.querySelectorAll('ul li label')).map(label => label.textContent)
    );
    if (labelOptions.length > 0) {
      return labelOptions;
    }

    const tableOptions = dedupeTextList(
      Array.from(answerRoot.querySelectorAll('table tr')).map(row => {
        const optionValue =
          row.querySelector('input[value]')?.getAttribute('value') ||
          row.querySelector('input')?.value ||
          '';
        const cells = Array.from(row.querySelectorAll('td, th'))
          .map(cell => normalizeText(cell.textContent))
          .filter(Boolean);

        if (optionValue) {
          const description = cells[cells.length - 1] || '';
          return description ? `${optionValue}. ${description}` : optionValue;
        }

        return '';
      })
    );
    if (tableOptions.length > 0) {
      return tableOptions;
    }

    const listOptions = dedupeTextList(
      Array.from(answerRoot.querySelectorAll('li')).map(item => item.textContent)
    );
    if (listOptions.length > 0) {
      return listOptions;
    }

    return dedupeTextList(
      Array.from(answerRoot.querySelectorAll('p')).map(item => item.textContent)
    );
  }

  /**
   * 提取当前显示的题目信息
   */
  function extractCurrentQuestion(questionMeta = {}) {
    const data = {
      examTitle: '',
      questionType: '未知',
      sectionHint: '',
      articleContent: '',
      questionText: '',
      options: [],
      myAnswer: '',
      correctAnswer: '',
      isWrong: false,
      timeSpent: '',
      analysis: '',
      timestamp: Date.now()
    };

    // 1. 题目标识和题型
    const examTitle = document.querySelector('.examTitle');
    if (examTitle) {
      data.examTitle = normalizeText(examTitle.textContent);
      const titleMeta = inferQuestionMeta(examTitle, data.examTitle);
      data.questionType = questionMeta.questionType || titleMeta.questionType || detectQuestionType(data.examTitle);
      data.sectionHint = questionMeta.sectionHint || titleMeta.sectionHint || '';
    }

    // 2. 文章正文
    const articleContent = document.querySelector('.article_content');
    if (articleContent) {
      data.articleContent = normalizeText(articleContent.textContent);
    }

    // 3. 问题文本
    const examQuestion = document.querySelector('.examQuestion');
    if (examQuestion) {
      data.questionText = normalizeText(examQuestion.textContent);
    }

    // 4. 选项列表
    const answerRoot = document.querySelector('#quant-answer') || document.querySelectorAll('.detail-body')[1] || null;
    data.options = extractOptions(answerRoot);

    // 5. 我的答案和正确答案
    const myAnswerEl = document.querySelector('.this_answer');
    if (myAnswerEl) data.myAnswer = normalizeText(myAnswerEl.textContent);
    const correctAnswerEl = document.querySelector('.is_true');
    if (correctAnswerEl) data.correctAnswer = normalizeText(correctAnswerEl.textContent);

    if (data.questionType === '未知') {
      data.questionType = detectQuestionType(data.examTitle);
    }

    // 6. 判断是否错题
    data.isWrong =
      !!questionMeta.isError ||
      (data.myAnswer !== '' && data.correctAnswer !== '' && data.myAnswer !== data.correctAnswer);

    // 7. 用时
    const quantTime = document.querySelector('#quant-time');
    if (quantTime) {
      data.timeSpent = normalizeText(quantTime.textContent).replace('本题用时：', '');
    }

    // 8. 文字解析
    const textJiexi = document.querySelector('.text_jiexi');
    if (textJiexi) {
      data.analysis = normalizeText(textJiexi.textContent);
    }

    return data;
  }

  /**
   * 截图指定 DOM 元素
   */
  async function captureElement(selector, options = {}) {
    try {
      const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
      if (!element || typeof html2canvas === 'undefined') return null;

      await waitForNextPaint();
      if (!options.forceSurface && !shouldForceSurfaceCapture(element, options) && isRenderableElement(element)) {
        const directDataUrl = await renderToDataUrl(element);
        if (directDataUrl) {
          return directDataUrl;
        }
      }

      const surface = createCaptureSurface([element], options);
      if (!surface) {
        return null;
      }

      try {
        await waitForNextPaint();
        return await renderToDataUrl(surface);
      } finally {
        surface.remove();
      }
    } catch (error) {
      console.error('[GMAT Helper] Screenshot error for', selector, ':', error);
      return null;
    }
  }

  async function captureElements(selectors, options = {}) {
    const elements = selectors
      .map((selector) => (typeof selector === 'string' ? document.querySelector(selector) : selector))
      .filter(Boolean);

    if (elements.length === 0 || typeof html2canvas === 'undefined') {
      return null;
    }

    try {
      const surface = createCaptureSurface(elements, options);
      if (!surface) {
        return null;
      }

      try {
        await waitForNextPaint();
        return await renderToDataUrl(surface);
      } finally {
        surface.remove();
      }
    } catch (error) {
      console.error('[GMAT Helper] Group screenshot error:', error);
      return null;
    }
  }

  async function captureQuestionScreenshot() {
    if (isDryrunReportPage()) {
      return (
        await captureElements([
          '.detail-body#quant-cn',
          '.detail-body#quant-answer'
        ], { minWidth: DESKTOP_CAPTURE_MIN_WIDTH })
      ) || captureElement('.subject_detailed', { minWidth: DESKTOP_CAPTURE_MIN_WIDTH });
    }

    return captureElement('.subject_detailed', { minWidth: DESKTOP_CAPTURE_MIN_WIDTH });
  }

  async function captureAnalysisScreenshot() {
    if (isDryrunReportPage()) {
      return (
        await captureElement(document.querySelector('.text_analysis'), {
          minWidth: DESKTOP_CAPTURE_MIN_WIDTH,
          forceSurface: true,
          prepareClone: pruneAnalysisClone
        })
      ) || captureElement(document.querySelector('.text_jiexi'), {
        minWidth: DESKTOP_CAPTURE_MIN_WIDTH,
        forceSurface: true,
        prepareClone: pruneAnalysisClone
      });
    }

    return captureElement('.text_analysis', {
      minWidth: DESKTOP_CAPTURE_MIN_WIDTH,
      forceSurface: true,
      prepareClone: pruneAnalysisClone
    });
  }

  /**
   * 提取当前页面所有错题
   */
  async function extractAllWrongQuestions(includeScreenshots) {
    const questions = await waitForQuestionList();
    const wrongQuestions = [];

    console.log('[GMAT Helper] Total questions:', questions.length);
    console.log('[GMAT Helper] Error questions:', questions.filter(q => q.isError).length);

    for (const q of questions) {
      if (!q.isError) continue;

      // 点击切换到该题
      await clickQuestionNumber(q.element);

      // 展开解析
      await expandAnalysis();

      // 提取题目数据
      const data = extractCurrentQuestion({
        questionType: q.questionType,
        sectionHint: q.sectionHint,
        isError: q.isError
      });
      data.questionNumber = q.number;

      // 截图
      if (includeScreenshots) {
        await wait(120);
        const questionScreenshot = await captureQuestionScreenshot();
        const analysisScreenshot = await captureAnalysisScreenshot();

        if (questionScreenshot) {
          data.questionScreenshot = questionScreenshot;
        }
        if (analysisScreenshot) {
          data.analysisScreenshot = analysisScreenshot;
        }
      }

      wrongQuestions.push(data);
      console.log('[GMAT Helper] Extracted wrong question #' + q.number + ':', data.examTitle);
    }

    return wrongQuestions;
  }

  /**
   * 监听来自 popup 的消息
   */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[GMAT Helper] Content script received:', request.action);

    if (request.action === 'checkPage') {
      (async () => {
        const isValid = isSupportedPage();
        const questions = isValid ? await waitForQuestionList(4000) : [];
        const errorCount = questions.filter(q => q.isError).length;

        sendResponse({
          success: true,
          isValidPage: isValid,
          pageLabel: getPageLabel(),
          totalCount: questions.length,
          errorCount: errorCount,
          questions: questions.map(q => ({
            number: q.number,
            isError: q.isError,
            isSlow: q.isSlow,
            questionType: q.questionType,
            sectionHint: q.sectionHint
          }))
        });
      })().catch(error => {
        console.error('[GMAT Helper] checkPage error:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true;
    }

    if (request.action === 'extractAllWrongQuestions') {
      const includeScreenshots = request.includeScreenshots || false;

      extractAllWrongQuestions(includeScreenshots).then(wrongQuestions => {
        sendResponse({ success: true, data: wrongQuestions });
      }).catch(error => {
        console.error('[GMAT Helper] Error:', error);
        sendResponse({ success: false, error: error.message });
      });

      return true; // 异步响应
    }

    sendResponse({ success: false, error: 'Unknown action' });
    return false;
  });

  console.log('[GMAT Helper] Content script ready. Is supported page:', isSupportedPage());
})();
