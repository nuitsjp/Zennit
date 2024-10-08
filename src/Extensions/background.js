// Native Messaging Host の名前
const hostName = "jp.nuits.claude_to_zenn";

// デフォルトの設定値
const defaultSettings = {
  repository: "",
  prompt: ""
};

// 拡張機能のインストール時やアップデート時に実行される
chrome.runtime.onInstalled.addListener(() => {
  console.log("Zenn It! extension installed or updated.");
  initializeDefaultSettings();
});

// デフォルト設定の初期化
function initializeDefaultSettings() {
  chrome.storage.sync.get(['repository', 'prompt'], (result) => {
    if (!result.repository) {
      chrome.storage.sync.set({repository: defaultSettings.repository});
    }
    if (!result.prompt) {
      // デフォルトのプロンプトテキストを読み込む
      fetch(chrome.runtime.getURL('prompt.txt'))
        .then(response => response.text())
        .then(text => {
          chrome.storage.sync.set({prompt: text});
        })
        .catch(error => console.error('Error loading default prompt:', error));
    }
  });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getMultilineString") {
    chrome.storage.sync.get('prompt', function(data) {
      sendResponse({prompt: data.prompt});
    });
    return true;  // Will respond asynchronously
  }
  if (request.action === "authenticate") {
    authenticate().then(sendResponse);
    return true;  // 非同期レスポンスを示す
  }
});

async function getAccessToken(code) {
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

async function authenticate() {
  const clientId = "Ov23ctrNPZFiJabmPhwj";
  const redirectUrl = chrome.identity.getRedirectURL("github");
  console.log("Redirect URL:", redirectUrl);

  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=repo,user`;

  try {
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

    const accessToken = await getAccessToken(code);
    return accessToken;
  } catch (error) {
    console.error("Authentication error:", error);
    throw error;
  }
}