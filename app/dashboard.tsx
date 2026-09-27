"use client";

import { useMemo, useState } from "react";
import {
  calculateCashFlow,
  calculateExpansionSimulation,
  calculateRequiredWorkers,
  calculateStoreSimulation,
  starterKitMonthlyExpense,
  summarizeCashFlow,
} from "../lib/calculations";
import { defaultExpansionInputs, operatingCostSettings, pricing, stores } from "../lib/data";
import {
  actualPeriods,
  august2026Actual,
  august2026Summary,
  july2026Actual,
  july2026Summary,
  summarizeActual,
} from "../lib/actuals";
import {
  calculateOperatingForecast,
  initialOperatingProfiles,
  summarizeOperatingForecast,
} from "../lib/operating-model";
import type { ServiceOperatingAssumption, StoreOperatingProfile, StorePhase } from "../lib/operating-model";
import type {
  DeploymentMode,
  ExpansionInputs,
  Pricing,
  SimulationSettings,
  StarterKitAccountingMethod,
  Store,
  StoreFinancials,
  TaxMode,
} from "../lib/types";

type Tab = "summary" | "actuals" | "stores" | "cashflow" | "simulator" | "settings";

const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("ja-JP", { style: "percent", maximumFractionDigits: 1 });
const compactYen = (value: number) => `${number.format(value / 10_000)}万円`;
const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");
const managementLabel = (store: Store) => store.managementPartner === "nas" ? "NaS管理" : store.managementPartner === "liveColor" ? "LIVE COLOR管理" : "直接運営";
const managementDescription = (store: Store) => store.managementPartner === "nas" ? "NaS管理対象店舗" : store.managementPartner === "liveColor" ? "LIVE COLOR管理対象店舗" : "アッタデザイン直接運営";

const navItems: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "summary", label: "サマリー", icon: "◫" },
  { id: "actuals", label: "実績・再予測", icon: "●" },
  { id: "stores", label: "店舗別比較", icon: "▦" },
  { id: "cashflow", label: "キャッシュフロー", icon: "↗" },
  { id: "simulator", label: "店舗追加", icon: "＋" },
  { id: "settings", label: "設定", icon: "⚙" },
];

function MetricCard({
  label,
  value,
  helper,
  tone = "navy",
  formula,
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "navy" | "blue" | "cyan" | "amber" | "green" | "violet";
  formula?: string;
}) {
  return (
    <article className={cx("metric-card", `tone-${tone}`)}>
      <div className="metric-topline">
        <span>{label}</span>
        {formula ? <span className="info-dot" title={formula}>i</span> : null}
      </div>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </article>
  );
}

function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="section-title">
      <div>
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function BarComparison({
  rows,
  valueLabel,
}: {
  rows: Array<{ label: string; primary: number; secondary?: number; accent?: "blue" | "green" | "amber"; secondaryAccent?: "green" | "amber" }>;
  valueLabel?: (value: number) => string;
}) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.primary, row.secondary ?? 0]));
  return (
    <div className="bar-comparison">
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <span className="bar-label">{row.label}</span>
          <div className="bar-track">
            <i className={cx("bar-fill", row.accent && `bar-${row.accent}`)} style={{ width: `${Math.max(2, row.primary / max * 100)}%` }} />
            {row.secondary != null ? <i className={cx("bar-fill secondary", row.secondaryAccent === "green" && "secondary-green")} style={{ width: `${Math.max(2, row.secondary / max * 100)}%` }} /> : null}
          </div>
          <strong>{valueLabel ? valueLabel(row.primary) : compactYen(row.primary)}</strong>
        </div>
      ))}
    </div>
  );
}

function TrendBars({
  first,
  second,
  firstLabel,
  secondLabel,
}: {
  first: number[];
  second?: number[];
  firstLabel: string;
  secondLabel?: string;
}) {
  const all = [...first, ...(second ?? [])];
  const max = Math.max(1, ...all.map((value) => Math.abs(value)));
  const sampleStep = first.length > 24 ? 3 : first.length > 12 ? 2 : 1;
  return (
    <div>
      <div className="legend"><span><i className="legend-blue" />{firstLabel}</span>{secondLabel ? <span><i className="legend-green" />{secondLabel}</span> : null}</div>
      <div className="trend-bars" aria-label={`${firstLabel}${secondLabel ? `と${secondLabel}` : ""}の推移`}>
        {first.map((value, index) => (
          <div className="trend-column" key={index}>
            <div className="trend-pair">
              <i className={cx("trend-bar", value < 0 && "negative")} style={{ height: `${Math.max(3, Math.abs(value) / max * 100)}%` }} title={`${index + 1}か月目 ${yen.format(value)}`} />
              {second ? <i className={cx("trend-bar second", second[index] < 0 && "negative")} style={{ height: `${Math.max(3, Math.abs(second[index]) / max * 100)}%` }} title={`${index + 1}か月目 ${yen.format(second[index])}`} /> : null}
            </div>
            {(index + 1) % sampleStep === 0 ? <small>{index + 1}</small> : <small />}
          </div>
        ))}
      </div>
      <p className="axis-note">横軸：月　縦軸：金額（各棒にカーソルで詳細）</p>
    </div>
  );
}

function NumberInput({ label, value, onChange, suffix, min = 0, step = 1 }: { label: string; value: number; onChange: (value: number) => void; suffix?: string; min?: number; step?: number }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field-input"><input type="number" min={min} step={step} value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} />{suffix ? <em>{suffix}</em> : null}</div>
    </label>
  );
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></label>;
}

