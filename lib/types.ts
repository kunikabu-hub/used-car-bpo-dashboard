export type StoreCategory = "actual" | "transition" | "forecast";
export type StarterKitAccountingMethod =
  | "cash"
  | "amortize12"
  | "amortize24"
  | "amortize36";
export type TaxMode = "taxExclusive" | "taxIncluded";
export type DeploymentMode = "simultaneous" | "phased";

export type Store = {
  id: string;
  name: string;
  shortName: string;
  category: StoreCategory;
  managedByNas: boolean;
  displayInventory?: number;
  finishingCount: number;
  simpleFinishingCount?: number;
  normalFinishingCount?: number;
  dirtyFinishingCount?: number;
  washCount: number;
  photoCount: number;
  billPhotoAsFinishingBundle?: boolean;
  photoContractConversionRate?: number;
  photoContractAdjustmentUnitPrice?: number;
  recheckCount: number;
  recheckWorkers: number;
  recheckSlots: number;
  actualMonthlyRevenue?: number;
  actualDirectCost?: number;
  directFinishingCostPerUnit?: number;
  directPhotoConversionRate?: number;
  directPhotoBaseActualUnits?: number;
  directPhotoBaseCompensation?: number;
  directWashCostPerUnit?: number;
  directRecheckCostPerUnit?: number;
  starterKitInstalled: boolean;
  starterKitCost: number;
  openingMonth: string;
  notes: string[];
  opportunities: string[];
};

export type Pricing = {
  client: {
    simpleFinishing: number;
    normalFinishing: number;
    dirtyFinishing: number;
    deliveryFinishing: number;
    normalFinishingWithPhoto: number;
    wash: number;
    recheckBaseMonthlyFee: number;
    recheckBaseUnits: number;
    recheckLowerUnits: number;
    recheckUpperUnits: number;
    recheckAdjustmentUnitPrice: number;
  };
  attaToNas: {
    simpleFinishing: number;
    normalFinishing: number;
    dirtyFinishing: number;
    wash: number;
    photo: number;
    recheck: number;
  };
  nasToWorker: {
    simpleFinishing: number;
    normalFinishing: number;
    dirtyFinishing: number;
    wash: number;
    photo: number;
    recheck: number;
  };
};

export type OperatingCostSettings = {
  attaStarterKitCostPerStore: number;
  nasMonthlySupplyCostPerStore: number;
  starterKitAccountingMethod: StarterKitAccountingMethod;
};

export type SimulationSettings = {
  taxMode: TaxMode;
  taxRate: number;
  recheckConversionRate: number;
  operatingDays: number;
  pricing: Pricing;
  operatingCosts: OperatingCostSettings;
};

export type StoreFinancials = {
  store: Store;
  finishingRevenue: number;
  washRevenue: number;
  recheckRevenue: number;
  photoContractRevenue: number;
  attaRevenue: number;
  attaDirectCost: number;
  directPhotoStaffCost: number;
  attaGrossProfit: number;
  attaGrossMargin: number;
  nasRevenue: number;
  nasStaffCost: number;
  nasGrossProfit: number;
  nasGrossMargin: number;
  nasSupplyCost: number;
  nasContributionProfit: number;
  nasContributionMargin: number;
  revenuePerFinishingUnit: number;
  grossProfitPerFinishingUnit: number;
  annualAttaRevenue: number;
  annualAttaGrossProfit: number;
  annualNasGrossProfit: number;
};

export type ExpansionInputs = {
  storeCount: number;
  finishingCount: number;
  simpleShare: number;
  normalShare: number;
  dirtyShare: number;
  washCount: number;
  photoCount: number;
  recheckCount: number;
  recheckWorkers: number;
  recheckSlots: number;
  managedByNas: boolean;
};

export type MonthlyCashFlow = {
  month: number;
  newStores: number;
  activeStores: number;
  starterKitOutflow: number;
  attaRevenue: number;
  attaGrossProfit: number;
  attaMonthlyCash: number;
  attaCumulativeCash: number;
  nasRevenue: number;
  nasStaffCost: number;
  nasSupplyCost: number;
  nasContributionProfit: number;
  nasCumulativeProfit: number;
};
