// background.js
// このスクリプトは、Chrome拡張機能のバックグラウンドプロセスを管理します。
// 主な機能は、拡張機能のインストール/アップデート時の初期化と、デフォルト設定の管理です。

import STORAGE_KEYS from './constants.js';

console.log("Zenn It! extension background loading...");

// 拡張機能のインストール時やアップデート時に実行されるリスナー
chrome.runtime.onInstalled.addListener((details) => {
  console.log(`Zenn It! extension ${details.reason}.`);
  initializeDefaultSettings();
});

// アイコンクリック時にポップアップを表示するリスナー
chrome.action.onClicked.addListener((tab) => {
  const url = tab.url;
  console.log(`Icon clicked. URL: ${url}`);
  // サポートするURLの場合はポップアップを表示
  if (url.startsWith("https://claude.ai/") || url.startsWith("https://chatgpt.com/")) {
    chrome.action.setPopup({ tabId: tab.id, popup: "popup.html" });
  } else {
    chrome.action.setPopup({ tabId: tab.id, popup: "" });
  }
});


/**
 * デフォルト設定を初期化する関数
 * リポジトリ設定とプロンプトが未設定の場合、デフォルト値を設定します。
 */
function initializeDefaultSettings() {
  chrome.storage.sync.get([STORAGE_KEYS.REPOSITORY, STORAGE_KEYS.PROMPT], (result) => {
    const updates = {};

    // リポジトリ設定の初期化
    if (!result[STORAGE_KEYS.REPOSITORY]) {
      updates[STORAGE_KEYS.REPOSITORY] = "";
      console.log("Initializing default repository setting.");
    }

    // プロンプト設定の初期化
    if (!result[STORAGE_KEYS.PROMPT]) {
      loadDefaultPrompt().then(defaultPrompt => {
        updates[STORAGE_KEYS.PROMPT] = defaultPrompt;
        saveSettings(updates);
      });
    } else {
      saveSettings(updates);
    }
  });
}

/**
 * デフォルトのプロンプトテキストを読み込む非同期関数
 * @returns {Promise<string>} デフォルトのプロンプトテキスト
 */
async function loadDefaultPrompt() {
  try {
    const response = await fetch(chrome.runtime.getURL('assets/prompt/claude.txt'));
    const text = await response.text();
    console.log("Default prompt loaded successfully.");
    return text;
  } catch (error) {
    console.error('Error loading default prompt:', error);
    return ""; // エラー時は空文字列を返す
  }
}

/**
 * 設定を保存する関数
 * @param {Object} updates - 保存する設定のオブジェクト
 */
function saveSettings(updates) {
  if (Object.keys(updates).length > 0) {
    chrome.storage.sync.set(updates, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving settings:', chrome.runtime.lastError);
      } else {
        console.log('Settings saved successfully:', updates);
      }
    });
  }
}