function FormulaDetails() {
  return (
    <details className="formula-details">
      <summary>計算根拠を表示</summary>
      <div className="formula-grid">
        <div><strong>アッタ直接粗利</strong><code>ガリバー売上 − 管理パートナーまたは直接スタッフ支払</code></div>
        <div><strong>初年度キャッシュ利益</strong><code>年間直接粗利 − 新規店舗数 × 600,000円</code></div>
        <div><strong>投資回収月数</strong><code>600,000円 ÷ 1店舗当たり月間直接粗利</code></div>
        <div><strong>NaS用具費控除後利益</strong><code>NaS直接粗利 − 管理店舗数 × 30,000円</code></div>
        <div><strong>リチェック＋登録</strong><code>実台数 × ガリバー請求2,500円</code></div>
        <div><strong>撮影</strong><code>実台数 × 請求2,000円 − 委託費1,500円</code></div>
      </div>
    </details>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("summary");
  const [selectedStore, setSelectedStore] = useState(stores[0].id);
  const [cashMonths, setCashMonths] = useState(24);
  const [deploymentMode, setDeploymentMode] = useState<DeploymentMode>("simultaneous");
  const [mobileNav, setMobileNav] = useState(false);
  const [inputs, setInputs] = useState<ExpansionInputs>({ ...defaultExpansionInputs });
  const [settings, setSettings] = useState<SimulationSettings>({
    taxMode: "taxExclusive",
    taxRate: 0.1,
    operatingDays: 22,
    pricing: structuredClone(pricing),
    operatingCosts: { ...operatingCostSettings },
  });

  const financials = useMemo(() => stores.map((store) => calculateStoreSimulation(store, settings)), [settings]);
  const expansion = useMemo(() => calculateExpansionSimulation(inputs, settings), [inputs, settings]);
  const simultaneous = useMemo(() => calculateCashFlow(inputs, settings, cashMonths, "simultaneous"), [inputs, settings, cashMonths]);
  const phased = useMemo(() => calculateCashFlow(inputs, settings, cashMonths, "phased"), [inputs, settings, cashMonths]);
  const cashFlow = deploymentMode === "simultaneous" ? simultaneous : phased;
  const simSummary = summarizeCashFlow(simultaneous);
  const phasedSummary = summarizeCashFlow(phased);
  const totals = useMemo(() => financials.reduce((acc, item) => ({
    attaRevenue: acc.attaRevenue + item.attaRevenue,
    attaCost: acc.attaCost + item.attaDirectCost,
    attaGross: acc.attaGross + item.attaGrossProfit,
    nasRevenue: acc.nasRevenue + item.nasRevenue,
    nasGross: acc.nasGross + item.nasGrossProfit,
    nasSupply: acc.nasSupply + item.nasSupplyCost,
    nasContribution: acc.nasContribution + item.nasContributionProfit,
    finishing: acc.finishing + item.store.finishingCount,
    photo: acc.photo + item.store.photoCount,
    recheck: acc.recheck + item.store.recheckCount,
  }), { attaRevenue: 0, attaCost: 0, attaGross: 0, nasRevenue: 0, nasGross: 0, nasSupply: 0, nasContribution: 0, finishing: 0, photo: 0, recheck: 0 }), [financials]);

  const updateInputs = <K extends keyof ExpansionInputs>(key: K, value: ExpansionInputs[K]) => setInputs((current) => ({ ...current, [key]: value }));
  const updateOperating = <K extends keyof SimulationSettings["operatingCosts"]>(key: K, value: SimulationSettings["operatingCosts"][K]) => setSettings((current) => ({ ...current, operatingCosts: { ...current.operatingCosts, [key]: value } }));
  const updatePrice = (group: keyof Pricing, key: string, value: number) => setSettings((current) => ({
    ...current,
    pricing: {
      ...current.pricing,
      [group]: { ...current.pricing[group], [key]: value },
    },
  }));

  const selectedFinancial = financials.find((item) => item.store.id === selectedStore) ?? financials[0];
  const currentNasStores = stores.filter((store) => store.managedByNas).length;
  const totalNasStores = currentNasStores + (inputs.managedByNas ? inputs.storeCount : 0);

  return (
    <div className="app-shell">
      <aside className={cx("sidebar", mobileNav && "open")}>
        <div className="brand"><div className="brand-mark">A</div><div><strong>ATTA DESIGN</strong><span>BPO Management</span></div></div>
        <nav>
          {navItems.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => { setTab(item.id); setMobileNav(false); }}><span>{item.icon}</span>{item.label}</button>)}
        </nav>
        <div className="side-note"><span>MODEL STATUS</span><strong><i /> 正常</strong><small>初期投資・用具費を反映済み</small></div>
        <div className="sidebar-footer"><span>基準日</span><strong>2026年8月</strong></div>
      </aside>

      <main>
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav((value) => !value)} aria-label="メニューを開く">☰</button>
          <div><span>中古車商品化BPO</span><strong>{navItems.find((item) => item.id === tab)?.label}</strong></div>
          <div className="top-actions"><span className="actual-chip">● 実績</span><span className="forecast-chip">● シミュレーション</span><button onClick={() => setTab("settings")}>設定を開く</button></div>
        </header>

        <div className="page-content">
          {tab === "summary" ? (
            <>
              <section className="hero-row">
                <div><span className="eyebrow">EXECUTIVE SUMMARY</span><h1>収益と投資を、同じ画面で判断する。</h1><p>対象{stores.length}店舗の直接粗利に、新規出店のスターターキット投資とNaSの継続用具費を重ねて確認できます。</p></div>
                <div className="hero-badge"><span>現在</span><strong>{stores.length}</strong><small>対象店舗</small><i>うちNaS管理 {currentNasStores}店舗</i></div>
              </section>

              <section className="metric-grid primary-metrics">
                <MetricCard label="アッタ月間売上" value={yen.format(totals.attaRevenue)} helper={`年間 ${compactYen(totals.attaRevenue * 12)}`} formula={`${stores.length}店舗のガリバー売上合計`} />
                <MetricCard label="アッタ月間直接粗利" value={yen.format(totals.attaGross)} helper={`直接粗利率 ${percent.format(totals.attaGross / totals.attaRevenue)}`} tone="blue" formula="売上 − 管理パートナーまたは直接スタッフ支払" />
                <MetricCard label="NaS月間受取" value={yen.format(totals.nasRevenue)} helper={`NaS管理${currentNasStores}店舗のみ`} tone="cyan" />
                <MetricCard label="NaS用具費控除後利益" value={yen.format(totals.nasContribution)} helper={`利益率 ${percent.format(totals.nasContribution / totals.nasRevenue)}`} tone="green" formula={`NaS直接粗利 − ${currentNasStores}店舗 × 月間用具費`} />
              </section>
              <section className="operations-strip">
                <div><span>月間仕上げ</span><strong>{number.format(totals.finishing)}台</strong></div>
                <div><span>月間撮影</span><strong>{number.format(totals.photo)}台</strong></div>
                <div><span>月間リチェック</span><strong>{number.format(totals.recheck)}台</strong></div>
                <div><span>NaS月間用具費（既存）</span><strong>{yen.format(totals.nasSupply)}</strong></div>
                <div><span>NaS年間用具費（既存）</span><strong>{yen.format(totals.nasSupply * 12)}</strong></div>
              </section>

              <section className="actual-summary-banner">
                <div className="actual-summary-heading"><span>2026年8月 暫定実績</span><strong>シミュレーション比と前月差を確認</strong><button onClick={() => setTab("actuals")}>実績詳細を見る →</button></div>
                <div><span>税抜売上</span><strong>{yen.format(august2026Actual.revenue)}</strong></div>
                <div><span>売上達成率</span><strong>{percent.format(august2026Summary.revenueAttainment)}</strong></div>
                <div><span>直接粗利</span><strong>{yen.format(august2026Summary.grossProfit)}</strong></div>
                <div><span>粗利達成率</span><strong>{percent.format(august2026Summary.grossProfitAttainment)}</strong></div>
              </section>

              <SectionTitle eyebrow="NEW STORE ECONOMICS" title={`追加${inputs.storeCount}店舗の投資・回収見通し`} action={<button className="text-button" onClick={() => setTab("simulator")}>条件を変更 →</button>} />
              <section className="metric-grid secondary-metrics">
                <MetricCard label="スターターキット投資額" value={yen.format(expansion.starterKitInvestment)} helper={`1店舗 ${yen.format(settings.operatingCosts.attaStarterKitCostPerStore)}`} tone="amber" />
                <MetricCard label="投資回収月数" value={`${number.format(expansion.paybackMonths)}か月`} helper="1店舗当たり月間直接粗利で回収" tone="violet" />
                <MetricCard label="初年度キャッシュ利益" value={yen.format(expansion.firstYearCashProfit)} helper="年間直接粗利 − 初期投資" tone="blue" />
                <MetricCard label="NaS月間用具費（総額）" value={yen.format(totalNasStores * settings.operatingCosts.nasMonthlySupplyCostPerStore)} helper={`既存${currentNasStores}＋新規${inputs.storeCount}店舗／年 ${compactYen(totalNasStores * settings.operatingCosts.nasMonthlySupplyCostPerStore * 12)}`} tone="cyan" />
              </section>

              <div className="two-column">
                <section className="panel">
                  <SectionTitle eyebrow="STORE PERFORMANCE" title="店舗別 アッタ売上・直接粗利" />
                  <div className="legend"><span><i className="legend-blue" />売上</span><span><i className="legend-amber" />直接粗利</span></div>
                  <BarComparison rows={financials.map((item) => ({ label: item.store.shortName, primary: item.attaRevenue, secondary: item.attaGrossProfit }))} />
                </section>
                <section className="panel">
                  <SectionTitle eyebrow="PROFIT WATERFALL" title="三者間の金額の流れ" />
                  <div className="money-flow">
                    <div><span>ガリバー支払</span><strong>{compactYen(totals.attaRevenue)}</strong></div><b>→</b>
                    <div className="flow-atta"><span>アッタ直接粗利</span><strong>{compactYen(totals.attaGross)}</strong></div><b>＋</b>
                    <div><span>NaS受取</span><strong>{compactYen(totals.nasRevenue)}</strong></div><b>→</b>
                    <div className="flow-nas"><span>NaS用具費後</span><strong>{compactYen(totals.nasContribution)}</strong></div>
                  </div>
                  <p className="panel-note">八王子・一宮は直接スタッフ支払、新狭山はLIVE COLORへの管理委託費としてアッタ原価に計上しています。</p>
                </section>
              </div>

              <div className="two-column">
                <section className="panel">
                  <SectionTitle eyebrow="INVESTMENT CURVE" title="新規店舗数と初期投資額" />
                  <BarComparison rows={[1, 3, 5, 7, 10].map((count) => ({ label: `${count}店舗`, primary: count * settings.operatingCosts.attaStarterKitCostPerStore, accent: "amber" }))} />
                </section>
                <section className="panel">
                  <SectionTitle eyebrow="SUPPLY COST CURVE" title="NaS管理店舗数と月間用具費" />
                  <BarComparison rows={[3, 4, 6, 8, 10, 13].map((count) => ({ label: `${count}店舗`, primary: count * settings.operatingCosts.nasMonthlySupplyCostPerStore, accent: "green" }))} />
                </section>
              </div>

              <section className="explanation">
                <div><span>このシミュレーションの考え方</span><h2>実績・移行・将来想定を分けて、直接粗利から資金負担まで追います。</h2></div>
                <ul>
                  <li>八王子は月平均実績売上・実績原価を優先</li><li>一宮は既存実績を基に新運用へ移行</li><li>NaSは草加・大宮・つくばの3店舗を管理</li><li>新狭山はLIVE COLOR管理</li><li>リチェック＋登録は実台数×2,500円で請求</li><li>撮影は実台数×2,000円、委託費1,500円</li><li>本部人件費・交通費・保険・採用費などは未控除</li>
                </ul>
              </section>
              <FormulaDetails />
            </>
          ) : null}

          {tab === "actuals" ? <ActualsView financials={financials} /> : null}
          {tab === "stores" ? <StoresView financials={financials} selected={selectedFinancial} setSelected={setSelectedStore} settings={settings} /> : null}
          {tab === "cashflow" ? <CashFlowView months={cashMonths} setMonths={setCashMonths} mode={deploymentMode} setMode={setDeploymentMode} flow={cashFlow} simultaneous={simultaneous} phased={phased} simSummary={simSummary} phasedSummary={phasedSummary} investment={expansion.starterKitInvestment} /> : null}
          {tab === "simulator" ? <SimulatorView inputs={inputs} updateInputs={updateInputs} expansion={expansion} settings={settings} setSettings={setSettings} /> : null}
          {tab === "settings" ? <SettingsView settings={settings} setSettings={setSettings} updateOperating={updateOperating} updatePrice={updatePrice} /> : null}
        </div>
      </main>
    </div>
  );
}

