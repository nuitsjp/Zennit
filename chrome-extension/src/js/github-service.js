// github-service.js

import { Octokit } from '@octokit/rest';

/**
 * GitHubの操作に関するサービス
 */
const GitHubService = {
  /**
   * GitHub認証を行い、アクセストークンを取得する
   * @param {Object} config 設定オブジェクト
   * @returns {Promise<string>} GitHubアクセストークン
   */
  async authenticate(config) {
    const redirectUrl = chrome.identity.getRedirectURL("github");
    const authUrl = `${config.GITHUB_AUTH_URL}?client_id=${config.CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=repo`;

    try {
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

      const response = await fetch(`${config.FUNCTION_URL}?code=${code}`);
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
      const { data: currentFile } = await octokit.rest.repos.getContent({
        owner,
        repo: repoName,
        path,
      }).catch(e => e.status === 404 ? { data: null } : Promise.reject(e));

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