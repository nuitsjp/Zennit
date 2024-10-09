import STORAGE_KEYS from './constants.js';

console.log("Zenn It! content script loaded");

function debugLog(message) {
  console.log("Content script: " + message);
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  debugLog("Message received: " + JSON.stringify(request));
  
  if (request.action == "generateSummary") {
    try {
      await generateSummary();
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
});

// 要約して記事を生成する非同期関数
async function generateSummary() {
  debugLog("Waiting for input element");
  const inputElement = await waitForElement('div[contenteditable="true"]');
  debugLog("Input element found");
  await inputPrompt(inputElement);
  await pressEnter(inputElement);
}

function waitForElement(selector) {
  return new Promise((resolve) => {
    debugLog("Starting waitForElement for: " + selector);
    const checkElement = () => {
      const element = document.querySelector(selector);
      if (element) {
        debugLog("Element found");
        resolve(element);
      } else {
        debugLog("Element not found, retrying in 500ms");
        setTimeout(checkElement, 500);
      }
    };
    checkElement();
  });
}

async function inputPrompt(inputArea) {
  debugLog("Inputting prompt");
  
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(STORAGE_KEYS.PROMPT, async function(data) {
      try {
        let promptText = data.prompt || '';
        
        if (!promptText) {
          debugLog("No custom prompt found, using default prompt");
          const url = chrome.runtime.getURL('assets/prompt/claude.txt');
          const response = await fetch(url);
          promptText = await response.text();
        } else {
          debugLog("Using custom prompt");
        }

        inputArea.textContent += promptText;
        const event = new InputEvent('input', {
          inputType: 'insertText',
          data: promptText,
          bubbles: true,
          cancelable: true,
        });
        inputArea.dispatchEvent(event);
        await new Promise(resolve => setTimeout(resolve, 50));

        debugLog("Prompt inputted");
        resolve();
      } catch (error) {
        debugLog("Error in inputPrompt: " + error.message);
        reject(error);
      }
    });
  });
}

async function pressEnter(element) {
  const enterEvent = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'Enter',
    keyCode: 13
  });
  element.dispatchEvent(enterEvent);
  element.textContent += '\n';
  element.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 50));
}