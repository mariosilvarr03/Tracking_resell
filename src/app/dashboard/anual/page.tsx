import Link from "next/link";
import { supabaseServer } from "../../lib/supabase/server";

type ItemRow = {
  id: string;
  title: string;
  type: string;
  buy_date: string;
  buy_price: number;
  quantity: number;
  sold_quantity_total: number;
  status: "EM_STOCK" | "VENDIDO";
};

type SaleRow = {
  id: string;
  title: string;
  type: string;
  platform: string | null;
  buy_date: string;
  buy_unit_cost: number;
  sold_at: string;
  sold_quantity: number;
  sold_price: number;
  fees: number;
};

const MONTHS_SHORT = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

function startOfYear(year: number) {
  return `${year}-01-01`;
}

function startOfNextYear(year: number) {
  return `${year + 1}-01-01`;
}

function euro(value: number) {
  return `€ ${value.toFixed(2)}`;
}

function daysBetween(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default async function DashboardAnualPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const selectedYearRaw = typeof params.year === "string" ? Number(params.year) : currentYear;
  const selectedYear = Number.isInteger(selectedYearRaw) ? selectedYearRaw : currentYear;

  const yearStart = startOfYear(selectedYear);
  const yearEnd = startOfNextYear(selectedYear);

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Sessão inválida. Faz login novamente.</div>;
  }

  const [{ data: itemsData, error: itemsError }, { data: salesData, error: salesError }] = await Promise.all([
    supabase
      .from("items")
      .select("id, title, type, buy_date, buy_price, quantity, sold_quantity_total, status")
      .eq("user_id", user.id)
      .order("buy_date", { ascending: false }),
    supabase
      .from("v_sales_enriched")
      .select("id, title, type, platform, buy_date, buy_unit_cost, sold_at, sold_quantity, sold_price, fees")
      .eq("user_id", user.id)
      .gte("sold_at", yearStart)
      .lt("sold_at", yearEnd)
      .order("sold_at", { ascending: false }),
  ]);

  if (itemsError) return <div>Erro ao carregar dashboard anual: {itemsError.message}</div>;
  if (salesError) return <div>Erro ao carregar dashboard anual: {salesError.message}</div>;

  const items = (itemsData ?? []) as ItemRow[];
  const sales = (salesData ?? []) as SaleRow[];

  const boughtThisYear = items.filter((item) => item.buy_date >= yearStart && item.buy_date < yearEnd);

  const comprasAno = boughtThisYear.reduce((sum, item) => sum + Number(item.buy_price) * Number(item.quantity), 0);
  const vendasAno = sales.reduce((sum, sale) => sum + Number(sale.sold_price) * Number(sale.sold_quantity), 0);

  const lucroAno = sales.reduce((sum, sale) => {
    const soldQty = Number(sale.sold_quantity);
    const soldUnit = Number(sale.sold_price);
    const buyUnit = Number(sale.buy_unit_cost ?? 0);
    const freteUnit = Number(sale.fees ?? 0);
    return sum + (soldUnit - buyUnit - freteUnit) * soldQty;
  }, 0);

  const capitalPreso = items.reduce((sum, item) => {
    const stock = Number(item.quantity) - Number(item.sold_quantity_total);
    return stock > 0 ? sum + Number(item.buy_price) * stock : sum;
  }, 0);

  const holdMedioDias = sales.length
    ? sales.reduce((sum, sale) => sum + daysBetween(sale.buy_date ?? sale.sold_at, sale.sold_at), 0) / sales.length
    : 0;

  const monthly = Array.from({ length: 12 }).map((_, index) => {
    const month = index + 1;

    const monthSales = sales.filter((sale) => {
      const saleDate = new Date(sale.sold_at);
      return saleDate.getUTCFullYear() === selectedYear && saleDate.getUTCMonth() + 1 === month;
    });

    const lucro = monthSales.reduce((sum, sale) => {
      const soldQty = Number(sale.sold_quantity);
      const soldUnit = Number(sale.sold_price);
      const buyUnit = Number(sale.buy_unit_cost ?? 0);
      const freteUnit = Number(sale.fees ?? 0);
      return sum + (soldUnit - buyUnit - freteUnit) * soldQty;
    }, 0);

    const itensVendidos = monthSales.reduce((sum, sale) => sum + Number(sale.sold_quantity), 0);

    return { month, lucro, itensVendidos };
  });

  const bestMonth = monthly.reduce((best, current) => (current.lucro > best.lucro ? current : best), monthly[0]);
  const worstMonth = monthly.reduce((worst, current) => (current.lucro < worst.lucro ? current : worst), monthly[0]);

  const lucroPorCategoriaMap = sales.reduce<Record<string, number>>((acc, sale) => {
    const key = sale.type ?? "SEM_CATEGORIA";
    const soldQty = Number(sale.sold_quantity);
    const soldUnit = Number(sale.sold_price);
    const buyUnit = Number(sale.buy_unit_cost ?? 0);
    const freteUnit = Number(sale.fees ?? 0);
    const lucro = (soldUnit - buyUnit - freteUnit) * soldQty;
    acc[key] = (acc[key] ?? 0) + lucro;
    return acc;
  }, {});

  const lucroPorCategoriaEntries = Object.entries(lucroPorCategoriaMap).sort((a, b) => b[1] - a[1]);
  const topCategorias = lucroPorCategoriaEntries.slice(0, 5);
  const outrosValor = lucroPorCategoriaEntries.slice(5).reduce((sum, [, value]) => sum + value, 0);
  const lucroPorCategoria = outrosValor > 0 ? [...topCategorias, ["Outros", outrosValor] as [string, number]] : topCategorias;

  const capitalPorCategoria = Object.entries(
    items.reduce<Record<string, number>>((acc, item) => {
      const stock = Number(item.quantity) - Number(item.sold_quantity_total);
      if (stock <= 0) return acc;
      const key = item.type ?? "SEM_CATEGORIA";
      acc[key] = (acc[key] ?? 0) + Number(item.buy_price) * stock;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const vendasPorPlataforma = Object.entries(
    sales.reduce<Record<string, number>>((acc, sale) => {
      const platform = sale.platform ?? "-";
      acc[platform] = (acc[platform] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const topLucroRows = sales
    .map((sale) => {
      const soldQty = Number(sale.sold_quantity);
      const soldUnit = Number(sale.sold_price);
      const buyUnit = Number(sale.buy_unit_cost ?? 0);
      const freteUnit = Number(sale.fees ?? 0);
      const lucro = (soldUnit - buyUnit - freteUnit) * soldQty;
      return {
        id: sale.id,
        produto: sale.title ?? "-",
        data: sale.sold_at,
        lucro,
      };
    })
    .sort((a, b) => b.lucro - a.lucro)
    .slice(0, 10);

  const topRoiRows = sales
    .map((sale) => {
      const soldQty = Number(sale.sold_quantity);
      const soldUnit = Number(sale.sold_price);
      const buyUnit = Number(sale.buy_unit_cost ?? 0);
      const freteUnit = Number(sale.fees ?? 0);
      const lucro = (soldUnit - buyUnit - freteUnit) * soldQty;
      const compra = buyUnit * soldQty;
      const roi = compra > 0 ? (lucro / compra) * 100 : 0;
      return {
        id: sale.id,
        produto: sale.title ?? "-",
        compra,
        lucro,
        roi,
      };
    })
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 10);

  const maxLucroMes = Math.max(1, ...monthly.map((m) => Math.abs(m.lucro)));
  const maxItensVendidosMes = Math.max(1, ...monthly.map((m) => m.itensVendidos));
  const maxCat = Math.max(1, ...lucroPorCategoria.map(([, value]) => Math.abs(value)));
  const maxCapitalCat = Math.max(1, ...capitalPorCategoria.map(([, value]) => value));
  const maxPlatform = Math.max(1, ...vendasPorPlataforma.map(([, value]) => value));

  const yearOptions = Array.from({ length: 8 }).map((_, index) => currentYear - index);

  return (
    <div className="dashboard-page dashboard-anual">
      <div className="topbar">
        <div>
          <h1>Dashboard Anual</h1>
          <p>
            Ano selecionado: <strong>{selectedYear}</strong> ({yearStart} → {yearEnd})
          </p>
        </div>

        <form className="month-form" method="get">
          <select name="year" defaultValue={String(selectedYear)}>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-light">
            Aplicar
          </button>
          <Link href="/dashboard/mensal" className="btn-link">
            Dashboard Mensal
          </Link>
          <Link href="/dashboard/global" className="btn-link">
            Dashboard Global
          </Link>
          <Link href="/inventario" className="btn-link">
            Inventário
          </Link>
        </form>
      </div>

      <div className="cards-grid cards-grid-5">
        <div className="metric-card"><span>Compras no ano</span><strong>{euro(comprasAno)}</strong></div>
        <div className="metric-card"><span>Vendas no ano</span><strong>{euro(vendasAno)}</strong></div>
        <div className="metric-card"><span>Lucro no ano</span><strong>{euro(lucroAno)}</strong></div>
        <div className="metric-card"><span>Capital preso</span><strong>{euro(capitalPreso)}</strong></div>
        <div className="metric-card"><span>Hold médio (vendidos no ano)</span><strong>{holdMedioDias.toFixed(1)} dias</strong></div>
      </div>

      <div className="two-col">
        <section className="panel">
          <h3>Melhor mês (lucro)</h3>
          <div className="kpi-month-row">{MONTHS_SHORT[bestMonth.month - 1]} — {euro(bestMonth.lucro)}</div>
        </section>
        <section className="panel">
          <h3>Pior mês (lucro)</h3>
          <div className="kpi-month-row">{MONTHS_SHORT[worstMonth.month - 1]} — {euro(worstMonth.lucro)}</div>
        </section>
      </div>

      <section className="panel">
        <h3>Lucro por mês</h3>
        <p className="muted">Soma do lucro dos itens vendidos em cada mês</p>
        <div className="panel-body">
          <div className="month-bars-grid">
            {monthly.map((row) => {
              const percent = clamp((Math.abs(row.lucro) / maxLucroMes) * 100, 0, 100);
              const hasValue = row.lucro > 0;
              return (
                <div key={row.month} className="month-bar-col" title={euro(row.lucro)}>
                  <div className="month-bar-value">{hasValue ? euro(row.lucro) : "—"}</div>
                  <div className="month-bar-track">
                    <div className="month-bar-fill" style={{ height: hasValue ? `${Math.max(16, percent)}%` : "0%" }} />
                  </div>
                  <div className="month-bar-label">{MONTHS_SHORT[row.month - 1]}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="two-col">
        <section className="panel">
          <h3>Itens vendidos por mês</h3>
          <p className="muted">Quantidade total vendida em cada mês</p>
          <div className="panel-body">
            <div className="month-bars-grid">
              {monthly.map((row) => {
                const hasValue = row.itensVendidos > 0;
                const percent = (row.itensVendidos / maxItensVendidosMes) * 100;
                return (
                  <div key={row.month} className="month-bar-col" title={`${row.itensVendidos} item(s)`}>
                    <div className="month-bar-value">{hasValue ? row.itensVendidos : "—"}</div>
                    <div className="month-bar-track">
                      <div className="month-bar-fill" style={{ height: hasValue ? `${Math.max(16, percent)}%` : "0%" }} />
                    </div>
                    <div className="month-bar-label">{MONTHS_SHORT[row.month - 1]}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="panel">
          <h3>Lucro por categoria</h3>
          <p className="muted">Top 5 + Outros (no ano)</p>
          <div className="panel-body">
            {lucroPorCategoria.length === 0 ? (
              <p className="muted">Sem dados no ano.</p>
            ) : (
              lucroPorCategoria.map(([name, value]) => (
                <div key={name} className="bar-row">
                  <div className="bar-head"><strong>{name}</strong><span>{euro(value)}</span></div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, (Math.abs(value) / maxCat) * 100)}%` }} /></div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="two-col">
        <section className="panel">
          <h3>Capital preso por categoria</h3>
          <p className="muted">Somatório de EM_STOCK (top 8)</p>
          <div className="panel-body">
            {capitalPorCategoria.length === 0 ? (
              <p className="muted">Sem stock em aberto.</p>
            ) : (
              capitalPorCategoria.map(([name, value]) => (
                <div key={name} className="bar-row">
                  <div className="bar-head"><strong>{name}</strong><span>{euro(value)}</span></div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, (value / maxCapitalCat) * 100)}%` }} /></div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <h3>Vendas por plataforma</h3>
          <p className="muted">Nº de vendas no ano por plataforma</p>
          <div className="panel-body">
            {vendasPorPlataforma.length === 0 ? (
              <p className="muted">Sem dados no ano.</p>
            ) : (
              vendasPorPlataforma.map(([name, count]) => (
                <div key={name} className="bar-row">
                  <div className="bar-head"><strong>{name}</strong><span>{count}</span></div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, (count / maxPlatform) * 100)}%` }} /></div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="two-col">
        <section className="panel">
          <h3>Top vendidos (por lucro)</h3>
          <p className="muted">Top 10 itens vendidos neste ano</p>
          <table>
            <thead><tr><th>Produto</th><th>Data</th><th>Lucro</th></tr></thead>
            <tbody>
              {topLucroRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.produto}</td>
                  <td>{row.data}</td>
                  <td>{euro(row.lucro)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h3>Top vendidos (por ROI)</h3>
          <p className="muted">ROI = lucro / compra (top 10 no ano)</p>
          <table>
            <thead><tr><th>Produto</th><th>Compra</th><th>Lucro</th><th>ROI</th></tr></thead>
            <tbody>
              {topRoiRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.produto}</td>
                  <td>{euro(row.compra)}</td>
                  <td>{euro(row.lucro)}</td>
                  <td>{row.roi.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
