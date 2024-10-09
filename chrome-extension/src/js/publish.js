// publish.js
// このスクリプトは、ユーザーが入力した記事をGitHubリポジトリに公開するための機能を提供します。
// GitHubのOAuth認証、ファイルの作成、およびエラー処理を含みます。

// 共通定数をインポート
import STORAGE_KEYS from './constants.js';

// マニフェストから設定を読み込む
const config = chrome.runtime.getManifest().config;

// アプリケーション全体で使用する定数を定義
const CLIENT_ID = config.CLIENT_ID;
const FUNCTION_URL = config.FUNCTION_URL;
const GITHUB_AUTH_URL = config.GITHUB_AUTH_URL;

// DOMの読み込みが完了したら実行
document.addEventListener('DOMContentLoaded', async function() {
  // DOM要素の取得
  const title = document.getElementById('title');
  const article = document.getElementById('article');
  const publishButton = document.getElementById('publish');
  const closeButton = document.getElementById('close');
  const titleError = document.getElementById('titleError');
  const articleError = document.getElementById('articleError');

  /**
   * クリップボードからテキストを読み取り、タイトルと記事本文に設定する
   * この関数は、ユーザーが別の場所からコンテンツをコピーしてきた場合に便利です
   */
  async function readClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const lines = text.split('\n');
        // クリップボードの内容が Markdown フロントマターで始まっているかチェック
        if (lines[0].startsWith('---')) {
          // フロントマターがある場合、全てを記事本文として扱う
          title.value = '';
          article.value = text;
        } else {
          // フロントマターがない場合、最初の行をタイトルとして扱う
          title.value = lines[0];
          article.value = lines.slice(1).join('\n');
        }
        validateInputs();  // 入力内容の検証を実行
      }
    } catch (error) {
      console.error('Failed to read clipboard contents: ', error);
    }
  }

  /**
   * タイトルと記事本文の入力を検証する
   * この関数は、ユーザーの入力が有効かどうかをチェックし、UI を適切に更新します
   * @returns {boolean} 入力が有効な場合はtrue、そうでない場合はfalse
   */
  function validateInputs() {
    let isValid = true;

    // タイトルの検証
    if (!title.value.trim()) {
      title.classList.add('error');
      titleError.style.display = 'block';
      isValid = false;
    } else {
      title.classList.remove('error');
      titleError.style.display = 'none';
    }

    // 記事本文の検証
    if (!article.value.trim()) {
      article.classList.add('error');
      articleError.style.display = 'block';
      isValid = false;
    } else {
      article.classList.remove('error');
      articleError.style.display = 'none';
    }

    // 公開ボタンの有効/無効を切り替え
    publishButton.disabled = !isValid;
    return isValid;
  }

  /**
   * GitHub認証を行い、アクセストークンを取得する
   * この関数は、OAuth2.0フローを使用してGitHubの認証を行います
   * @returns {Promise<string>} アクセストークン
   */
  async function authenticate() {
    // Chrome拡張機能用のリダイレクトURLを取得
    // このURLは、GitHub OAuth アプリケーションの設定で許可されている必要があります
    const redirectUrl = chrome.identity.getRedirectURL("github");
    console.log("Redirect URL:", redirectUrl);
  
    // GitHub OAuth認証用のURLを構築
    // client_id: アプリケーションの識別子
    // redirect_uri: 認証後のリダイレクト先
    // scope: 要求する権限（repo: リポジトリアクセス, user: ユーザー情報アクセス）
    const authUrl = `${GITHUB_AUTH_URL}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=repo,user`;
  
    try {
      // Chrome拡張機能の認証フローを開始
      // この処理はポップアップウィンドウを開き、ユーザーにGitHubログインを促します
      const responseUrl = await new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true  // ユーザーの操作が必要な対話型の認証を指定
        }, (responseUrl) => {
          // 認証プロセスが完了したら、この関数が呼び出されます
          if (chrome.runtime.lastError) {
            // エラーがある場合（例：ユーザーがキャンセルした場合）は reject
            reject(chrome.runtime.lastError);
          } else {
            // 正常に完了した場合は、レスポンスURLをresolve
            resolve(responseUrl);
          }
        });
      });

      console.log("Response URL:", responseUrl);

      // レスポンスURLから認証コードを抽出
      const url = new URL(responseUrl);
      const code = url.searchParams.get("code");
      
      // 認証コードが取得できなかった場合はエラー
      if (!code) {
        throw new Error("No code received from GitHub");
      }

      // 認証コードをアクセストークンと交換
      // この処理はサーバーサイドで行うべきですが、ここではAzure Functionを使用しています
      const response = await fetch(`${FUNCTION_URL}?code=${code}`);
    
      // レスポンスのステータスコードをチェック
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    
      // レスポンスからアクセストークンを抽出
      const data = await response.text();
      const params = new URLSearchParams(data);
      const accessToken = params.get('access_token');

      // アクセストークンが取得できなかった場合はエラー
      if (!accessToken) {
        throw new Error('Failed to get access token');
      }
    
      // 取得したアクセストークンを返す
      return accessToken;
    } catch (error) {
      // 認証プロセス中に発生したエラーをログに記録し、再スロー
      console.error("Authentication failed:", error);
      throw error;
    }
  }

  // ... 残りの関数は変更なし

  // イベントリスナーの設定
  title.addEventListener('input', validateInputs);
  article.addEventListener('input', validateInputs);
  publishButton.addEventListener('click', publish);
  closeButton.addEventListener('click', () => window.close());

  // 初期状態でバリデーションを実行
  validateInputs();

  // クリップボードから読み取ってフィールドに設定
  await readClipboard();
});