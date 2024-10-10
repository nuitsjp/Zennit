// options.js

// 定数ファイルからストレージキーをインポート
import STORAGE_KEYS from './constants.js';

// DOMの読み込みが完了したら実行
document.addEventListener('DOMContentLoaded', function() {
  // DOM要素の取得
  const repository = document.getElementById('repository');
  const prompt = document.getElementById('prompt');
  const saveButton = document.getElementById('save');
  const repositoryError = document.getElementById('repositoryError');
  const promptError = document.getElementById('promptError');

  // リアルタイムバリデーション用のイベントリスナーを追加
  repository.addEventListener('input', validateInputs);
  prompt.addEventListener('input', validateInputs);
  saveButton.addEventListener('click', save);

  // フィードバック表示用の要素を動的に作成
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

  // 保存された設定を読み込む
  chrome.storage.sync.get([STORAGE_KEYS.REPOSITORY, STORAGE_KEYS.PROMPT], function(data) {
    if (data[STORAGE_KEYS.REPOSITORY]) {
      repository.value = data[STORAGE_KEYS.REPOSITORY];
    }
    if (data[STORAGE_KEYS.PROMPT]) {
      prompt.value = data[STORAGE_KEYS.PROMPT];
    }
    validateInputs(); // 初期状態でバリデーションを実行
  });

  /**
   * 入力値のバリデーションを行う関数
   * @returns {boolean} バリデーション結果（true: 有効、false: 無効）
   */
  function validateInputs() {
    let isValid = true;

    // リポジトリ入力のバリデーション
    if (!repository.value.trim()) {
      repository.classList.add('error');
      repositoryError.style.display = 'block';
      isValid = false;
    } else {
      repository.classList.remove('error');
      repositoryError.style.display = 'none';
    }

    // プロンプト入力のバリデーション
    if (!prompt.value.trim()) {
      prompt.classList.add('error');
      promptError.style.display = 'block';
      isValid = false;
    } else {
      prompt.classList.remove('error');
      promptError.style.display = 'none';
    }

    // 保存ボタンの有効/無効を切り替え
    saveButton.disabled = !isValid;
    return isValid;
  }

  /**
   * フィードバックメッセージを表示する関数
   * @param {string} message 表示するメッセージ
   */
  function showFeedback(message) {
    feedbackElement.textContent = message;
    feedbackElement.style.display = 'block';
    feedbackElement.style.opacity = '1';
    
    // 3秒後にフィードバックを非表示にする
    setTimeout(() => {
      feedbackElement.style.opacity = '0';
      setTimeout(() => {
        feedbackElement.style.display = 'none';
      }, 500); // フェードアウト後に非表示
    }, 3000);
  }

  /**
   * 設定を保存する関数
   */
  function save() {
    if (validateInputs()) {
      // 入力値をトリムしてストレージに保存
      chrome.storage.sync.set({
        [STORAGE_KEYS.REPOSITORY]: repository.value.trim(),
        [STORAGE_KEYS.PROMPT]: prompt.value.trim()
      }, function () {
        console.log('設定が保存されました');
        showFeedback('設定が保存されました');
      });
    }
  }
});