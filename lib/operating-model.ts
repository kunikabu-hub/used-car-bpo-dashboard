export type StorePhase = "unopened" | "ramp" | "stable";
export type ServiceKey = "finishing" | "wash" | "photo" | "recheck" | "registration";

export type ServiceOperatingAssumption = {
  key: ServiceKey;
  label: string;
  enabled: boolean;
  capacityUnits: number;
  utilization: number;
  capacityRevenue: number;
  capacityVariableCost: number;
  billingUnitPrice?: number;
  outsourcingUnitPrice?: number;
  billingBaseUnits?: number;
  billingBaseAmount?: number;
  billingDecreasePerUnit?: number;
  outsourcingBaseUnits?: number;
  outsourcingBaseAmount?: number;
  outsourcingDecreasePerUnit?: number;
  billingPricingNote?: string;
  outsourcingPricingNote?: string;
};

export type StoreOperatingProfile = {
  storeId: string;
  storeName: string;
  inventoryUnits: number;
  phase: StorePhase;
  fixedCost: number;
  minimumGuarantee: number;
  services: ServiceOperatingAssumption[];
  note: string;
};

const unitPricedService = (
  key: ServiceKey,
  label: string,
  capacityUnits: number,
  actualUnits: number,
  billingUnitPrice: number,
  outsourcingUnitPrice: number,
  enabled = actualUnits > 0,
): ServiceOperatingAssumption => ({
  key,
  label,
  enabled,
  capacityUnits,
  utilization: capacityUnits > 0 ? actualUnits / capacityUnits : 0,
  capacityRevenue: capacityUnits * billingUnitPrice,
  capacityVariableCost: capacityUnits * outsourcingUnitPrice,
  billingUnitPrice,
  outsourcingUnitPrice,
});

const decrementPricedService = (
  key: "photo" | "recheck",
  label: string,
  baseUnits: number,
  actualUnits: number,
  billingBaseAmount: number,
  billingDecreasePerUnit: number,
  outsourcingBaseAmount: number,
  outsourcingDecreasePerUnit: number,
): ServiceOperatingAssumption => ({
  key,
  label,
  enabled: actualUnits > 0,
  capacityUnits: baseUnits,
  utilization: actualUnits / baseUnits,
  capacityRevenue: billingBaseAmount,
  capacityVariableCost: outsourcingBaseAmount,
  billingBaseUnits: baseUnits,
  billingBaseAmount,
  billingDecreasePerUnit,
  outsourcingBaseUnits: baseUnits,
  outsourcingBaseAmount,
  outsourcingDecreasePerUnit,
  billingPricingNote: `${baseUnits}台 ${billingBaseAmount.toLocaleString("ja-JP")}円／減額 ${billingDecreasePerUnit.toLocaleString("ja-JP")}円`,
  outsourcingPricingNote: `${baseUnits}台 ${outsourcingBaseAmount.toLocaleString("ja-JP")}円／減額 ${outsourcingDecreasePerUnit.toLocaleString("ja-JP")}円`,
});

const calibratedService = (
  key: ServiceKey,
  label: string,
  capacityUnits: number,
  actualUnits: number,
  actualRevenue: number,
  actualVariableCost: number,
): ServiceOperatingAssumption => {
  const utilization = capacityUnits > 0 ? actualUnits / capacityUnits : 0;
  return {
    key,
    label,
    enabled: actualUnits > 0,
    capacityUnits,
    utilization,
    capacityRevenue: utilization > 0 ? actualRevenue / utilization : 0,
    capacityVariableCost: utilization > 0 ? actualVariableCost / utilization : 0,
  };
};

