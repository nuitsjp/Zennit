// popup.js
// このスクリプトは、Chrome拡張機能のポップアップUIの動作を制御します。
// 主な機能は、記事の要約生成と公開プロセスの開始です。

// 共通の定数をインポート（ストレージキーなど）
import STORAGE_KEYS from './constants.js';

console.log("Popup script started loading...");

// DOMの操作を簡略化するユーティリティ関数
const $ = document.querySelector.bind(document);

/**
 * ポップアップUIの管理を担当するクラス
 */
class PopupUI {
  constructor() {
    // UIの構成要素
    this.generateSummaryBtn = $('#generateSummary');
    this.publishArticleBtn = $('#publishArticle');
    this.statusMessage = $('#statusMessage');
  }

  /**
   * UIの初期化
   * イベントリスナーの設定とボタンの初期状態を設定します
   */
  initialize() {
    this.bindEvents();
    this.updateButtonStates();
  }

  /**
   * イベントリスナーの設定
   * ボタンクリックイベントを対応するメソッドにバインドします
   */
  bindEvents() {
    this.generateSummaryBtn.addEventListener('click', () => this.generateSummary());
    this.publishArticleBtn.addEventListener('click', () => this.publish());
  }

  /**
   * ボタンの状態を更新
   * 要約生成中かどうかに基づいてボタンの有効/無効を切り替えます
   */
  async updateButtonStates() {
    const isGenerating = await this.isGeneratingSummary();
    this.generateSummaryBtn.disabled = isGenerating;
    this.publishArticleBtn.disabled = isGenerating;
  }

  /**
   * 要約生成中かどうかを確認
   * @returns {Promise<boolean>} 要約生成中の場合はtrue、そうでない場合はfalse
   */
  async isGeneratingSummary() {
    return new Promise(resolve => {
      chrome.storage.local.get(STORAGE_KEYS.IS_GENERATING, data => {
        resolve(data[STORAGE_KEYS.IS_GENERATING] || false);
      });
    });
  }

  /**
   * ステータスメッセージを表示
   * @param {string} message 表示するメッセージ
   * @param {boolean} isError エラーメッセージの場合はtrue
   */
  showStatus(message, isError = false) {
    this.statusMessage.textContent = message;
    this.statusMessage.classList.toggle('error', isError);
    this.statusMessage.hidden = false;
  }

  /**
   * ステータスメッセージをクリア
   * メッセージを非表示にし、内容をクリアします
   */
  clearStatus() {
    this.statusMessage.hidden = true;
    this.statusMessage.classList.toggle('error', false);
    this.statusMessage.textContent = '';
  }

  /**
   * 要約生成プロセスを開始
   * アクティブなタブに要約生成のメッセージを送信します
   */
  async generateSummary() {
    this.clearStatus();
    try {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tabs || tabs.length === 0) {
        throw new Error("アクティブなタブが見つかりません");
      }

      await chrome.tabs.sendMessage(tabs[0].id, {action: 'generateSummary'});
    } catch (error) {
      console.error("要約生成中にエラーが発生しました:", error);
      this.showStatus("要約生成中にエラーが発生しました", true);
    } finally {
      this.updateButtonStates();
    }
  }

  /**
   * 記事公開プロセスを開始
   * リポジトリの設定を確認し、適切な次のステップを実行します
   */
  async publish() {
    this.clearStatus();
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

  /**
   * オプションページを開く
   * chrome.runtime.openOptionsPage APIをサポートしていない場合は
   * 代替方法でオプションページを開きます
   */
  async openOptionsPage() {
    if (chrome.runtime.openOptionsPage) {
      await chrome.runtime.openOptionsPage();
    } else {
      await chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    }
    window.close();
  }

  /**
   * 公開ページを開く
   * 新しいタブで公開ページを開き、現在のポップアップを閉じます
   */
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