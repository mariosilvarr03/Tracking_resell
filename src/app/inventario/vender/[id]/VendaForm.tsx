"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../lib/supabase/client";

type VendaFormProps = {
  itemId: string;
  itemTitle: string;
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

export default function VendaForm({ itemId, itemTitle, stockAvailable }: VendaFormProps) {
  const router = useRouter();
  const [soldQuantity, setSoldQuantity] = useState(1);
  const [soldPrice, setSoldPrice] = useState("");
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
          sold_price: Number(soldPrice),
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
          Preço de venda
          <input
            type="number"
            min={0}
            step="0.01"
            value={soldPrice}
            onChange={(event) => setSoldPrice(event.target.value)}
            required
          />
        </label>

        <label>
          Frete
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
          color: #555;
        }
        .venda-form {
          margin-top: 1rem;
          display: grid;
          gap: 0.9rem;
          background: #fafafa;
          padding: 1rem;
          border-radius: 0.5rem;
          box-shadow: 0 2px 8px #0001;
        }
        label {
          display: grid;
          gap: 0.35rem;
        }
        input,
        select {
          padding: 0.45rem 0.55rem;
          border: 1px solid #ddd;
          border-radius: 0.35rem;
        }
        .actions {
          display: flex;
          gap: 0.5rem;
        }
        button {
          padding: 0.45rem 0.9rem;
          border: none;
          border-radius: 0.45rem;
          background: #f2f2f2;
          cursor: pointer;
        }
        button:hover {
          background: #e6e6e6;
        }
        .error {
          color: #c00;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
