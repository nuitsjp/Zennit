// publish.js
// このスクリプトは、ユーザーが入力した記事をGitHubリポジトリに公開するための機能を提供します。
// GitHubのOAuth認証、ファイルの作成、およびエラー処理を含みます。

// 共通定数をインポート
import STORAGE_KEYS from './constants.js';

// 設定を読み込む関数
async function loadConfig() {
  const response = await fetch(chrome.runtime.getURL('assets/json/config.json'));
  return await response.json();
}

// DOMの読み込みが完了したら実行
document.addEventListener('DOMContentLoaded', async function() {
  
  // 設定を読み込む
  const config = await loadConfig();

  // アプリケーション全体で使用する定数を定義
  const CLIENT_ID = config.CLIENT_ID;
  const FUNCTION_URL = config.FUNCTION_URL;
  const GITHUB_AUTH_URL = config.GITHUB_AUTH_URL;

  // DOM要素の取得
  const title = document.getElementById('title');
  const article = document.getElementById('article');
  const publishButton = document.getElementById('publish');
  const closeButton = document.getElementById('close');
  const titleError = document.getElementById('titleError');
  const articleError = document.getElementById('articleError');
  const publishError = document.getElementById('publishError');

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

  /**
   * Chrome拡張機能のストレージからデータを読み込む
   * この関数は、保存されたリポジトリ情報とプロンプトを取得します
   * @returns {Promise<Object>} ストレージから読み込んだデータ
   */
  function loadData() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([STORAGE_KEYS.REPOSITORY, STORAGE_KEYS.PROMPT], (result) => {
        resolve(result);
      });
    });
  }

  /**
   * Unicode文字列をBase64エンコードする
   * この関数は、GitHubAPIにファイル内容を送信する際に必要なエンコーディングを行います
   * @param {string} str エンコードする文字列
   * @returns {string} Base64エンコードされた文字列
   */
  function unicodeToBase64(str) {
    const utf8Bytes = new TextEncoder().encode(str);
    return btoa(String.fromCharCode.apply(null, utf8Bytes));
  }

  /**
   * ファイルをGitHubリポジトリに追加する
   * この関数は、GitHub API を使用してリポジトリに新しいファイルを作成します
   * @param {string} repo リポジトリ名 (形式: "ユーザー名/リポジトリ名")
   * @param {string} path リポジトリ内のファイルパス
   * @param {string} content ファイルの内容
   * @param {string} message コミットメッセージ
   * @param {string} token GitHub アクセストークン
   * @returns {Promise<Object>} GitHubのAPI応答
   */
  async function addFileToRepo(repo, path, content, message, token) {
    // 設定を読み込む
    const config = await loadConfig();
    const GITHUB_API_BASE_URL = config.GITHUB_API_BASE_URL;

    // GitHub API のエンドポイントURLを構築
    // このURLは特定のリポジトリ内の特定のファイルパスを指します
    const url = `${GITHUB_API_BASE_URL}/repos/${repo}/contents/${path}`;
    
    // GitHub API に送信するデータを準備
    const data = {
      message: message,  // コミットメッセージ
      content: unicodeToBase64(content)  // Base64エンコードされたファイル内容
    };

    try {
      // GitHub API にリクエストを送信
      // メソッドはPUT（ファイルの作成または更新）
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,  // 認証用のアクセストークン
          'Content-Type': 'application/json',  // JSONデータを送信することを指定
        },
        body: JSON.stringify(data)  // データをJSON文字列に変換
      });

      // レスポンスのステータスコードをチェック
      if (!response.ok) {
        // エラーレスポンスの場合、詳細情報を含めてエラーをスロー
        const errorBody = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
      }

      // レスポンスをJSONとしてパース
      const result = await response.json();
      console.log('File successfully created:', result);
      return result;  // 成功時はGitHub APIのレスポンスを返す
    } catch (error) {
      // ネットワークエラーやAPI側のエラーをログに記録
      console.error('Error creating file:', error);
      // エラーを上位の関数にスローして、適切に処理できるようにする
      throw error;
    }
  }

  /**
   * 記事を公開する
   * この関数は、ユーザーが入力した記事をGitHubリポジトリに公開するメインのプロセスを実行します
   */
  async function publish() {
    if (!validateInputs()) {
      return;
    }

    try {
      // エラーメッセージをクリア
      clearErrorMessage();

      // 保存されたデータを読み込む
      const data = await loadData();
      const repository = data[STORAGE_KEYS.REPOSITORY];
      const prompt = data[STORAGE_KEYS.PROMPT];
      let accessToken = data[STORAGE_KEYS.ACCESS_TOKEN];

      // リポジトリ情報やプロンプトが設定されていない場合、オプションページを開く
      if (!repository || !prompt) {
        chrome.runtime.openOptionsPage();
        return;
      }

      // アクセストークンがない場合、認証を行う
      if(!accessToken) {
        accessToken = await authenticate();
        console.log("Access token:", accessToken);
      }

      // ファイル名とコンテンツを準備
      const fileName = `articles/${title.value.trim()}`;
      const content = article.value.trim();
      const commitMessage = `Publish: ${fileName}`;
      
      // GitHubリポジトリにファイルを追加
      await addFileToRepo(repository, fileName, content, commitMessage, accessToken);
      console.log('File created successfully');

      // 完了メッセージを表示
      showCompletionMessage(fileName);
    } catch (error) {
      console.error('Failed to publish:', error);
      // エラーメッセージを表示
      showErrorMessage(error.message);
    }
  }

  /**
   * 完了メッセージを表示する
   * @param {string} fileName 作成されたファイル名
   */
  function showCompletionMessage(fileName) {
    const message = `ファイル "${fileName}" が正常に公開されました。`;
    alert(message);
    window.close();
  }
  
  /**
   * エラーメッセージを表示する
   * @param {string} errorMessage エラーメッセージ
   */
  function showErrorMessage(errorMessage) {
    publishError.textContent = `公開に失敗しました: ${errorMessage}`;
    publishError.style.display = 'block';
    publishError.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * エラーメッセージをクリアする
   */
  function clearErrorMessage() {
    publishError.textContent = '';
    publishError.style.display = 'none';
  }
  
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