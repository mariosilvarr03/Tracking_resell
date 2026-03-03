"use client";
import React, { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/client";

const apparelSizes = ["XS", "S", "M", "L", "XL", "XXL"];
const supabase = supabaseBrowser();

export default function NovaCompraPage() {
  const [form, setForm] = useState({
    title: "",
    type: "CARTAS",
    buy_price: "",
    buy_date: new Date().toISOString().slice(0, 10),
    quantity: 1,
    size: "",
    brand: "",
    condition: "",
    size_eu: "",
    model: "",
    event_name: "",
    event_date: "",
    location: "",
    seat_info: "",
    game: "",
    set_name: "",
    card_name: "",
    language: "",
    extra: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function renderExtraFields() {
    switch (form.type) {
      case "ROUPA":
        return (
          <>
            <label>Tamanho:
              <select required value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))}>
                <option value="">Selecione</option>
                {apparelSizes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>Marca: <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} /></label>
            <label>Condição: <input value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} /></label>
          </>
        );
      case "SAPATILHAS":
        return (
          <>
            <label>Tamanho EU: <input required type="number" min="10" step="0.5" value={form.size_eu} onChange={e => setForm(f => ({ ...f, size_eu: e.target.value }))} /></label>
            <label>Marca: <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} /></label>
            <label>Modelo: <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></label>
            <label>Condição: <input value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} /></label>
          </>
        );
      case "BILHETES":
        return (
          <>
            <label>Evento: <input value={form.event_name} onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))} /></label>
            <label>Data do evento: <input type="date" min={form.buy_date} value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} /></label>
            <label>Local: <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></label>
            <label>Lugar: <input value={form.seat_info} onChange={e => setForm(f => ({ ...f, seat_info: e.target.value }))} /></label>
          </>
        );
      case "CARTAS":
        return (
          <>
            <label>Coleção/Marca: <input value={form.game} onChange={e => setForm(f => ({ ...f, game: e.target.value }))} /></label>
            <label>Set: <input value={form.set_name} onChange={e => setForm(f => ({ ...f, set_name: e.target.value }))} /></label>
            <label>Produto: <input value={form.card_name} onChange={e => setForm(f => ({ ...f, card_name: e.target.value }))} /></label>
            <label>Idioma: <input value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} /></label>
          </>
        );
      case "RANDOM":
        return (
          <label>Extra (JSON): <textarea value={form.extra} onChange={e => setForm(f => ({ ...f, extra: e.target.value }))} /></label>
        );
      default:
        return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Tens de fazer login para adicionar compras.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/inventario/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Erro ao adicionar compra");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setForm({
        title: "",
        type: "CARTAS",
        buy_price: "",
        buy_date: new Date().toISOString().slice(0, 10),
        quantity: 1,
        size: "",
        brand: "",
        condition: "",
        size_eu: "",
        model: "",
        event_name: "",
        event_date: "",
        location: "",
        seat_info: "",
        game: "",
        set_name: "",
        card_name: "",
        language: "",
        extra: ""
      });
    } catch {
      setError("Erro de rede ao adicionar compra");
    } finally {
      setLoading(false);
      return;
    }
  }

  return (
    <div className="nova-compra-container">
      <h2>Adicionar Nova Compra</h2>
      <form className="add-form" onSubmit={handleSubmit}>
        <label>Nome: <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></label>
        <label>Categoria:
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="CARTAS">Cartas</option>
            <option value="ROUPA">Roupa</option>
            <option value="SAPATILHAS">Sapatilhas</option>
            <option value="BILHETES">Bilhetes</option>
            <option value="RANDOM">Random</option>
          </select>
        </label>
        <label>Preço de compra: <input required type="number" min="0" step="0.01" value={form.buy_price} onChange={e => setForm(f => ({ ...f, buy_price: e.target.value }))} /></label>
        <label>Data de compra: <input required type="date" value={form.buy_date} max={form.type === "BILHETES" && form.event_date ? form.event_date : undefined} onChange={e => setForm(f => {
          const nextBuyDate = e.target.value;
          const shouldAdjustEventDate = f.type === "BILHETES" && f.event_date && f.event_date < nextBuyDate;
          return { ...f, buy_date: nextBuyDate, event_date: shouldAdjustEventDate ? nextBuyDate : f.event_date };
        })} /></label>
        <label>Quantidade: <input required type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} /></label>
        <div className="category-fields">{renderExtraFields()}</div>
        {error && <div className="error">{error}</div>}
        {success && <div className="success">Compra adicionada com sucesso!</div>}
        <div className="submit-row">
          <button type="submit" disabled={loading}>{loading ? "A adicionar..." : "Adicionar"}</button>
        </div>
      </form>
      <style jsx>{`
        .nova-compra-container {
          padding: 2rem;
        }
        .add-form {
          background: linear-gradient(180deg, #eef4ff, #e6efff);
          border: 1px solid #c7d7f6;
          padding: 1.1em;
          border-radius: 0.8em;
          margin-bottom: 2em;
          box-shadow: 0 10px 28px rgba(29, 78, 216, 0.08);
        }
        .add-form label {
          display: block;
          margin-bottom: 0.75em;
          color: #213a63;
        }
        .category-fields {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem 1rem;
          margin-bottom: 0.75rem;
        }
        .category-fields :global(label) {
          margin-bottom: 0;
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
        }
        .add-form input, .add-form select, .add-form textarea {
          margin-left: 0.5em;
          padding: 0.45em 0.55em;
          border: 1px solid #b7c9ea;
          border-radius: 0.45rem;
          background: #ffffff;
        }
        .category-fields :global(input),
        .category-fields :global(select),
        .category-fields :global(textarea) {
          background: #fff !important;
          min-width: 200px;
        }
        .add-form input:focus, .add-form select:focus, .add-form textarea:focus {
          border-color: #2563eb;
          outline: 2px solid #bfdbfe;
        }
        .add-form .error {
          color: #b42318;
          margin-bottom: 0.5em;
        }
        .add-form .success {
          color: #14653b;
          margin-bottom: 0.5em;
        }
        .add-form .submit-row {
          display: flex;
          justify-content: center;
          width: 100%;
          margin-top: 0.75rem;
        }
        .add-form button {
          border: 1px solid #1d4ed8;
          border-radius: 0.65rem;
          padding: 0.58rem 0.95rem;
          background: linear-gradient(180deg, #2563eb, #1d4ed8);
          color: #fff;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.25);
        }
        .add-form button:hover {
          background: linear-gradient(180deg, #1d4ed8, #1e40af);
          transform: translateY(-1px);
        }
        .add-form button:active {
          transform: translateY(1px) scale(0.99);
        }
      `}</style>
    </div>
  );
}
