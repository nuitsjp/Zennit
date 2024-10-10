// github-service.js
// このスクリプトは、GitHubとの通信を担当するサービスを提供します。
// 認証、ファイルの追加、更新、確認、設定の管理などの機能を含みます。

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
   * 特定のファイルの存在を確認し、存在する場合はハッシュを返す
   * 
   * Why この実装方法を選んだのか：
   * 1. エラーログの最小化：
   *    個別のファイルに対する直接的なGET/HEADリクエストは、ファイルが存在しない場合に
   *    不要なエラーログを生成してしまいます。ディレクトリの内容を取得する方法を使用することで、
   *    このような不要なエラーログを完全に回避できます。
   * 
   * 2. エラーハンドリングの改善：
   *    ディレクトリが存在しない場合と、ファイルが存在しない場合を明確に区別できます。
   *    これにより、より詳細なエラー報告と適切なエラーハンドリングが可能になります。
   * 
   * 3. 特定の要件への対応：
   *    'articles/'ディレクトリ内の単一ファイルを扱うという特定の要件に適した実装になっています。
   *    この構造を前提とすることで、目的に特化したコードを書くことができます。
   *
   * @param {string} repo リポジトリ名 (形式: "ユーザー名/リポジトリ名")
   * @param {string} path リポジトリ内のファイルパス (形式: "articles/ファイル名")
   * @param {string} accessToken GitHubアクセストークン
   * @returns {Promise<string|null>} ファイルのSHA-1ハッシュ、存在しない場合はnull
   */
  async checkFileExistence(repo, path, accessToken) {
    const [owner, repoName] = repo.split('/');
    const [directory, fileName] = path.split('/');
    const octokit = new Octokit({ auth: accessToken });

    try {
      // Why ディレクトリの内容を取得するのか：
      // 特定のファイルの存在を確認する際に、不要なエラーログの出力を避けるため
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo: repoName,
        path: directory,
      });

      // Why データが配列かチェックするのか：
      // APIレスポンスが期待通りの形式（ディレクトリリスティング）であることを確認し、
      // 誤って単一ファイルの内容を取得してしまった場合のエラーを防ぐため
      if (!Array.isArray(data)) {
        throw new Error(`${directory} はディレクトリではありません。`);
      }

      // 指定されたファイル名と一致するファイルを探す
      const file = data.find(item => item.name === fileName);

      // ファイルが見つかった場合はそのSHAを、見つからなかった場合はnullを返す
      return file ? file.sha : null;

    } catch (error) {
      // Why 404エラーを特別に処理するのか：
      // ディレクトリが存在しない場合を、他のエラーと区別して扱い、
      // 適切なエラーメッセージを提供するため
      if (error.status === 404) {
        console.warn(`ディレクトリ ${directory} が見つかりません。`);
        return null;
      }
      // その他のエラーの場合は例外をスロー
      console.error('ファイルの確認中にエラーが発生しました:', error);
      throw new Error('ファイルの確認中にエラーが発生しました。');
    }
  },

  /**
   * 新しいファイルをGitHubリポジトリに追加する
   * @param {string} repo リポジトリ名 (形式: "ユーザー名/リポジトリ名")
   * @param {string} path リポジトリ内のファイルパス
   * @param {string} content ファイルの内容
   * @param {string} message コミットメッセージ
   * @param {string} accessToken GitHubアクセストークン
   * @returns {Promise<Object>} GitHubのAPI応答
   */
  async addNewFile(repo, path, content, message, accessToken) {
    const [owner, repoName] = repo.split('/');
    const octokit = new Octokit({ auth: accessToken });

    try {
      const response = await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path,
        message,
        content: this.unicodeToBase64(content),
      });

      console.log('新しいファイルが正常に作成されました:', response.data);
      return response.data;
    } catch (error) {
      console.error('addNewFileでエラーが発生しました:', error);
      throw new Error('新しいファイルの作成に失敗しました。');
    }
  },

  /**
   * 既存のファイルを更新する
   * @param {string} repo リポジトリ名 (形式: "ユーザー名/リポジトリ名")
   * @param {string} path リポジトリ内のファイルパス
   * @param {string} content 新しいファイルの内容
   * @param {string} message コミットメッセージ
   * @param {string} sha 既存ファイルのSHA-1ハッシュ
   * @param {string} accessToken GitHubアクセストークン
   * @returns {Promise<Object>} GitHubのAPI応答
   */
  async updateFile(repo, path, content, message, sha, accessToken) {
    const [owner, repoName] = repo.split('/');
    const octokit = new Octokit({ auth: accessToken });

    try {
      const response = await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path,
        message,
        content: this.unicodeToBase64(content),
        sha,
      });

      console.log('ファイルが正常に更新されました:', response.data);
      return response.data;
    } catch (error) {
      console.error('updateFileでエラーが発生しました:', error);
      throw new Error('ファイルの更新に失敗しました。');
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