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

function monthLabel(yyyyMm: string) {
  const [year, month] = yyyyMm.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  const label = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(date);
  return label;
}

function toISODate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addMonths(yyyyMm: string, delta: number) {
  const [year, month] = yyyyMm.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function daysBetween(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function euro(value: number) {
  return `€ ${value.toFixed(2)}`;
}

export default async function DashboardMensalPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const now = new Date();
  const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const selectedMonthRaw = typeof params.month === "string" ? params.month : defaultMonth;
  const selectedMonth = /^\d{4}-\d{2}$/.test(selectedMonthRaw) ? selectedMonthRaw : defaultMonth;

  const monthStart = `${selectedMonth}-01`;
  const nextMonth = addMonths(selectedMonth, 1);
  const monthEnd = `${nextMonth}-01`;

  const supabase = await supabaseServer();

  const [{ data: itemsData, error: itemsError }, { data: salesData, error: salesError }] = await Promise.all([
    supabase
      .from("items")
      .select("id, title, type, buy_date, buy_price, quantity, sold_quantity_total, status")
      .order("buy_date", { ascending: false }),
    supabase
      .from("v_sales_enriched")
      .select("id, title, type, platform, buy_date, buy_unit_cost, sold_at, sold_quantity, sold_price, fees")
      .gte("sold_at", monthStart)
      .lt("sold_at", monthEnd)
      .order("sold_at", { ascending: false }),
  ]);

  if (itemsError) return <div>Erro ao carregar dashboard: {itemsError.message}</div>;
  if (salesError) return <div>Erro ao carregar dashboard: {salesError.message}</div>;

  const items = (itemsData ?? []) as ItemRow[];
  const sales = (salesData ?? []) as SaleRow[];

  const boughtThisMonth = items.filter((item) => item.buy_date >= monthStart && item.buy_date < monthEnd);

  const comprasMes = boughtThisMonth.reduce((sum, item) => sum + Number(item.buy_price) * Number(item.quantity), 0);

  const vendasMes = sales.reduce(
    (sum, sale) => sum + Number(sale.sold_price) * Number(sale.sold_quantity),
    0
  );

  const lucroMes = sales.reduce((sum, sale) => {
    const soldQty = Number(sale.sold_quantity);
    const soldUnit = Number(sale.sold_price);
    const buyUnit = Number(sale.buy_unit_cost ?? 0);
    const freteUnit = Number(sale.fees ?? 0);
    const lucroPorProduto = soldUnit - buyUnit - freteUnit;
    return sum + lucroPorProduto * soldQty;
  }, 0);

  const capitalPreso = items.reduce((sum, item) => {
    const stock = Number(item.quantity) - Number(item.sold_quantity_total);
    return stock > 0 ? sum + Number(item.buy_price) * stock : sum;
  }, 0);

  const holdMedioDias = sales.length
    ? sales.reduce((sum, sale) => sum + daysBetween(sale.buy_date ?? sale.sold_at, sale.sold_at), 0) / sales.length
    : 0;

  const itensVendidosMes = sales.reduce((sum, sale) => sum + Number(sale.sold_quantity), 0);

  const vendasPorCategoria = Object.entries(
    sales.reduce<Record<string, number>>((acc, sale) => {
      const key = sale.type ?? "SEM_CATEGORIA";
      const soldQty = Number(sale.sold_quantity);
      const soldUnit = Number(sale.sold_price);
      const totalVendidoCategoria = soldUnit * soldQty;
      acc[key] = (acc[key] ?? 0) + totalVendidoCategoria;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const holdAlerts = items.filter((item) => {
    const stock = Number(item.quantity) - Number(item.sold_quantity_total);
    if (stock <= 0) return false;
    return daysBetween(item.buy_date, toISODate(now)) >= 30;
  });

  const vendidosRows = sales.slice(0, 6).map((sale) => {
    const soldQty = Number(sale.sold_quantity);
    const soldUnit = Number(sale.sold_price);
    const saleTotal = soldUnit * soldQty;
    const buyUnit = Number(sale.buy_unit_cost ?? 0);
    const freteUnit = Number(sale.fees ?? 0);
    const lucroTotal = (soldUnit - buyUnit - freteUnit) * soldQty;
    const custoTotal = buyUnit * soldQty;
    const roi = custoTotal > 0 ? (lucroTotal / custoTotal) * 100 : 0;
    const hold = daysBetween(sale.buy_date ?? sale.sold_at, sale.sold_at);

    return {
      id: sale.id,
      produto: sale.title ?? "-",
      venda: `${euro(saleTotal)} (${sale.sold_at})`,
      lucro: lucroTotal,
      roi,
      hold,
    };
  });

  const plataformaCounts = Object.entries(
    sales.reduce<Record<string, number>>((acc, sale) => {
      const platformName = sale.platform ?? "-";
      acc[platformName] = (acc[platformName] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const maxCat = Math.max(1, ...vendasPorCategoria.map(([, value]) => Math.abs(value)));
  const maxPlat = Math.max(1, ...plataformaCounts.map(([, value]) => value));

  const monthOptions = Array.from({ length: 12 }).map((_, idx) => addMonths(defaultMonth, -idx));

  return (
    <div className="dashboard-page">
      <div className="topbar">
        <div>
          <h1>Dashboard</h1>
          <p>
            Mês selecionado: <strong>{monthLabel(selectedMonth)}</strong> ({monthStart} → {monthEnd})
          </p>
        </div>

        <form className="month-form" method="get">
          <select name="month" defaultValue={selectedMonth}>
            {monthOptions.map((value) => (
              <option key={value} value={value}>
                {monthLabel(value)}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-light">Aplicar</button>
          <Link href="/inventario/nova-compra" className="btn-dark">+ Nova Compra</Link>
          <Link href="/inventario" className="btn-link">Ver Inventário</Link>
        </form>
      </div>

      <div className="cards-grid">
        <div className="metric-card"><span>Compras do mês</span><strong>{euro(comprasMes)}</strong></div>
        <div className="metric-card"><span>Vendas do mês</span><strong>{euro(vendasMes)}</strong></div>
        <div className="metric-card"><span>Lucro do mês</span><strong>{euro(lucroMes)}</strong></div>
        <div className="metric-card"><span>Capital preso</span><strong>{euro(capitalPreso)}</strong></div>
        <div className="metric-card"><span>Hold médio (vendidos no mês)</span><strong>{holdMedioDias.toFixed(1)} dias</strong></div>
        <div className="metric-card"><span>Itens vendidos no mês</span><strong>{itensVendidosMes}</strong></div>
      </div>

      <div className="two-col">
        <section className="panel">
          <h3>Vendas por categoria</h3>
          <p className="muted">Top categorias por valor total vendido no mês</p>
          <div className="panel-body">
            {vendasPorCategoria.length === 0 ? (
              <p className="muted">Sem dados no mês.</p>
            ) : (
              vendasPorCategoria.map(([name, value]) => (
                <div key={name} className="bar-row">
                  <div className="bar-head"><strong>{name}</strong><span>{euro(value)}</span></div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, (Math.abs(value) / maxCat) * 100)}%` }} /></div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <h3>Hold alerts</h3>
          <p className="muted">Items em stock há ≥ 30 dias</p>
          <div className="panel-body">
            {holdAlerts.length === 0 ? (
              <p className="muted">Sem itens acima do threshold.</p>
            ) : (
              <ul className="simple-list">
                {holdAlerts.slice(0, 6).map((item) => (
                  <li key={item.id}>{item.title} — {daysBetween(item.buy_date, toISODate(now))} dias</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <div className="two-col">
        <section className="panel">
          <h3>Comprados neste mês</h3>
          <p className="muted">{boughtThisMonth.length} item(s)</p>
          <table>
            <thead><tr><th>Produto</th><th>Data</th><th>Preço</th><th>Status</th></tr></thead>
            <tbody>
              {boughtThisMonth.slice(0, 8).map((item) => {
                const stock = item.quantity - item.sold_quantity_total;
                const status = stock > 0 ? "EM_STOCK" : "VENDIDO";
                return (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{item.buy_date}</td>
                    <td>{euro(item.buy_price)}</td>
                    <td>{status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h3>Vendidos neste mês</h3>
          <p className="muted">{sales.length} item(s)</p>
          <table>
            <thead><tr><th>Produto</th><th>Venda</th><th>Lucro</th><th>ROI</th><th>Hold</th></tr></thead>
            <tbody>
              {vendidosRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.produto}</td>
                  <td>{row.venda}</td>
                  <td>{euro(row.lucro)}</td>
                  <td>{row.roi.toFixed(1)}%</td>
                  <td>{row.hold} dias</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="panel">
        <h3>Vendas por plataforma</h3>
        <p className="muted">Nº de vendas no mês por plataforma</p>
        <div className="panel-body">
          {plataformaCounts.length === 0 ? (
            <p className="muted">Sem dados no mês.</p>
          ) : (
            plataformaCounts.map(([name, count]) => (
              <div key={name} className="bar-row">
                <div className="bar-head"><strong>{name}</strong><span>{count}</span></div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(count / maxPlat) * 100}%` }} /></div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
