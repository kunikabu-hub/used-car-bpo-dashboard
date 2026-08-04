import type {
  DeploymentMode,
  ExpansionInputs,
  MonthlyCashFlow,
  Pricing,
  SimulationSettings,
  Store,
  StoreFinancials,
} from "./types";

const safeDivide = (numerator: number, denominator: number) =>
  denominator === 0 ? 0 : numerator / denominator;

export function calculateRecheckRevenue(
  actualUnits: number,
  slots: number,
  conversionRate: number,
  pricing: Pricing["client"],
  taxMultiplier = 1,
) {
  if (slots <= 0 || actualUnits <= 0) return 0;
  const convertedUnitsPerSlot = (actualUnits * conversionRate) / slots;
  let perSlot = pricing.recheckBaseMonthlyFee;
  if (convertedUnitsPerSlot < pricing.recheckLowerUnits) {
    perSlot -=
      (pricing.recheckLowerUnits - convertedUnitsPerSlot) *
      pricing.recheckAdjustmentUnitPrice;
  } else if (convertedUnitsPerSlot > pricing.recheckUpperUnits) {
    perSlot +=
      (convertedUnitsPerSlot - pricing.recheckUpperUnits) *
      pricing.recheckAdjustmentUnitPrice;
  }
  return Math.max(0, perSlot * slots * taxMultiplier);
}

function mixCounts(store: Store) {
  const simple = store.simpleFinishingCount ?? 0;
  const dirty = store.dirtyFinishingCount ?? 0;
  const normal = store.normalFinishingCount ?? Math.max(0, store.finishingCount - simple - dirty);
  return { simple, normal, dirty };
}

export function calculateAttaRevenue(store: Store, settings: SimulationSettings) {
  if (store.actualMonthlyRevenue != null) return store.actualMonthlyRevenue;
  const { simple, normal, dirty } = mixCounts(store);
  const photoBundledNormal = store.billPhotoAsFinishingBundle === false ? 0 : Math.min(normal, store.photoCount);
  const normalWithoutPhoto = Math.max(0, normal - photoBundledNormal);
  const finishingRevenue =
    simple * settings.pricing.client.simpleFinishing +
    normalWithoutPhoto * settings.pricing.client.normalFinishing +
    photoBundledNormal * settings.pricing.client.normalFinishingWithPhoto +
    dirty * settings.pricing.client.dirtyFinishing;
  const washRevenue = store.washCount * settings.pricing.client.wash;
  const taxMultiplier = settings.taxMode === "taxIncluded" ? 1 + settings.taxRate : 1;
  const recheckRevenue = calculateRecheckRevenue(
    store.recheckCount,
    store.recheckSlots,
    settings.recheckConversionRate,
    settings.pricing.client,
    taxMultiplier,
  );
  const photoContractRevenue = calculatePhotoContractRevenue(store, settings);
  return finishingRevenue + washRevenue + recheckRevenue + photoContractRevenue;
}

export function calculatePhotoContractRevenue(store: Store, settings: SimulationSettings) {
  if (!store.photoContractConversionRate || store.photoCount <= 0) return 0;
  return calculateRecheckRevenue(
    store.photoCount,
    1,
    store.photoContractConversionRate,
    {
      ...settings.pricing.client,
      recheckAdjustmentUnitPrice:
        store.photoContractAdjustmentUnitPrice ?? settings.pricing.client.recheckAdjustmentUnitPrice,
    },
    settings.taxMode === "taxIncluded" ? 1 + settings.taxRate : 1,
  );
}

export function calculateNasRevenue(store: Store, pricing: Pricing) {
  if (!store.managedByNas) return 0;
  const { simple, normal, dirty } = mixCounts(store);
  return (
    simple * pricing.attaToNas.simpleFinishing +
    normal * pricing.attaToNas.normalFinishing +
    dirty * pricing.attaToNas.dirtyFinishing +
    store.washCount * pricing.attaToNas.wash +
    store.photoCount * pricing.attaToNas.photo +
    store.recheckCount * pricing.attaToNas.recheck
  );
}