export const initialOperatingProfiles: StoreOperatingProfile[] = [
  {
    storeId: "hachioji",
    storeName: "八王子",
    inventoryUnits: 200,
    phase: "stable",
    fixedCost: 0,
    minimumGuarantee: 0,
    services: [
      calibratedService("finishing", "仕上げ", 125.9, 29, 253_000, 146_000),
      calibratedService("wash", "水洗い", 685.5, 683, 341_500, 124_600),
    ],
    note: "仕上げは低稼働、水洗いはほぼ上限。7月実績を初期値に設定。",
  },
  {
    storeId: "soka",
    storeName: "草加",
    inventoryUnits: 250,
    phase: "stable",
    fixedCost: 0,
    minimumGuarantee: 376_400,
    services: [
      unitPricedService("finishing", "仕上げ", 200, 155, 5_600, 4_400),
      calibratedService("wash", "水洗い", 400, 134, 67_000, 95_000),
      unitPricedService("photo", "撮影", 100, 100, 2_000, 1_500),
      unitPricedService("recheck", "リチェック＋登録", 100, 100, 2_500, 2_000),
    ],
    note: "仕上げは7月216台・8月93台の2か月平均を初期値に設定。委託費4,400円／対象台数、最低保証は分離。",
  },
  {
    storeId: "omiya",
    storeName: "大宮",
    inventoryUnits: 150,
    phase: "ramp",
    fixedCost: 294_500,
    minimumGuarantee: 0,
    services: [
      unitPricedService("finishing", "仕上げ", 130, 7, 8_800, 4_950, true),
      calibratedService("wash", "水洗い", 260, 0, 0, 0),
      unitPricedService("photo", "撮影", 130, 0, 2_000, 1_500),
      unitPricedService("recheck", "リチェック＋登録", 100, 68, 2_500, 2_500),
    ],
    note: "仕上げは7月0台・8月14台、リチェック＋登録は7月51台・8月85台の2か月平均を初期値に設定。",
  },
  {
    storeId: "ichinomiya",
    storeName: "一宮",
    inventoryUnits: 300,
    phase: "ramp",
    fixedCost: 96,
    minimumGuarantee: 0,
    services: [
      calibratedService("finishing", "仕上げ", 180, 143, 1_075_000, 811_500),
      calibratedService("wash", "水洗い", 396.3, 277, 138_500, 60_940),
      decrementPricedService("photo", "撮影", 200, 181, 407_000, 1_695, 250_000, 1_250),
      unitPricedService("recheck", "リチェック＋登録", 65, 45, 2_500, 2_000),
    ],
    note: "撮影181台、リチェック＋登録45台を実台数で計算。通常仕上げ8,250円（税込）を基準。",
  },
  {
    storeId: "shinsayama",
    storeName: "新狭山",
    inventoryUnits: 200,
    phase: "ramp",
    fixedCost: 0,
    minimumGuarantee: 0,
    services: [
      unitPricedService("finishing", "仕上げ", 180, 99, 8_800, 5_500),
      unitPricedService("photo", "撮影", 180, 0, 2_000, 1_500),
      unitPricedService("recheck", "リチェック＋登録", 120, 113, 2_500, 2_500),
    ],
    note: "仕上げ委託費は固定費ではなく5,500円／対象台数。リチェック＋登録は7月107台・8月118台の平均を初期値に設定。水洗いなし。",
  },
  {
    storeId: "tsukuba",
    storeName: "つくば",
    inventoryUnits: 150,
    phase: "unopened",
    fixedCost: 0,
    minimumGuarantee: 0,
    services: [
      { key: "finishing", label: "仕上げ", enabled: true, capacityUnits: 150, utilization: 0, capacityRevenue: 1_320_000, capacityVariableCost: 742_500, billingUnitPrice: 8_800, outsourcingUnitPrice: 4_950 },
      { key: "wash", label: "水洗い", enabled: true, capacityUnits: 300, utilization: 0, capacityRevenue: 165_000, capacityVariableCost: 90_000 },
      unitPricedService("photo", "撮影", 150, 0, 2_000, 1_500),
      unitPricedService("recheck", "リチェック＋登録", 70, 0, 2_500, 2_500),
    ],
    note: "開設前。開設月が確定するまで売上・原価とも0円。撮影なし。",
  },
];

export function calculateOperatingForecast(profile: StoreOperatingProfile) {
  if (profile.phase === "unopened") {
    return { revenue: 0, variableCost: 0, directCost: 0, grossProfit: 0, grossMargin: 0 };
  }
  const activeServices = profile.services.filter((service) => service.enabled);
  const revenue = activeServices.reduce(
    (sum, service) => sum + calculateServiceRevenue(service),
    0,
  );
  const variableCost = activeServices.reduce(
    (sum, service) => sum + calculateServiceVariableCost(service),
    0,
  );
  const directCost = profile.fixedCost + Math.max(profile.minimumGuarantee, variableCost);
  const grossProfit = revenue - directCost;
  return {
    revenue,
    variableCost,
    directCost,
    grossProfit,
    grossMargin: revenue > 0 ? grossProfit / revenue : 0,
  };
}

function decrementAmount(units: number, baseUnits: number, baseAmount: number, decreasePerUnit: number) {
  return Math.max(0, baseAmount - Math.max(0, baseUnits - Math.min(units, baseUnits)) * decreasePerUnit);
}

export function calculateServiceRevenue(service: ServiceOperatingAssumption) {
  if (!service.enabled) return 0;
  const units = service.capacityUnits * Math.max(0, service.utilization);
  if (service.billingBaseUnits != null && service.billingBaseAmount != null && service.billingDecreasePerUnit != null) {
    return decrementAmount(units, service.billingBaseUnits, service.billingBaseAmount, service.billingDecreasePerUnit);
  }
  return service.capacityRevenue * Math.max(0, service.utilization);
}

export function calculateServiceVariableCost(service: ServiceOperatingAssumption) {
  if (!service.enabled) return 0;
  const units = service.capacityUnits * Math.max(0, service.utilization);
  if (service.outsourcingBaseUnits != null && service.outsourcingBaseAmount != null && service.outsourcingDecreasePerUnit != null) {
    return decrementAmount(units, service.outsourcingBaseUnits, service.outsourcingBaseAmount, service.outsourcingDecreasePerUnit);
  }
  return service.capacityVariableCost * Math.max(0, service.utilization);
}

export function summarizeOperatingForecast(profiles: StoreOperatingProfile[]) {
  const totals = profiles.reduce((summary, profile) => {
    const result = calculateOperatingForecast(profile);
    summary.revenue += result.revenue;
    summary.directCost += result.directCost;
    summary.grossProfit += result.grossProfit;
    return summary;
  }, { revenue: 0, directCost: 0, grossProfit: 0 });
  return { ...totals, grossMargin: totals.revenue > 0 ? totals.grossProfit / totals.revenue : 0 };
}
