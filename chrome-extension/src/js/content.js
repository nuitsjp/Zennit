// 定数をインポート
import STORAGE_KEYS from './constants.js';

// マジックナンバーを定数として定義
const RETRY_INTERVAL = 500;
const INPUT_DELAY = 50;

console.log("Zenn It! content script loaded");

/**
 * デバッグメッセージをコンソールに出力する関数
 * @param {string} message - ログメッセージ
 */
function debugLog(message) {
  console.log(`Content script: ${message}`);
}

// メッセージリスナーを設定
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  debugLog(`Message received: ${JSON.stringify(request)}`);
  
  if (request.action === "generateSummary") {
    try {
      await generateSummary();
      sendResponse({ success: true });
    } catch (error) {
      debugLog(`Error in generateSummary: ${error.message}`);
      sendResponse({ success: false, error: error.message });
    }
  }
});

/**
 * 要約して記事を生成する非同期関数
 */
async function generateSummary() {
  debugLog("Waiting for input element");
  const inputElement = await waitForElement('div[contenteditable="true"]');
  debugLog("Input element found");
  await inputPrompt(inputElement);
  await pressEnter(inputElement);
}

/**
 * 指定されたセレクタの要素が見つかるまで待機する関数
 * @param {string} selector - CSS セレクタ
 * @returns {Promise<Element>} 見つかった要素
 */
function waitForElement(selector) {
  return new Promise((resolve) => {
    debugLog(`Starting waitForElement for: ${selector}`);
    const checkElement = () => {
      const element = document.querySelector(selector);
      if (element) {
        debugLog("Element found");
        resolve(element);
      } else {
        debugLog(`Element not found, retrying in ${RETRY_INTERVAL}ms`);
        setTimeout(checkElement, RETRY_INTERVAL);
      }
    };
    checkElement();
  });
}

/**
 * プロンプトを入力エリアに入力する非同期関数
 * @param {Element} inputArea - 入力エリアの要素
 * @returns {Promise<void>}
 */
async function inputPrompt(inputArea) {
  debugLog("Inputting prompt");
  
  try {
    const data = await new Promise((resolve) => chrome.storage.sync.get(STORAGE_KEYS.PROMPT, resolve));
    let promptText = data.prompt || '';
    
    if (!promptText) {
      debugLog("No custom prompt found, using default prompt");
      const url = chrome.runtime.getURL('assets/prompt/claude.txt');
      const response = await fetch(url);
      promptText = await response.text();
    } else {
      debugLog("Using custom prompt");
    }

    // プロンプトテキストを入力エリアに追加
    inputArea.textContent += promptText;
    const event = new InputEvent('input', {
      inputType: 'insertText',
      data: promptText,
      bubbles: true,
      cancelable: true,
    });
    inputArea.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, INPUT_DELAY));

    debugLog("Prompt inputted");
  } catch (error) {
    debugLog(`Error in inputPrompt: ${error.message}`);
    throw error;
  }
}

/**
 * 指定された要素にEnterキーイベントを発生させる非同期関数
 * @param {Element} element - 対象の要素
 */
async function pressEnter(element) {
  const enterEvent = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'Enter',
    keyCode: 13
  });
  element.dispatchEvent(enterEvent);
  element.textContent += '\n';
  element.dispatchEvent(new Event('input', { bubbles: true }));
  await Promise.resolve();
}