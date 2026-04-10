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

  function normalizeText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
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
          setTimeout(resolve, 800);
          return;
        }
      }
      resolve();
    });
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
  async function captureElement(selector) {
    try {
      const element = document.querySelector(selector);
      if (!element || typeof html2canvas === 'undefined') return null;

      const canvas = await html2canvas(element, {
        useCORS: true,
        allowTaint: true,
        scale: 1.5,
        logging: false,
        backgroundColor: '#ffffff'
      });

      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('[GMAT Helper] Screenshot error for', selector, ':', error);
      return null;
    }
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
        data.questionScreenshot = await captureElement('.subject_detailed');
        data.analysisScreenshot = await captureElement('.text_analysis');
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
