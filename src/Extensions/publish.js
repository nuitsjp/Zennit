// publish.js

// 共通定数をインポート
import { STORAGE_KEYS } from './constants.js';

document.addEventListener('DOMContentLoaded', async function() {
  const title = document.getElementById('title');
  const article = document.getElementById('article');
  const saveButton = document.getElementById('save');
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

    saveButton.disabled = !isValid;
  }

  title.addEventListener('input', validateInputs);
  article.addEventListener('input', validateInputs);
  saveButton.addEventListener('click', validateInputs);
  closeButton.addEventListener('click', function() {
    window.close();
  });

  // 初期状態でバリデーションを実行
  validateInputs();

  // クリップボードから読み取ってフィールドに設定
  await readClipboard();
});