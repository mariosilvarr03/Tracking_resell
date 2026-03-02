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

function euro(value: number) {
  return `€ ${value.toFixed(2)}`;
}

function daysBetween(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export default async function DashboardGlobalPage() {
  const supabase = await supabaseServer();

  const [{ data: itemsData, error: itemsError }, { data: salesData, error: salesError }] = await Promise.all([
    supabase
      .from("items")
      .select("id, title, type, buy_date, buy_price, quantity, sold_quantity_total, status")
      .order("buy_date", { ascending: false }),
    supabase
      .from("v_sales_enriched")
      .select("id, title, type, platform, buy_date, buy_unit_cost, sold_at, sold_quantity, sold_price, fees")
      .order("sold_at", { ascending: false }),
  ]);

  if (itemsError) return <div>Erro ao carregar dashboard global: {itemsError.message}</div>;
  if (salesError) return <div>Erro ao carregar dashboard global: {salesError.message}</div>;

  const items = (itemsData ?? []) as ItemRow[];
  const sales = (salesData ?? []) as SaleRow[];

  const comprasTotal = items.reduce((sum, item) => sum + Number(item.buy_price) * Number(item.quantity), 0);
  const vendasTotal = sales.reduce((sum, sale) => sum + Number(sale.sold_price) * Number(sale.sold_quantity), 0);

  const lucroTotal = sales.reduce((sum, sale) => {
    const soldQty = Number(sale.sold_quantity);
    const soldUnit = Number(sale.sold_price);
    const buyUnit = Number(sale.buy_unit_cost ?? 0);
    const freteUnit = Number(sale.fees ?? 0);
    return sum + (soldUnit - buyUnit - freteUnit) * soldQty;
  }, 0);

  const profitMargin = vendasTotal > 0 ? (lucroTotal / vendasTotal) * 100 : 0;
  const roi = comprasTotal > 0 ? (lucroTotal / comprasTotal) * 100 : 0;

  const capitalPreso = items.reduce((sum, item) => {
    const stock = Number(item.quantity) - Number(item.sold_quantity_total);
    return stock > 0 ? sum + Number(item.buy_price) * stock : sum;
  }, 0);

  const holdMedioDias = sales.length
    ? sales.reduce((sum, sale) => sum + daysBetween(sale.buy_date ?? sale.sold_at, sale.sold_at), 0) / sales.length
    : 0;

  const lucroPorPlataforma = Object.entries(
    sales.reduce<Record<string, number>>((acc, sale) => {
      const platform = sale.platform ?? "-";
      const soldQty = Number(sale.sold_quantity);
      const soldUnit = Number(sale.sold_price);
      const buyUnit = Number(sale.buy_unit_cost ?? 0);
      const freteUnit = Number(sale.fees ?? 0);
      const lucro = (soldUnit - buyUnit - freteUnit) * soldQty;
      acc[platform] = (acc[platform] ?? 0) + lucro;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

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
      const roiItem = compra > 0 ? (lucro / compra) * 100 : 0;
      return {
        id: sale.id,
        produto: sale.title ?? "-",
        compra,
        lucro,
        roi: roiItem,
      };
    })
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 10);

  const lucroPorCategoria = Object.entries(
    sales.reduce<Record<string, number>>((acc, sale) => {
      const category = sale.type ?? "SEM_CATEGORIA";
      const soldQty = Number(sale.sold_quantity);
      const soldUnit = Number(sale.sold_price);
      const buyUnit = Number(sale.buy_unit_cost ?? 0);
      const freteUnit = Number(sale.fees ?? 0);
      const lucro = (soldUnit - buyUnit - freteUnit) * soldQty;
      acc[category] = (acc[category] ?? 0) + lucro;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const maxLucroPlataforma = Math.max(1, ...lucroPorPlataforma.map(([, value]) => Math.abs(value)));
  const maxVendasPlataforma = Math.max(1, ...vendasPorPlataforma.map(([, value]) => value));
  const maxLucroCategoria = Math.max(1, ...lucroPorCategoria.map(([, value]) => Math.abs(value)));

  return (
    <div className="dashboard-page dashboard-global">
      <div className="topbar">
        <div>
          <h1>Dashboard Global</h1>
          <p>Resumo all-time (desde o início).</p>
        </div>

        <div className="month-form">
          <Link href="/dashboard/mensal" className="btn-link">Dashboard Mensal</Link>
          <Link href="/dashboard/anual" className="btn-link">Dashboard Anual</Link>
          <Link href="/inventario" className="btn-link">Inventário</Link>
        </div>
      </div>

      <div className="cards-grid cards-grid-7">
        <div className="metric-card"><span>Compras total</span><strong>{euro(comprasTotal)}</strong></div>
        <div className="metric-card"><span>Vendas total</span><strong>{euro(vendasTotal)}</strong></div>
        <div className="metric-card"><span>Lucro total</span><strong>{euro(lucroTotal)}</strong></div>
        <div className="metric-card"><span>Profit margin</span><strong>{profitMargin.toFixed(1)}%</strong></div>
        <div className="metric-card"><span>ROI (lucro/compras)</span><strong>{roi.toFixed(1)}%</strong></div>
        <div className="metric-card"><span>Capital preso</span><strong>{euro(capitalPreso)}</strong></div>
        <div className="metric-card"><span>Hold médio (vendidos)</span><strong>{holdMedioDias.toFixed(1)} dias</strong></div>
      </div>

      <div className="two-col">
        <section className="panel">
          <h3>Lucro por plataforma</h3>
          <p className="muted">Somatório do lucro por plataforma (all-time)</p>
          <div className="panel-body">
            {lucroPorPlataforma.length === 0 ? (
              <p className="muted">Sem dados globais.</p>
            ) : (
              lucroPorPlataforma.map(([name, value]) => (
                <div key={name} className="bar-row">
                  <div className="bar-head"><strong>{name}</strong><span>{euro(value)}</span></div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, (Math.abs(value) / maxLucroPlataforma) * 100)}%` }} /></div>
                </div>
              ))
            )}
          </div>

          <p className="muted">Extra: nº vendas por plataforma</p>
          <div className="panel-body">
            {vendasPorPlataforma.length === 0 ? (
              <p className="muted">Sem dados globais.</p>
            ) : (
              vendasPorPlataforma.map(([name, value]) => (
                <div key={name} className="bar-row">
                  <div className="bar-head"><strong>{name}</strong><span>{value}</span></div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, (value / maxVendasPlataforma) * 100)}%` }} /></div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <h3>Top 10 vendas (por lucro)</h3>
          <p className="muted">Top 10 itens vendidos all-time</p>
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
      </div>

      <div className="two-col">
        <section className="panel">
          <h3>Lucro por categoria</h3>
          <p className="muted">Somatório do lucro por categoria (all-time)</p>
          <div className="panel-body">
            {lucroPorCategoria.length === 0 ? (
              <p className="muted">Sem dados globais.</p>
            ) : (
              lucroPorCategoria.map(([name, value]) => (
                <div key={name} className="bar-row">
                  <div className="bar-head"><strong>{name}</strong><span>{euro(value)}</span></div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, (Math.abs(value) / maxLucroCategoria) * 100)}%` }} /></div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <h3>Top 10 vendas (por ROI)</h3>
          <p className="muted">ROI = lucro / compra (all-time)</p>
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
