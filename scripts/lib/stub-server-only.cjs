// 検証スクリプト専用: `import "server-only"` を空モジュールにする preload。
// （react-server 条件は react-dom/server と両立しないため、SSR スモークではこちらを使う）
//   node --require ./scripts/lib/stub-server-only.cjs ...
const Module = require("node:module");
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "server-only") return {};
  return origLoad.call(this, request, ...rest);
};
