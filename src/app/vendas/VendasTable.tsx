"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "../lib/supabase/client";

type SaleRow = {
  id: string;
  title: string;
  type: string;
  platform: string | null;
  sold_at: string;
  sold_quantity: number;
  sold_price: number;
  fees: number;
  buy_unit_cost: number;
};

type VendasTableProps = {
  sales: SaleRow[];
  initialFilters: {
    query: string;
    category: string;
    platform: string;
    orderBy: string;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

const basePlatforms = ["vinted", "olx", "lolapop", "viagogo", "stubhub", "ebay", "cardmarket"];

function escapeCsvCell(value: string | number | null | undefined) {
  const normalized = String(value ?? "").replace(/"/g, '""');
  return `"${normalized}"`;
}

function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map((value) => escapeCsvCell(value)).join(";")).join("\n");
}

function getVisiblePages(currentPage: number, totalPages: number): Array<number | "dots-left" | "dots-right"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: Array<number | "dots-left" | "dots-right"> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    pages.push("dots-left");
  }

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (end < totalPages - 1) {
    pages.push("dots-right");
  }

  pages.push(totalPages);
  return pages;
}

export default function VendasTable({ sales, initialFilters, pagination }: VendasTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [localSales, setLocalSales] = useState(sales);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    sold_quantity: 1,
    sold_price: "",
    fees: "0",
    sold_at: "",
    platform: "vinted",
  });

  const defaultFilters = useMemo(
    () => ({
      query: "",
      category: "all",
      platform: "all",
      orderBy: "sold_at_desc",
    }),
    []
  );

  const [draftFilters, setDraftFilters] = useState(initialFilters);

  const categories = useMemo(() => {
    const uniqueCategories = new Set(
      localSales
        .map((sale) => sale.type)
        .filter((value): value is string => Boolean(value))
    );

    return Array.from(uniqueCategories).sort((a, b) => a.localeCompare(b, "pt"));
  }, [localSales]);

  const platforms = useMemo(() => {
    const uniquePlatforms = new Set(
      localSales
        .map((sale) => sale.platform)
        .filter((value): value is string => Boolean(value))
    );

    basePlatforms.forEach((platform) => uniquePlatforms.add(platform));

    return Array.from(uniquePlatforms).sort((a, b) => a.localeCompare(b, "pt"));
  }, [localSales]);

  const filteredSales = useMemo(() => localSales, [localSales]);

  useEffect(() => {
    setLocalSales(sales);
  }, [sales]);

  useEffect(() => {
    setDraftFilters(initialFilters);
  }, [initialFilters]);

  function navigateWithParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    const next = params.toString();
    router.push(next ? `${pathname}?${next}` : pathname);
  }

  function applyFilters() {
    navigateWithParams({
      query: draftFilters.query,
      category: draftFilters.category,
      platform: draftFilters.platform,
      orderBy: draftFilters.orderBy,
      page: "1",
    });
  }

  function clearFilters() {
    setDraftFilters(defaultFilters);
    navigateWithParams({
      query: "",
      category: defaultFilters.category,
      platform: defaultFilters.platform,
      orderBy: defaultFilters.orderBy,
      page: "1",
    });
  }

  function goToPage(nextPage: number) {
    const clamped = Math.min(Math.max(nextPage, 1), pagination.totalPages);
    navigateWithParams({ page: String(clamped) });
  }

  function changePageSize(value: number) {
    navigateWithParams({ pageSize: String(value), page: "1" });
  }

  const visiblePages = useMemo(
    () => getVisiblePages(pagination.page, pagination.totalPages),
    [pagination.page, pagination.totalPages]
  );

  const totalProfit = useMemo(() => {
    return filteredSales.reduce((sum, sale) => {
      const soldPricePerProduct = Number(sale.sold_price ?? 0);
      const soldQuantity = Number(sale.sold_quantity ?? 0);
      const buyPricePerProduct = Number(sale.buy_unit_cost ?? 0);
      const fretePerProduct = Number(sale.fees ?? 0);
      const profitPerProduct = soldPricePerProduct - buyPricePerProduct - fretePerProduct;
      const profitTotalByRule = profitPerProduct * soldQuantity;
      return sum + profitTotalByRule;
    }, 0);
  }, [filteredSales]);

  async function getAccessToken() {
    const supabase = supabaseBrowser();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  function closeMenuFromElement(element: HTMLElement) {
    const details = element.closest("details");
    if (details) {
      details.removeAttribute("open");
    }
  }

  function startEdit(sale: SaleRow) {
    setError(null);
    setEditingId(sale.id);
    setEditForm({
      sold_quantity: Number(sale.sold_quantity),
      sold_price: String(sale.sold_price),
      fees: String(sale.fees),
      sold_at: sale.sold_at,
      platform: sale.platform ?? "vinted",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function saveEdit(saleId: string) {
    setError(null);
    setSavingId(saleId);

    try {
      const token = await getAccessToken();
      if (!token) {
        setError("Tens de fazer login para editar vendas.");
        return;
      }

      const response = await fetch("/api/vendas/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: saleId,
          sold_quantity: Number(editForm.sold_quantity),
          sold_price_unit: Number(editForm.sold_price),
          fees: Number(editForm.fees),
          sold_at: editForm.sold_at,
          platform: editForm.platform,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || "Erro ao editar venda.");
        return;
      }

      const updatedSale = data.sale as SaleRow;
      setLocalSales((previous) => previous.map((sale) => (sale.id === saleId ? updatedSale : sale)));
      setEditingId(null);
    } catch {
      setError("Erro de rede ao editar venda.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteSale(saleId: string) {
    setError(null);
    setDeletingId(saleId);

    try {
      const token = await getAccessToken();
      if (!token) {
        setError("Tens de fazer login para apagar vendas.");
        return;
      }

      const response = await fetch(`/api/vendas/delete?id=${saleId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || "Erro ao apagar venda.");
        return;
      }

      setLocalSales((previous) => previous.filter((sale) => sale.id !== saleId));
    } catch {
      setError("Erro de rede ao apagar venda.");
    } finally {
      setDeletingId(null);
    }
  }

  function exportFilteredSalesCsv() {
    const header = [
      "ID",
      "Produto",
      "Categoria",
      "Plataforma",
      "Data venda",
      "Quantidade",
      "Preço venda unitário",
      "Custo compra unitário",
      "Frete unitário",
      "Lucro por produto",
      "Lucro total",
    ];

    const rows = filteredSales.map((sale) => {
      const soldPricePerProduct = Number(sale.sold_price ?? 0);
      const soldQuantity = Number(sale.sold_quantity ?? 0);
      const buyPricePerProduct = Number(sale.buy_unit_cost ?? 0);
      const fretePerProduct = Number(sale.fees ?? 0);
      const profitPerProduct = soldPricePerProduct - buyPricePerProduct - fretePerProduct;
      const profitTotal = profitPerProduct * soldQuantity;

      return [
        sale.id,
        sale.title,
        sale.type,
        sale.platform ?? "-",
        sale.sold_at,
        soldQuantity,
        soldPricePerProduct.toFixed(2),
        buyPricePerProduct.toFixed(2),
        fretePerProduct.toFixed(2),
        profitPerProduct.toFixed(2),
        profitTotal.toFixed(2),
      ];
    });

    const csv = toCsv([header, ...rows]);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateTag = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.setAttribute("download", `vendas_${dateTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="vendas-container">
      <h2>Vendas</h2>

      <section className="filters-card">
        <div className="filters-header">
          <div className="filters-header-top">
            <div>
              <h3>Filtros</h3>
              <p>Refina por pesquisa, categoria, plataforma e ordenação</p>
            </div>

            <div className="filters-actions">
              <button type="button" className="apply-btn" onClick={applyFilters}>
                Aplicar
              </button>
              <button
                type="button"
                className="clear-btn"
                onClick={clearFilters}
              >
                Limpar
              </button>
              <button
                type="button"
                className="export-btn"
                onClick={exportFilteredSalesCsv}
                disabled={filteredSales.length === 0}
              >
                Exportar CSV
              </button>
            </div>
          </div>
        </div>

        <div className="filters-grid">
          <label>
            Pesquisar
            <input
              placeholder="ex: pokemon, cartas, ebay..."
              value={draftFilters.query}
              onChange={(event) =>
                setDraftFilters((previous) => ({ ...previous, query: event.target.value }))
              }
            />
          </label>

          <label>
            Categoria
            <select
              value={draftFilters.category}
              onChange={(event) =>
                setDraftFilters((previous) => ({ ...previous, category: event.target.value }))
              }
            >
              <option value="all">Todas</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label>
            Plataforma
            <select
              value={draftFilters.platform}
              onChange={(event) =>
                setDraftFilters((previous) => ({ ...previous, platform: event.target.value }))
              }
            >
              <option value="all">Todas</option>
              {platforms.map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </label>

          <label>
            Ordenar por
            <select
              value={draftFilters.orderBy}
              onChange={(event) =>
                setDraftFilters((previous) => ({ ...previous, orderBy: event.target.value }))
              }
            >
              <option value="sold_at_desc">Data de venda (desc)</option>
              <option value="sold_at_asc">Data de venda (asc)</option>
              <option value="price_desc">Preço venda (desc)</option>
              <option value="price_asc">Preço venda (asc)</option>
              <option value="quantity_desc">Qtd (desc)</option>
              <option value="quantity_asc">Qtd (asc)</option>
            </select>
          </label>
        </div>
      </section>

      <div className="profit-box">
        <span>Lucro total:</span>
        <strong>€ {totalProfit.toFixed(2)}</strong>
      </div>

      {error && <p className="table-error">{error}</p>}

      <div className="table-scroll">
        <table className="vendas-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Plataforma</th>
              <th>Qtd</th>
              <th className="col-nowrap">Data venda</th>
              <th className="col-nowrap">Preço venda produto</th>
              <th className="col-nowrap">Frete</th>
              <th className="col-nowrap">Lucro por produto</th>
              <th className="col-nowrap">Lucro total</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map((sale) => {
            const isEditing = editingId === sale.id;
            const soldPricePerProduct = isEditing ? Number(editForm.sold_price || 0) : Number(sale.sold_price ?? 0);
            const soldQuantity = isEditing ? Number(editForm.sold_quantity || 0) : Number(sale.sold_quantity ?? 0);
            const buyPricePerProduct = Number(sale.buy_unit_cost ?? 0);
            const fretePerProduct = isEditing ? Number(editForm.fees || 0) : Number(sale.fees ?? 0);
            const profitPerProduct = soldPricePerProduct - buyPricePerProduct - fretePerProduct;
            const profitTotal = profitPerProduct * soldQuantity;

            return (
              <tr key={sale.id}>
                <td>{sale.title}</td>
                <td>{sale.type}</td>
                <td>
                  {isEditing ? (
                    <select
                      value={editForm.platform}
                      onChange={(event) =>
                        setEditForm((previous) => ({ ...previous, platform: event.target.value }))
                      }
                    >
                      {platforms.map((platform) => (
                        <option key={platform} value={platform}>
                          {platform}
                        </option>
                      ))}
                    </select>
                  ) : (
                    sale.platform ?? "-"
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input
                      type="number"
                      min={1}
                      value={editForm.sold_quantity}
                      onChange={(event) =>
                        setEditForm((previous) => ({ ...previous, sold_quantity: Number(event.target.value) }))
                      }
                    />
                  ) : (
                    sale.sold_quantity
                  )}
                </td>
                <td className="col-nowrap">
                  {isEditing ? (
                    <input
                      type="date"
                      value={editForm.sold_at}
                      onChange={(event) =>
                        setEditForm((previous) => ({ ...previous, sold_at: event.target.value }))
                      }
                    />
                  ) : (
                    sale.sold_at
                  )}
                </td>
                <td className="col-nowrap">
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editForm.sold_price}
                      onChange={(event) =>
                        setEditForm((previous) => ({ ...previous, sold_price: event.target.value }))
                      }
                    />
                  ) : (
                    <>€ {soldPricePerProduct.toFixed(2)}</>
                  )}
                </td>
                <td className="col-nowrap">
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editForm.fees}
                      onChange={(event) =>
                        setEditForm((previous) => ({ ...previous, fees: event.target.value }))
                      }
                    />
                  ) : (
                    <>€ {fretePerProduct.toFixed(2)}</>
                  )}
                </td>
                <td className="col-nowrap">€ {profitPerProduct.toFixed(2)}</td>
                <td className="col-nowrap">€ {profitTotal.toFixed(2)}</td>
                <td>
                  {isEditing ? (
                    <>
                      <button type="button" disabled={savingId === sale.id} onClick={() => saveEdit(sale.id)}>
                        {savingId === sale.id ? "A guardar..." : "Guardar"}
                      </button>
                      <button type="button" onClick={cancelEdit}>Cancelar</button>
                    </>
                  ) : (
                    <details className="actions-menu">
                      <summary className="menu-trigger">...</summary>
                      <div className="menu-list">
                        <button
                          type="button"
                          className="menu-item"
                          onClick={(event) => {
                            closeMenuFromElement(event.currentTarget);
                            startEdit(sale);
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="menu-item"
                          disabled={deletingId === sale.id}
                          onClick={(event) => {
                            closeMenuFromElement(event.currentTarget);
                            deleteSale(sale.id);
                          }}
                        >
                          {deletingId === sale.id ? "A apagar..." : "Apagar"}
                        </button>
                      </div>
                    </details>
                  )}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>

      {filteredSales.length === 0 && <p className="empty">Sem vendas para os filtros selecionados.</p>}

      <div className="pagination-row">
        <div className="pagination-meta">
          <span>Total: {pagination.totalCount}</span>
          <span>Página {pagination.page} de {pagination.totalPages}</span>
        </div>

        <div className="pagination-controls">
          <label>
            Por página
            <select
              value={String(pagination.pageSize)}
              onChange={(event) => changePageSize(Number(event.target.value))}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>

          <button type="button" onClick={() => goToPage(pagination.page - 1)} disabled={pagination.page <= 1}>
            Anterior
          </button>

          {visiblePages.map((value) => {
            if (typeof value !== "number") {
              return <span key={value} className="pagination-dots">...</span>;
            }

            return (
              <button
                key={value}
                type="button"
                className={value === pagination.page ? "page-btn page-btn-active" : "page-btn"}
                onClick={() => goToPage(value)}
              >
                {value}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => goToPage(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
          >
            Seguinte
          </button>
        </div>
      </div>

      <style jsx>{`
        .vendas-container {
          padding: 2rem;
        }

        .filters-card {
          border: 1px solid #dbe7fb;
          border-radius: 1rem;
          margin: 1rem 0;
          overflow: hidden;
          background: linear-gradient(180deg, #ffffff, #f6f9ff);
          box-shadow: 0 10px 28px rgba(29, 78, 216, 0.08);
        }

        .filters-header {
          padding: 1rem 1rem 0.75rem;
          border-bottom: 1px solid #eaf1ff;
        }

        .filters-header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }

        .filters-header h3 {
          margin: 0;
          font-size: 1.1rem;
        }

        .filters-header p {
          margin: 0.35rem 0 0;
          color: #4f6178;
        }

        .filters-grid {
          padding: 1rem;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.9rem;
          align-items: end;
        }

        .filters-grid label {
          display: grid;
          gap: 0.35rem;
          min-width: 180px;
        }

        .filters-grid input {
          padding: 0.4rem 0.5rem;
          border: 1px solid #d5e2f8;
          border-radius: 0.35rem;
          background: #fff;
        }
        .filters-grid input:focus {
          border-color: #3b82f6;
          outline: 2px solid #dbeafe;
        }

        .filters-grid select {
          padding: 0.4rem 0.5rem;
          border: 1px solid #d5e2f8;
          border-radius: 0.35rem;
          background: #fff;
        }
        .filters-grid select:focus {
          border-color: #3b82f6;
          outline: 2px solid #dbeafe;
        }

        .filters-actions {
          display: flex;
          gap: 0.55rem;
          align-items: center;
        }

        .filters-actions .apply-btn {
          background: linear-gradient(180deg, #2563eb, #1d4ed8);
          color: #fff;
          border: 1px solid #1d4ed8;
          border-radius: 0.5rem;
          padding: 0.55rem 1rem;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.25);
        }
        .filters-actions .apply-btn:hover {
          background: linear-gradient(180deg, #1d4ed8, #1e40af);
          transform: translateY(-1px);
        }

        .filters-actions .clear-btn {
          background: #edf3ff;
          border: 1px solid #cfe0ff;
          color: #123264;
          padding: 0.42rem 0.62rem;
          border-radius: 0.55rem;
          cursor: pointer;
        }
        .filters-actions .clear-btn:hover { background: #e0ecff; }

        .filters-actions .export-btn {
          background: #ffffff;
          border: 1px solid #cfe0ff;
          color: #123264;
          padding: 0.42rem 0.62rem;
          border-radius: 0.55rem;
          cursor: pointer;
        }
        .filters-actions .export-btn:hover {
          background: #f4f8ff;
        }
        .filters-actions .export-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .profit-box {
          display: inline-flex;
          gap: 0.5rem;
          align-items: center;
          margin-bottom: 1rem;
          padding: 0.6rem 0.9rem;
          border-radius: 0.75rem;
          background: #edf3ff;
          border: 1px solid #cfe0ff;
          color: #123264;
        }

        .table-error {
          color: #b42318;
          margin: 0 0 1rem;
        }

        .vendas-table {
          width: 100%;
          min-width: 1020px;
          border-collapse: collapse;
        }
        .table-scroll {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .vendas-table th,
        .vendas-table td {
          padding: 0.7rem;
          border-bottom: 1px solid #e9f0ff;
          text-align: center;
        }
        .vendas-table .col-nowrap {
          white-space: nowrap;
        }
        .vendas-table tbody tr:hover {
          background: #f3f7ff;
        }

        .vendas-table input,
        .vendas-table select {
          width: 100%;
          min-width: 90px;
          padding: 0.3rem 0.45rem;
          border: 1px solid #d5e2f8;
          border-radius: 0.35rem;
          background: #fff;
        }

        .vendas-table input:focus,
        .vendas-table select:focus {
          border-color: #3b82f6;
          outline: 2px solid #dbeafe;
        }

        .vendas-table button {
          margin-right: 0.45rem;
          padding: 0.42rem 0.85rem;
          border: 1px solid #cfe0ff;
          border-radius: 0.5em;
          background: #eef4ff;
          color: #123264;
          cursor: pointer;
        }

        .vendas-table button:hover {
          background: #e0ecff;
          transform: translateY(-1px);
        }

        .actions-menu {
          position: relative;
          display: inline-block;
        }

        .menu-trigger {
          list-style: none;
          width: 2.25rem;
          text-align: center;
          padding: 0.25rem 0.35rem;
          border-radius: 0.45rem;
          background: #edf3ff;
          border: 1px solid #d6e4ff;
          cursor: pointer;
          user-select: none;
        }

        .menu-trigger::-webkit-details-marker {
          display: none;
        }

        .actions-menu[open] .menu-trigger {
          background: #e0ecff;
        }

        .menu-list {
          position: absolute;
          right: 0;
          margin-top: 0.35rem;
          min-width: 165px;
          background: white;
          border: 1px solid #dbe7fb;
          border-radius: 0.5rem;
          box-shadow: 0 12px 26px rgba(29, 78, 216, 0.12);
          padding: 0.3rem;
          display: grid;
          gap: 0.25rem;
          z-index: 10;
        }

        .menu-item {
          width: 100%;
          text-align: left;
          margin: 0;
          background: transparent;
          padding: 0.45rem 0.55rem;
          border-radius: 0.4rem;
          border: none;
          color: #123264;
        }

        .menu-item:hover {
          background: #edf3ff;
        }

        .empty {
          margin-top: 1rem;
          color: #4f6178;
        }

        .pagination-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 0.9rem;
          gap: 1rem;
        }

        .pagination-meta {
          display: flex;
          gap: 1rem;
          color: #4f6178;
        }

        .pagination-controls {
          display: flex;
          align-items: center;
          gap: 0.55rem;
        }

        .pagination-controls label {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          margin-right: 0.2rem;
        }

        .pagination-controls .page-btn {
          min-width: 2.1rem;
          margin-right: 0;
          padding: 0.35rem 0.55rem;
        }

        .pagination-controls .page-btn-active {
          background: linear-gradient(180deg, #2563eb, #1d4ed8);
          color: #fff;
          border-color: #1d4ed8;
        }

        .pagination-dots {
          color: #4f6178;
          padding: 0 0.15rem;
        }

        @media (max-width: 1180px) {
          .filters-header-top {
            flex-direction: column;
            align-items: stretch;
          }

          .filters-actions {
            justify-content: flex-start;
            flex-wrap: wrap;
          }

          .filters-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .vendas-container {
            padding: 1rem;
          }
          .filters-grid {
            grid-template-columns: 1fr;
          }

          .pagination-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .pagination-controls {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
}
