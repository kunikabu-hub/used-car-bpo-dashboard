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
import type {
  DeploymentMode,
  ExpansionInputs,
  Pricing,
  SimulationSettings,
  StarterKitAccountingMethod,
  StoreFinancials,
  TaxMode,
} from "../lib/types";

type Tab = "summary" | "stores" | "cashflow" | "simulator" | "settings";

const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("ja-JP", { style: "percent", maximumFractionDigits: 1 });
const compactYen = (value: number) => `${number.format(value / 10_000)}万円`;
const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

const navItems: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "summary", label: "サマリー", icon: "◫" },
  { id: "stores", label: "店舗別", icon: "▦" },
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
        <div><strong>アッタ直接粗利</strong><code>ガリバー売上 − NaSまたは直接スタッフ支払</code></div>
        <div><strong>初年度キャッシュ利益</strong><code>年間直接粗利 − 新規店舗数 × 600,000円</code></div>
        <div><strong>投資回収月数</strong><code>600,000円 ÷ 1店舗当たり月間直接粗利</code></div>
        <div><strong>NaS用具費控除後利益</strong><code>NaS直接粗利 − 管理店舗数 × 30,000円</code></div>
        <div><strong>リチェック100台未満</strong><code>370,000 − (100 − 換算台数) × 3,083.333</code></div>
        <div><strong>リチェック140台超</strong><code>370,000 ＋ (換算台数 − 140) × 3,083.333</code></div>
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
    recheckConversionRate: 0.75,
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
        <div className="sidebar-footer"><span>基準日</span><strong>2026年7月</strong></div>
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
                <div><span className="eyebrow">EXECUTIVE SUMMARY</span><h1>収益と投資を、同じ画面で判断する。</h1><p>既存5店舗の直接粗利に、新規出店のスターターキット投資とNaSの継続用具費を重ねて確認できます。</p></div>
                <div className="hero-badge"><span>現在</span><strong>5</strong><small>対象店舗</small><i>うちNaS管理 3店舗</i></div>
              </section>

              <section className="metric-grid primary-metrics">
                <MetricCard label="アッタ月間売上" value={yen.format(totals.attaRevenue)} helper={`年間 ${compactYen(totals.attaRevenue * 12)}`} formula="5店舗のガリバー売上合計" />
                <MetricCard label="アッタ月間直接粗利" value={yen.format(totals.attaGross)} helper={`直接粗利率 ${percent.format(totals.attaGross / totals.attaRevenue)}`} tone="blue" formula="売上 − NaSまたは直接スタッフ支払" />
                <MetricCard label="NaS月間受取" value={yen.format(totals.nasRevenue)} helper="NaS管理3店舗のみ" tone="cyan" />
                <MetricCard label="NaS用具費控除後利益" value={yen.format(totals.nasContribution)} helper={`利益率 ${percent.format(totals.nasContribution / totals.nasRevenue)}`} tone="green" formula="NaS直接粗利 − 3店舗 × 月間用具費" />
              </section>
              <section className="operations-strip">
                <div><span>月間仕上げ</span><strong>{number.format(totals.finishing)}台</strong></div>
                <div><span>月間撮影</span><strong>{number.format(totals.photo)}台</strong></div>
                <div><span>月間リチェック</span><strong>{number.format(totals.recheck)}台</strong></div>
                <div><span>NaS月間用具費（既存）</span><strong>{yen.format(totals.nasSupply)}</strong></div>
                <div><span>NaS年間用具費（既存）</span><strong>{yen.format(totals.nasSupply * 12)}</strong></div>
              </section>

              <SectionTitle eyebrow="NEW STORE ECONOMICS" title={`追加${inputs.storeCount}店舗の投資・回収見通し`} action={<button className="text-button" onClick={() => setTab("simulator")}>条件を変更 →</button>} />
              <section className="metric-grid secondary-metrics">
                <MetricCard label="スターターキット投資額" value={yen.format(expansion.starterKitInvestment)} helper={`1店舗 ${yen.format(settings.operatingCosts.attaStarterKitCostPerStore)}`} tone="amber" />
                <MetricCard label="投資回収月数" value={`${number.format(expansion.paybackMonths)}か月`} helper="1店舗当たり月間直接粗利で回収" tone="violet" />
                <MetricCard label="初年度キャッシュ利益" value={yen.format(expansion.firstYearCashProfit)} helper="年間直接粗利 − 初期投資" tone="blue" />
                <MetricCard label="NaS月間用具費（総額）" value={yen.format(totalNasStores * settings.operatingCosts.nasMonthlySupplyCostPerStore)} helper={`既存3＋新規${inputs.storeCount}店舗／年 ${compactYen(totalNasStores * settings.operatingCosts.nasMonthlySupplyCostPerStore * 12)}`} tone="cyan" />
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
                  <p className="panel-note">NaSを介さない八王子・一宮は、直接スタッフ支払としてアッタ原価に計上しています。</p>
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
                  <li>八王子は月平均実績売上・実績原価を優先</li><li>一宮は既存実績を基に新運用へ移行</li><li>NaSは現在3店舗のみを管理</li><li>撮影は仕上げ担当、リチェック＋登録は専任担当</li><li>リチェック換算率は初期値0.75、枠ごとに固定レンジを適用</li><li>本部人件費・交通費・保険・採用費などは未控除</li>
                </ul>
              </section>
              <FormulaDetails />
            </>
          ) : null}

          {tab === "stores" ? <StoresView financials={financials} selected={selectedFinancial} setSelected={setSelectedStore} settings={settings} /> : null}
          {tab === "cashflow" ? <CashFlowView months={cashMonths} setMonths={setCashMonths} mode={deploymentMode} setMode={setDeploymentMode} flow={cashFlow} simultaneous={simultaneous} phased={phased} simSummary={simSummary} phasedSummary={phasedSummary} investment={expansion.starterKitInvestment} /> : null}
          {tab === "simulator" ? <SimulatorView inputs={inputs} updateInputs={updateInputs} expansion={expansion} settings={settings} setSettings={setSettings} /> : null}
          {tab === "settings" ? <SettingsView settings={settings} setSettings={setSettings} updateOperating={updateOperating} updatePrice={updatePrice} /> : null}
        </div>
      </main>
    </div>
  );
}

