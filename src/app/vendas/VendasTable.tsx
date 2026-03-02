"use client";

import { useMemo, useState } from "react";

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

export default function VendasTable({ sales }: VendasTableProps) {
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
      sales
        .map((sale) => sale.type)
        .filter((value): value is string => Boolean(value))
    );

    return Array.from(uniqueCategories).sort((a, b) => a.localeCompare(b, "pt"));
  }, [sales]);

  const platforms = useMemo(() => {
    const uniquePlatforms = new Set(
      sales
        .map((sale) => sale.platform)
        .filter((value): value is string => Boolean(value))
    );

    return Array.from(uniquePlatforms).sort((a, b) => a.localeCompare(b, "pt"));
  }, [sales]);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
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
  }, [sales, appliedFilters]);

  const totalProfit = useMemo(() => {
    return filteredSales.reduce((sum, sale) => {
      const soldPricePerProduct = Number(sale.sold_price ?? 0);
      const soldQuantity = Number(sale.sold_quantity ?? 0);
      const buyPricePerProduct = Number(sale.buy_unit_cost ?? 0);
      const fretePerProduct = Number(sale.fees ?? 0);
      const profitPerProduct = soldPricePerProduct - buyPricePerProduct;
      const profitTotalByRule = (profitPerProduct - fretePerProduct) * soldQuantity;
      return sum + profitTotalByRule;
    }, 0);
  }, [filteredSales]);

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
          </tr>
        </thead>
        <tbody>
          {filteredSales.map((sale) => {
            const soldPricePerProduct = Number(sale.sold_price ?? 0);
            const soldQuantity = Number(sale.sold_quantity ?? 0);
            const buyPricePerProduct = Number(sale.buy_unit_cost ?? 0);
            const fretePerProduct = Number(sale.fees ?? 0);
            const profitPerProduct = soldPricePerProduct - buyPricePerProduct - fretePerProduct;
            const profitTotal = profitPerProduct * soldQuantity;

            return (
              <tr key={sale.id}>
                <td>{sale.title}</td>
                <td>{sale.type}</td>
                <td>{sale.platform ?? "-"}</td>
                <td>{sale.sold_quantity}</td>
                <td>{sale.sold_at}</td>
                <td>€ {soldPricePerProduct.toFixed(2)}</td>
                <td>€ {fretePerProduct.toFixed(2)}</td>
                <td>€ {profitPerProduct.toFixed(2)}</td>
                <td>€ {profitTotal.toFixed(2)}</td>
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
