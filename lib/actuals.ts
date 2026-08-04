export type JulyStoreActual = {
  id: string;
  name: string;
  revenue: number;
  outsourcingCost: number;
  costStatus?: "confirmed" | "unallocated";
};

export type JulyContractorAllocation = {
  store: string;
  contractor: string;
  amount: number;
  work: string;
};

export const july2026Actual = {
  period: "2026年7月",
  utilizationRate: 0.8,
  revenue: 4_910_637,
  storeOutsourcingCost: 3_107_036,
  commonEquipmentCost: 76_000,
  lightingEquipmentCostTaxIncluded: 110_331,
  lightingEquipmentCostTaxExclusive: 100_301,
  stores: [
    { id: "hachioji", name: "八王子", revenue: 594_500, outsourcingCost: 270_600 },
    { id: "soka", name: "草加", revenue: 1_427_609, outsourcingCost: 606_900 },
    { id: "omiya", name: "大宮", revenue: 140_317, outsourcingCost: 294_500 },
    { id: "ichinomiya", name: "一宮", revenue: 1_764_570, outsourcingCost: 1_074_036 },
    { id: "shinsayama", name: "新狭山", revenue: 847_641, outsourcingCost: 861_000 },
    { id: "tokorozawa", name: "所沢", revenue: 136_000, outsourcingCost: 0, costStatus: "unallocated" },
  ] satisfies JulyStoreActual[],
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
  ] satisfies JulyContractorAllocation[],
} as const;

export const july2026Summary = {
  grossProfit: july2026Actual.revenue - july2026Actual.storeOutsourcingCost,
  grossMargin: (july2026Actual.revenue - july2026Actual.storeOutsourcingCost) / july2026Actual.revenue,
  equipmentCost: july2026Actual.commonEquipmentCost + july2026Actual.lightingEquipmentCostTaxExclusive,
  contributionProfit:
    july2026Actual.revenue
    - july2026Actual.storeOutsourcingCost
    - july2026Actual.commonEquipmentCost
    - july2026Actual.lightingEquipmentCostTaxExclusive,
  fullCapacityRevenue: july2026Actual.revenue / july2026Actual.utilizationRate,
} as const;
