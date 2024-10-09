// content_scriptsでは通常moduleが使えないため、動的にモジュールを読み込むことで解決する
(async () => {
  await import(chrome.runtime.getURL("js/content.js"));
})();
