document.addEventListener('DOMContentLoaded', function() {
  const repositoryPath = document.getElementById('repositoryPath');
  const multilineString = document.getElementById('multilineString');
  const saveButton = document.getElementById('save');
  const repositoryPathError = document.getElementById('repositoryPathError');
  const multilineStringError = document.getElementById('multilineStringError');

  // フィードバック用の要素を追加
  const feedbackElement = document.createElement('div');
  feedbackElement.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 10px 20px;
    background-color: #4CAF50;
    color: white;
    border-radius: 4px;
    display: none;
    transition: opacity 0.5s;
  `;
  document.body.appendChild(feedbackElement);

  // Load saved settings
  chrome.storage.sync.get(['repositoryPath', 'multilineString'], function(data) {
    if (data.repositoryPath) {
      repositoryPath.value = data.repositoryPath;
    }
    if (data.multilineString) {
      multilineString.value = data.multilineString;
    }
    validateInputs(); // 初期状態でバリデーションを実行
  });

  function validateInputs() {
    let isValid = true;

    if (!repositoryPath.value.trim()) {
      repositoryPath.classList.add('error');
      repositoryPathError.style.display = 'block';
      isValid = false;
    } else {
      repositoryPath.classList.remove('error');
      repositoryPathError.style.display = 'none';
    }

    if (!multilineString.value.trim()) {
      multilineString.classList.add('error');
      multilineStringError.style.display = 'block';
      isValid = false;
    } else {
      multilineString.classList.remove('error');
      multilineStringError.style.display = 'none';
    }

    saveButton.disabled = !isValid;
    return isValid;
  }

  // Add event listeners for real-time validation
  repositoryPath.addEventListener('input', validateInputs);
  multilineString.addEventListener('input', validateInputs);

  // フィードバックを表示する関数
  function showFeedback(message) {
    feedbackElement.textContent = message;
    feedbackElement.style.display = 'block';
    feedbackElement.style.opacity = '1';
    
    setTimeout(() => {
      feedbackElement.style.opacity = '0';
      setTimeout(() => {
        feedbackElement.style.display = 'none';
      }, 500);
    }, 3000);
  }

  // Save settings
  saveButton.addEventListener('click', function() {
    if (validateInputs()) {
      chrome.storage.sync.set({
        repositoryPath: repositoryPath.value.trim(),
        multilineString: multilineString.value.trim()
      }, function() {
        console.log('Settings saved');
        showFeedback('設定が保存されました');
      });
    }
  });
});