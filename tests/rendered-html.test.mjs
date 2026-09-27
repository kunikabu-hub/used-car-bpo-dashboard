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
  assert.match(html, /収益と投資を、同じ画面で判断する/);
  assert.match(html, /スターターキット投資額/);
  assert.match(html, /NaS用具費控除後利益/);
  assert.match(html, /2026年8月 暫定実績/);
  assert.match(html, /売上達成率/);
  assert.match(html, /実台数×2,500円/);
  assert.doesNotMatch(html, /リチェック換算率/);
  assert.doesNotMatch(html, /撮影・リチェック<\/span>/);
  assert.match(html, /直接粗利率/);
  assert.match(html, /実績・再予測/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});
