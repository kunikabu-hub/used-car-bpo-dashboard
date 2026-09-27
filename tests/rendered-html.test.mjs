import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("管理ダッシュボードをサーバー描画する", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /中古車BPO 収益・投資シミュレーター/);
  assert.match(html, /7月・8月実績と、現在の再予測/);
  assert.match(html, /スターターキット投資額/);
  assert.match(html, /現在の再予測売上/);
  assert.match(html, /現在の再予測直接粗利/);
  assert.match(html, /実在庫数/);
  assert.match(html, /対象仕上げ台数/);
  assert.doesNotMatch(html, /シミュレーション比と前月差を確認/);
  assert.match(html, /実台数×2,500円/);
  assert.doesNotMatch(html, /リチェック換算率/);
  assert.doesNotMatch(html, /撮影・リチェック<\/span>/);
  assert.match(html, /再予測粗利率/);
  assert.match(html, /実績・再予測/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});
