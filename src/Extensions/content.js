console.log("Zenn It! content script loaded"); // コンテンツスクリプトの読み込み開始をログに記録

// デバッグ用のログ関数を定義
function debugLog(message) {
  console.log("Content script: " + message); // メッセージをコンソールに出力
}

// メッセージリスナーを追加
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  debugLog("Message received: " + JSON.stringify(request)); // 受信したメッセージをログに記録
  
  // アクションに対応する関数を定義
  const actions = {
    generateSummary: generateAndRetrieveSummary,
    publishArticle: publishArticleButton
  };

  // リクエストされたアクションが存在する場合
  if (actions[request.action]) {
    debugLog(`Starting ${request.action}`); // アクションの開始をログに記録
    actions[request.action]()
      .then(summary => {
        debugLog(`Completed ${request.action}`); // アクションの完了をログに記録
        sendResponse({ success: true, summary: summary }); // 成功レスポンスを送信
      })
      .catch(error => {
        debugLog("Error: " + error.message); // エラーをログに記録
        sendResponse({ success: false, error: error.message }); // エラーレスポンスを送信
      });
    return true;  // 非同期レスポンスを示す
  }
  else
  {
    // リクエストされたアクションが存在しない場合
    debugLog("Unknown action: " + request.action); // 不明なアクションをログに記録
  }
});

// 要約して記事を生成する非同期関数
async function generateAndRetrieveSummary() {
  try {
    debugLog("Waiting for input element"); // 入力要素の待機をログに記録
    const inputElement = await waitForElement('div[contenteditable="true"]'); // 入力要素を待機
    debugLog("Input element found"); // 入力要素が見つかったことをログに記録
    await inputPrompt(inputElement); // プロンプトを入力
    await pressEnter(inputElement); // Enterキーを押す
  } catch (error) {
    debugLog("Error in generateAndRetrieveSummary: " + error.message); // エラーをログに記録
    throw error; // エラーを再スロー
  }
}

// 記事を公開するボタンの非同期関数
async function publishArticleButton() {
  try {
    // クリップボードの内容を読み取る（少し遅延を入れる）
    setTimeout(() => {
      readClipboard().then(text => {
        console.log('Clipboard contents:', text); // クリップボードの内容をログに記録

        // バックグラウンドスクリプトとの接続を確立
        port = chrome.runtime.connect({name: "nativeMessaging"});
        console.log('nativeMessaging connected.'); // 接続の確立をログに記録

        // メッセージリスナーを追加
        port.onMessage.addListener((message) => {
          console.log('Received message:', JSON.stringify(message)); // 受信したメッセージをログに記録
        });

        // ストレージから設定を取得
        chrome.storage.sync.get('repositoryPath', function(data) {
          const repositoryPath = data.repositoryPath || ''; // デフォルト値を空文字列に設定

          // メッセージをポスト
          port.postMessage(
            { 
              action: "post", 
              content: text,
              repositoryPath: repositoryPath // 設定から取得したリポジトリパスを使用
            });
          console.log('nativeMessaging posted. Repository path:', repositoryPath); // メッセージのポストとリポジトリパスをログに記録
        });

      }).catch(err => {
        console.error('Failed to read clipboard contents: ', err); // クリップボード読み取り失敗をログに記録
      });
    }, 500);  // 500ミリ秒の遅延（必要に応じて調整）
  } catch (error) {
    debugLog("Error in publishArticleButton: " + error.message); // エラーをログに記録
    throw error; // エラーを再スロー
  }
}

// 指定されたセレクタに一致する要素が見つかるまで待機する関数
function waitForElement(selector) {
  return new Promise((resolve) => {
    debugLog("Starting waitForElement for: " + selector); // 要素の待機開始をログに記録
    const checkElement = () => {
      const element = document.querySelector(selector); // 要素をチェック
      if (element) {
        debugLog("Element found"); // 要素が見つかったことをログに記録
        resolve(element); // 要素を解決
      } else {
        debugLog("Element not found, retrying in 500ms"); // 要素が見つからない場合、再試行をログに記録
        setTimeout(checkElement, 500); // 500ミリ秒後に再試行
      }
    };
    checkElement(); // 要素のチェックを開始
  });
}

// 入力プロンプトを処理する非同期関数
async function inputPrompt(inputArea) {
  debugLog("Inputting prompt"); // プロンプトの入力をログに記録
  
  // ストレージから設定を取得
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get('multilineString', async function(data) {
      try {
        let promptText = data.multilineString || ''; // デフォルト値を空文字列に設定
        
        if (!promptText) {
          debugLog("No custom prompt found, using default prompt"); // カスタムプロンプトが見つからない場合のログ
          const url = chrome.runtime.getURL('prompt.txt'); // デフォルトプロンプトテキストのURLを取得
          const response = await fetch(url); // デフォルトプロンプトテキストをフェッチ
          promptText = await response.text(); // デフォルトプロンプトテキストをテキストとして取得
        } else {
          debugLog("Using custom prompt"); // カスタムプロンプトを使用する場合のログ
        }

        inputArea.textContent += promptText; // 入力エリアにプロンプトテキストを追加
        const event = new InputEvent('input', {
          inputType: 'insertText',
          data: promptText,
          bubbles: true,
          cancelable: true,
        });
        inputArea.dispatchEvent(event); // 入力イベントをディスパッチ
        // 各行の入力後に遅延を入れる
        await new Promise(resolve => setTimeout(resolve, 50)); // 50ミリ秒の遅延

        debugLog("Prompt inputted"); // プロンプトの入力完了をログに記録
        resolve();
      } catch (error) {
        debugLog("Error in inputPrompt: " + error.message); // エラーをログに記録
        reject(error);
      }
    });
  });
}

// Enterキーを押す非同期関数
async function pressEnter(element) {
  const enterEvent = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'Enter',
    keyCode: 13
  });
  element.dispatchEvent(enterEvent); // Enterキーのキーダウンイベントをディスパッチ
  element.textContent += '\n'; // テキストエリアに改行を追加
  element.dispatchEvent(new Event('input', { bubbles: true })); // 入力イベントをディスパッチ
  await new Promise(resolve => setTimeout(resolve, 50)); // 改行後の短い遅延
}

// クリップボードの内容を読み取る関数
function readClipboard() {
  return new Promise((resolve, reject) => {
    // まず、navigator.clipboard.readText()を試みる
    navigator.clipboard.readText().then(resolve).catch(() => {
      // 失敗した場合、document.execCommandを使用
      const textArea = document.createElement("textarea");
      document.body.appendChild(textArea);
      textArea.focus();
      document.execCommand('paste');
      const text = textArea.value;
      document.body.removeChild(textArea);
      resolve(text); // クリップボードの内容を解決
    });
  });
}