export function calculateManagementPartnerPayment(store: Store, pricing: Pricing) {
  const { simple, normal, dirty } = mixCounts(store);
  const finishingUnitPrice = store.directFinishingCostPerUnit;
  return (
    simple * (finishingUnitPrice ?? pricing.attaToNas.simpleFinishing) +
    normal * (finishingUnitPrice ?? pricing.attaToNas.normalFinishing) +
    dirty * (finishingUnitPrice ?? pricing.attaToNas.dirtyFinishing) +
    store.washCount * (store.directWashCostPerUnit ?? pricing.attaToNas.wash) +
    store.photoCount * pricing.attaToNas.photo +
    store.recheckCount * (store.directRecheckCostPerUnit ?? pricing.attaToNas.recheck)
  );
}

export function calculateAttaDirectCost(store: Store, pricing: Pricing) {
  if (store.actualDirectCost != null) return store.actualDirectCost;
  if (store.managementPartner !== "atta") return calculateManagementPartnerPayment(store, pricing);
  const { simple, normal, dirty } = mixCounts(store);
  const finishingCost =
    simple * (store.directFinishingCostPerUnit ?? pricing.attaToNas.simpleFinishing) +
    normal * (store.directFinishingCostPerUnit ?? pricing.attaToNas.normalFinishing) +
    dirty * (store.directFinishingCostPerUnit ?? pricing.attaToNas.dirtyFinishing);
  const photoStaffCost = calculateDirectPhotoStaffCost(store);
  return (
    finishingCost +
    photoStaffCost +
    store.washCount * (store.directWashCostPerUnit ?? pricing.attaToNas.wash) +
    store.recheckCount * (store.directRecheckCostPerUnit ?? pricing.attaToNas.recheck)
  );
}

export function calculateDirectPhotoStaffCost(store: Store) {
  if (
    store.managedByNas ||
    !store.directPhotoConversionRate ||
    !store.directPhotoBaseActualUnits ||
    !store.directPhotoBaseCompensation
  ) return 0;
  const convertedUnits = store.photoCount * store.directPhotoConversionRate;
  const baseConvertedUnits = store.directPhotoBaseActualUnits * store.directPhotoConversionRate;
  return convertedUnits * (store.directPhotoBaseCompensation / baseConvertedUnits);
}

export function calculateAttaGrossProfit(store: Store, settings: SimulationSettings) {
  return calculateAttaRevenue(store, settings) - calculateAttaDirectCost(store, settings.pricing);
}

export function calculateNasStaffCost(store: Store, pricing: Pricing) {
  if (!store.managedByNas) return 0;
  const { simple, normal, dirty } = mixCounts(store);
  return (
    simple * pricing.nasToWorker.simpleFinishing +
    normal * pricing.nasToWorker.normalFinishing +
    dirty * pricing.nasToWorker.dirtyFinishing +
    store.washCount * pricing.nasToWorker.wash +
    store.photoCount * pricing.nasToWorker.photo +
    store.recheckCount * pricing.nasToWorker.recheck
  );
}

export function calculateNasGrossProfit(store: Store, pricing: Pricing) {
  return calculateNasRevenue(store, pricing) - calculateNasStaffCost(store, pricing);
}

