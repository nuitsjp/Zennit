console.log("Popup script started loading");

document.addEventListener('DOMContentLoaded', function() {
  console.log("Popup DOM loaded");
  const generateButton = document.getElementById('generateSummary');
  const publishButton = document.getElementById('publishArticle');
  const getReposButton = document.getElementById('getRepos');

  if (!generateButton || !publishButton || !getReposButton) {
    console.log("One or more buttons not found");
    return;
  }

  generateButton.addEventListener('click', function() {
    handleButtonClick('generateSummary');
  });

  publishButton.addEventListener('click', function() {
    checkRepositoryPathAndPublish();
  });

  getReposButton.addEventListener('click', async () => {
    try {
      const accessToken = await chrome.runtime.sendMessage({action: "authenticate"});
      if (accessToken) {
        await fetchRepositories(accessToken);
      } else {
        console.error("Failed to get access token");
        // エラーメッセージをユーザーに表示
      }
    } catch (error) {
      console.error("Authentication failed:", error);
      // エラーメッセージをユーザーに表示
    }
  });

  function handleButtonClick(action) {
    console.log(action + " button clicked");

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (chrome.runtime.lastError) {
        console.log("Error querying tabs: " + chrome.runtime.lastError.message);
        return;
      }
      console.log("Active tab: " + JSON.stringify(tabs[0]));
      chrome.tabs.sendMessage(tabs[0].id, {action: action}, function(response) {
        console.log("Response received in popup");
        if (chrome.runtime.lastError) {
          console.log("Chrome runtime error: " + chrome.runtime.lastError.message);
        }
      });
    });
  }

  function checkRepositoryPathAndPublish() {
    chrome.storage.sync.get('repositoryPath', function(data) {
      if (!data.repositoryPath) {
        alert('リポジトリパスが設定されていません。設定画面で設定してください。');
        // オプション：設定ページを開く
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          window.open(chrome.runtime.getURL('options.html'));
        }
      } else {
        handleButtonClick('publishArticle');
      }
    });
  }
});

async function handleGitHubApiRequest(action) {
  console.log(action + " button clicked");
  try {
    const response = await callGitHubAPI(action);
    displayResult(response);
  } catch (error) {
    console.error('Error:', error);
    if (error.message === 'Authentication required') {
      initiateAuth();
    } else {
      alert('エラーが発生しました: ' + error.message);
    }
  }
}

async function callGitHubAPI(action) {
  const token = await getStoredToken();
  const response = await fetch(`https://func-zennit-prod-japaneast.azurewebsites.net/api/${action}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (response.status === 401) {
    throw new Error('Authentication required');
  }

  return response.json();
}

function initiateAuth() {
  chrome.windows.create({
    url: 'https://func-zennit-prod-japaneast.azurewebsites.net/api/InitiateOAuth',
    type: 'popup',
    width: 800,
    height: 600
  });
}

function displayResult(result) {
  // 結果を表示するロジックを実装
  console.log(result);
  // 例: リポジトリ一覧を表示
  if (Array.isArray(result)) {
    const repoList = result.map(repo => repo.name).join('\n');
    alert('リポジトリ一覧:\n' + repoList);
  }
}

async function getStoredToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get('githubToken', function(data) {
      resolve(data.githubToken || '');
    });
  });
}

async function fetchRepositories(accessToken) {
  try {
    const response = await fetch('https://api.github.com/user/repos', {
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const repos = await response.json();
    console.log("Repositories:", repos);
    // レポジトリ情報の処理
  } catch (error) {
    console.error('Error fetching repositories:', error);
    // エラーメッセージをユーザーに表示
  }
}

console.log("Popup script finished loading");