function ActualHistoryView() {
  const [selectedPeriodId, setSelectedPeriodId] = useState(august2026Actual.id);
  const selectedIndex = actualPeriods.findIndex((period) => period.id === selectedPeriodId);
  const actual = actualPeriods[selectedIndex] ?? august2026Actual;
  const previous = selectedIndex > 0 ? actualPeriods[selectedIndex - 1] : null;
  const summary = summarizeActual(actual);
  const previousSummary = previous ? summarizeActual(previous) : null;
  const actualByStore = new Map(actual.stores.map((store) => [store.id, store]));
  const planByStore = new Map(actual.simulation.stores.map((store) => [store.id, store]));
  const storeIds = Array.from(new Set([...actual.simulation.stores.map((store) => store.id), ...actual.stores.map((store) => store.id)]));
  const signedYen = (value: number) => `${value >= 0 ? "+" : "−"}${yen.format(Math.abs(value))}`;
  const statusLabel = (status?: "confirmed" | "provisional" | "unallocated") =>
    status === "unallocated" ? "原価未配賦" : status === "provisional" ? "見込み含む" : "配賦済み";

  return <>
    <section className="actual-history-header">
      <div>
        <span className="eyebrow">MONTHLY ACTUALS</span>
        <h1>月次実績とシミュレーション比較</h1>
        <p>実績は月ごとに追加し、当時のシミュレーションを固定保存して達成率を比較します。</p>
      </div>
      <div className="period-switcher" aria-label="実績月を選択">
        {actualPeriods.map((period) => <button key={period.id} className={actual.id === period.id ? "active" : ""} onClick={() => setSelectedPeriodId(period.id)}><strong>{period.shortPeriod}</strong><small>{period.status === "confirmed" ? "確定" : "暫定"}</small></button>)}
      </div>
    </section>

    <section className="actual-context-bar">
      <div><span>表示中</span><strong>{actual.period}</strong><i className={actual.status === "confirmed" ? "status-confirmed" : "status-provisional"}>{actual.status === "confirmed" ? "確定実績" : "暫定実績"}</i></div>
      <div><span>比較シミュレーション</span><strong>{actual.simulation.label}</strong><small>{actual.simulation.version} ／ {actual.simulation.frozenAt}保存</small></div>
      <p>シミュレーションを今後改定しても、この月の達成率は保存済みの比較基準で維持されます。</p>
    </section>

    <section className="metric-grid primary-metrics attainment-metrics">
      <MetricCard label={`${actual.shortPeriod}売上`} value={yen.format(actual.revenue)} helper={previous ? `前月比 ${signedYen(actual.revenue - previous.revenue)}` : "月次実績"} />
      <MetricCard label="売上達成率" value={percent.format(summary.revenueAttainment)} helper={`計画差 ${signedYen(summary.revenueVariance)}`} tone={summary.revenueAttainment >= 1 ? "green" : "amber"} formula="実績売上 ÷ 保存済みシミュレーション売上" />
      <MetricCard label="直接粗利" value={yen.format(summary.grossProfit)} helper={`粗利率 ${percent.format(summary.grossMargin)}`} tone="blue" />
      <MetricCard label="粗利達成率" value={percent.format(summary.grossProfitAttainment)} helper={`計画差 ${signedYen(summary.grossProfitVariance)}`} tone={summary.grossProfitAttainment >= 1 ? "green" : "amber"} formula="実績直接粗利 ÷ 保存済みシミュレーション直接粗利" />
    </section>

    <section className="attainment-panel panel">
      <SectionTitle eyebrow="PLAN / ACTUAL" title={`${actual.period} 達成率`} />
      <div className="attainment-row"><span>売上</span><div><i style={{ width: `${Math.min(100, summary.revenueAttainment * 100)}%` }} /></div><strong>{percent.format(summary.revenueAttainment)}</strong><small>{yen.format(actual.revenue)} / {yen.format(summary.planRevenue)}</small></div>
      <div className="attainment-row"><span>直接粗利</span><div><i className="profit" style={{ width: `${Math.min(100, Math.max(0, summary.grossProfitAttainment * 100))}%` }} /></div><strong>{percent.format(summary.grossProfitAttainment)}</strong><small>{yen.format(summary.grossProfit)} / {yen.format(summary.planGrossProfit)}</small></div>
    </section>

    <div className="two-column monthly-comparison-grid">
      <section className="panel table-panel monthly-table">
        <SectionTitle eyebrow="MONTHLY TREND" title="月別推移" />
        <div className="table-scroll"><table><thead><tr><th>月</th><th>状態</th><th>売上</th><th>前月差</th><th>売上達成率</th><th>直接粗利</th><th>粗利率</th><th>粗利達成率</th></tr></thead><tbody>{actualPeriods.map((period, index) => { const item = summarizeActual(period); const prior = index > 0 ? actualPeriods[index - 1] : null; return <tr key={period.id} className={period.id === actual.id ? "selected-row" : ""}><td><button className="table-link" onClick={() => setSelectedPeriodId(period.id)}>{period.shortPeriod}</button></td><td>{period.status === "confirmed" ? <span className="confirmed-badge">確定</span> : <span className="provisional-badge">暫定</span>}</td><td>{yen.format(period.revenue)}</td><td className={prior && period.revenue < prior.revenue ? "negative-text" : "positive-text"}>{prior ? signedYen(period.revenue - prior.revenue) : "—"}</td><td>{percent.format(item.revenueAttainment)}</td><td>{yen.format(item.grossProfit)}</td><td>{percent.format(item.grossMargin)}</td><td>{percent.format(item.grossProfitAttainment)}</td></tr>; })}</tbody></table></div>
      </section>
      <section className="panel variance-summary">
        <SectionTitle eyebrow="VARIANCE" title="差異の要点" />
        <div><span>売上計画差</span><strong className={summary.revenueVariance < 0 ? "negative-text" : "positive-text"}>{signedYen(summary.revenueVariance)}</strong></div>
        <div><span>直接粗利計画差</span><strong className={summary.grossProfitVariance < 0 ? "negative-text" : "positive-text"}>{signedYen(summary.grossProfitVariance)}</strong></div>
        <div><span>前月売上差</span><strong>{previous ? signedYen(actual.revenue - previous.revenue) : "—"}</strong></div>
        <div><span>前月粗利差</span><strong>{previousSummary ? signedYen(summary.grossProfit - previousSummary.grossProfit) : "—"}</strong></div>
        <div><span>備品費控除後</span><strong>{yen.format(summary.contributionProfit)}</strong></div>
        <div><span>共通・未配賦原価</span><strong>{yen.format(actual.commonUnallocatedCost)}</strong></div>
      </section>
    </div>

    <section className="panel table-panel">
      <SectionTitle eyebrow="STORE ATTAINMENT" title={`${actual.period} 店舗別の計画・実績・達成率`} />
      <div className="table-scroll"><table><thead><tr><th>店舗</th><th>計画売上</th><th>実績売上</th><th>売上差</th><th>売上達成率</th><th>実績原価</th><th>店舗粗利</th><th>粗利率</th><th>確認状況</th></tr></thead><tbody>{storeIds.map((id) => { const plan = planByStore.get(id); const store = actualByStore.get(id); const revenue = store?.revenue ?? 0; const cost = store?.outsourcingCost ?? 0; const gross = revenue - cost; const attainment = plan?.revenue ? revenue / plan.revenue : null; return <tr key={id}><td>{store?.name ?? plan?.name ?? id}</td><td>{plan ? yen.format(plan.revenue) : "計画外"}</td><td>{yen.format(revenue)}</td><td className={plan && revenue < plan.revenue ? "negative-text" : "positive-text"}>{plan ? signedYen(revenue - plan.revenue) : "—"}</td><td>{attainment == null ? "—" : percent.format(attainment)}</td><td>{yen.format(cost)}</td><td className={gross < 0 ? "negative-text" : ""}>{yen.format(gross)}</td><td>{revenue ? percent.format(gross / revenue) : "—"}</td><td>{store ? <span className={store.costStatus === "unallocated" ? "pending-badge" : store.costStatus === "provisional" ? "provisional-badge" : "confirmed-badge"}>{statusLabel(store.costStatus)}</span> : "実績なし"}</td></tr>; })}</tbody><tfoot><tr><td>全社合計</td><td>{yen.format(summary.planRevenue)}</td><td>{yen.format(actual.revenue)}</td><td className={summary.revenueVariance < 0 ? "negative-text" : "positive-text"}>{signedYen(summary.revenueVariance)}</td><td>{percent.format(summary.revenueAttainment)}</td><td>{yen.format(actual.storeOutsourcingCost)}</td><td>{yen.format(summary.grossProfit)}</td><td>{percent.format(summary.grossMargin)}</td><td>{actual.status === "confirmed" ? "確定" : "暫定"}</td></tr></tfoot></table></div>
      <p className="panel-note">店舗粗利は店舗に配賦済みの原価で計算しています。全社合計には共通・未配賦原価 {yen.format(actual.commonUnallocatedCost)} を含みます。</p>
    </section>

    <div className="two-column actual-detail-columns">
      <section className="panel"><SectionTitle eyebrow="STORE REVENUE" title="店舗別 計画売上と実績売上" /><div className="legend"><span><i className="legend-blue" />計画</span><span><i className="legend-green" />実績</span></div><BarComparison rows={actual.simulation.stores.map((plan) => ({ label: plan.name, primary: plan.revenue, secondary: actualByStore.get(plan.id)?.revenue ?? 0, secondaryAccent: "green" }))} /></section>
      <section className="panel"><SectionTitle eyebrow="COST ALLOCATION" title="委託先・店舗別内訳" /><div className="allocation-list">{actual.allocations.map((item, index) => <div key={`${item.store}-${item.contractor}-${index}`}><span><strong>{item.store}</strong>{item.contractor}<small>{item.work}{item.status === "provisional" ? "／見込み" : ""}</small></span><b>{yen.format(item.amount)}</b></div>)}</div></section>
    </div>

    <section className="actual-note"><strong>集計メモ</strong><span>{actual.notes.join(" ")}</span></section>
  </>;
}