export function calculateStoreSimulation(store: Store, settings: SimulationSettings): StoreFinancials {
  const { simple, normal, dirty } = mixCounts(store);
  const photoBundledNormal = store.billPhotoAsFinishingBundle === false ? 0 : Math.min(normal, store.photoCount);
  const finishingRevenue = store.actualMonthlyRevenue != null
    ? 0
    : simple * settings.pricing.client.simpleFinishing +
      (normal - photoBundledNormal) * settings.pricing.client.normalFinishing +
      photoBundledNormal * settings.pricing.client.normalFinishingWithPhoto +
      dirty * settings.pricing.client.dirtyFinishing;
  const washRevenue = store.actualMonthlyRevenue != null ? 0 : store.washCount * settings.pricing.client.wash;
  const taxMultiplier = settings.taxMode === "taxIncluded" ? 1 + settings.taxRate : 1;
  const recheckRevenue = store.actualMonthlyRevenue != null ? 0 : calculateRecheckRevenue(
    store.recheckCount,
    store.recheckSlots,
    settings.recheckConversionRate,
    settings.pricing.client,
    taxMultiplier,
  );
  const photoContractRevenue = store.actualMonthlyRevenue != null ? 0 : calculatePhotoContractRevenue(store, settings);
  const attaRevenue = calculateAttaRevenue(store, settings);
  const attaDirectCost = calculateAttaDirectCost(store, settings.pricing);
  const directPhotoStaffCost = calculateDirectPhotoStaffCost(store);
  const attaGrossProfit = attaRevenue - attaDirectCost;
  const nasRevenue = calculateNasRevenue(store, settings.pricing);
  const nasStaffCost = calculateNasStaffCost(store, settings.pricing);
  const nasGrossProfit = nasRevenue - nasStaffCost;
  const nasSupplyCost = store.managedByNas ? settings.operatingCosts.nasMonthlySupplyCostPerStore : 0;
  const nasContributionProfit = nasGrossProfit - nasSupplyCost;
  return {
    store,
    finishingRevenue,
    washRevenue,
    recheckRevenue,
    photoContractRevenue,
    attaRevenue,
    attaDirectCost,
    directPhotoStaffCost,
    attaGrossProfit,
    attaGrossMargin: safeDivide(attaGrossProfit, attaRevenue),
    nasRevenue,
    nasStaffCost,
    nasGrossProfit,
    nasGrossMargin: safeDivide(nasGrossProfit, nasRevenue),
    nasSupplyCost,
    nasContributionProfit,
    nasContributionMargin: safeDivide(nasContributionProfit, nasRevenue),
    revenuePerFinishingUnit: safeDivide(attaRevenue, store.finishingCount),
    grossProfitPerFinishingUnit: safeDivide(attaGrossProfit, store.finishingCount),
    annualAttaRevenue: attaRevenue * 12,
    annualAttaGrossProfit: attaGrossProfit * 12,
    annualNasGrossProfit: nasGrossProfit * 12,
  };
}

export function expansionStore(inputs: ExpansionInputs): Store {
  const shareTotal = inputs.simpleShare + inputs.normalShare + inputs.dirtyShare || 1;
  return {
    id: "expansion-store",
    name: "追加150台店舗",
    shortName: "追加店",
    category: "forecast",
    managedByNas: inputs.managedByNas,
    managementPartner: inputs.managedByNas ? "nas" : "atta",
    finishingCount: inputs.finishingCount,
    simpleFinishingCount: inputs.finishingCount * (inputs.simpleShare / shareTotal),
    normalFinishingCount: inputs.finishingCount * (inputs.normalShare / shareTotal),
    dirtyFinishingCount: inputs.finishingCount * (inputs.dirtyShare / shareTotal),
    washCount: inputs.washCount,
    photoCount: inputs.photoCount,
    recheckCount: inputs.recheckCount,
    recheckWorkers: inputs.recheckWorkers,
    recheckSlots: inputs.recheckSlots,
    starterKitInstalled: false,
    starterKitCost: 0,
    openingMonth: "シミュレーション1か月目",
    notes: ["平均150台規模の追加店舗"],
    opportunities: [],
  };
}

export function calculateRequiredWorkers(inputs: ExpansionInputs) {
  const finishingWorkers = Math.max(1, Math.ceil(inputs.finishingCount / 150));
  const recheckWorkers = Math.max(inputs.recheckWorkers, Math.ceil(inputs.recheckCount / 100));
  const washWorkers = Math.max(1, Math.ceil(inputs.washCount / 400));
  const managers = Math.max(1, Math.ceil(inputs.storeCount / 5));
  return {
    finishingWorkers: finishingWorkers * inputs.storeCount,
    recheckWorkers: recheckWorkers * inputs.storeCount,
    washWorkers: washWorkers * inputs.storeCount,
    managers,
    total: (finishingWorkers + recheckWorkers + washWorkers) * inputs.storeCount + managers,
  };
}

