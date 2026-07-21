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
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});
