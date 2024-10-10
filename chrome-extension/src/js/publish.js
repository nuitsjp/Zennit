// publish.js
// このスクリプトは、ユーザーが入力した記事をGitHubリポジトリに公開するための機能を提供します。
// GitHubのOAuth認証、ファイルの作成、およびエラー処理を含みます。

import { Octokit } from '@octokit/rest';
import STORAGE_KEYS from './constants.js';

/**
 * 公開UIを管理するクラス
 * このクラスは、ユーザー入力の処理、GitHub認証、ファイルの公開などの機能を提供します。
 */
class PublishUI {
  constructor() {
    this.config = null;
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
   * 設定の読み込み、イベントのバインド、クリップボードの読み取りを行います。
   */
  async initialize() {
    this.config = await this.loadConfig();
    this.bindEvents();
    await this.readClipboard();
    this.validateInputs();
  }

  /**
   * 設定ファイルを読み込む
   * @returns {Promise<Object>} 設定オブジェクト
   */
  async loadConfig() {
    const response = await fetch(chrome.runtime.getURL('assets/json/config.json'));
    return await response.json();
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
   * GitHub認証を行い、アクセストークンを取得する
   * @returns {Promise<string>} GitHubアクセストークン
   */
  async authenticate() {
    const redirectUrl = chrome.identity.getRedirectURL("github");
    const authUrl = `${this.config.GITHUB_AUTH_URL}?client_id=${this.config.CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=repo`;

    try {
      // Chrome拡張機能の認証フローを開始
      const code = await new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true
        }, (responseUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error("GitHub認証に失敗しました。"));
          } else {
            const url = new URL(responseUrl);
            const code = url.searchParams.get("code");
            if (!code) {
              reject(new Error("GitHub認証コードの取得に失敗しました。"));
            } else {
              resolve(code);
            }
          }
        });
      });

      // 認証コードをアクセストークンと交換
      const response = await fetch(`${this.config.FUNCTION_URL}?code=${code}`);
      if (!response.ok) {
        throw new Error(response.status === 403 
          ? 'Zenn It!認証サービスが停止している可能性があります。'
          : 'GitHubアクセストークンの取得に失敗しました。');
      }

      const data = await response.text();
      const params = new URLSearchParams(data);
      const accessToken = params.get('access_token');
      if (!accessToken) {
        throw new Error('GitHubアクセストークンの取得に失敗しました。');
      }

      return accessToken;
    } catch (error) {
      console.error('認証エラー:', error);
      throw error;
    }
  }

  /**
   * Chrome拡張機能のストレージからデータを読み込む
   * @returns {Promise<Object>} ストレージから読み込んだデータ
   */
  async loadStorageData() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([STORAGE_KEYS.REPOSITORY, STORAGE_KEYS.PROMPT, STORAGE_KEYS.ACCESS_TOKEN], resolve);
    });
  }

  /**
   * Unicode文字列をBase64エンコードする
   * @param {string} str エンコードする文字列
   * @returns {string} Base64エンコードされた文字列
   */
  unicodeToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  /**
   * ファイルをGitHubリポジトリに追加する
   * @param {string} repo リポジトリ名 (形式: "ユーザー名/リポジトリ名")
   * @param {string} path リポジトリ内のファイルパス
   * @param {string} content ファイルの内容
   * @param {string} message コミットメッセージ
   * @param {string} accessToken GitHubアクセストークン
   * @returns {Promise<Object>} GitHubのAPI応答
   */
  async addFileToRepo(repo, path, content, message, accessToken) {
    const [owner, repoName] = repo.split('/');
    const octokit = new Octokit({ auth: accessToken });

    try {
      // ファイルの現在の状態を取得
      const { data: currentFile } = await octokit.rest.repos.getContent({
        owner,
        repo: repoName,
        path,
      }).catch(e => e.status === 404 ? { data: null } : Promise.reject(e));

      // ファイルを作成または更新
      const response = await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path,
        message,
        content: this.unicodeToBase64(content),
        sha: currentFile ? currentFile.sha : undefined,
      });

      console.log('ファイルが正常に作成または更新されました:', response.data);
      return response.data;
    } catch (error) {
      console.error('addFileToRepoでエラーが発生しました:', error);
      throw new Error(error.status === 404 
        ? 'リポジトリの設定に誤りがある可能性があります。設定を確認してください。'
        : '記事の更新に失敗しました。');
    }
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
      const { [STORAGE_KEYS.REPOSITORY]: repository, [STORAGE_KEYS.PROMPT]: prompt, [STORAGE_KEYS.ACCESS_TOKEN]: accessToken } = data;

      // リポジトリ情報やプロンプトが設定されていない場合、オプションページを開く
      if (!repository || !prompt) {
        chrome.runtime.openOptionsPage();
        return;
      }

      // アクセストークンがない場合、認証を行う
      const token = accessToken || await this.authenticate();

      // ファイル名とコンテンツを準備
      const fileName = `articles/${this.title.value.trim()}`;
      const content = this.article.value.trim();
      const commitMessage = `Publish: ${fileName}`;
      
      // GitHubリポジトリにファイルを追加
      await this.addFileToRepo(repository, fileName, content, commitMessage, token);
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