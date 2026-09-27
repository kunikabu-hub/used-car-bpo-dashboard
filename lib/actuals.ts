export type ActualStatus = "confirmed" | "provisional" | "unallocated";

export type StoreActual = {
  id: string;
  name: string;
  revenue: number;
  outsourcingCost: number;
  costStatus?: ActualStatus;
};

export type ContractorAllocation = {
  store: string;
  contractor: string;
  amount: number;
  work: string;
  status?: "confirmed" | "provisional";
};

export type SimulationStoreSnapshot = {
  id: string;
  name: string;
  revenue: number;
  directCost: number;
};

export type SimulationSnapshot = {
  version: string;
  label: string;
  frozenAt: string;
  note: string;
  stores: SimulationStoreSnapshot[];
};

export type MonthlyActual = {
  id: string;
  period: string;
  shortPeriod: string;
  status: "confirmed" | "provisional";
  utilizationRate: number;
  revenue: number;
  storeOutsourcingCost: number;
  commonUnallocatedCost: number;
  equipmentCost: number;
  equipmentCostTaxIncluded?: number;
  commonEquipmentCost: number;
  lightingEquipmentCostTaxIncluded: number;
  lightingEquipmentCostTaxExclusive: number;
  stores: StoreActual[];
  allocations: ContractorAllocation[];
  simulation: SimulationSnapshot;
  notes: string[];
};

const simulationV1: SimulationSnapshot = {
  version: "SIM-2026-08-v1",
  label: "初期シミュレーション v1",
  frozenAt: "2026-08-12",
  note: "店舗別の標準処理量・契約単価を基にした初期計画。実績の達成率はこの保存値と比較します。",
  stores: [
    { id: "hachioji", name: "八王子", revenue: 1_169_021, directCost: 513_810 },
    { id: "ichinomiya", name: "一宮", revenue: 1_860_890, directCost: 941_186 },
    { id: "shinsayama", name: "新狭山", revenue: 2_519_583, directCost: 1_620_000 },
    { id: "omiya", name: "大宮", revenue: 1_853_958, directCost: 975_000 },
    { id: "soka", name: "草加", revenue: 3_005_833, directCost: 1_620_000 },
    { id: "tsukuba", name: "つくば", revenue: 1_708_542, directCost: 905_000 },
  ],
};

export const july2026Actual: MonthlyActual = {
  id: "2026-07", period: "2026年7月", shortPeriod: "7月", status: "confirmed", utilizationRate: 0.8,
  revenue: 4_910_637, storeOutsourcingCost: 3_107_036, commonUnallocatedCost: 0,
  equipmentCost: 176_301, equipmentCostTaxIncluded: 186_331,
  commonEquipmentCost: 76_000, lightingEquipmentCostTaxIncluded: 110_331, lightingEquipmentCostTaxExclusive: 100_301,
  stores: [
    { id: "hachioji", name: "八王子", revenue: 594_500, outsourcingCost: 270_600 },
    { id: "soka", name: "草加", revenue: 1_427_609, outsourcingCost: 606_900 },
    { id: "omiya", name: "大宮", revenue: 140_317, outsourcingCost: 294_500 },
    { id: "ichinomiya", name: "一宮", revenue: 1_764_570, outsourcingCost: 1_074_036 },
    { id: "shinsayama", name: "新狭山", revenue: 847_641, outsourcingCost: 861_000 },
    { id: "tokorozawa", name: "所沢", revenue: 136_000, outsourcingCost: 0, costStatus: "unallocated" },
  ],
  allocations: [
    { store: "八王子", contractor: "青木", amount: 124_600, work: "水洗い" },
    { store: "八王子", contractor: "高橋", amount: 146_000, work: "店舗業務" },
    { store: "草加", contractor: "石垣", amount: 132_400, work: "撮影・リチェック等" },
    { store: "草加", contractor: "高橋", amount: 28_000, work: "店舗業務" },
    { store: "草加", contractor: "福田", amount: 107_500, work: "仕上げ" },
    { store: "草加", contractor: "小山", amount: 244_000, work: "店舗業務" },
    { store: "草加", contractor: "青木", amount: 95_000, work: "水洗い・関連費" },
    { store: "大宮", contractor: "小山", amount: 130_000, work: "店舗業務" },
    { store: "大宮", contractor: "岩崎", amount: 139_500, work: "店舗業務" },
    { store: "大宮", contractor: "渡邊", amount: 9_000, work: "店舗業務" },
    { store: "大宮", contractor: "高橋", amount: 16_000, work: "店舗業務" },
    { store: "一宮", contractor: "福田", amount: 1_074_036, work: "水洗い・仕上げ・登録" },
    { store: "新狭山", contractor: "LIVE COLOR", amount: 593_000, work: "仕上げ" },
    { store: "新狭山", contractor: "上荒磯", amount: 268_000, work: "リチェック" },
  ],
  simulation: simulationV1,
  notes: [
    "売上・店舗委託費は税抜。高橋の総額266,000円のうち190,000円を店舗費、76,000円を備品・共通費に分類。",
    "所沢は売上伝票がありますが、店舗別業務委託費の配賦がありません。",
  ],
};

