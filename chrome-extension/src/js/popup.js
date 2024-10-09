// popup.js
// このスクリプトは、Chrome拡張機能のポップアップUIの動作を制御します。
// 主な機能は、記事の要約生成と公開プロセスの開始です。

// 共通の定数をインポート
import STORAGE_KEYS from './constants.js';

console.log("Popup script started loading");

// DOMの読み込みが完了したら実行
document.addEventListener('DOMContentLoaded', function() {
  console.log("Popup DOM loaded");

  // UIの主要な要素を取得
  const generateButton = document.getElementById('generateSummary');
  const publishButton = document.getElementById('publishArticle');

  // ボタンが見つからない場合はエラーログを出力して処理を終了
  if (!generateButton || !publishButton) {
    console.log("One or more buttons not found");
    return;
  }

  // 要約生成ボタンにクリックイベントリスナーを追加
  generateButton.addEventListener('click', function() {
    handleButtonClick('generateSummary');
  });

  // 記事公開ボタンにクリックイベントリスナーを追加
  publishButton.addEventListener('click', function() {
    publish();
  });

  /**
   * ボタンクリックを処理する関数
   * @param {string} action - 実行するアクション（例: 'generateSummary'）
   */
  function handleButtonClick(action) {
    console.log(action + " button clicked");

    // 現在アクティブなタブを取得
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // タブの取得中にエラーが発生した場合
      if (chrome.runtime.lastError) {
        console.log("Error querying tabs: " + chrome.runtime.lastError.message);
        return;
      }
      console.log("Active tab: " + JSON.stringify(tabs[0]));

      // アクティブなタブにメッセージを送信
      chrome.tabs.sendMessage(tabs[0].id, {action: action}, function(response) {
        console.log("Response received in popup");
        // メッセージ送信中にエラーが発生した場合
        if (chrome.runtime.lastError) {
          console.log("Chrome runtime error: " + chrome.runtime.lastError.message);
        }
      });
    });
  }

  /**
   * 記事公開プロセスを開始する関数
   * リポジトリの設定を確認し、適切な次のステップを実行します
   */
  function publish() {
    // ストレージからリポジトリ設定を取得
    chrome.storage.sync.get(STORAGE_KEYS.REPOSITORY, function(data) {
      if (!data[STORAGE_KEYS.REPOSITORY]) {
        // リポジトリが設定されていない場合
        alert('リポジトリが設定されていません。設定画面で設定してください。');
        
        // 設定ページを開く
        if (chrome.runtime.openOptionsPage) {
          // openOptionsPage APIが利用可能な場合
          chrome.runtime.openOptionsPage(() => {
            window.close();  // ポップアップを閉じる
          });
        } else {
          // openOptionsPage APIが利用できない場合、URLを直接開く
          window.open(chrome.runtime.getURL('../html/options.html'));
          window.close();  // ポップアップを閉じる
        }
      } else {
        // リポジトリが設定されている場合、publish.html を新しいタブで開く
        chrome.tabs.create({ url: chrome.runtime.getURL('../html/publish.html') }, function() {
          window.close();  // ポップアップを閉じる
        });
      }
    });
  }
});

console.log("Popup script finished loading");