function ActualsView({ financials }: { financials: StoreFinancials[] }) {
  const [profiles, setProfiles] = useState<StoreOperatingProfile[]>(() => structuredClone(initialOperatingProfiles));
  const [selectedProfileId, setSelectedProfileId] = useState(initialOperatingProfiles[0].storeId);
  const [resetNotice, setResetNotice] = useState(false);
  const revised = useMemo(() => summarizeOperatingForecast(profiles), [profiles]);
  const selectedProfile = profiles.find((profile) => profile.storeId === selectedProfileId) ?? profiles[0];
  const selectedForecast = calculateOperatingForecast(selectedProfile);
  const planTotals = financials.reduce((summary, item) => ({
    revenue: summary.revenue + item.attaRevenue,
    directCost: summary.directCost + item.attaDirectCost,
    grossProfit: summary.grossProfit + item.attaGrossProfit,
  }), { revenue: 0, directCost: 0, grossProfit: 0 });
  const comparableActual = july2026Actual.stores.filter((store) => store.id !== "tokorozawa").reduce((summary, store) => ({
    revenue: summary.revenue + store.revenue,
    directCost: summary.directCost + store.outsourcingCost,
    grossProfit: summary.grossProfit + store.revenue - store.outsourcingCost,
  }), { revenue: 0, directCost: 0, grossProfit: 0 });
  const updateProfile = (patch: Partial<StoreOperatingProfile>) => { setResetNotice(false); setProfiles((current) => current.map((profile) => profile.storeId === selectedProfile.storeId ? { ...profile, ...patch } : profile)); };
  const updateService = (key: ServiceOperatingAssumption["key"], patch: Partial<ServiceOperatingAssumption>) => { setResetNotice(false); setProfiles((current) => current.map((profile) => profile.storeId === selectedProfile.storeId ? { ...profile, services: profile.services.map((service) => service.key === key ? { ...service, ...patch } : service) } : profile)); };
  const resetProfiles = () => { setProfiles(structuredClone(initialOperatingProfiles)); setSelectedProfileId(initialOperatingProfiles[0].storeId); setResetNotice(true); };
  const phaseLabel = (phase: StorePhase) => phase === "unopened" ? "未開設" : phase === "ramp" ? "立ち上げ中" : "安定稼働";
  const actualByStore = new Map(july2026Actual.stores.map((store) => [store.id, store]));
  const planByStore = new Map(financials.map((item) => [item.store.id, item]));

  return <>
    <ActualHistoryView />
    <div className="reforecast-divider"><span>次回シミュレーション見直し</span><strong>実績を基に将来条件を更新</strong></div>
    <section className="actual-hero legacy-actual">
      <div><span className="eyebrow">JULY 2026 ACTUAL</span><h1>7月実績</h1><p>請求データと業務委託費の店舗配賦を税抜で集計。予測モデルとは分離して表示しています。</p></div>
      <div className="utilization-ring"><strong>{percent.format(july2026Actual.utilizationRate)}</strong><span>推定稼働率</span></div>
    </section>

    <section className="metric-grid primary-metrics legacy-actual">
      <MetricCard label="7月売上" value={yen.format(july2026Actual.revenue)} helper={`100%稼働換算 ${yen.format(july2026Summary.fullCapacityRevenue)}`} formula="伝票・撮影／リチェック・水洗い請求の税抜売上合計" />
      <MetricCard label="店舗別業務委託費" value={yen.format(july2026Actual.storeOutsourcingCost)} helper="上荒磯リチェック268,000円を含む" tone="amber" />
      <MetricCard label="直接粗利" value={yen.format(july2026Summary.grossProfit)} helper={`粗利率 ${percent.format(july2026Summary.grossMargin)}`} tone="blue" formula="売上 − 店舗別業務委託費" />
      <MetricCard label="備品費控除後利益" value={yen.format(july2026Summary.contributionProfit)} helper={`利益率 ${percent.format(july2026Summary.contributionProfit / july2026Actual.revenue)}`} tone="green" formula="直接粗利 − 高橋共通費 − 東日本ライティング備品費（税抜換算）" />
    </section>

    <section className="actual-cost-strip legacy-actual">
      <div><span>高橋 備品・共通費</span><strong>{yen.format(july2026Actual.commonEquipmentCost)}</strong><small>税抜</small></div>
      <div><span>東日本ライティング</span><strong>{yen.format(july2026Actual.lightingEquipmentCostTaxIncluded)}</strong><small>税込／税抜換算 {yen.format(july2026Actual.lightingEquipmentCostTaxExclusive)}</small></div>
      <div><span>備品費合計</span><strong>{yen.format(july2026Summary.equipmentCost)}</strong><small>粗利後に控除・税抜換算</small></div>
      <div><span>未稼働20%の売上余地</span><strong>{yen.format(july2026Summary.fullCapacityRevenue - july2026Actual.revenue)}</strong><small>80%稼働の単純換算</small></div>
    </section>

    <SectionTitle eyebrow="REFORECAST MODEL" title="店舗フェーズ・業務別稼働率による修正予測" action={<div className="reset-action"><button className={cx("text-button", resetNotice && "reset-complete")} onClick={resetProfiles}>{resetNotice ? "✓ 初期値に戻しました" : "再予測条件を初期値に戻す"}</button><span aria-live="polite">{resetNotice ? "店舗フェーズ・稼働率・固定費・最低保証を7月実績ベースへ戻しました。" : "7月実績ベースの設定へ戻します"}</span></div>} />
    <section className="metric-grid primary-metrics">
      <MetricCard label="当初計画売上" value={yen.format(planTotals.revenue)} helper={`粗利 ${yen.format(planTotals.grossProfit)}`} tone="violet" />
      <MetricCard label="比較対象7月売上" value={yen.format(comparableActual.revenue)} helper={`対象6店舗・所沢を除外／粗利 ${yen.format(comparableActual.grossProfit)}`} tone="blue" />
      <MetricCard label="修正予測売上" value={yen.format(revised.revenue)} helper={`直接原価 ${yen.format(revised.directCost)}`} tone="cyan" />
      <MetricCard label="修正予測直接粗利" value={yen.format(revised.grossProfit)} helper={`粗利率 ${percent.format(revised.grossMargin)}`} tone={revised.grossProfit >= 0 ? "green" : "amber"} />
    </section>

    <div className="reforecast-layout">
      <section className="panel reforecast-store-list">
        <SectionTitle eyebrow="STORE PHASE" title="店舗フェーズ" />
        {profiles.map((profile) => { const forecast = calculateOperatingForecast(profile); return <button key={profile.storeId} className={selectedProfile.storeId === profile.storeId ? "active" : ""} onClick={() => setSelectedProfileId(profile.storeId)}><span><i className={cx("phase-dot", `phase-${profile.phase}`)} />{profile.storeName}<small>{phaseLabel(profile.phase)}</small></span><strong className={forecast.grossProfit < 0 ? "negative-text" : ""}>{yen.format(forecast.grossProfit)}</strong></button>; })}
      </section>

      <section className="panel service-editor">
        <div className="editor-heading"><div><span className="eyebrow">SERVICE UTILIZATION</span><h2>{selectedProfile.storeName}の修正条件</h2></div><span className={cx("phase-pill", `phase-${selectedProfile.phase}`)}>{phaseLabel(selectedProfile.phase)}</span></div>
        <div className="reforecast-settings">
          <SelectField label="店舗フェーズ" value={selectedProfile.phase} onChange={(value) => updateProfile({ phase: value as StorePhase })}><option value="unopened">未開設</option><option value="ramp">立ち上げ中</option><option value="stable">安定稼働</option></SelectField>
          <NumberInput label="固定費" value={selectedProfile.fixedCost} onChange={(value) => updateProfile({ fixedCost: value })} suffix="円/月" step={1_000} />
          <NumberInput label="最低保証" value={selectedProfile.minimumGuarantee} onChange={(value) => updateProfile({ minimumGuarantee: value })} suffix="円/月" step={1_000} />
        </div>
        <p className="editor-note">{selectedProfile.note}</p>
        <p className="editor-note pricing-rule">換算率・固定レンジは使用しません。撮影とリチェック＋登録は、それぞれの実台数 × 単価で計算します。</p>
        <div className="service-assumptions">
          <div className="service-assumption header"><span>業務</span><span>業務稼働率</span><span>予測台数</span><span>ガリバー請求</span><span>委託費</span></div>
          {selectedProfile.services.map((service) => <div className="service-assumption" key={service.key}>
            <label className="service-toggle"><input type="checkbox" checked={service.enabled} onChange={(event) => updateService(service.key, { enabled: event.target.checked })} /><span>{service.label}</span></label>
            <div className="utilization-control"><input type="range" min="0" max="150" step="1" value={Math.round(service.utilization * 100)} onChange={(event) => updateService(service.key, { utilization: Number(event.target.value) / 100 })} disabled={!service.enabled} /><strong>{percent.format(service.utilization)}</strong></div>
            <span>{number.format(service.capacityUnits * service.utilization)}台</span>
            <strong>{yen.format(service.enabled ? service.capacityRevenue * service.utilization : 0)}{service.billingUnitPrice != null ? <small>{yen.format(service.billingUnitPrice)}／実台</small> : null}</strong>
            <strong>{yen.format(service.enabled ? service.capacityVariableCost * service.utilization : 0)}{service.outsourcingUnitPrice != null ? <small>{yen.format(service.outsourcingUnitPrice)}／実台</small> : null}</strong>
          </div>)}
        </div>
        <div className="forecast-result-strip"><div><span>修正売上</span><strong>{yen.format(selectedForecast.revenue)}</strong></div><div><span>固定＋変動原価</span><strong>{yen.format(selectedForecast.directCost)}</strong></div><div><span>直接粗利</span><strong className={selectedForecast.grossProfit < 0 ? "negative-text" : ""}>{yen.format(selectedForecast.grossProfit)}</strong></div><div><span>粗利率</span><strong>{percent.format(selectedForecast.grossMargin)}</strong></div></div>
      </section>
    </div>

    <section className="panel table-panel"><SectionTitle eyebrow="PLAN / ACTUAL / REFORECAST" title="当初計画・7月実績・修正予測の店舗別比較" /><div className="table-scroll"><table><thead><tr><th>店舗</th><th>フェーズ</th><th>当初売上</th><th>7月売上</th><th>修正売上</th><th>当初粗利</th><th>7月粗利</th><th>修正粗利</th><th>修正粗利率</th></tr></thead><tbody>{profiles.map((profile) => { const plan = planByStore.get(profile.storeId); const actual = actualByStore.get(profile.storeId); const forecast = calculateOperatingForecast(profile); const actualGross = actual ? actual.revenue - actual.outsourcingCost : 0; return <tr key={profile.storeId}><td>{profile.storeName}</td><td>{phaseLabel(profile.phase)}</td><td>{yen.format(plan?.attaRevenue ?? 0)}</td><td>{yen.format(actual?.revenue ?? 0)}</td><td>{yen.format(forecast.revenue)}</td><td>{yen.format(plan?.attaGrossProfit ?? 0)}</td><td className={actualGross < 0 ? "negative-text" : ""}>{yen.format(actualGross)}</td><td className={forecast.grossProfit < 0 ? "negative-text" : ""}>{yen.format(forecast.grossProfit)}</td><td>{percent.format(forecast.grossMargin)}</td></tr>; })}</tbody></table></div><p className="panel-note">撮影は請求2,000円・委託1,500円／実台。リチェック＋登録は請求2,500円、委託は上荒磯2,500円・その他2,000円／実台です。未開設店舗は売上・原価とも0円です。</p></section>

    <section className="panel table-panel"><SectionTitle eyebrow="STORE ACTUAL" title="店舗別 7月売上・業務委託費" /><div className="table-scroll"><table><thead><tr><th>店舗</th><th>売上（税抜）</th><th>業務委託費（税抜）</th><th>直接粗利</th><th>粗利率</th><th>確認状況</th></tr></thead><tbody>{july2026Actual.stores.map((store) => { const gross = store.revenue - store.outsourcingCost; return <tr key={store.id}><td>{store.name}</td><td>{yen.format(store.revenue)}</td><td>{yen.format(store.outsourcingCost)}</td><td className={gross < 0 ? "negative-text" : ""}>{yen.format(gross)}</td><td className={gross < 0 ? "negative-text" : ""}>{percent.format(store.revenue ? gross / store.revenue : 0)}</td><td>{store.costStatus === "unallocated" ? <span className="pending-badge">原価未配賦</span> : <span className="confirmed-badge">配賦済み</span>}</td></tr>; })}</tbody><tfoot><tr><td>合計</td><td>{yen.format(july2026Actual.revenue)}</td><td>{yen.format(july2026Actual.storeOutsourcingCost)}</td><td>{yen.format(july2026Summary.grossProfit)}</td><td>{percent.format(july2026Summary.grossMargin)}</td><td>—</td></tr></tfoot></table></div><p className="panel-note">所沢は売上伝票がありますが、今回共有された店舗別業務委託費に配賦がないため原価未配賦と表示しています。つくばは7月実績なしです。</p></section>

    <div className="two-column actual-detail-columns">
      <section className="panel"><SectionTitle eyebrow="STORE PROFIT" title="店舗別 売上と直接粗利" /><div className="legend"><span><i className="legend-blue" />売上</span><span><i className="legend-amber" />直接粗利</span></div><BarComparison rows={july2026Actual.stores.map((store) => ({ label: store.name, primary: store.revenue, secondary: store.revenue - store.outsourcingCost }))} /></section>
      <section className="panel"><SectionTitle eyebrow="COST ALLOCATION" title="委託先・店舗別内訳" /><div className="allocation-list">{july2026Actual.allocations.map((item, index) => <div key={`${item.store}-${item.contractor}-${index}`}><span><strong>{item.store}</strong>{item.contractor}<small>{item.work}</small></span><b>{yen.format(item.amount)}</b></div>)}</div></section>
    </div>

    <section className="actual-note"><strong>集計上の扱い</strong><span>売上・店舗委託費は税抜。高橋の総額266,000円のうち190,000円を店舗費、76,000円を備品・共通費に分類。新狭山にはLIVE COLOR 593,000円と上荒磯リチェック268,000円を計上しています。</span></section>
  </>;
}

