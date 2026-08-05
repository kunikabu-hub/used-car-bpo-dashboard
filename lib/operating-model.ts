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
};

export type StoreOperatingProfile = {
  storeId: string;
  storeName: string;
  phase: StorePhase;
  fixedCost: number;
  minimumGuarantee: number;
  services: ServiceOperatingAssumption[];
  note: string;
};

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
    phase: "stable",
    fixedCost: 0,
    minimumGuarantee: 376_400,
    services: [
      calibratedService("finishing", "仕上げ", 200, 216, 1_208_000, 379_500),
      calibratedService("wash", "水洗い", 400, 134, 67_000, 95_000),
      calibratedService("recheck", "撮影・リチェック", 100, 50, 152_609, 132_400),
    ],
    note: "仕上げは計画超過、水洗いと撮影・リチェックに余力。最低保証を分離。",
  },
  {
    storeId: "omiya",
    storeName: "大宮",
    phase: "ramp",
    fixedCost: 294_500,
    minimumGuarantee: 0,
    services: [
      calibratedService("finishing", "仕上げ", 130, 0, 0, 0),
      calibratedService("wash", "水洗い", 260, 0, 0, 0),
      calibratedService("photo", "撮影", 130, 0, 0, 0),
      calibratedService("recheck", "リチェック", 100, 25.5, 140_317, 0),
    ],
    note: "7月はリチェック中心。担当者確保費を固定費として扱う。",
  },
  {
    storeId: "ichinomiya",
    storeName: "一宮",
    phase: "ramp",
    fixedCost: 96,
    minimumGuarantee: 0,
    services: [
      calibratedService("finishing", "仕上げ", 180, 143, 1_075_000, 811_500),
      calibratedService("wash", "水洗い", 396.3, 277, 138_500, 60_940),
      calibratedService("photo", "撮影", 150, 90.5, 340_712, 0),
      calibratedService("registration", "登録関連", 65, 45, 210_358, 201_500),
    ],
    note: "登録業務を独立。撮影スタッフ費は請求確定時に固定費または最低保証へ追加。",
  },
  {
    storeId: "shinsayama",
    storeName: "新狭山",
    phase: "ramp",
    fixedCost: 593_000,
    minimumGuarantee: 0,
    services: [
      calibratedService("finishing", "仕上げ", 180, 77, 621_000, 0),
      calibratedService("recheck", "リチェック", 100, 53.5, 226_641, 268_000),
    ],
    note: "LIVE COLOR費を固定費、上荒磯リチェックを変動費として分離。水洗いなし。",
  },
  {
    storeId: "tsukuba",
    storeName: "つくば",
    phase: "unopened",
    fixedCost: 0,
    minimumGuarantee: 0,
    services: [
      { key: "finishing", label: "仕上げ", enabled: true, capacityUnits: 150, utilization: 0, capacityRevenue: 1_320_000, capacityVariableCost: 675_000 },
      { key: "wash", label: "水洗い", enabled: true, capacityUnits: 300, utilization: 0, capacityRevenue: 165_000, capacityVariableCost: 90_000 },
      { key: "recheck", label: "リチェック", enabled: true, capacityUnits: 70, utilization: 0, capacityRevenue: 223_541.6666825, capacityVariableCost: 140_000 },
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
    (sum, service) => sum + service.capacityRevenue * Math.max(0, service.utilization),
    0,
  );
  const variableCost = activeServices.reduce(
    (sum, service) => sum + service.capacityVariableCost * Math.max(0, service.utilization),
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
