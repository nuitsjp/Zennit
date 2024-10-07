// Native Messaging Host の名前
const hostName = "jp.nuits.claude_to_zenn";

// デフォルトの設定値
const defaultSettings = {
  repositoryPath: "",
  multilineString: ""
};

// 拡張機能のインストール時やアップデート時に実行される
chrome.runtime.onInstalled.addListener(() => {
  console.log("Zenn It! extension installed or updated.");
  initializeDefaultSettings();
});

// デフォルト設定の初期化
function initializeDefaultSettings() {
  chrome.storage.sync.get(['repositoryPath', 'multilineString'], (result) => {
    if (!result.repositoryPath) {
      chrome.storage.sync.set({repositoryPath: defaultSettings.repositoryPath});
    }
    if (!result.multilineString) {
      // デフォルトのプロンプトテキストを読み込む
      fetch(chrome.runtime.getURL('prompt.txt'))
        .then(response => response.text())
        .then(text => {
          chrome.storage.sync.set({multilineString: text});
        })
        .catch(error => console.error('Error loading default prompt:', error));
    }
  });
}

// Native Messaging Host との接続を管理
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "nativeMessaging") {
    port.onMessage.addListener((message) => {
      console.log("Received message from popup:", message);
      sendMessageToNativeHost(message, (response) => {
        port.postMessage(response);
      });
    });
  }
});

// Native Host にメッセージを送信
function sendMessageToNativeHost(message, callback) {
  chrome.runtime.sendNativeMessage(hostName, message, (response) => {
    console.log("Received response from native host:", response);
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      callback({ error: chrome.runtime.lastError.message });
    } else {
      callback(response);
    }
  });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getMultilineString") {
    chrome.storage.sync.get('multilineString', function(data) {
      sendResponse({multilineString: data.multilineString});
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
  const clientId = "Ov23liP5J0K2CK1mKWb7";
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