type StoresViewProps = { financials: StoreFinancials[]; selected: StoreFinancials; setSelected: (id: string) => void; settings: SimulationSettings };

function StoresView(props: StoresViewProps) {
  const [mode, setMode] = useState<"simulation" | "actual">("simulation");
  const [periodId, setPeriodId] = useState(august2026Actual.id);
  const actual = actualPeriods.find((period) => period.id === periodId) ?? august2026Actual;
  return <>
    <div className="store-view-controls">
      <div><span className="eyebrow">STORE COMPARISON</span><h1>店舗別比較</h1><p>現行シミュレーションと月次実績を切り替えて確認できます。</p></div>
      <div className="store-view-actions">
        <div className="segmented"><button className={mode === "simulation" ? "active" : ""} onClick={() => setMode("simulation")}>シミュレーション</button><button className={mode === "actual" ? "active" : ""} onClick={() => setMode("actual")}>月次実績</button></div>
        {mode === "actual" ? <div className="segmented">{actualPeriods.map((period) => <button key={period.id} className={actual.id === period.id ? "active" : ""} onClick={() => setPeriodId(period.id)}>{period.shortPeriod}</button>)}</div> : null}
      </div>
    </div>
    {mode === "simulation" ? <SimulationStoresView {...props} /> : <ActualStoresView actual={actual} />}
  </>;
}