export function calculateExpansionSimulation(inputs: ExpansionInputs, settings: SimulationSettings) {
  const perStore = calculateStoreSimulation(expansionStore(inputs), settings);
  const count = inputs.storeCount;
  const starterKitInvestment = count * settings.operatingCosts.attaStarterKitCostPerStore;
  const monthlyAttaGrossProfit = perStore.attaGrossProfit * count;
  const monthlyNasSupplyCost = inputs.managedByNas
    ? count * settings.operatingCosts.nasMonthlySupplyCostPerStore
    : 0;
  return {
    perStore,
    storeCount: count,
    starterKitInvestment,
    monthlyAttaRevenue: perStore.attaRevenue * count,
    monthlyAttaGrossProfit,
    annualAttaRevenue: perStore.attaRevenue * count * 12,
    annualAttaGrossProfit: monthlyAttaGrossProfit * 12,
    firstYearCashProfit: monthlyAttaGrossProfit * 12 - starterKitInvestment,
    paybackMonths: safeDivide(settings.operatingCosts.attaStarterKitCostPerStore, perStore.attaGrossProfit),
    monthlyNasRevenue: perStore.nasRevenue * count,
    monthlyNasGrossProfit: perStore.nasGrossProfit * count,
    monthlyNasSupplyCost,
    annualNasSupplyCost: monthlyNasSupplyCost * 12,
    monthlyNasContributionProfit: perStore.nasContributionProfit * count,
    annualNasContributionProfit: perStore.nasContributionProfit * count * 12,
    nasContributionMargin: safeDivide(perStore.nasContributionProfit, perStore.nasRevenue),
    workers: calculateRequiredWorkers(inputs),
  };
}

function openingsForMonth(storeCount: number, month: number, mode: DeploymentMode) {
  if (mode === "simultaneous") return month === 1 ? storeCount : 0;
  return month >= 1 && (month - 1) % 3 === 0 && Math.floor((month - 1) / 3) < storeCount ? 1 : 0;
}

export function calculateCashFlow(
  inputs: ExpansionInputs,
  settings: SimulationSettings,
  months: number,
  deploymentMode: DeploymentMode,
): MonthlyCashFlow[] {
  const perStore = calculateStoreSimulation(expansionStore(inputs), settings);
  let activeStores = 0;
  let attaCumulativeCash = 0;
  let nasCumulativeProfit = 0;
  const flows: MonthlyCashFlow[] = [];
  for (let month = 1; month <= months; month += 1) {
    const newStores = openingsForMonth(inputs.storeCount, month, deploymentMode);
    activeStores += newStores;
    const starterKitOutflow = newStores * settings.operatingCosts.attaStarterKitCostPerStore;
    const attaRevenue = activeStores * perStore.attaRevenue;
    const attaGrossProfit = activeStores * perStore.attaGrossProfit;
    const attaMonthlyCash = attaGrossProfit - starterKitOutflow;
    attaCumulativeCash += attaMonthlyCash;
    const nasRevenue = activeStores * perStore.nasRevenue;
    const nasStaffCost = activeStores * perStore.nasStaffCost;
    const nasSupplyCost = activeStores * perStore.nasSupplyCost;
    const nasContributionProfit = activeStores * perStore.nasContributionProfit;
    nasCumulativeProfit += nasContributionProfit;
    flows.push({
      month,
      newStores,
      activeStores,
      starterKitOutflow,
      attaRevenue,
      attaGrossProfit,
      attaMonthlyCash,
      attaCumulativeCash,
      nasRevenue,
      nasStaffCost,
      nasSupplyCost,
      nasContributionProfit,
      nasCumulativeProfit,
    });
  }
  return flows;
}

export function summarizeCashFlow(flows: MonthlyCashFlow[]) {
  let priorEndingCash = 0;
  let minimumPreRevenueCash = 0;
  for (const flow of flows) {
    minimumPreRevenueCash = Math.min(minimumPreRevenueCash, priorEndingCash - flow.starterKitOutflow);
    priorEndingCash = flow.attaCumulativeCash;
  }
  const recovery = flows.find((flow, index) =>
    flow.attaCumulativeCash >= 0 && flows.slice(0, index + 1).some((item) => item.starterKitOutflow > 0),
  );
  return {
    maximumCashOutflow: Math.abs(minimumPreRevenueCash),
    recoveryMonth: recovery?.month ?? null,
    endingAttaCash: flows.at(-1)?.attaCumulativeCash ?? 0,
    endingNasProfit: flows.at(-1)?.nasCumulativeProfit ?? 0,
  };
}

export function starterKitMonthlyExpense(cost: number, method: SimulationSettings["operatingCosts"]["starterKitAccountingMethod"]) {
  const months = method === "cash" ? 1 : Number(method.replace("amortize", ""));
  return cost / months;
}
