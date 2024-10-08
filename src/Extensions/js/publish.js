// publish.js

// 共通定数をインポート
import STORAGE_KEYS from './constants.js';

document.addEventListener('DOMContentLoaded', async function() {
  const title = document.getElementById('title');
  const article = document.getElementById('article');
  const publishButton = document.getElementById('publish');
  const closeButton = document.getElementById('close');
  const titleError = document.getElementById('titleError');
  const articleError = document.getElementById('articleError');

  async function readClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const lines = text.split('\n');
        if (lines[0].startsWith('---')) {
          // 1行目が "---" で始まっている場合
          title.value = '';
          article.value = text;
        } else {
          // 1行目が "---" で始まっていない場合
          title.value = lines[0];
          article.value = lines.slice(1).join('\n');
        }
        validateInputs();
      }
    } catch (error) {
      console.error('Failed to read clipboard contents: ', error);
    }
  }

  function validateInputs() {
    let isValid = true;

    if (!title.value.trim()) {
      title.classList.add('error');
      titleError.style.display = 'block';
      isValid = false;
    } else {
      title.classList.remove('error');
      titleError.style.display = 'none';
    }

    if (!article.value.trim()) {
      article.classList.add('error');
      articleError.style.display = 'block';
      isValid = false;
    } else {
      article.classList.remove('error');
      articleError.style.display = 'none';
    }

    publishButton.disabled = !isValid;
    return isValid;
  }

  async function authenticate() {
    const clientId = "Ov23ctrNPZFiJabmPhwj";
    const redirectUrl = chrome.identity.getRedirectURL("github");
    console.log("Redirect URL:", redirectUrl);
  
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=repo,user`;
  
    const responseUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      }, (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(responseUrl);
        }
      });
    });

    console.log("Response URL:", responseUrl);
    const url = new URL(responseUrl);
    const code = url.searchParams.get("code");
    
    if (!code) {
      throw new Error("No code received from GitHub");
    }

    const functionUrl = "https://func-zennit-prod-japaneast.azurewebsites.net/api/ExchangeGitHubToken";
    const response = await fetch(`${functionUrl}?code=${code}`);
  
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  
    const data = await response.text();
    const params = new URLSearchParams(data);
    const accessToken = params.get('access_token');
    if (!accessToken) {
      throw new Error('Failed to get access token');
    }
  
    return accessToken;
  }

  function loadData() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get([STORAGE_KEYS.REPOSITORY, STORAGE_KEYS.PROMPT], (result) => {
          resolve(result);
        }
      );
    });
  }

  function unicodeToBase64(str) {
    // Unicode文字列をUTF-8バイト配列に変換
    const utf8Bytes = new TextEncoder().encode(str);
    // UTF-8バイト配列をBase64エンコード
    return btoa(String.fromCharCode.apply(null, utf8Bytes));
  }

  // ファイルを GitHub リポジトリに追加する関数
  async function addFileToRepo(repo, path, content, message, token) {
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    
    const data = {
      message: message,
      content: unicodeToBase64(content) // content を Base64 エンコード
    };

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('File successfully created:', result);
      return result;
    } catch (error) {
      console.error('Error creating file:', error);
      throw error;
    }
  }

  function publish() {
    if (!validateInputs()) {
      return;
    }

    // Dataを取得
    loadData().then(async function(data) {
      const repository = data[STORAGE_KEYS.REPOSITORY];
      const prompt = data[STORAGE_KEYS.PROMPT];
      let accessToken = data[STORAGE_KEYS.ACCESS_TOKEN];

      if (!repository || !prompt) {
        // options.htmlを開く
        chrome.runtime.openOptionsPage();
        return;
      }

      if(!accessToken) {
        try {
          accessToken = await authenticate();
          console.log("Access token:", accessToken);
        } catch (error) {
          console.error("Failed to authenticate:", error);
          return;
        }
      }

      // 使用例
      const fileName = `articles/${title.value.trim()}`; // 動的に生成されたファイル名
      const content = article.value.trim();
      const commitMessage = `Publish: ${fileName}`;
      
      addFileToRepo(repository, fileName, content, commitMessage, accessToken)
        .then(result => {
          console.log('File created successfully');
        })
        .catch(error => {
          console.error('Failed to create file:', error);
        });
    });
  }

  title.addEventListener('input', validateInputs);
  article.addEventListener('input', validateInputs);
  publishButton.addEventListener('click', publish);
  closeButton.addEventListener('click', function() { window.close(); });

  // 初期状態でバリデーションを実行
  validateInputs();

  // クリップボードから読み取ってフィールドに設定
  await readClipboard();
});