function ActualStoresView({ actual }: { actual: (typeof actualPeriods)[number] }) {
  const [selectedId, setSelectedId] = useState("hachioji");
  const selected = actual.stores.find((store) => store.id === selectedId) ?? actual.stores[0];
  const plan = actual.simulation.stores.find((store) => store.id === selected.id);
  const grossProfit = selected.revenue - selected.outsourcingCost;
  const grossMargin = selected.revenue ? grossProfit / selected.revenue : 0;
  const attainment = plan?.revenue ? selected.revenue / plan.revenue : null;
  const allocations = actual.allocations.filter((item) => item.store === selected.name);
  const signedYen = (value: number) => `${value >= 0 ? "+" : "−"}${yen.format(Math.abs(value))}`;
  return <>
    <SectionTitle eyebrow="MONTHLY STORE ACTUAL" title={`${actual.period} 店舗別実績`} action={<span className={actual.status === "confirmed" ? "confirmed-badge" : "provisional-badge"}>{actual.status === "confirmed" ? "確定" : "暫定"}</span>} />
    <div className="store-chips">{actual.stores.map((store) => <button key={store.id} className={selected.id === store.id ? "active" : ""} onClick={() => setSelectedId(store.id)}><span className="status-dot actual" />{store.name}<small>{store.costStatus === "unallocated" ? "原価未配賦" : store.costStatus === "provisional" ? "見込み含む" : "配賦済み"}</small></button>)}</div>
    <section className="metric-grid primary-metrics">
      <MetricCard label="実績売上" value={yen.format(selected.revenue)} helper={plan ? `計画 ${yen.format(plan.revenue)}` : "シミュレーション計画外"} />
      <MetricCard label="売上達成率" value={attainment == null ? "—" : percent.format(attainment)} helper={plan ? `計画差 ${signedYen(selected.revenue - plan.revenue)}` : "比較対象なし"} tone={attainment != null && attainment >= 1 ? "green" : "amber"} />
      <MetricCard label="業務委託費" value={yen.format(selected.outsourcingCost)} helper="店舗配賦済み原価" tone="amber" />
      <MetricCard label="店舗粗利" value={yen.format(grossProfit)} helper={`粗利率 ${percent.format(grossMargin)}`} tone={grossProfit >= 0 ? "blue" : "amber"} />
    </section>
    <div className="detail-grid actual-store-detail">
      <section className="panel">
        <div className="store-header"><div><span className="category-label actual">月次実績</span><h1>{selected.name}</h1><p>{actual.period} ／ 比較基準 {actual.simulation.label}</p></div><div className="inventory"><strong>{attainment == null ? "—" : percent.format(attainment)}</strong><span>売上達成率</span></div></div>
        <div className="detail-kpis"><div><span>計画売上</span><strong>{plan ? yen.format(plan.revenue) : "計画外"}</strong></div><div><span>実績売上</span><strong>{yen.format(selected.revenue)}</strong></div><div><span>計画差</span><strong>{plan ? signedYen(selected.revenue - plan.revenue) : "—"}</strong></div><div><span>店舗粗利</span><strong>{yen.format(grossProfit)}</strong></div><div><span>粗利率</span><strong>{percent.format(grossMargin)}</strong></div></div>
        <div className="note-columns"><div><span>委託費内訳</span>{allocations.length ? allocations.map((item, index) => <p key={`${item.contractor}-${index}`}>• {item.contractor}：{yen.format(item.amount)}（{item.work}）</p>) : <p>• 店舗別の委託費内訳なし</p>}</div><div><span>集計上の注意</span>{actual.notes.map((note) => <p key={note}>• {note}</p>)}</div></div>
      </section>
      <section className="panel financial-stack"><h3>{actual.period} 実績</h3><div><span>売上</span><strong>{yen.format(selected.revenue)}</strong></div><div><span>業務委託費</span><strong>− {yen.format(selected.outsourcingCost)}</strong></div><div className="profit"><span>店舗粗利</span><strong>{yen.format(grossProfit)}</strong></div><div><span>粗利率</span><strong>{percent.format(grossMargin)}</strong></div>{plan ? <><h3>シミュレーション比較</h3><div><span>計画売上</span><strong>{yen.format(plan.revenue)}</strong></div><div><span>売上差</span><strong className={selected.revenue < plan.revenue ? "negative-text" : "positive-text"}>{signedYen(selected.revenue - plan.revenue)}</strong></div><div><span>達成率</span><strong>{percent.format(attainment ?? 0)}</strong></div></> : null}</section>
    </div>
    <section className="panel table-panel"><SectionTitle eyebrow="ALL STORE ACTUALS" title={`${actual.period} 店舗別実績一覧`} /><div className="table-scroll"><table><thead><tr><th>店舗</th><th>計画売上</th><th>実績売上</th><th>達成率</th><th>業務委託費</th><th>店舗粗利</th><th>粗利率</th><th>状態</th></tr></thead><tbody>{actual.stores.map((store) => { const storePlan = actual.simulation.stores.find((item) => item.id === store.id); const gross = store.revenue - store.outsourcingCost; return <tr key={store.id}><td><button className="table-link" onClick={() => setSelectedId(store.id)}>{store.name}</button></td><td>{storePlan ? yen.format(storePlan.revenue) : "計画外"}</td><td>{yen.format(store.revenue)}</td><td>{storePlan?.revenue ? percent.format(store.revenue / storePlan.revenue) : "—"}</td><td>{yen.format(store.outsourcingCost)}</td><td className={gross < 0 ? "negative-text" : ""}>{yen.format(gross)}</td><td>{store.revenue ? percent.format(gross / store.revenue) : "—"}</td><td>{store.costStatus === "unallocated" ? "原価未配賦" : store.costStatus === "provisional" ? "見込み含む" : "配賦済み"}</td></tr>; })}</tbody></table></div><p className="panel-note">全社共通・未配賦原価は店舗粗利に含めず、月次実績の全社合計で控除しています。</p></section>
  </>;
}

function SimulationStoresView({ financials, selected, setSelected, settings }: StoresViewProps) {
  const monthlyKitExpense = starterKitMonthlyExpense(settings.operatingCosts.attaStarterKitCostPerStore, settings.operatingCosts.starterKitAccountingMethod);
  return <>
    <SectionTitle eyebrow="STORE PORTFOLIO" title="店舗別収益と投資回収" />
    <div className="store-chips">{financials.map((item) => <button key={item.store.id} className={selected.store.id === item.store.id ? "active" : ""} onClick={() => setSelected(item.store.id)}><span className={`status-dot ${item.store.category}`} />{item.store.shortName}<small>{managementLabel(item.store)}</small></button>)}</div>
    <div className="detail-grid">
      <section className="panel store-profile">
        <div className="store-header"><div><span className={`category-label ${selected.store.category}`}>{selected.store.category === "actual" ? "実績" : selected.store.category === "transition" ? "移行中" : "想定"}</span><h1>{selected.store.name}</h1><p>{managementDescription(selected.store)}{selected.store.sourceUrl ? <> ／ <a href={selected.store.sourceUrl} target="_blank" rel="noreferrer">店舗公式 ↗</a></> : null}</p></div><div className="inventory"><strong>{selected.store.displayInventory ?? "—"}</strong><span>MAX展示数</span></div></div>
        <div className="detail-kpis"><div><span>仕上げ</span><strong>{number.format(selected.store.finishingCount)}台</strong></div><div><span>水洗い</span><strong>{number.format(selected.store.washCount)}台</strong></div><div><span>撮影</span><strong>{number.format(selected.store.photoCount)}台</strong></div><div><span>リチェック</span><strong>{number.format(selected.store.recheckCount)}台</strong></div><div><span>担当／枠</span><strong>{selected.store.recheckWorkers}名／{selected.store.recheckSlots}枠</strong></div></div>
        <div className="note-columns"><div><span>現状・課題</span>{selected.store.notes.map((note) => <p key={note}>• {note}</p>)}</div><div><span>改善余地</span>{selected.store.opportunities.map((note) => <p key={note}>• {note}</p>)}</div></div>
      </section>
      <section className="panel financial-stack">
        <h3>アッタデザイン</h3><div><span>売上</span><strong>{yen.format(selected.attaRevenue)}</strong></div>{selected.photoContractRevenue > 0 ? <div className="revenue-detail"><span>うち撮影契約収益</span><strong>{yen.format(selected.photoContractRevenue)}</strong></div> : null}<div><span>管理パートナー／直接スタッフ支払</span><strong>− {yen.format(selected.attaDirectCost)}</strong></div>{selected.directPhotoStaffCost > 0 ? <div className="cost-detail"><span>うち撮影専任報酬</span><strong>{yen.format(selected.directPhotoStaffCost)}</strong></div> : null}<div className="profit"><span>直接粗利</span><strong>{yen.format(selected.attaGrossProfit)}</strong></div><div><span>直接粗利率</span><strong>{percent.format(selected.attaGrossMargin)}</strong></div>
        {selected.store.managedByNas ? <><h3>NaS</h3><div><span>受取額</span><strong>{yen.format(selected.nasRevenue)}</strong></div><div><span>スタッフ支払</span><strong>− {yen.format(selected.nasStaffCost)}</strong></div><div><span>月次用具費</span><strong>− {yen.format(selected.nasSupplyCost)}</strong></div><div className="profit green"><span>用具費控除後利益</span><strong>{yen.format(selected.nasContributionProfit)}</strong></div></> : null}
      </section>
    </div>
    <section className="metric-grid secondary-metrics">
      <MetricCard label="スターターキット" value={selected.store.starterKitInstalled ? "導入済み" : "未導入"} helper={`${yen.format(selected.store.starterKitCost)}／${selected.store.openingMonth}`} tone={selected.store.starterKitInstalled ? "green" : "amber"} />
      <MetricCard label="初期投資回収" value={selected.store.starterKitInstalled ? "回収済み" : "未回収"} helper={selected.store.starterKitInstalled ? "既存店のため将来追加投資から除外" : "開設月にスターターキット支出予定"} tone={selected.store.starterKitInstalled ? "blue" : "violet"} />
      <MetricCard label="累計粗利（年換算）" value={yen.format(selected.annualAttaGrossProfit)} helper="月間直接粗利 × 12" tone="violet" />
      <MetricCard label="投資回収率（年換算）" value={percent.format(selected.annualAttaGrossProfit / selected.store.starterKitCost)} helper={`会計表示月額 ${yen.format(monthlyKitExpense)}`} tone="amber" />
    </section>
    <div className="two-column">
      <section className="panel"><SectionTitle eyebrow="PAYBACK" title="店舗別 投資回収期間" /><BarComparison rows={financials.map((item) => ({ label: item.store.shortName, primary: settings.operatingCosts.attaStarterKitCostPerStore / Math.max(1, item.attaGrossProfit), accent: "blue" }))} valueLabel={(value) => `${number.format(value)}か月`} /></section>
      <section className="panel"><SectionTitle eyebrow="NaS CONTRIBUTION" title="NaS直接粗利と用具費控除後利益" /><div className="legend"><span><i className="legend-blue" />直接粗利</span><span><i className="legend-green" />用具費控除後</span></div><BarComparison rows={financials.filter((item) => item.store.managedByNas).map((item) => ({ label: item.store.shortName, primary: item.nasGrossProfit, secondary: item.nasContributionProfit, secondaryAccent: "green" as const }))} /></section>
    </div>
    <section className="panel table-panel"><SectionTitle eyebrow="ALL STORES" title="店舗別比較表" /><div className="table-scroll"><table><thead><tr><th>店舗</th><th>区分</th><th>管理</th><th>売上</th><th>直接原価</th><th>アッタ粗利</th><th>粗利率</th><th>NaS粗利</th><th>用具費後NaS利益</th><th>仕上げ</th><th>水洗い</th><th>撮影</th><th>リチェック</th></tr></thead><tbody>{financials.map((item) => <tr key={item.store.id}><td><button className="table-link" onClick={() => setSelected(item.store.id)}>{item.store.name}</button></td><td>{item.store.category === "actual" ? "実績" : item.store.category === "transition" ? "移行" : "想定"}</td><td>{managementLabel(item.store)}</td><td>{yen.format(item.attaRevenue)}</td><td>{yen.format(item.attaDirectCost)}</td><td>{yen.format(item.attaGrossProfit)}</td><td>{percent.format(item.attaGrossMargin)}</td><td>{item.store.managedByNas ? yen.format(item.nasGrossProfit) : "—"}</td><td>{item.store.managedByNas ? yen.format(item.nasContributionProfit) : "—"}</td><td>{number.format(item.store.finishingCount)}</td><td>{number.format(item.store.washCount)}</td><td>{number.format(item.store.photoCount)}</td><td>{number.format(item.store.recheckCount)}</td></tr>)}</tbody></table></div></section>
  </>;
}

