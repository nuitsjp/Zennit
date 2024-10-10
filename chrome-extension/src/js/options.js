// options.js

// 定数ファイルからストレージキーをインポート
import STORAGE_KEYS from './constants.js';

// グローバル定数定義
const FEEDBACK_DURATION = 3000; // フィードバック表示時間（ミリ秒）
const FADE_DURATION = 500; // フェードアウト時間（ミリ秒）

// DOM操作を簡略化するユーティリティ関数
const $ = document.querySelector.bind(document);

/**
 * 設定の管理を担当するモジュール
 */
const SettingsManager = {
  /**
   * 保存された設定を読み込む
   * @returns {Promise<Object>} 読み込んだ設定
   */
  async load() {
    try {
      const data = await chrome.storage.sync.get([STORAGE_KEYS.REPOSITORY, STORAGE_KEYS.PROMPT]);
      return {
        repository: data[STORAGE_KEYS.REPOSITORY] || '',
        prompt: data[STORAGE_KEYS.PROMPT] || ''
      };
    } catch (error) {
      console.error('設定の読み込み中にエラーが発生しました:', error);
      throw error;
    }
  },

  /**
   * 設定を保存する
   * @param {string} repository リポジトリ設定
   * @param {string} prompt プロンプト設定
   * @returns {Promise<void>}
   */
  async save(repository, prompt) {
    try {
      await chrome.storage.sync.set({
        [STORAGE_KEYS.REPOSITORY]: repository.trim(),
        [STORAGE_KEYS.PROMPT]: prompt.trim()
      });
      console.log('設定が保存されました');
    } catch (error) {
      console.error('設定の保存中にエラーが発生しました:', error);
      throw error;
    }
  }
};

/**
 * オプションページのUI操作を管理するクラス
 */
class OptionsUI {
  constructor() {
    // DOM要素の取得
    this.repository = $('#repository');
    this.prompt = $('#prompt');
    this.saveButton = $('#save');
    this.repositoryError = $('#repositoryError');
    this.promptError = $('#promptError');
    this.feedbackElement = this.createFeedbackElement();

    this.bindEvents();
  }

  /**
   * フィードバック表示用の要素を作成
   * @returns {HTMLElement} 作成したフィードバック要素
   */
  createFeedbackElement() {
    const element = document.createElement('div');
    element.setAttribute('role', 'alert');
    element.setAttribute('aria-live', 'polite');
    element.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      background-color: #4CAF50;
      color: white;
      border-radius: 4px;
      display: none;
      transition: opacity ${FADE_DURATION}ms;
    `;
    document.body.appendChild(element);
    return element;
  }

  /**
   * イベントリスナーを設定
   */
  bindEvents() {
    this.repository.addEventListener('input', () => this.validateInputs());
    this.prompt.addEventListener('input', () => this.validateInputs());
    this.saveButton.addEventListener('click', () => this.save());
  }

  /**
   * 入力値のバリデーションを行う
   * @returns {boolean} バリデーション結果
   */
  validateInputs() {
    const isRepositoryValid = this.validateField(this.repository, this.repositoryError);
    const isPromptValid = this.validateField(this.prompt, this.promptError);
    const isValid = isRepositoryValid && isPromptValid;

    this.saveButton.disabled = !isValid;
    return isValid;
  }

  /**
   * 個別のフィールドのバリデーションを行う
   * @param {HTMLInputElement} field 検証対象のフィールド
   * @param {HTMLElement} errorElement エラーメッセージ表示要素
   * @returns {boolean} バリデーション結果
   */
  validateField(field, errorElement) {
    const isValid = field.value.trim() !== '';
    field.classList.toggle('error', !isValid);
    errorElement.style.display = isValid ? 'none' : 'block';
    return isValid;
  }

  /**
   * フィードバックメッセージを表示
   * @param {string} message 表示するメッセージ
   */
  showFeedback(message) {
    this.feedbackElement.textContent = message;
    this.feedbackElement.style.display = 'block';
    this.feedbackElement.style.opacity = '1';
    
    setTimeout(() => {
      this.feedbackElement.style.opacity = '0';
      setTimeout(() => {
        this.feedbackElement.style.display = 'none';
      }, FADE_DURATION);
    }, FEEDBACK_DURATION);
  }

  /**
   * 設定を保存
   */
  async save() {
    if (this.validateInputs()) {
      try {
        await SettingsManager.save(this.repository.value, this.prompt.value);
        this.showFeedback('設定が保存されました');
      } catch (error) {
        this.showFeedback('設定の保存中にエラーが発生しました');
      }
    }
  }

  /**
   * UIの初期化
   */
  async initialize() {
    try {
      const settings = await SettingsManager.load();
      this.repository.value = settings.repository;
      this.prompt.value = settings.prompt;
      this.validateInputs();
    } catch (error) {
      this.showFeedback('設定の読み込み中にエラーが発生しました');
    }
  }
}

// DOMの読み込みが完了したらアプリケーションを初期化
document.addEventListener('DOMContentLoaded', async () => {
  const ui = new OptionsUI();
  await ui.initialize();
});