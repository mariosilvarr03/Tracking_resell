"use client";

import { useMemo, useState } from "react";
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
};

const basePlatforms = ["vinted", "olx", "lolapop", "viagogo", "stubhub", "ebay", "cardmarket"];

export default function VendasTable({ sales }: VendasTableProps) {
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
    }),
    []
  );

  const [draftFilters, setDraftFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);

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

  const filteredSales = useMemo(() => {
    return localSales.filter((sale) => {
      const normalizedQuery = appliedFilters.query.trim().toLowerCase();

      const categoryMatches =
        appliedFilters.category === "all" || sale.type === appliedFilters.category;
      const platformMatches =
        appliedFilters.platform === "all" || sale.platform === appliedFilters.platform;
      const queryMatches =
        normalizedQuery.length === 0 ||
        sale.title.toLowerCase().includes(normalizedQuery) ||
        sale.type.toLowerCase().includes(normalizedQuery) ||
        (sale.platform ?? "").toLowerCase().includes(normalizedQuery);

      return categoryMatches && platformMatches && queryMatches;
    });
  }, [localSales, appliedFilters]);

  const totalProfit = useMemo(() => {
    return filteredSales.reduce((sum, sale) => {
      const soldPricePerProduct = Number(sale.sold_price ?? 0);
      const soldQuantity = Number(sale.sold_quantity ?? 0);
      const buyPricePerProduct = Number(sale.buy_unit_cost ?? 0);
      const profitPerProduct = soldPricePerProduct - buyPricePerProduct;
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

  return (
    <div className="vendas-container">
      <h2>Vendas</h2>

      <section className="filters-card">
        <div className="filters-header">
          <h3>Filtros</h3>
          <p>Refina por pesquisa, categoria e plataforma</p>
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

          <div className="filters-actions">
            <button type="button" className="apply-btn" onClick={() => setAppliedFilters(draftFilters)}>
              Aplicar
            </button>
            <button
              type="button"
              className="clear-btn"
              onClick={() => {
                setDraftFilters(defaultFilters);
                setAppliedFilters(defaultFilters);
              }}
            >
              Limpar
            </button>
          </div>
        </div>
      </section>

      <div className="profit-box">
        <span>Lucro total:</span>
        <strong>€ {totalProfit.toFixed(2)}</strong>
      </div>

      {error && <p className="table-error">{error}</p>}

      <table className="vendas-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Categoria</th>
            <th>Plataforma</th>
            <th>Qtd</th>
            <th>Data venda</th>
            <th>Preço venda produto</th>
            <th>Frete</th>
            <th>Lucro por produto</th>
            <th>Lucro total</th>
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
            const profitPerProduct = soldPricePerProduct - buyPricePerProduct;
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
                <td>
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
                <td>
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
                <td>
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
                <td>€ {profitPerProduct.toFixed(2)}</td>
                <td>€ {profitTotal.toFixed(2)}</td>
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

      {filteredSales.length === 0 && <p className="empty">Sem vendas para os filtros selecionados.</p>}

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
          border-collapse: collapse;
        }

        .vendas-table th,
        .vendas-table td {
          padding: 0.7rem;
          border-bottom: 1px solid #e9f0ff;
          text-align: left;
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

        @media (max-width: 1180px) {
          .filters-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .filters-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