function CashFlowView({ months, setMonths, mode, setMode, flow, simultaneous, phased, simSummary, phasedSummary, investment }: any) {
  return <>
    <div className="title-with-controls"><SectionTitle eyebrow="MONTHLY CASH FLOW" title="店舗展開キャッシュフロー" /><div className="segmented"><button className={months === 12 ? "active" : ""} onClick={() => setMonths(12)}>12か月</button><button className={months === 24 ? "active" : ""} onClick={() => setMonths(24)}>24か月</button><button className={months === 36 ? "active" : ""} onClick={() => setMonths(36)}>36か月</button></div></div>
    <div className="mode-cards"><button className={mode === "simultaneous" ? "active" : ""} onClick={() => setMode("simultaneous")}><span>一括展開</span><strong>全店舗を1か月目に開設</strong><small>初期投資を早期投入し、収益化を優先</small></button><button className={mode === "phased" ? "active" : ""} onClick={() => setMode("phased")}><span>段階展開</span><strong>3か月ごとに1店舗</strong><small>初期資金負担を分散し、運営学習を反映</small></button></div>
    <section className="metric-grid secondary-metrics"><MetricCard label="初期資金必要額" value={yen.format(investment)} helper="スターターキット総額" tone="amber" /><MetricCard label="最大累積資金流出" value={yen.format(mode === "simultaneous" ? simSummary.maximumCashOutflow : phasedSummary.maximumCashOutflow)} helper="月次粗利込みの累積最低点" tone="violet" /><MetricCard label="投資回収月" value={`${mode === "simultaneous" ? simSummary.recoveryMonth ?? "—" : phasedSummary.recoveryMonth ?? "—"}か月目`} helper="累積キャッシュが0円以上" tone="blue" /><MetricCard label={`${months}か月累積キャッシュ`} value={yen.format(flow.at(-1)?.attaCumulativeCash ?? 0)} helper={`NaS累積利益 ${compactYen(flow.at(-1)?.nasCumulativeProfit ?? 0)}`} tone="green" /></section>
    <section className="panel"><SectionTitle eyebrow="DEPLOYMENT COMPARISON" title="一括展開と段階展開の累積キャッシュ比較" /><TrendBars first={simultaneous.map((item: any) => item.attaCumulativeCash)} second={phased.map((item: any) => item.attaCumulativeCash)} firstLabel="一括展開" secondLabel="段階展開" /></section>
    <section className="panel"><SectionTitle eyebrow="PROFIT TREND" title="アッタ直接粗利とNaS用具費控除後利益の推移" /><TrendBars first={flow.map((item: any) => item.attaGrossProfit)} second={flow.map((item: any) => item.nasContributionProfit)} firstLabel="アッタ直接粗利" secondLabel="NaS用具費控除後利益" /></section>
    <section className="comparison-strip"><div><span>比較項目</span><strong>一括展開</strong><strong>段階展開</strong></div><div><span>最大資金流出額</span><strong>{yen.format(simSummary.maximumCashOutflow)}</strong><strong>{yen.format(phasedSummary.maximumCashOutflow)}</strong></div><div><span>投資回収月</span><strong>{simSummary.recoveryMonth ?? "—"}か月目</strong><strong>{phasedSummary.recoveryMonth ?? "—"}か月目</strong></div><div><span>{months}か月累積利益</span><strong>{yen.format(simSummary.endingAttaCash)}</strong><strong>{yen.format(phasedSummary.endingAttaCash)}</strong></div></section>
    <section className="panel table-panel"><SectionTitle eyebrow="MONTHLY DETAIL" title={`${mode === "simultaneous" ? "一括展開" : "段階展開"} 月次明細`} /><div className="table-scroll"><table><thead><tr><th>月</th><th>新規開設</th><th>稼働店舗</th><th>キット支出</th><th>アッタ売上</th><th>直接粗利</th><th>月間CF</th><th>累積CF</th><th>NaS受取</th><th>スタッフ支払</th><th>用具費</th><th>用具費後利益</th><th>NaS累積利益</th></tr></thead><tbody>{flow.map((item: any) => <tr key={item.month}><td>{item.month}か月目</td><td>{item.newStores}店舗</td><td>{item.activeStores}店舗</td><td className={item.starterKitOutflow ? "negative-text" : ""}>{yen.format(-item.starterKitOutflow)}</td><td>{yen.format(item.attaRevenue)}</td><td>{yen.format(item.attaGrossProfit)}</td><td className={item.attaMonthlyCash < 0 ? "negative-text" : ""}>{yen.format(item.attaMonthlyCash)}</td><td>{yen.format(item.attaCumulativeCash)}</td><td>{yen.format(item.nasRevenue)}</td><td>{yen.format(item.nasStaffCost)}</td><td>{yen.format(item.nasSupplyCost)}</td><td>{yen.format(item.nasContributionProfit)}</td><td>{yen.format(item.nasCumulativeProfit)}</td></tr>)}</tbody></table></div></section>
  </>;
}

