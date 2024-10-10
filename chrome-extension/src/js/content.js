// content-script.js
// このスクリプトは、ウェブページ上で動作し、要約生成のためのプロンプト入力を自動化します。

import STORAGE_KEYS from './constants.js';

// 定数定義
const RETRY_INTERVAL = 500; // 要素を再チェックする間隔（ミリ秒）
const INPUT_DELAY = 50; // 入力後の遅延時間（ミリ秒）
const DEBUG = true; // デバッグモードの制御

console.log("Zenn It! content script loaded");

/**
 * デバッグメッセージをコンソールに出力する関数
 * @param {string} message - ログメッセージ
 */
function debugLog(message) {
  if (DEBUG) {
    console.log(`Content script: ${message}`);
  }
}

/**
 * Chrome拡張機能からのメッセージを処理するリスナー
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  debugLog(`Message received: ${JSON.stringify(request)}`);
  
  if (request.action === "generateSummary") {
    generateSummary()
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        debugLog(`Error in generateSummary: ${error.message}`);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 非同期レスポンスを示すために true を返す
  }
});

/**
 * 要約を生成するメイン関数
 * 入力要素を見つけ、プロンプトを入力し、Enterキーを押す一連の処理を行う
 */
async function generateSummary() {
  try {
    debugLog("Waiting for input element");
    const inputElement = await waitForElement('div[contenteditable="true"]');
    debugLog("Input element found");
    await inputPrompt(inputElement);
    await pressEnter(inputElement);
  } catch (error) {
    debugLog(`Error in generateSummary: ${error.message}`);
    throw error;
  }
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
 * プロンプトを入力エリアに入力する関数
 * @param {Element} inputArea - 入力エリアの要素
 */
async function inputPrompt(inputArea) {
  debugLog("Inputting prompt");
  
  try {
    const data = await new Promise((resolve) => chrome.storage.sync.get(STORAGE_KEYS.PROMPT, resolve));
    let promptText = data[STORAGE_KEYS.PROMPT] || '';
    
    if (!promptText) {
      debugLog("No custom prompt found, using default prompt");
      promptText = await fetchDefaultPrompt();
    } else {
      debugLog("Using custom prompt");
    }

    await simulateTyping(inputArea, promptText);
    debugLog("Prompt inputted");
  } catch (error) {
    debugLog(`Error in inputPrompt: ${error.message}`);
    throw error;
  }
}

/**
 * デフォルトのプロンプトを取得する関数
 * @returns {Promise<string>} デフォルトのプロンプトテキスト
 */
async function fetchDefaultPrompt() {
  const url = chrome.runtime.getURL('assets/prompt/claude.txt');
  const response = await fetch(url);
  return await response.text();
}

/**
 * タイピングをシミュレートする関数
 * @param {Element} element - 入力対象の要素
 * @param {string} text - 入力するテキスト
 */
async function simulateTyping(element, text) {
  element.textContent += text;
  const event = new InputEvent('input', {
    inputType: 'insertText',
    data: text,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
  await new Promise(resolve => setTimeout(resolve, INPUT_DELAY));
}

/**
 * 指定された要素にEnterキーイベントを発生させる関数
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