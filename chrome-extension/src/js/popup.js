// popup.js
// このスクリプトは、Chrome拡張機能のポップアップUIの動作を制御します。
// 主な機能は、記事の要約生成と公開プロセスの開始です。

import STORAGE_KEYS from './constants.js';

console.log("Popup script started loading...");

// DOMの操作を簡略化するユーティリティ関数
const $ = document.querySelector.bind(document);

class PopupUI {
  constructor() {
    this.generateSummaryBtn = $('#generateSummary');
    this.publishArticleBtn = $('#publishArticle');
    this.statusMessage = $('#statusMessage');
  }

  // UIの初期化
  initialize() {
    this.bindEvents();
    this.updateButtonStates();
  }

  // イベントリスナーの設定
  bindEvents() {
    this.generateSummaryBtn.addEventListener('click', () => this.generateSummary());
    this.publishArticleBtn.addEventListener('click', () => this.publish());
  }

  // ボタンの状態を更新
  async updateButtonStates() {
    const isGenerating = await this.isGeneratingSummary();
    this.generateSummaryBtn.disabled = isGenerating;
    this.publishArticleBtn.disabled = isGenerating;
  }

  // 要約生成中かどうかを確認
  async isGeneratingSummary() {
    return new Promise(resolve => {
      chrome.storage.local.get(STORAGE_KEYS.IS_GENERATING, data => {
        resolve(data[STORAGE_KEYS.IS_GENERATING] || false);
      });
    });
  }

  // ステータスメッセージを表示
  showStatus(message, isError = false) {
    this.statusMessage.textContent = message;
    this.statusMessage.classList.toggle('error', isError);
    this.statusMessage.hidden = false;
  }

  // 要約生成プロセスを開始
  async generateSummary() {
    try {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tabs || tabs.length === 0) {
        throw new Error("アクティブなタブが見つかりません");
      }

      this.showStatus("要約を生成中...");
      await chrome.tabs.sendMessage(tabs[0].id, {action: 'generateSummary'});
      this.showStatus("要約が生成されました");
    } catch (error) {
      console.error("要約生成中にエラーが発生しました:", error);
      this.showStatus("要約生成中にエラーが発生しました", true);
    } finally {
      this.updateButtonStates();
    }
  }

  // 記事公開プロセスを開始
  async publish() {
    try {
      const data = await chrome.storage.sync.get(STORAGE_KEYS.REPOSITORY);
      if (!data[STORAGE_KEYS.REPOSITORY]) {
        this.showStatus("リポジトリが設定されていません", true);
        await this.openOptionsPage();
      } else {
        await this.openPublishPage();
      }
    } catch (error) {
      console.error("公開プロセス開始中にエラーが発生しました:", error);
      this.showStatus("公開プロセス開始中にエラーが発生しました", true);
    }
  }

  // オプションページを開く
  async openOptionsPage() {
    if (chrome.runtime.openOptionsPage) {
      await chrome.runtime.openOptionsPage();
    } else {
      await chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    }
    window.close();
  }

  // 公開ページを開く
  async openPublishPage() {
    await chrome.tabs.create({ url: chrome.runtime.getURL('../html/publish.html') });
    window.close();
  }
}

// DOMの読み込みが完了したらUIを初期化
document.addEventListener('DOMContentLoaded', () => {
  const ui = new PopupUI();
  ui.initialize();
});

console.log("Popup script finished loading");