import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCashFlow,
  calculateExpansionSimulation,
  calculateRecheckRevenue,
  calculateStoreSimulation,
  summarizeCashFlow,
} from "../lib/calculations.ts";
import { defaultExpansionInputs, operatingCostSettings, pricing, stores } from "../lib/data.ts";

const settings = {
  taxMode: "taxExclusive",
  taxRate: 0.1,
  recheckConversionRate: 0.75,
  operatingDays: 22,
  pricing,
  operatingCosts: operatingCostSettings,
};

const recheck = (units, rate = 1, slots = 1) => calculateRecheckRevenue(units, slots, rate, pricing.client);

test("換算台数の固定レンジ境界を計算する", () => {
  assert.ok(Math.abs(recheck(99) - (370000 - 3083.333333)) < 0.01);
  assert.equal(recheck(100), 370000);
  assert.equal(recheck(120), 370000);
  assert.equal(recheck(140), 370000);
  assert.ok(Math.abs(recheck(141) - (370000 + 3083.333333)) < 0.01);
});

test("2枠200実台を枠別に0.75換算する", () => {
  const expectedPerSlot = 370000 - (100 - 75) * 3083.333333;
  assert.ok(Math.abs(recheck(200, 0.75, 2) - expectedPerSlot * 2) < 0.01);
});

test("0.70と0.75換算を比較できる", () => {
  assert.ok(recheck(70, 0.75) > recheck(70, 0.70));
});

test("八王子は実績固定値を優先する", () => {
  const result = calculateStoreSimulation(stores[0], settings);
  assert.equal(result.attaRevenue, 1169021);
  assert.equal(result.attaDirectCost, 513810);
  assert.equal(result.attaGrossProfit, 655211);
  assert.equal(result.nasRevenue, 0);
});

test("一宮はリチェック70台・1枠で計算する", () => {
  const result = calculateStoreSimulation(stores[1], settings);
  const expected = 370000 - (100 - 52.5) * 3083.333333;
  assert.ok(Math.abs(result.recheckRevenue - expected) < 0.01);
});

test("5店舗のMAX展示数を反映する", () => {
  assert.deepEqual(
    Object.fromEntries(stores.map((store) => [store.id, store.displayInventory])),
    { hachioji: 200, ichinomiya: 300, shinsayama: 200, omiya: 150, soka: 250 },
  );
});

test("追加5店舗の初期投資とNaS用具費を計算する", () => {
  const result = calculateExpansionSimulation({ ...defaultExpansionInputs, storeCount: 5 }, settings);
  assert.equal(result.starterKitInvestment, 3000000);
  assert.equal(result.monthlyNasSupplyCost, 150000);
  assert.equal(result.annualNasSupplyCost, 1800000);
});

test("一括展開と段階展開の開設月を分ける", () => {
  const inputs = { ...defaultExpansionInputs, storeCount: 3 };
  const simultaneous = calculateCashFlow(inputs, settings, 12, "simultaneous");
  const phased = calculateCashFlow(inputs, settings, 12, "phased");
  assert.deepEqual(simultaneous.slice(0, 3).map((row) => row.newStores), [3, 0, 0]);
  assert.deepEqual(phased.map((row) => row.newStores), [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0]);
  assert.equal(summarizeCashFlow(simultaneous).maximumCashOutflow, 1800000);
  assert.equal(summarizeCashFlow(phased).maximumCashOutflow, 600000);
});
