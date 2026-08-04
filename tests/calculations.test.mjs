import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCashFlow,
  calculateExpansionSimulation,
  calculateDirectPhotoStaffCost,
  calculatePhotoContractRevenue,
  calculateRecheckRevenue,
  calculateStoreSimulation,
  summarizeCashFlow,
} from "../lib/calculations.ts";
import { defaultExpansionInputs, operatingCostSettings, pricing, stores } from "../lib/data.ts";
import { july2026Actual, july2026Summary } from "../lib/actuals.ts";

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

test("一宮はリチェックなし、撮影150台を75台分へ換算する", () => {
  const result = calculateStoreSimulation(stores[1], settings);
  assert.equal(stores[1].recheckCount, 0);
  assert.equal(stores[1].recheckSlots, 0);
  assert.equal(result.recheckRevenue, 0);
  assert.equal(calculatePhotoContractRevenue(stores[1], settings), 292925);
  assert.equal(result.photoContractRevenue, 292925);
});

test("一宮は仕上げ180台・撮影150台、撮影専任報酬17万円で計算する", () => {
  const result = calculateStoreSimulation(stores[1], settings);
  assert.equal(stores[1].finishingCount, 180);
  assert.equal(stores[1].photoCount, 150);
  assert.equal(calculateDirectPhotoStaffCost(stores[1]), 170000);
  assert.equal(result.attaRevenue, 2094890);
  assert.equal(result.attaDirectCost, 941186);
  assert.equal(result.attaGrossProfit, 1153704);
});

test("6店舗のMAX展示数を反映する", () => {
  assert.deepEqual(
    Object.fromEntries(stores.map((store) => [store.id, store.displayInventory])),
    { hachioji: 200, ichinomiya: 300, shinsayama: 200, omiya: 150, soka: 250, tsukuba: 150 },
  );
});

test("NaSは草加・大宮・つくば、新狭山はLIVE COLOR管理", () => {
  assert.deepEqual(
    stores.filter((store) => store.managedByNas).map((store) => store.id).sort(),
    ["omiya", "soka", "tsukuba"],
  );
  const shinsayama = stores.find((store) => store.id === "shinsayama");
  assert.equal(shinsayama?.managedByNas, false);
  assert.equal(shinsayama?.managementPartner, "liveColor");
  const result = calculateStoreSimulation(shinsayama, settings);
  assert.equal(shinsayama?.washCount, 0);
  assert.equal(shinsayama?.directFinishingCostPerUnit, 5500);
  assert.equal(shinsayama?.directRecheckCostPerUnit, 2500);
  assert.equal(result.attaDirectCost, 1620000);
  assert.ok(Math.abs(result.attaGrossProfit - 899583.333345) < 0.01);
  assert.equal(result.nasSupplyCost, 0);
});

test("つくばは展示150台のNaS管理、当面は撮影なし", () => {
  const tsukuba = stores.find((store) => store.id === "tsukuba");
  const result = calculateStoreSimulation(tsukuba, settings);
  assert.equal(tsukuba?.displayInventory, 150);
  assert.equal(tsukuba?.finishingCount, 150);
  assert.equal(tsukuba?.photoCount, 0);
  assert.equal(tsukuba?.starterKitInstalled, false);
  assert.equal(result.nasRevenue, 905000);
  assert.equal(result.nasStaffCost, 575000);
  assert.equal(result.nasSupplyCost, 30000);
  assert.equal(result.nasContributionProfit, 300000);
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

test("2026年7月実績の売上・委託費・粗利率を集計する", () => {
  assert.equal(july2026Actual.stores.reduce((sum, store) => sum + store.revenue, 0), 4_910_637);
  assert.equal(july2026Actual.stores.reduce((sum, store) => sum + store.outsourcingCost, 0), 3_107_036);
  assert.equal(july2026Actual.allocations.reduce((sum, item) => sum + item.amount, 0), 3_107_036);
  assert.equal(july2026Summary.grossProfit, 1_803_601);
  assert.ok(Math.abs(july2026Summary.grossMargin - 0.36728452948161305) < 1e-12);
  assert.equal(july2026Summary.equipmentCost, 176_301);
  assert.equal(july2026Summary.contributionProfit, 1_627_300);
});
