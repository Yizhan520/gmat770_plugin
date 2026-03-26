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

  /**
   * 检查当前页面是否是题目解析页面
   */
  function isExercisePage() {
    const { pathname } = window.location;
    return /\/(?:index\/)?exercise\/(?:exercisebg|exerciseresult)\//i.test(pathname);
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
    await waitForSelector('.lis_bor_ul li, .lis_bor li', timeout);
    return getQuestionList();
  }

  /**
   * 从 examTitle 文本中提取题型
   */
  function detectQuestionType(examTitleText) {
    if (!examTitleText) return '未知';
    const text = examTitleText.trim();
    if (text.includes('阅读') || /\bRC\b/.test(text)) return 'RC';
    if (text.includes('逻辑') || /\bCR\b/.test(text)) return 'CR';
    if (text.includes('数学PS') || text.includes('问题求解') || /\bPS\b/.test(text)) return 'PS';
    if (text.includes('数据充分') || /\bDS\b/.test(text)) return 'DS';
    if (/\bIR\b/.test(text)) return 'IR';
    if (text.includes('SC') || text.includes('句子改错')) return 'SC';
    return '未知';
  }

  /**
   * 获取所有题号及其错题状态
   */
  function getQuestionList() {
    const items = document.querySelectorAll('.lis_bor_ul li, .lis_bor li');
    return Array.from(items).map((li, index) => {
      const actionElement = li.querySelector('a, button') || li;
      const classNames = [li.className, actionElement.className]
        .filter(Boolean)
        .join(' ');

      return {
        index: index,
        number: li.textContent.trim(),
        isError: classNames.includes('subject_type_error'),
        isSlow: classNames.includes('subject_type_times'),
        element: actionElement
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

  /**
   * 提取当前显示的题目信息
   */
  function extractCurrentQuestion() {
    const data = {
      examTitle: '',
      questionType: '未知',
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
      data.examTitle = examTitle.textContent.trim();
      data.questionType = detectQuestionType(data.examTitle);
    }

    // 2. 文章正文
    const articleContent = document.querySelector('.article_content');
    if (articleContent) {
      data.articleContent = articleContent.textContent.trim();
    }

    // 3. 问题文本
    const examQuestion = document.querySelector('.examQuestion');
    if (examQuestion) {
      data.questionText = examQuestion.textContent.trim();
    }

    // 4. 选项列表
    const optionLabels = document.querySelectorAll('#quant-answer ul li label');
    if (optionLabels.length > 0) {
      data.options = Array.from(optionLabels).map(label => label.textContent.trim());
    } else {
      const detailBodies = document.querySelectorAll('.detail-body');
      if (detailBodies.length > 1) {
        const labels = detailBodies[1].querySelectorAll('label');
        if (labels.length > 0) {
          data.options = Array.from(labels).map(l => l.textContent.trim());
        } else {
          const lis = detailBodies[1].querySelectorAll('li');
          data.options = Array.from(lis).map(li => li.textContent.trim());
        }
      }
    }

    // 5. 我的答案和正确答案
    const iconfontDivs = document.querySelectorAll('.subject_main > .iconfont');
    if (iconfontDivs.length >= 1) {
      const myAnswerEl = iconfontDivs[0].querySelector('.this_answer');
      if (myAnswerEl) data.myAnswer = myAnswerEl.textContent.trim();
    }
    if (iconfontDivs.length >= 2) {
      const correctAnswerEl = iconfontDivs[1].querySelector('.is_true');
      if (correctAnswerEl) data.correctAnswer = correctAnswerEl.textContent.trim();
    }

    // 6. 判断是否错题
    data.isWrong = data.myAnswer !== '' && data.correctAnswer !== '' && data.myAnswer !== data.correctAnswer;

    // 7. 用时
    const quantTime = document.querySelector('#quant-time');
    if (quantTime) {
      data.timeSpent = quantTime.textContent.trim().replace('本题用时：', '');
    }

    // 8. 文字解析
    const textJiexi = document.querySelector('.text_jiexi');
    if (textJiexi) {
      data.analysis = textJiexi.textContent.trim();
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
      const data = extractCurrentQuestion();
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
        const isValid = isExercisePage();
        const questions = isValid ? await waitForQuestionList(4000) : [];
        const errorCount = questions.filter(q => q.isError).length;

        sendResponse({
          success: true,
          isValidPage: isValid,
          totalCount: questions.length,
          errorCount: errorCount,
          questions: questions.map(q => ({
            number: q.number,
            isError: q.isError,
            isSlow: q.isSlow
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

  console.log('[GMAT Helper] Content script ready. Is exercise page:', isExercisePage());
})();
