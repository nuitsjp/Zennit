// background.js
import STORAGE_KEYS from './constants.js';

console.log("Zenn It! extension background loding...");

// 拡張機能のインストール時やアップデート時に実行される
chrome.runtime.onInstalled.addListener(() => {
  console.log("Zenn It! extension installed or updated.");
  initializeDefaultSettings();
});

// デフォルト設定の初期化
function initializeDefaultSettings() {
  chrome.storage.sync.get([STORAGE_KEYS.REPOSITORY, STORAGE_KEYS.PROMPT], (result) => {
    if (!result[STORAGE_KEYS.REPOSITORY]) {
      chrome.storage.sync.set({ [STORAGE_KEYS.REPOSITORY]: "" });
    }
    if (!result[STORAGE_KEYS.PROMPT]) {
      // デフォルトのプロンプトテキストを読み込む
      fetch(chrome.runtime.getURL('assets/prompt/claude.txt'))
        .then(response => response.text())
        .then(text => {
          chrome.storage.sync.set({ [STORAGE_KEYS.PROMPT]: text });
        })
        .catch(error => console.error('Error loading default prompt:', error));
    }
  });
}
