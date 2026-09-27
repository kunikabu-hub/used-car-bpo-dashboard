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
import { august2026Actual, august2026Summary, july2026Actual, july2026Summary } from "../lib/actuals.ts";
import {
  calculateOperatingForecast,
  calculateServiceRevenue,
  calculateServiceVariableCost,
  initialOperatingProfiles,
  summarizeOperatingForecast,
} from "../lib/operating-model.ts";

const settings = {
  taxMode: "taxExclusive",
  taxRate: 0.1,
  operatingDays: 22,
  pricing,
  operatingCosts: operatingCostSettings,
};

test("リチェック＋登録は実台数×2,500円で請求する", () => {
  assert.equal(calculateRecheckRevenue(1, pricing.client), 2_500);
  assert.equal(calculateRecheckRevenue(100, pricing.client), 250_000);
  assert.equal(calculateRecheckRevenue(100, pricing.client, 1.1), 275_000);
});

test("八王子は実績固定値を優先する", () => {
  const result = calculateStoreSimulation(stores[0], settings);
  assert.equal(result.attaRevenue, 1169021);
  assert.equal(result.attaDirectCost, 513810);
  assert.equal(result.attaGrossProfit, 655211);
  assert.equal(result.nasRevenue, 0);
});

test("一宮はリチェックなし、撮影150台を2,000円で請求する", () => {
  const result = calculateStoreSimulation(stores[1], settings);
  assert.equal(stores[1].recheckCount, 0);
  assert.equal(stores[1].recheckSlots, 0);
  assert.equal(result.recheckRevenue, 0);
  assert.equal(calculatePhotoContractRevenue(stores[1], settings), 300_000);
  assert.equal(result.photoContractRevenue, 300_000);
});

test("一宮は仕上げ180台・撮影150台、撮影委託費1,500円で計算する", () => {
  const result = calculateStoreSimulation(stores[1], settings);
  assert.equal(stores[1].finishingCount, 180);
  assert.equal(stores[1].photoCount, 150);
  assert.equal(calculateDirectPhotoStaffCost(stores[1]), 225_000);
  assert.equal(stores[1].clientNormalFinishingPrice, 8250);
  assert.equal(result.attaRevenue, 2_002_965);
  assert.equal(result.attaDirectCost, 996_186);
  assert.equal(result.attaGrossProfit, 1_006_779);
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
  assert.equal(result.attaDirectCost, 1_710_000);
  assert.equal(result.attaGrossProfit, 684_000);
  assert.equal(result.nasSupplyCost, 0);
});

test("つくばは展示150台のNaS管理、当面は撮影なし", () => {
  const tsukuba = stores.find((store) => store.id === "tsukuba");
  const result = calculateStoreSimulation(tsukuba, settings);
  assert.equal(tsukuba?.displayInventory, 150);
  assert.equal(tsukuba?.finishingCount, 150);
  assert.equal(tsukuba?.photoCount, 0);
  assert.equal(tsukuba?.starterKitInstalled, false);
  assert.equal(tsukuba?.directFinishingCostPerUnit, 4_950);
  assert.equal(result.nasRevenue, 1_007_500);
  assert.equal(result.nasStaffCost, 610_000);
  assert.equal(result.nasSupplyCost, 30000);
  assert.equal(result.nasContributionProfit, 367500);
});

test("大宮は展示車両水洗いを収益・原価に含めない", () => {
  const omiya = stores.find((store) => store.id === "omiya");
  assert.ok(omiya);
  const result = calculateStoreSimulation(omiya, settings);
  assert.equal(omiya.washCount, 0);
  assert.equal(result.washRevenue, 0);
  assert.equal(
    result.nasRevenue,
      omiya.normalFinishingCount * omiya.directFinishingCostPerUnit +
      omiya.photoCount * pricing.attaToNas.photo +
      omiya.recheckCount * omiya.directRecheckCostPerUnit,
  );
});