function SimulatorView({ inputs, updateInputs, expansion, settings, setSettings }: any) {
  const scenarios = [
    { name: "保守", finishing: 120, wash: 500, recheck: 50, workers: 1 },
    { name: "標準", finishing: 150, wash: 300, recheck: 70, workers: 1 },
    { name: "高稼働", finishing: 200, wash: 400, recheck: 180, workers: 2 },
  ].map((scenario) => {
    const scenarioInputs = { ...inputs, finishingCount: scenario.finishing, photoCount: scenario.finishing, washCount: scenario.wash, recheckCount: scenario.recheck, recheckWorkers: scenario.workers, recheckSlots: scenario.workers };
    return { ...scenario, result: calculateExpansionSimulation(scenarioInputs, settings), workersResult: calculateRequiredWorkers(scenarioInputs) };
  });
  const updateShare = (key: "simpleShare" | "normalShare" | "dirtyShare", value: number) => updateInputs(key, Math.max(0, Math.min(100, value)) / 100);
  return <>
    <SectionTitle eyebrow="EXPANSION SIMULATOR" title="平均150台店舗の追加シミュレーション" />
    <div className="simulator-layout">
      <section className="panel input-panel"><h3>店舗・業務量</h3><div className="preset-row">{[1, 3, 5, 7, 10].map((count) => <button className={inputs.storeCount === count ? "active" : ""} key={count} onClick={() => updateInputs("storeCount", count)}>{count}店舗</button>)}</div><div className="form-grid"><NumberInput label="追加店舗数" value={inputs.storeCount} onChange={(value) => updateInputs("storeCount", Math.max(1, value))} suffix="店舗" min={1} /><NumberInput label="仕上げ" value={inputs.finishingCount} onChange={(value) => updateInputs("finishingCount", value)} suffix="台/月" /><NumberInput label="水洗い" value={inputs.washCount} onChange={(value) => updateInputs("washCount", value)} suffix="台/月" /><NumberInput label="撮影" value={inputs.photoCount} onChange={(value) => updateInputs("photoCount", value)} suffix="台/月" /><NumberInput label="リチェック＋登録" value={inputs.recheckCount} onChange={(value) => updateInputs("recheckCount", value)} suffix="台/月" /><NumberInput label="リチェック担当" value={inputs.recheckWorkers} onChange={(value) => updateInputs("recheckWorkers", value)} suffix="名" min={1} /><NumberInput label="リチェック枠" value={inputs.recheckSlots} onChange={(value) => updateInputs("recheckSlots", value)} suffix="枠" min={1} /><NumberInput label="営業日数" value={settings.operatingDays} onChange={(value) => setSettings((current: SimulationSettings) => ({ ...current, operatingDays: value }))} suffix="日" min={1} /></div>
        <h3>仕上げ構成比</h3><div className="form-grid three"><NumberInput label="簡易" value={inputs.simpleShare * 100} onChange={(value) => updateShare("simpleShare", value)} suffix="%" /><NumberInput label="通常" value={inputs.normalShare * 100} onChange={(value) => updateShare("normalShare", value)} suffix="%" /><NumberInput label="汚れ" value={inputs.dirtyShare * 100} onChange={(value) => updateShare("dirtyShare", value)} suffix="%" /></div>
        <h3>契約条件</h3><div className="form-grid"><NumberInput label="リチェック＋登録 請求単価" value={settings.pricing.client.recheck} onChange={(value) => setSettings((current: SimulationSettings) => ({ ...current, pricing: { ...current.pricing, client: { ...current.pricing.client, recheck: value } } }))} suffix="円／台" step={100} /><NumberInput label="撮影 請求単価" value={settings.pricing.client.photo} onChange={(value) => setSettings((current: SimulationSettings) => ({ ...current, pricing: { ...current.pricing, client: { ...current.pricing.client, photo: value } } }))} suffix="円／台" step={100} /><SelectField label="表示税区分" value={settings.taxMode} onChange={(value) => setSettings((current: SimulationSettings) => ({ ...current, taxMode: value as TaxMode }))}><option value="taxExclusive">契約税抜ベース</option><option value="taxIncluded">契約税込ベース</option></SelectField></div>
      </section>
      <section className="sim-results"><div className="result-hero"><span>アッタ初年度キャッシュ利益</span><strong>{yen.format(expansion.firstYearCashProfit)}</strong><small>初期投資 {yen.format(expansion.starterKitInvestment)} 控除後</small></div><div className="result-grid"><div><span>月間売上</span><strong>{yen.format(expansion.monthlyAttaRevenue)}</strong></div><div><span>月間直接粗利</span><strong>{yen.format(expansion.monthlyAttaGrossProfit)}</strong></div><div><span>投資回収</span><strong>{number.format(expansion.paybackMonths)}か月</strong></div><div><span>必要スタッフ</span><strong>{expansion.workers.total}名</strong></div><div><span>NaS用具費/月</span><strong>{yen.format(expansion.monthlyNasSupplyCost)}</strong></div><div><span>NaS用具費後利益</span><strong>{yen.format(expansion.monthlyNasContributionProfit)}</strong></div></div><div className="calculation-note"><span>1店舗あたり</span><p>売上 <strong>{yen.format(expansion.perStore.attaRevenue)}</strong> ／ 直接粗利 <strong>{yen.format(expansion.perStore.attaGrossProfit)}</strong></p><p>スターターキット <strong>{yen.format(settings.operatingCosts.attaStarterKitCostPerStore)}</strong> ／ NaS用具費 <strong>{yen.format(settings.operatingCosts.nasMonthlySupplyCostPerStore)}/月</strong></p></div></section>
    </div>
    <section className="panel"><SectionTitle eyebrow="GROWTH CURVE" title="新規店舗数とアッタ累積キャッシュ（12か月）" /><BarComparison rows={[1, 3, 5, 7, 10].map((count) => { const result = calculateExpansionSimulation({ ...inputs, storeCount: count }, settings); return { label: `${count}店舗`, primary: result.firstYearCashProfit, accent: "blue" as const }; })} /></section>
    <SectionTitle eyebrow="SCENARIO COMPARISON" title="保守・標準・高稼働ケース" />
    <div className="scenario-grid">{scenarios.map((scenario) => <article key={scenario.name} className={scenario.name === "標準" ? "featured" : ""}><span>{scenario.name}ケース</span><h3>{scenario.finishing}台 × {inputs.storeCount}店舗</h3><div><small>アッタ月間粗利</small><strong>{yen.format(scenario.result.monthlyAttaGrossProfit)}</strong></div><div><small>NaS用具費後利益</small><strong>{yen.format(scenario.result.monthlyNasContributionProfit)}</strong></div><div><small>初年度キャッシュ</small><strong>{yen.format(scenario.result.firstYearCashProfit)}</strong></div><p>水洗い {scenario.wash}台 ／ リチェック {scenario.recheck}台 ／ 担当 {scenario.workers}名</p></article>)}</div>
    <FormulaDetails />
  </>;
}

function SettingsView({ settings, setSettings, updateOperating, updatePrice }: any) {
  const priceGroups = [
    { key: "client", title: "ガリバー → アッタ", fields: [["normalFinishing", "通常仕上げ"], ["wash", "水洗い"], ["photo", "撮影／台"], ["recheck", "リチェック＋登録／台"]] },
    { key: "attaToNas", title: "アッタ → NaS", fields: [["normalFinishing", "通常仕上げ"], ["wash", "水洗い"], ["photo", "撮影"], ["recheck", "リチェック＋登録"]] },
    { key: "nasToWorker", title: "NaS → スタッフ", fields: [["normalFinishing", "通常仕上げ"], ["wash", "水洗い"], ["photo", "撮影"], ["recheck", "リチェック＋登録"]] },
  ];
  return <>
    <SectionTitle eyebrow="MODEL SETTINGS" title="事業前提・単価設定" />
    <div className="settings-intro"><strong>青い入力欄は変更可能です。</strong><span>変更内容はサマリー、店舗別、キャッシュフロー、シミュレーターへ即時反映されます。</span></div>
    <section className="panel"><SectionTitle eyebrow="OPERATING COST" title="初期投資・用具費" /><div className="form-grid settings-grid"><NumberInput label="アッタ スターターキット／店" value={settings.operatingCosts.attaStarterKitCostPerStore} onChange={(value) => updateOperating("attaStarterKitCostPerStore", value)} suffix="円" step={10_000} /><NumberInput label="NaS 月間用具費／管理店" value={settings.operatingCosts.nasMonthlySupplyCostPerStore} onChange={(value) => updateOperating("nasMonthlySupplyCostPerStore", value)} suffix="円" step={1_000} /><SelectField label="スターターキット会計表示" value={settings.operatingCosts.starterKitAccountingMethod} onChange={(value) => updateOperating("starterKitAccountingMethod", value as StarterKitAccountingMethod)}><option value="cash">一括費用計上</option><option value="amortize12">12か月按分</option><option value="amortize24">24か月按分</option><option value="amortize36">36か月按分</option></SelectField><NumberInput label="会計表示上の月額" value={starterKitMonthlyExpense(settings.operatingCosts.attaStarterKitCostPerStore, settings.operatingCosts.starterKitAccountingMethod)} onChange={() => {}} suffix="円/月" step={1} /></div><p className="panel-note">キャッシュフローでは会計表示方法にかかわらず、開設月にスターターキット全額を支出します。</p></section>
    <section className="panel"><SectionTitle eyebrow="PHOTO / RECHECK CONTRACT" title="撮影・リチェック＋登録の新単価" /><div className="form-grid settings-grid"><NumberInput label="リチェック＋登録 請求" value={settings.pricing.client.recheck} onChange={(value) => updatePrice("client", "recheck", value)} suffix="円／台" step={100} /><NumberInput label="リチェック その他委託" value={settings.pricing.attaToNas.recheck} onChange={(value) => updatePrice("attaToNas", "recheck", value)} suffix="円／台" step={100} /><NumberInput label="撮影 請求" value={settings.pricing.client.photo} onChange={(value) => updatePrice("client", "photo", value)} suffix="円／台" step={100} /><NumberInput label="撮影 委託" value={settings.pricing.attaToNas.photo} onChange={(value) => updatePrice("attaToNas", "photo", value)} suffix="円／台" step={100} /></div><p className="panel-note">上荒磯のリチェック＋登録は店舗別設定で2,500円／台。その他は2,000円／台。撮影は請求2,000円・委託1,500円／台で計算します。</p></section>
    <div className="price-group-grid">{priceGroups.map((group) => <section className="panel" key={group.key}><h3>{group.title}</h3>{group.fields.map(([key, label]) => <NumberInput key={key} label={label} value={(settings.pricing as any)[group.key][key]} onChange={(value) => updatePrice(group.key, key, value)} suffix="円" step={key === "recheckAdjustmentUnitPrice" ? 0.001 : 100} />)}</section>)}</div>
    <section className="panel assumptions-table"><SectionTitle eyebrow="ASSUMPTION REGISTER" title="前提値一覧" /><div className="table-scroll"><table><thead><tr><th>区分</th><th>項目</th><th>初期値</th><th>扱い</th><th>根拠</th></tr></thead><tbody><tr><td>対象店</td><td>NaS管理店舗</td><td>3店舗</td><td>固定対象</td><td>草加・大宮・つくば</td></tr><tr><td>対象店</td><td>LIVE COLOR管理店舗</td><td>1店舗</td><td>固定対象</td><td>新狭山</td></tr><tr><td>請求単価</td><td>一宮／通常仕上げ</td><td>8,250円（税込）／7,500円（税抜）</td><td>店舗固有</td><td>ユーザー提示条件</td></tr><tr><td>委託単価</td><td>新狭山／LIVE COLOR</td><td>仕上げ5,500円（税込）／リチェック2,500円</td><td>店舗固有</td><td>ユーザー提示条件</td></tr><tr><td>追加店</td><td>標準処理量</td><td>仕上げ150／水洗い300／撮影150／リチェック70</td><td>変更可</td><td>Excel標準店舗モデル</td></tr><tr><td>投資</td><td>スターターキット</td><td>{yen.format(settings.operatingCosts.attaStarterKitCostPerStore)}</td><td>開設月キャッシュアウト</td><td>ユーザー提示条件</td></tr><tr><td>継続費</td><td>NaS用具費</td><td>{yen.format(settings.operatingCosts.nasMonthlySupplyCostPerStore)}/管理店</td><td>毎月</td><td>ユーザー提示条件</td></tr><tr><td>会計</td><td>本部費用</td><td>未控除</td><td>モデル範囲外</td><td>直接粗利・営業貢献利益まで</td></tr></tbody></table></div></section>
  </>;
}
