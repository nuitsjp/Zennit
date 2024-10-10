// publish.js
// このスクリプトは、ユーザーが入力した記事をGitHubリポジトリに公開するための機能を提供します。
// GitHubのOAuth認証、ファイルの作成、およびエラー処理を含みます。

import GitHubService from './github-service.js';
import STORAGE_KEYS from './constants.js';

/**
 * 公開UIを管理するクラス
 * このクラスは、ユーザー入力の処理、GitHub認証、ファイルの公開などの機能を提供します。
 */
class PublishUI {
  constructor() {
    // DOM要素の取得
    this.title = document.getElementById('title');
    this.article = document.getElementById('article');
    this.publishButton = document.getElementById('publish');
    this.closeButton = document.getElementById('close');
    this.titleError = document.getElementById('titleError');
    this.articleError = document.getElementById('articleError');
    this.publishError = document.getElementById('publishError');
  }

  /**
   * UIの初期化
   * GitHubServiceの初期化、イベントのバインド、クリップボードの読み取りを行います。
   */
  async initialize() {
    await GitHubService.initialize();
    this.bindEvents();
    await this.readClipboard();
    this.validateInputs();
  }

  /**
   * イベントリスナーを設定
   */
  bindEvents() {
    this.title.addEventListener('input', () => this.validateInputs());
    this.article.addEventListener('input', () => this.validateInputs());
    this.publishButton.addEventListener('click', () => this.publish());
    this.closeButton.addEventListener('click', () => window.close());
  }

  /**
   * クリップボードからテキストを読み取り、タイトルと記事本文に設定
   */
  async readClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const lines = text.split('\n');
        if (lines[0].startsWith('---')) {
          // Markdownフロントマターがある場合、全てを記事本文として扱う
          this.title.value = '';
          this.article.value = text;
        } else {
          // フロントマターがない場合、最初の行をタイトルとして扱う
          this.title.value = lines[0];
          this.article.value = lines.slice(1).join('\n');
        }
        this.validateInputs();
      }
    } catch (error) {
      console.error('クリップボードの読み取りに失敗しました: ', error);
    }
  }

  /**
   * 入力値のバリデーションを行う
   * @returns {boolean} バリデーション結果
   */
  validateInputs() {
    const isTitleValid = this.validateField(this.title, this.titleError);
    const isArticleValid = this.validateField(this.article, this.articleError);
    this.publishButton.disabled = !(isTitleValid && isArticleValid);
    return isTitleValid && isArticleValid;
  }

  /**
   * 個別のフィールドのバリデーションを行う
   * @param {HTMLInputElement} field 検証対象のフィールド
   * @param {HTMLElement} errorElement エラーメッセージ表示要素
   * @returns {boolean} バリデーション結果
   */
  validateField(field, errorElement) {
    const isValid = field.value.trim() !== '';
    field.classList.toggle('error', !isValid);
    errorElement.style.display = isValid ? 'none' : 'block';
    return isValid;
  }

  /**
   * Chrome拡張機能のストレージからデータを読み込む
   * @returns {Promise<Object>} ストレージから読み込んだデータ
   */
  async loadStorageData() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([STORAGE_KEYS.REPOSITORY, STORAGE_KEYS.PROMPT], resolve);
    });
  }

  /**
   * 記事を公開する
   * ユーザーが入力した記事をGitHubリポジトリに公開するメインのプロセスを実行します
   */
  async publish() {
    if (!this.validateInputs()) return;

    try {
      this.clearErrorMessage();

      // 保存されたデータを読み込む
      const data = await this.loadStorageData();
      const { [STORAGE_KEYS.REPOSITORY]: repository, [STORAGE_KEYS.PROMPT]: prompt } = data;

      // リポジトリ情報やプロンプトが設定されていない場合、オプションページを開く
      if (!repository || !prompt) {
        chrome.runtime.openOptionsPage();
        return;
      }

      // GitHubの認証を行う
      const token = await GitHubService.authenticate();

      // ファイル名とコンテンツを準備
      const fileName = `articles/${this.title.value.trim()}`;
      const content = this.article.value.trim();
      const commitMessage = `Publish: ${fileName}`;
      
      // GitHubリポジトリにファイルを追加
      await GitHubService.addFileToRepo(repository, fileName, content, commitMessage, token);
      this.showCompletionMessage(fileName);
    } catch (error) {
      console.error('公開に失敗しました:', error);
      this.showErrorMessage(error);
    }
  }

  /**
   * 完了メッセージを表示する
   * @param {string} fileName 作成されたファイル名
   */
  showCompletionMessage(fileName) {
    alert(`ファイル "${fileName}" が正常に公開されました。`);
    window.close();
  }

  /**
   * エラーメッセージを表示する
   * @param {Error} error エラーオブジェクト
   */
  showErrorMessage(error) {
    this.publishError.innerHTML = `${error.message || '公開に失敗しました。'}<br><br>詳細: ${error.detail || error.stack || '詳細情報がありません。'}`;
    this.publishError.style.display = 'block';
    this.publishError.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * エラーメッセージをクリアする
   */
  clearErrorMessage() {
    this.publishError.textContent = '';
    this.publishError.style.display = 'none';
  }
}

// DOMの読み込みが完了したらUIを初期化
document.addEventListener('DOMContentLoaded', async () => {
  const ui = new PublishUI();
  await ui.initialize();
});