function StoresView({ financials, selected, setSelected, settings }: { financials: StoreFinancials[]; selected: StoreFinancials; setSelected: (id: string) => void; settings: SimulationSettings }) {
  const monthlyKitExpense = starterKitMonthlyExpense(settings.operatingCosts.attaStarterKitCostPerStore, settings.operatingCosts.starterKitAccountingMethod);
  return <>
    <SectionTitle eyebrow="STORE PORTFOLIO" title="店舗別収益と投資回収" />
    <div className="store-chips">{financials.map((item) => <button key={item.store.id} className={selected.store.id === item.store.id ? "active" : ""} onClick={() => setSelected(item.store.id)}><span className={`status-dot ${item.store.category}`} />{item.store.shortName}<small>{item.store.managedByNas ? "NaS管理" : "直接運営"}</small></button>)}</div>
    <div className="detail-grid">
      <section className="panel store-profile">
        <div className="store-header"><div><span className={`category-label ${selected.store.category}`}>{selected.store.category === "actual" ? "実績" : selected.store.category === "transition" ? "移行中" : "想定"}</span><h1>{selected.store.name}</h1><p>{selected.store.managedByNas ? "NaS管理対象店舗" : "アッタデザイン直接運営"}</p></div><div className="inventory"><strong>{selected.store.displayInventory ?? "—"}</strong><span>MAX展示数</span></div></div>
        <div className="detail-kpis"><div><span>仕上げ</span><strong>{number.format(selected.store.finishingCount)}台</strong></div><div><span>水洗い</span><strong>{number.format(selected.store.washCount)}台</strong></div><div><span>撮影</span><strong>{number.format(selected.store.photoCount)}台</strong></div><div><span>リチェック</span><strong>{number.format(selected.store.recheckCount)}台</strong></div><div><span>担当／枠</span><strong>{selected.store.recheckWorkers}名／{selected.store.recheckSlots}枠</strong></div></div>
        <div className="note-columns"><div><span>現状・課題</span>{selected.store.notes.map((note) => <p key={note}>• {note}</p>)}</div><div><span>改善余地</span>{selected.store.opportunities.map((note) => <p key={note}>• {note}</p>)}</div></div>
      </section>
      <section className="panel financial-stack">
        <h3>アッタデザイン</h3><div><span>売上</span><strong>{yen.format(selected.attaRevenue)}</strong></div><div><span>NaS／直接スタッフ支払</span><strong>− {yen.format(selected.attaDirectCost)}</strong></div><div className="profit"><span>直接粗利</span><strong>{yen.format(selected.attaGrossProfit)}</strong></div><div><span>直接粗利率</span><strong>{percent.format(selected.attaGrossMargin)}</strong></div>
        {selected.store.managedByNas ? <><h3>NaS</h3><div><span>受取額</span><strong>{yen.format(selected.nasRevenue)}</strong></div><div><span>スタッフ支払</span><strong>− {yen.format(selected.nasStaffCost)}</strong></div><div><span>月次用具費</span><strong>− {yen.format(selected.nasSupplyCost)}</strong></div><div className="profit green"><span>用具費控除後利益</span><strong>{yen.format(selected.nasContributionProfit)}</strong></div></> : null}
      </section>
    </div>
    <section className="metric-grid secondary-metrics">
      <MetricCard label="スターターキット" value="導入済み" helper={`${yen.format(selected.store.starterKitCost)}／${selected.store.openingMonth}`} tone="green" />
      <MetricCard label="初期投資回収" value="回収済み" helper="既存店のため将来追加投資から除外" tone="blue" />
      <MetricCard label="累計粗利（年換算）" value={yen.format(selected.annualAttaGrossProfit)} helper="月間直接粗利 × 12" tone="violet" />
      <MetricCard label="投資回収率（年換算）" value={percent.format(selected.annualAttaGrossProfit / selected.store.starterKitCost)} helper={`会計表示月額 ${yen.format(monthlyKitExpense)}`} tone="amber" />
    </section>
    <div className="two-column">
      <section className="panel"><SectionTitle eyebrow="PAYBACK" title="店舗別 投資回収期間" /><BarComparison rows={financials.map((item) => ({ label: item.store.shortName, primary: settings.operatingCosts.attaStarterKitCostPerStore / Math.max(1, item.attaGrossProfit), accent: "blue" }))} valueLabel={(value) => `${number.format(value)}か月`} /></section>
      <section className="panel"><SectionTitle eyebrow="NaS CONTRIBUTION" title="NaS直接粗利と用具費控除後利益" /><div className="legend"><span><i className="legend-blue" />直接粗利</span><span><i className="legend-green" />用具費控除後</span></div><BarComparison rows={financials.filter((item) => item.store.managedByNas).map((item) => ({ label: item.store.shortName, primary: item.nasGrossProfit, secondary: item.nasContributionProfit, secondaryAccent: "green" as const }))} /></section>
    </div>
    <section className="panel table-panel"><SectionTitle eyebrow="ALL STORES" title="店舗別比較表" /><div className="table-scroll"><table><thead><tr><th>店舗</th><th>区分</th><th>売上</th><th>直接原価</th><th>アッタ粗利</th><th>粗利率</th><th>NaS粗利</th><th>用具費後NaS利益</th><th>仕上げ</th><th>水洗い</th><th>撮影</th><th>リチェック</th></tr></thead><tbody>{financials.map((item) => <tr key={item.store.id}><td><button className="table-link" onClick={() => setSelected(item.store.id)}>{item.store.name}</button></td><td>{item.store.category === "actual" ? "実績" : item.store.category === "transition" ? "移行" : "想定"}</td><td>{yen.format(item.attaRevenue)}</td><td>{yen.format(item.attaDirectCost)}</td><td>{yen.format(item.attaGrossProfit)}</td><td>{percent.format(item.attaGrossMargin)}</td><td>{item.store.managedByNas ? yen.format(item.nasGrossProfit) : "—"}</td><td>{item.store.managedByNas ? yen.format(item.nasContributionProfit) : "—"}</td><td>{number.format(item.store.finishingCount)}</td><td>{number.format(item.store.washCount)}</td><td>{number.format(item.store.photoCount)}</td><td>{number.format(item.store.recheckCount)}</td></tr>)}</tbody></table></div></section>
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
        <h3>契約条件</h3><div className="form-grid"><NumberInput label="リチェック換算率" value={settings.recheckConversionRate} onChange={(value) => setSettings((current: SimulationSettings) => ({ ...current, recheckConversionRate: value }))} step={0.05} /><SelectField label="表示税区分" value={settings.taxMode} onChange={(value) => setSettings((current: SimulationSettings) => ({ ...current, taxMode: value as TaxMode }))}><option value="taxExclusive">契約税抜ベース</option><option value="taxIncluded">契約税込ベース</option></SelectField></div>
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
    { key: "client", title: "ガリバー → アッタ", fields: [["normalFinishingWithPhoto", "通常仕上げ＋撮影"], ["wash", "水洗い"], ["recheckBaseMonthlyFee", "リチェック基準月額"], ["recheckAdjustmentUnitPrice", "超過・減額単価"]] },
    { key: "attaToNas", title: "アッタ → NaS", fields: [["normalFinishing", "通常仕上げ"], ["wash", "水洗い"], ["photo", "撮影"], ["recheck", "リチェック＋登録"]] },
    { key: "nasToWorker", title: "NaS → スタッフ", fields: [["normalFinishing", "通常仕上げ"], ["wash", "水洗い"], ["photo", "撮影"], ["recheck", "リチェック＋登録"]] },
  ];
  return <>
    <SectionTitle eyebrow="MODEL SETTINGS" title="事業前提・単価設定" />
    <div className="settings-intro"><strong>青い入力欄は変更可能です。</strong><span>変更内容はサマリー、店舗別、キャッシュフロー、シミュレーターへ即時反映されます。</span></div>
    <section className="panel"><SectionTitle eyebrow="OPERATING COST" title="初期投資・用具費" /><div className="form-grid settings-grid"><NumberInput label="アッタ スターターキット／店" value={settings.operatingCosts.attaStarterKitCostPerStore} onChange={(value) => updateOperating("attaStarterKitCostPerStore", value)} suffix="円" step={10_000} /><NumberInput label="NaS 月間用具費／管理店" value={settings.operatingCosts.nasMonthlySupplyCostPerStore} onChange={(value) => updateOperating("nasMonthlySupplyCostPerStore", value)} suffix="円" step={1_000} /><SelectField label="スターターキット会計表示" value={settings.operatingCosts.starterKitAccountingMethod} onChange={(value) => updateOperating("starterKitAccountingMethod", value as StarterKitAccountingMethod)}><option value="cash">一括費用計上</option><option value="amortize12">12か月按分</option><option value="amortize24">24か月按分</option><option value="amortize36">36か月按分</option></SelectField><NumberInput label="会計表示上の月額" value={starterKitMonthlyExpense(settings.operatingCosts.attaStarterKitCostPerStore, settings.operatingCosts.starterKitAccountingMethod)} onChange={() => {}} suffix="円/月" step={1} /></div><p className="panel-note">キャッシュフローでは会計表示方法にかかわらず、開設月にスターターキット全額を支出します。</p></section>
    <section className="panel"><SectionTitle eyebrow="RECHECK CONTRACT" title="リチェック＋登録契約" /><div className="form-grid settings-grid"><NumberInput label="換算率" value={settings.recheckConversionRate} onChange={(value) => setSettings((current: SimulationSettings) => ({ ...current, recheckConversionRate: value }))} step={0.05} /><NumberInput label="固定レンジ下限" value={settings.pricing.client.recheckLowerUnits} onChange={(value) => updatePrice("client", "recheckLowerUnits", value)} suffix="換算台" /><NumberInput label="固定レンジ上限" value={settings.pricing.client.recheckUpperUnits} onChange={(value) => updatePrice("client", "recheckUpperUnits", value)} suffix="換算台" /><SelectField label="表示税区分" value={settings.taxMode} onChange={(value) => setSettings((current: SimulationSettings) => ({ ...current, taxMode: value as TaxMode }))}><option value="taxExclusive">税抜</option><option value="taxIncluded">税込（10%）</option></SelectField></div></section>
    <div className="price-group-grid">{priceGroups.map((group) => <section className="panel" key={group.key}><h3>{group.title}</h3>{group.fields.map(([key, label]) => <NumberInput key={key} label={label} value={(settings.pricing as any)[group.key][key]} onChange={(value) => updatePrice(group.key, key, value)} suffix="円" step={key === "recheckAdjustmentUnitPrice" ? 0.001 : 100} />)}</section>)}</div>
    <section className="panel assumptions-table"><SectionTitle eyebrow="ASSUMPTION REGISTER" title="前提値一覧" /><div className="table-scroll"><table><thead><tr><th>区分</th><th>項目</th><th>初期値</th><th>扱い</th><th>根拠</th></tr></thead><tbody><tr><td>既存店</td><td>NaS管理店舗</td><td>3店舗</td><td>固定対象</td><td>新狭山・大宮・草加のみ</td></tr><tr><td>追加店</td><td>標準処理量</td><td>仕上げ150／水洗い300／撮影150／リチェック70</td><td>変更可</td><td>Excel標準店舗モデル</td></tr><tr><td>投資</td><td>スターターキット</td><td>{yen.format(settings.operatingCosts.attaStarterKitCostPerStore)}</td><td>開設月キャッシュアウト</td><td>ユーザー提示条件</td></tr><tr><td>継続費</td><td>NaS用具費</td><td>{yen.format(settings.operatingCosts.nasMonthlySupplyCostPerStore)}/管理店</td><td>毎月</td><td>ユーザー提示条件</td></tr><tr><td>会計</td><td>本部費用</td><td>未控除</td><td>モデル範囲外</td><td>直接粗利・営業貢献利益まで</td></tr></tbody></table></div></section>
  </>;
}