test("通常仕上げのパートナー委託単価を店舗別に設定する", () => {
  assert.deepEqual(
    Object.fromEntries(stores.filter((store) => ["soka", "omiya", "tsukuba", "shinsayama"].includes(store.id)).map((store) => [store.id, store.directFinishingCostPerUnit])),
    { shinsayama: 5_500, omiya: 4_950, soka: 4_400, tsukuba: 4_950 },
  );
  const soka = calculateStoreSimulation(stores.find((store) => store.id === "soka"), settings);
  assert.equal(soka.attaDirectCost, 1_700_000);
  const omiya = calculateStoreSimulation(stores.find((store) => store.id === "omiya"), settings);
  assert.equal(omiya.attaDirectCost, 1_163_500);
});

test("撮影・リチェックは新しい請求単価と委託単価を使う", () => {
  assert.equal(pricing.client.photo, 2_000);
  assert.equal(pricing.client.recheck, 2_500);
  assert.equal(pricing.attaToNas.photo, 1_500);
  assert.equal(pricing.attaToNas.recheck, 2_000);
  assert.equal(stores.find((store) => store.id === "omiya")?.directRecheckCostPerUnit, 2_500);
  assert.equal(stores.find((store) => store.id === "tsukuba")?.directRecheckCostPerUnit, 2_500);
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

test("2026年8月実績と保存済みシミュレーションの達成率を集計する", () => {
  assert.equal(august2026Actual.stores.reduce((sum, store) => sum + store.revenue, 0), 6_573_916);
  assert.equal(
    august2026Actual.stores.reduce((sum, store) => sum + store.outsourcingCost, 0)
      + august2026Actual.commonUnallocatedCost,
    3_506_506,
  );
  assert.equal(august2026Actual.allocations.reduce((sum, item) => sum + item.amount, 0), 3_506_506);
  assert.equal(august2026Summary.grossProfit, 3_067_410);
  assert.equal(august2026Summary.contributionProfit, 3_024_210);
  assert.ok(Math.abs(august2026Summary.revenueAttainment - 6_573_916 / 12_117_827) < 1e-12);
  assert.ok(Math.abs(august2026Summary.grossProfitAttainment - 3_067_410 / 5_542_831) < 1e-12);
});

test("再予測は撮影・リチェックを実台数と新単価で別計算する", () => {
  const soka = initialOperatingProfiles.find((profile) => profile.storeId === "soka");
  const omiya = initialOperatingProfiles.find((profile) => profile.storeId === "omiya");
  const shinsayama = initialOperatingProfiles.find((profile) => profile.storeId === "shinsayama");
  assert.deepEqual(
    soka.services.filter((service) => service.key === "photo" || service.key === "recheck").map((service) => ({
      key: service.key,
      units: service.capacityUnits * service.utilization,
      billingUnitPrice: service.billingUnitPrice,
      outsourcingUnitPrice: service.outsourcingUnitPrice,
    })),
    [
      { key: "photo", units: 100, billingUnitPrice: 2_000, outsourcingUnitPrice: 1_500 },
      { key: "recheck", units: 100, billingUnitPrice: 2_500, outsourcingUnitPrice: 2_000 },
    ],
  );
  assert.equal(omiya.services.find((service) => service.key === "recheck").capacityUnits * omiya.services.find((service) => service.key === "recheck").utilization, 68);
  assert.equal(omiya.services.find((service) => service.key === "recheck").outsourcingUnitPrice, 2_500);
  assert.equal(shinsayama.services.find((service) => service.key === "recheck").capacityUnits * shinsayama.services.find((service) => service.key === "recheck").utilization, 113);
  assert.equal(shinsayama.services.find((service) => service.key === "recheck").outsourcingUnitPrice, 2_500);
  const result = summarizeOperatingForecast(initialOperatingProfiles);
  assert.equal(result.revenue, 5_666_345);
  assert.equal(result.directCost, 3_644_436);
  assert.equal(result.grossProfit, 2_021_909);
});

test("大宮の仕上げは台数に応じて売上と委託費が増減する", () => {
  const omiya = structuredClone(initialOperatingProfiles.find((profile) => profile.storeId === "omiya"));
  const finishing = omiya.services.find((service) => service.key === "finishing");
  finishing.utilization = 1;
  assert.equal(calculateServiceRevenue(finishing), 1_144_000);
  assert.equal(calculateServiceVariableCost(finishing), 643_500);
});

test("新狭山の仕上げ委託費は対象台数×5,500円で増減する", () => {
  const shinsayama = structuredClone(initialOperatingProfiles.find((profile) => profile.storeId === "shinsayama"));
  const finishing = shinsayama.services.find((service) => service.key === "finishing");
  finishing.utilization = 100 / finishing.capacityUnits;
  assert.equal(calculateServiceVariableCost(finishing), 550_000);
  finishing.utilization = 99 / finishing.capacityUnits;
  assert.equal(calculateServiceVariableCost(finishing), 544_500);
  assert.equal(shinsayama.fixedCost, 0);
  assert.equal(shinsayama.inventoryUnits, 200);
});

test("一宮の撮影は200台基準の減額方式で計算する", () => {
  const ichinomiya = initialOperatingProfiles.find((profile) => profile.storeId === "ichinomiya");
  const photo = structuredClone(ichinomiya.services.find((service) => service.key === "photo"));
  photo.utilization = 1;
  assert.equal(calculateServiceRevenue(photo), 407_000);
  assert.equal(calculateServiceVariableCost(photo), 250_000);
  photo.utilization = 199 / 200;
  assert.equal(calculateServiceRevenue(photo), 405_305);
  assert.equal(calculateServiceVariableCost(photo), 248_750);
  photo.utilization = 181 / 200;
  assert.equal(calculateServiceRevenue(photo), 374_795);
  assert.equal(calculateServiceVariableCost(photo), 226_250);
});

test("未開設店舗も入力台数を再予測へ反映する", () => {
  const tsukuba = structuredClone(initialOperatingProfiles.find((profile) => profile.storeId === "tsukuba"));
  tsukuba.services.forEach((service) => { service.utilization = 0; });
  tsukuba.services.find((service) => service.key === "finishing").utilization = 98 / 150;
  const recheck = tsukuba.services.find((service) => service.key === "recheck");
  recheck.enabled = true;
  recheck.utilization = 40 / 70;
  assert.deepEqual(calculateOperatingForecast(tsukuba), {
    revenue: 962400,
    variableCost: 585100,
    directCost: 585100,
    grossProfit: 377300,
    grossMargin: 377300 / 962400,
  });
});

test("単価変更は保持済みの基準金額より優先して反映する", () => {
  const service = structuredClone(initialOperatingProfiles.find((profile) => profile.storeId === "soka").services.find((service) => service.key === "finishing"));
  service.outsourcingUnitPrice = 5000;
  service.billingUnitPrice = 6000;
  assert.equal(calculateServiceVariableCost(service), 155 * 5000);
  assert.equal(calculateServiceRevenue(service), 155 * 6000);
});

test("最低保証は変動費を下回る場合だけ原価へ反映する", () => {
  const soka = structuredClone(initialOperatingProfiles.find((profile) => profile.storeId === "soka"));
  soka.services.forEach((service) => { service.utilization = 0; });
  const result = calculateOperatingForecast(soka);
  assert.equal(result.revenue, 0);
  assert.equal(result.variableCost, 0);
  assert.equal(result.directCost, 376_400);
  assert.equal(result.grossProfit, -376_400);
});

test("店舗別の売上・直接原価を直接入力した場合は自動計算より優先する", () => {
  const soka = structuredClone(initialOperatingProfiles.find((profile) => profile.storeId === "soka"));
  soka.useDirectFinancials = true;
  soka.directRevenue = 1_234_000;
  soka.directCost = 765_000;
  const result = calculateOperatingForecast(soka);
  assert.equal(result.revenue, 1_234_000);
  assert.equal(result.directCost, 765_000);
  assert.equal(result.grossProfit, 469_000);
  assert.equal(result.grossMargin, 469_000 / 1_234_000);
});