export const august2026Actual: MonthlyActual = {
  id: "2026-08", period: "2026年8月", shortPeriod: "8月", status: "provisional", utilizationRate: 0,
  revenue: 6_573_916, storeOutsourcingCost: 3_506_506, commonUnallocatedCost: 396_810,
  equipmentCost: 43_200, equipmentCostTaxIncluded: 47_520,
  commonEquipmentCost: 0, lightingEquipmentCostTaxIncluded: 47_520, lightingEquipmentCostTaxExclusive: 43_200,
  stores: [
    { id: "hachioji", name: "八王子", revenue: 702_500, outsourcingCost: 312_200 },
    { id: "ichinomiya", name: "一宮", revenue: 2_033_365, outsourcingCost: 760_400 },
    { id: "shinsayama", name: "新狭山", revenue: 1_649_637, outsourcingCost: 962_000 },
    { id: "omiya", name: "大宮", revenue: 1_014_364, outsourcingCost: 341_076, costStatus: "provisional" },
    { id: "soka", name: "草加", revenue: 1_121_477, outsourcingCost: 601_800, costStatus: "provisional" },
    { id: "tokorozawa", name: "所沢", revenue: 52_573, outsourcingCost: 40_000 },
    { id: "tsukuba", name: "つくば", revenue: 0, outsourcingCost: 92_220 },
  ],
  allocations: [
    { store: "八王子", contractor: "青木", amount: 170_200, work: "水洗い" },
    { store: "八王子", contractor: "高橋", amount: 142_000, work: "仕上げ・水洗い配賦" },
    { store: "一宮", contractor: "福田", amount: 614_600, work: "仕上げ・登録" },
    { store: "一宮", contractor: "古賀", amount: 145_800, work: "撮影・交通費" },
    { store: "新狭山", contractor: "LIVE COLOR", amount: 667_000, work: "仕上げ" },
    { store: "新狭山", contractor: "上荒磯", amount: 295_000, work: "リチェック配賦" },
    { store: "大宮", contractor: "上荒磯", amount: 212_500, work: "リチェック配賦" },
    { store: "大宮", contractor: "小山", amount: 66_000, work: "仕上げ（請求書未着）", status: "provisional" },
    { store: "大宮", contractor: "青木", amount: 18_576, work: "水洗い用品等" },
    { store: "大宮", contractor: "高橋", amount: 44_000, work: "店舗業務配賦" },
    { store: "草加", contractor: "石垣", amount: 122_300, work: "撮影・リチェック" },
    { store: "草加", contractor: "小山", amount: 378_000, work: "仕上げ（請求書未着）", status: "provisional" },
    { store: "草加", contractor: "青木", amount: 101_500, work: "水洗い・交通費" },
    { store: "所沢", contractor: "高橋", amount: 40_000, work: "店舗業務配賦" },
    { store: "つくば", contractor: "上荒磯", amount: 87_500, work: "リチェック配賦" },
    { store: "つくば", contractor: "高橋", amount: 4_720, work: "交通費" },
    { store: "共通・未配賦", contractor: "NaS", amount: 293_910, work: "3店舗分・店舗内訳未記載" },
    { store: "共通・未配賦", contractor: "青木", amount: 3_182, work: "通常仕上げ・店舗未記載" },
    { store: "共通・未配賦", contractor: "上荒磯", amount: 20_000, work: "研修・交通費" },
    { store: "共通・未配賦", contractor: "高橋", amount: 79_718, work: "技術手当・研修・工具" },
  ],
  simulation: simulationV1,
  notes: [
    "小山分444,000円は請求書未着のため、共有された単価を税別として見込み計上しています。",
    "共通・未配賦396,810円は会社全体の直接原価に含めていますが、店舗別粗利には未配賦です。",
    "つくばは原価92,220円が発生していますが、8月売上資料では独立した売上を確認できていません。",
  ],
};

export const actualPeriods = [july2026Actual, august2026Actual] as const;

export function summarizeActual(actual: MonthlyActual) {
  const grossProfit = actual.revenue - actual.storeOutsourcingCost;
  const grossMargin = actual.revenue > 0 ? grossProfit / actual.revenue : 0;
  const contributionProfit = grossProfit - actual.equipmentCost;
  const planRevenue = actual.simulation.stores.reduce((sum, store) => sum + store.revenue, 0);
  const planDirectCost = actual.simulation.stores.reduce((sum, store) => sum + store.directCost, 0);
  const planGrossProfit = planRevenue - planDirectCost;
  return {
    grossProfit, grossMargin, contributionProfit, equipmentCost: actual.equipmentCost,
    contributionMargin: actual.revenue > 0 ? contributionProfit / actual.revenue : 0,
    fullCapacityRevenue: actual.utilizationRate ? actual.revenue / actual.utilizationRate : actual.revenue,
    planRevenue, planDirectCost, planGrossProfit,
    revenueAttainment: planRevenue > 0 ? actual.revenue / planRevenue : 0,
    grossProfitAttainment: planGrossProfit > 0 ? grossProfit / planGrossProfit : 0,
    revenueVariance: actual.revenue - planRevenue,
    grossProfitVariance: grossProfit - planGrossProfit,
  };
}

export const july2026Summary = summarizeActual(july2026Actual);
export const august2026Summary = summarizeActual(august2026Actual);
