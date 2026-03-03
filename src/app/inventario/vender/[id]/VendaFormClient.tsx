"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../lib/supabase/client";

type VendaFormProps = {
  itemId: string;
  itemTitle: string;
  buyDate: string;
  stockAvailable: number;
};

const platformOptions = [
  "vinted",
  "olx",
  "lolapop",
  "viagogo",
  "stubhub",
  "ebay",
  "cardmarket",
] as const;

export default function VendaFormClient({ itemId, itemTitle, buyDate, stockAvailable }: VendaFormProps) {
  const router = useRouter();
  const [soldQuantity, setSoldQuantity] = useState(1);
  const [soldPriceUnit, setSoldPriceUnit] = useState("");
  const [frete, setFrete] = useState("0");
  const [platform, setPlatform] = useState<(typeof platformOptions)[number]>("vinted");
  const [soldAt, setSoldAt] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = supabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Tens de fazer login para marcar como vendido.");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/vendas/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          item_id: itemId,
          sold_quantity: soldQuantity,
          sold_price_unit: Number(soldPriceUnit),
          fees: Number(frete),
          sold_at: soldAt,
          platform,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || "Erro ao registar venda.");
        setLoading(false);
        return;
      }

      router.push("/inventario");
      router.refresh();
    } catch {
      setError("Erro de rede ao registar venda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="venda-container">
      <h2>Marcar como vendido</h2>
      <p className="subtitle">
        Item: <strong>{itemTitle}</strong>
      </p>
      <p className="subtitle">Stock disponível: {stockAvailable}</p>

      <form className="venda-form" onSubmit={onSubmit}>
        <label>
          Quantidade
          <input
            type="number"
            min={1}
            max={stockAvailable}
            value={soldQuantity}
            onChange={(event) => setSoldQuantity(Number(event.target.value))}
            required
          />
        </label>

        <label>
          Preço de venda (unitário)
          <input
            type="number"
            min={0}
            step="0.01"
            value={soldPriceUnit}
            onChange={(event) => setSoldPriceUnit(event.target.value)}
            required
          />
        </label>

        <p className="subtitle">
          Total bruto: € {(Number(soldPriceUnit || 0) * soldQuantity).toFixed(2)}
        </p>

        <label>
          Frete (por produto)
          <input
            type="number"
            min={0}
            step="0.01"
            value={frete}
            onChange={(event) => setFrete(event.target.value)}
            required
          />
        </label>

        <label>
          Plataforma
          <select value={platform} onChange={(event) => setPlatform(event.target.value as (typeof platformOptions)[number])}>
            {platformOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Data da venda
          <input
            type="date"
            min={buyDate}
            value={soldAt}
            onChange={(event) => setSoldAt(event.target.value)}
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button type="submit" disabled={loading}>
            {loading ? "A registar..." : "Registar venda"}
          </button>
          <button type="button" onClick={() => router.push("/inventario")}>Cancelar</button>
        </div>
      </form>

      <style jsx>{`
        .venda-container {
          padding: 2rem;
          max-width: 700px;
        }
        .subtitle {
          margin: 0.25rem 0;
          color: #4f6178;
        }
        .venda-form {
          margin-top: 1rem;
          display: grid;
          gap: 0.9rem;
          background: linear-gradient(180deg, #ffffff, #f6f9ff);
          border: 1px solid #dbe7fb;
          padding: 1rem;
          border-radius: 0.75rem;
          box-shadow: 0 10px 28px rgba(29, 78, 216, 0.08);
        }
        label {
          display: grid;
          gap: 0.35rem;
        }
        input,
        select {
          padding: 0.45rem 0.55rem;
          border: 1px solid #d5e2f8;
          border-radius: 0.35rem;
        }
        input:focus,
        select:focus {
          border-color: #3b82f6;
          outline: 2px solid #dbeafe;
        }
        .actions {
          display: flex;
          gap: 0.5rem;
        }
        button {
          padding: 0.5rem 0.95rem;
          border: 1px solid #cfe0ff;
          border-radius: 0.45rem;
          background: #edf3ff;
          color: #123264;
          font-weight: 600;
          cursor: pointer;
        }
        button[type="submit"] {
          border-color: #1d4ed8;
          background: linear-gradient(180deg, #2563eb, #1d4ed8);
          color: #fff;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.25);
        }
        button:hover {
          transform: translateY(-1px);
        }
        button[type="submit"]:hover { background: linear-gradient(180deg, #1d4ed8, #1e40af); }
        button[type="button"]:hover { background: #e0ecff; }
        button:active { transform: translateY(1px) scale(0.99); }
        .error {
          color: #b42318;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
