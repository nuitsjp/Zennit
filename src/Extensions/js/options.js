// options.js

import STORAGE_KEYS from './constants.js';

document.addEventListener('DOMContentLoaded', function() {
  const repository = document.getElementById('repository');
  const prompt = document.getElementById('prompt');
  const saveButton = document.getElementById('save');
  const repositoryError = document.getElementById('repositoryError');
  const promptError = document.getElementById('promptError');

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
  chrome.storage.sync.get([STORAGE_KEYS.REPOSITORY, STORAGE_KEYS.PROMPT], function(data) {
    if (data[STORAGE_KEYS.REPOSITORY]) {
      repository.value = data[STORAGE_KEYS.REPOSITORY];
    }
    if (data[STORAGE_KEYS.PROMPT]) {
      prompt.value = data[STORAGE_KEYS.PROMPT];
    }
    validateInputs(); // 初期状態でバリデーションを実行
  });

  function validateInputs() {
    let isValid = true;

    if (!repository.value.trim()) {
      repository.classList.add('error');
      repositoryError.style.display = 'block';
      isValid = false;
    } else {
      repository.classList.remove('error');
      repositoryError.style.display = 'none';
    }

    if (!prompt.value.trim()) {
      prompt.classList.add('error');
      promptError.style.display = 'block';
      isValid = false;
    } else {
      prompt.classList.remove('error');
      promptError.style.display = 'none';
    }

    saveButton.disabled = !isValid;
    return isValid;
  }

  // Add event listeners for real-time validation
  repository.addEventListener('input', validateInputs);
  prompt.addEventListener('input', validateInputs);

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
        [STORAGE_KEYS.REPOSITORY]: repository.value.trim(),
        [STORAGE_KEYS.PROMPT]: prompt.value.trim()
      }, function() {
        console.log('Settings saved');
        showFeedback('設定が保存されました');
      });
    }
  });
});