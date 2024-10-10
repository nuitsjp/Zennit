// github-service.js
// このスクリプトは、GitHubとの通信を担当するサービスを提供します。
// 認証、ファイルの追加、設定の管理などの機能を含みます。

import { Octokit } from '@octokit/rest';
import STORAGE_KEYS from './constants.js';

/**
 * GitHubとの通信を管理するサービス
 */
const GitHubService = {
  config: null,

  /**
   * サービスの初期化
   * 設定を読み込みます。
   */
  async initialize() {
    this.config = await this.loadConfig();
  },

  /**
   * 設定ファイルを読み込む
   * @returns {Promise<Object>} 設定オブジェクト
   */
  async loadConfig() {
    const response = await fetch(chrome.runtime.getURL('assets/json/config.json'));
    return await response.json();
  },

  /**
   * GitHub認証を行い、アクセストークンを取得する
   * キャッシュされたトークンがある場合はそれを使用し、
   * ない場合は新しいトークンを取得してキャッシュします。
   * @returns {Promise<string>} GitHubアクセストークン
   */
  async authenticate() {
    try {
      const cachedToken = await this.getCachedToken();
      if (cachedToken) {
        return cachedToken;
      }

      const token = await this.getNewToken();
      await this.cacheToken(token);
      return token;
    } catch (error) {
      console.error('認証エラー:', error);
      throw error;
    }
  },

  /**
   * キャッシュされたトークンを取得する
   * @returns {Promise<string|null>} キャッシュされたトークン、またはnull
   */
  async getCachedToken() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(STORAGE_KEYS.TOKEN, (result) => {
        resolve(result[STORAGE_KEYS.TOKEN]);
      });
    });
  },

  /**
   * トークンをキャッシュする
   * @param {string} token キャッシュするトークン
   */
  async cacheToken(token) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [STORAGE_KEYS.TOKEN]: token }, resolve);
    });
  },

  /**
   * 新しいアクセストークンを取得する
   * @returns {Promise<string>} 新しいアクセストークン
   */
  async getNewToken() {
    const redirectUrl = chrome.identity.getRedirectURL("github");
    const authUrl = `${this.config.GITHUB_AUTH_URL}?client_id=${this.config.CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=repo`;

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
  },

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
  },

  /**
   * Unicode文字列をBase64エンコードする
   * @param {string} str エンコードする文字列
   * @returns {string} Base64エンコードされた文字列
   */
  unicodeToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
};

export default GitHubService;