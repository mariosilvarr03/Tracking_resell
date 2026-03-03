"use client";
import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "../lib/supabase/client";
import {
  INVENTORY_ALLOWED_TYPES,
  type InventoryCsvCanonicalHeader,
  INVENTORY_CSV_TEMPLATE_HEADERS,
  mapInventoryCsvHeaders,
} from "../lib/imports/inventoryCsvSpec";

// Helper para calcular dias de hold
function getHoldDays(buyDate: string) {
  const now = new Date();
  const buy = new Date(buyDate);
  const diff = Math.floor((now.getTime() - buy.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

type Item = {
  id: string;
  title: string;
  type: string;
  quantity: number;
  sold_quantity_total: number;
  buy_price: number;
  buy_date: string;
};

type InventoryFilters = {
  query: string;
  status: string;
  category: string;
  orderBy: string;
};

type PaginationMeta = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type CsvPreviewState = {
  rawHeaders: string[];
  sampleRows: string[][];
  mappedRows: Array<Partial<Record<InventoryCsvCanonicalHeader, string>>>;
  totalRows: number;
  unknownHeaders: string[];
  missingRequired: string[];
  validRows: number;
  invalidRows: number;
  rowErrors: Array<{
    rowNumber: number;
    messages: string[];
  }>;
};

const ALLOWED_ITEM_TYPES: ReadonlySet<string> = new Set(INVENTORY_ALLOWED_TYPES);

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

function parseCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseDecimal(value: string) {
  return Number(value.replace(",", "."));
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseCsvText(text: string): CsvPreviewState {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error("CSV inválido: inclui header e pelo menos 1 linha.");
  }

  const headerLine = lines[0];
  const semicolonCount = (headerLine.match(/;/g) ?? []).length;
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const delimiter = semicolonCount >= commaCount ? ";" : ",";

  const rawHeaders = parseCsvLine(headerLine, delimiter);
  const parsedRows = lines.slice(1).map((line) => parseCsvLine(line, delimiter));

  const mapped = mapInventoryCsvHeaders(rawHeaders);
  const mappedRows: Array<Partial<Record<InventoryCsvCanonicalHeader, string>>> = parsedRows.map((row) => {
    const mappedRow: Partial<Record<InventoryCsvCanonicalHeader, string>> = {};
    mapped.canonicalByIndex.forEach((canonicalHeader, cellIndex) => {
      if (!canonicalHeader) return;
      mappedRow[canonicalHeader] = String(row[cellIndex] ?? "").trim();
    });
    return mappedRow;
  });
  const rowErrors: CsvPreviewState["rowErrors"] = [];

  mappedRows.forEach((values, rowIndex) => {
    const rowNumber = rowIndex + 2;

    const messages: string[] = [];
    const title = values.title ?? "";
    const typeRaw = (values.type ?? "").toUpperCase();
    const buyPriceRaw = values.buy_price ?? "";
    const buyDateRaw = values.buy_date ?? "";
    const quantityRaw = values.quantity ?? "";
    const eventDateRaw = values.event_date ?? "";

    if (!title) messages.push("title em falta");
    if (!typeRaw) {
      messages.push("type em falta");
    } else if (!ALLOWED_ITEM_TYPES.has(typeRaw)) {
      messages.push(`type inválido (${typeRaw})`);
    }

    const buyPrice = parseDecimal(buyPriceRaw);
    if (!buyPriceRaw) {
      messages.push("buy_price em falta");
    } else if (!Number.isFinite(buyPrice) || buyPrice < 0) {
      messages.push("buy_price inválido");
    }

    const quantity = Number(quantityRaw);
    if (!quantityRaw) {
      messages.push("quantity em falta");
    } else if (!Number.isInteger(quantity) || quantity < 1) {
      messages.push("quantity inválida");
    }

    const buyDate = parseDateOnly(buyDateRaw);
    if (!buyDateRaw) {
      messages.push("buy_date em falta");
    } else if (!buyDate) {
      messages.push("buy_date inválida (formato YYYY-MM-DD)");
    }

    if (eventDateRaw) {
      const eventDate = parseDateOnly(eventDateRaw);
      if (!eventDate) {
        messages.push("event_date inválida (formato YYYY-MM-DD)");
      } else if (typeRaw === "BILHETES" && buyDate && eventDate < buyDate) {
        messages.push("event_date não pode ser anterior a buy_date");
      }
    }

    if (messages.length > 0) {
      rowErrors.push({ rowNumber, messages });
    }
  });

  const invalidRows = mapped.missingRequired.length > 0 ? parsedRows.length : rowErrors.length;
  const validRows = Math.max(0, parsedRows.length - invalidRows);

  return {
    rawHeaders,
    sampleRows: parsedRows.slice(0, 10),
    mappedRows,
    totalRows: parsedRows.length,
    unknownHeaders: mapped.unknownHeaders,
    missingRequired: mapped.missingRequired,
    validRows,
    invalidRows,
    rowErrors,
  };
}

export default function InventarioTable({
  items,
  initialFilters,
  pagination,
}: {
  items: Item[];
  initialFilters: InventoryFilters;
  pagination: PaginationMeta;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [localItems, setLocalItems] = React.useState(items);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [importSuccess, setImportSuccess] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [csvPreview, setCsvPreview] = React.useState<CsvPreviewState | null>(null);

  const defaultFilters = React.useMemo(
    () => ({
      query: "",
      status: "ALL",
      category: "ALL",
      orderBy: "buy_date_desc",
    }),
    []
  );

  const [draftFilters, setDraftFilters] = React.useState<InventoryFilters>(initialFilters);

  const [editForm, setEditForm] = React.useState({
    title: "",
    buy_price: "",
    buy_date: "",
    quantity: 1,
  });

  const visibleItems = React.useMemo(() => localItems, [localItems]);

  React.useEffect(() => {
    setLocalItems(items);
  }, [items]);

  React.useEffect(() => {
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
      status: draftFilters.status,
      category: draftFilters.category,
      orderBy: draftFilters.orderBy,
      page: "1",
    });
  }

  function clearFilters() {
    setDraftFilters(defaultFilters);
    navigateWithParams({
      query: "",
      status: defaultFilters.status,
      category: defaultFilters.category,
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

  const visiblePages = React.useMemo(
    () => getVisiblePages(pagination.page, pagination.totalPages),
    [pagination.page, pagination.totalPages]
  );

  async function getAccessToken() {
    const supabase = supabaseBrowser();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  function startEdit(item: Item) {
    setError(null);
    setEditingId(item.id);
    setEditForm({
      title: item.title,
      buy_price: String(item.buy_price),
      buy_date: item.buy_date,
      quantity: item.quantity,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function saveEdit(itemId: string) {
    setError(null);
    setSavingId(itemId);

    try {
      const token = await getAccessToken();
      if (!token) {
        setError("Tens de fazer login para editar.");
        return;
      }

      const res = await fetch("/api/inventario/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: itemId,
          title: editForm.title,
          buy_price: Number(editForm.buy_price),
          buy_date: editForm.buy_date,
          quantity: Number(editForm.quantity),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Erro ao editar item");
        return;
      }

      setLocalItems((previous) => previous.map((item) => (item.id === itemId ? data.item : item)));
      setEditingId(null);
    } catch {
      setError("Erro de rede ao editar item");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteItem(itemId: string) {
    setError(null);
    setDeletingId(itemId);

    try {
      const token = await getAccessToken();
      if (!token) {
        setError("Tens de fazer login para apagar.");
        return;
      }

      const res = await fetch(`/api/inventario/delete?id=${itemId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Erro ao apagar item");
        return;
      }

      setLocalItems((previous) => previous.filter((item) => item.id !== itemId));
    } catch {
      setError("Erro de rede ao apagar item");
    } finally {
      setDeletingId(null);
    }
  }

  function closeMenuFromElement(element: HTMLElement) {
    const details = element.closest("details");
    if (details) {
      details.removeAttribute("open");
    }
  }

  async function onImportCsvSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setImportError(null);
    setImportSuccess(null);
    setCsvPreview(null);

    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      setCsvPreview(parsed);
    } catch {
      setImportError("Não foi possível ler o CSV. Verifica formato e headers.");
    } finally {
      event.target.value = "";
    }
  }

  async function importCsvRows() {
    setImportError(null);
    setImportSuccess(null);

    if (!csvPreview) {
      setImportError("Seleciona um CSV antes de importar.");
      return;
    }

    if (csvPreview.invalidRows > 0 || csvPreview.missingRequired.length > 0) {
      setImportError("Corrige os erros do CSV antes de importar.");
      return;
    }

    setImporting(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setImportError("Tens de fazer login para importar.");
        return;
      }

      const res = await fetch("/api/inventario/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          validateOnly: false,
          rows: csvPreview.mappedRows,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setImportError(data?.error || "Erro ao importar CSV.");
        return;
      }

      setImportSuccess(`Import concluído: ${data?.summary?.insertedItems ?? 0} items inseridos.`);
      setCsvPreview(null);
      router.refresh();
    } catch {
      setImportError("Erro de rede ao importar CSV.");
    } finally {
      setImporting(false);
    }
  }

  function exportVisibleItemsCsv() {
    const header = [
      "ID",
      "Nome",
      "Categoria",
      "Quantidade",
      "Qtd vendida",
      "Stock",
      "Status",
      "Preço produto",
      "Preço total",
      "Data compra",
      "Tempo hold (dias)",
    ];

    const rows = visibleItems.map((item) => {
      const soldQuantity = Number(item.sold_quantity_total ?? 0);
      const quantity = Number(item.quantity ?? 0);
      const stock = quantity - soldQuantity;
      const status = stock > 0 ? "EM STOCK" : "VENDIDO";
      const unitPrice = Number(item.buy_price ?? 0);
      const totalPrice = unitPrice * quantity;

      return [
        item.id,
        item.title,
        item.type,
        quantity,
        soldQuantity,
        stock,
        status,
        unitPrice.toFixed(2),
        totalPrice.toFixed(2),
        item.buy_date,
        getHoldDays(item.buy_date),
      ];
    });

    const csv = toCsv([header, ...rows]);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateTag = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.setAttribute("download", `inventario_${dateTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="inventario-container">
      <h2>Inventário</h2>
      <button className="add-btn" onClick={() => router.push("/inventario/nova-compra")}>Nova compra</button>
      {error && <p className="table-error">{error}</p>}
      <section className="import-card">
        <h3>Importar CSV (preview)</h3>
        <p>Usa headers do template oficial; aliases são aceites automaticamente.</p>
        <input type="file" accept=".csv,text/csv" onChange={onImportCsvSelected} />
        <p className="import-template">Template: {INVENTORY_CSV_TEMPLATE_HEADERS.join(", ")}</p>
        {importError && <p className="table-error">{importError}</p>}
        {importSuccess && <p className="import-success">{importSuccess}</p>}
        {csvPreview && (
          <div className="import-preview">
            <p>
              Linhas lidas: <strong>{csvPreview.totalRows}</strong>
            </p>
            <p>
              Válidas: <strong>{csvPreview.validRows}</strong> | Inválidas: <strong>{csvPreview.invalidRows}</strong>
            </p>
            {csvPreview.missingRequired.length > 0 && (
              <p className="table-error">Headers obrigatórios em falta: {csvPreview.missingRequired.join(", ")}</p>
            )}
            {csvPreview.unknownHeaders.length > 0 && (
              <p className="import-warn">Headers não reconhecidos: {csvPreview.unknownHeaders.join(", ")}</p>
            )}
            {csvPreview.rowErrors.length > 0 && (
              <div className="import-errors">
                <p>Erros por linha (preview):</p>
                <ul>
                  {csvPreview.rowErrors.slice(0, 12).map((rowError) => (
                    <li key={`csv-error-${rowError.rowNumber}`}>
                      Linha {rowError.rowNumber}: {rowError.messages.join("; ")}
                    </li>
                  ))}
                </ul>
                {csvPreview.rowErrors.length > 12 && (
                  <p className="import-muted">
                    A mostrar 12 de {csvPreview.rowErrors.length} linhas com erro.
                  </p>
                )}
              </div>
            )}
            <div className="table-scroll">
              <table className="inventario-table">
                <thead>
                  <tr>
                    {csvPreview.rawHeaders.map((header, headerIndex) => (
                      <th key={`csv-header-${headerIndex}`}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.sampleRows.map((row, rowIndex) => (
                    <tr key={`csv-row-${rowIndex}`}>
                      {csvPreview.rawHeaders.map((_, cellIndex) => (
                        <td key={`csv-cell-${rowIndex}-${cellIndex}`}>{row[cellIndex] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csvPreview.totalRows > csvPreview.sampleRows.length && (
              <p className="import-muted">A mostrar apenas as primeiras {csvPreview.sampleRows.length} linhas.</p>
            )}
            <button
              type="button"
              className="import-btn"
              disabled={importing || csvPreview.invalidRows > 0 || csvPreview.missingRequired.length > 0}
              onClick={importCsvRows}
            >
              {importing ? "A importar..." : `Importar ${csvPreview.validRows} linhas válidas`}
            </button>
          </div>
        )}
      </section>

      <section className="filters-card">
        <div className="filters-header">
          <div className="filters-header-top">
            <div>
              <h3>Filtros</h3>
              <p>Refina por pesquisa, status, categoria e ordenação</p>
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
                onClick={exportVisibleItemsCsv}
                disabled={visibleItems.length === 0}
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
              placeholder="ex: jordan, pokemon, bilhetes..."
              value={draftFilters.query}
              onChange={(event) =>
                setDraftFilters((previous) => ({ ...previous, query: event.target.value }))
              }
            />
          </label>

          <label>
            Status
            <select
              value={draftFilters.status}
              onChange={(event) =>
                setDraftFilters((previous) => ({ ...previous, status: event.target.value }))
              }
            >
              <option value="ALL">Todos</option>
              <option value="EM_STOCK">Em stock</option>
              <option value="VENDIDO">Vendido</option>
            </select>
          </label>

          <label>
            Categoria
            <select
              value={draftFilters.category}
              onChange={(event) =>
                setDraftFilters((previous) => ({ ...previous, category: event.target.value }))
              }
            >
              <option value="ALL">Todas</option>
              <option value="CARTAS">Cartas</option>
              <option value="ROUPA">Roupa</option>
              <option value="SAPATILHAS">Sapatilhas</option>
              <option value="BILHETES">Bilhetes</option>
              <option value="RANDOM">Random</option>
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
              <option value="buy_date_desc">Data de compra (desc)</option>
              <option value="buy_date_asc">Data de compra (asc)</option>
              <option value="title_asc">Nome (A-Z)</option>
              <option value="title_desc">Nome (Z-A)</option>
              <option value="price_desc">Preço produto (desc)</option>
              <option value="price_asc">Preço produto (asc)</option>
              <option value="stock_desc">Stock (desc)</option>
              <option value="stock_asc">Stock (asc)</option>
            </select>
          </label>

        </div>
      </section>

      <div className="table-scroll">
        <table className="inventario-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Quantidade</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Preço produto</th>
              <th className="col-nowrap">Preço total</th>
              <th className="col-nowrap">Data de compra</th>
              <th>Tempo de Hold</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => {
            const status = item.quantity > item.sold_quantity_total ? "EM STOCK" : "VENDIDO";
            const stock = item.quantity - item.sold_quantity_total;
            const isEditing = editingId === item.id;
            const unitPrice = isEditing ? Number(editForm.buy_price || 0) : item.buy_price;
            const quantity = isEditing ? Number(editForm.quantity || 0) : item.quantity;
            const totalPrice = unitPrice * quantity;
            return (
              <tr key={item.id}>
                <td>
                  {isEditing ? (
                    <input
                      value={editForm.title}
                      onChange={(e) => setEditForm((previous) => ({ ...previous, title: e.target.value }))}
                    />
                  ) : (
                    item.title
                  )}
                </td>
                <td>{item.type}</td>
                <td>
                  {isEditing ? (
                    <input
                      type="number"
                      min={1}
                      value={editForm.quantity}
                      onChange={(e) => setEditForm((previous) => ({ ...previous, quantity: Number(e.target.value) }))}
                    />
                  ) : (
                    item.quantity
                  )}
                </td>
                <td>{stock}</td>
                <td>
                  <span className={status === "EM STOCK" ? "status-stock" : "status-vendido"}>{status}</span>
                </td>
                <td>
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editForm.buy_price}
                      onChange={(e) => setEditForm((previous) => ({ ...previous, buy_price: e.target.value }))}
                    />
                  ) : (
                    <>€ {unitPrice.toFixed(2)}</>
                  )}
                </td>
                <td className="col-nowrap">€ {totalPrice.toFixed(2)}</td>
                <td>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editForm.buy_date}
                      onChange={(e) => setEditForm((previous) => ({ ...previous, buy_date: e.target.value }))}
                    />
                  ) : (
                    <span className="col-nowrap">{item.buy_date}</span>
                  )}
                </td>
                <td>{getHoldDays(item.buy_date)} dias</td>
                <td>
                  {isEditing ? (
                    <>
                      <button disabled={savingId === item.id} onClick={() => saveEdit(item.id)}>
                        {savingId === item.id ? "A guardar..." : "Guardar"}
                      </button>
                      <button onClick={cancelEdit}>Cancelar</button>
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
                            startEdit(item);
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="menu-item"
                          disabled={deletingId === item.id}
                          onClick={(event) => {
                            closeMenuFromElement(event.currentTarget);
                            deleteItem(item.id);
                          }}
                        >
                          {deletingId === item.id ? "A apagar..." : "Apagar"}
                        </button>
                        <button
                          type="button"
                          className="menu-item"
                          disabled={status !== "EM STOCK"}
                          onClick={(event) => {
                            closeMenuFromElement(event.currentTarget);
                            router.push(`/inventario/vender/${item.id}`);
                          }}
                        >
                          Marcar como vendido
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

      {visibleItems.length === 0 && <p className="empty-state">Sem itens para os filtros selecionados.</p>}

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
        .inventario-container {
          padding: 2rem;
        }
        .filters-card {
          border: 1px solid #dbe7fb;
          border-radius: 1rem;
          margin: 0 0 1.25rem;
          overflow: hidden;
          background: linear-gradient(180deg, #ffffff, #f6f9ff);
          box-shadow: 0 10px 28px rgba(29, 78, 216, 0.08);
        }
        .import-card {
          border: 1px solid #dbe7fb;
          border-radius: 1rem;
          margin: 0 0 1.25rem;
          padding: 1rem;
          background: linear-gradient(180deg, #ffffff, #f6f9ff);
          box-shadow: 0 10px 28px rgba(29, 78, 216, 0.08);
        }
        .import-card h3 {
          margin: 0 0 0.4rem;
        }
        .import-card p {
          margin: 0.2rem 0 0.8rem;
          color: #4f6178;
        }
        .import-template {
          font-size: 0.85rem;
          word-break: break-word;
        }
        .import-preview {
          margin-top: 0.8rem;
        }
        .import-warn {
          color: #8a5500;
        }
        .import-muted {
          margin-top: 0.5rem;
          font-size: 0.85rem;
          color: #4f6178;
        }
        .import-success {
          color: #14653b;
          font-weight: 600;
        }
        .import-btn {
          margin-top: 0.7rem;
          background: linear-gradient(180deg, #2563eb, #1d4ed8);
          color: #fff;
          border: 1px solid #1d4ed8;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.25);
        }
        .import-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
        }
        .import-errors {
          margin: 0.65rem 0;
          border: 1px solid #f3d3d0;
          background: #fff7f7;
          border-radius: 0.6rem;
          padding: 0.55rem 0.7rem;
        }
        .import-errors p {
          margin: 0 0 0.35rem;
          color: #7a271a;
          font-weight: 600;
        }
        .import-errors ul {
          margin: 0;
          padding-left: 1.1rem;
          color: #7a271a;
          font-size: 0.9rem;
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
          gap: 0.4rem;
          font-weight: 500;
        }
        .filters-actions {
          display: flex;
          gap: 0.55rem;
          align-items: center;
        }
        .filters-actions .apply-btn {
          background: linear-gradient(180deg, #2563eb, #1d4ed8);
          color: #fff;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.25);
        }
        .filters-actions .apply-btn:hover { background: linear-gradient(180deg, #1d4ed8, #1e40af); }
        .filters-actions .clear-btn {
          background: #edf3ff;
          color: #123264;
          border: 1px solid #cfe0ff;
          padding: 0.42rem 0.62rem;
          border-radius: 0.55rem;
        }
        .filters-actions .clear-btn:hover {
          background: #e0ecff;
        }
        .filters-actions .export-btn {
          background: #ffffff;
          color: #123264;
          border: 1px solid #cfe0ff;
          padding: 0.42rem 0.62rem;
          border-radius: 0.55rem;
        }
        .filters-actions .export-btn:hover {
          background: #f4f8ff;
        }
        .filters-actions .export-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .inventario-table {
          width: 100%;
          min-width: 980px;
          border-collapse: collapse;
        }
        .table-scroll {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        th, td {
          padding: 0.75rem;
          border-bottom: 1px solid #e9f0ff;
          text-align: center;
        }
        tbody tr:hover {
          background: #f3f7ff;
        }
        .inventario-table .col-nowrap {
          white-space: nowrap;
        }
        .status-stock {
          background: #e7f7ee;
          color: #14653b;
          padding: 0.3em 0.8em;
          border-radius: 1em;
          font-weight: 500;
          white-space: nowrap;
        }
        .status-vendido {
          background: #eef3fb;
          color: #4f6178;
          padding: 0.3em 0.8em;
          border-radius: 1em;
          font-weight: 500;
          white-space: nowrap;
        }
        .table-error {
          color: #b42318;
          margin: 0 0 1rem;
        }
        button {
          margin-right: 0.5em;
          padding: 0.42em 0.85em;
          border: 1px solid #cfe0ff;
          border-radius: 0.5em;
          background: #eef4ff;
          color: #123264;
          cursor: pointer;
        }
        button:hover {
          background: #e0ecff;
          transform: translateY(-1px);
        }
        .add-btn {
          margin-bottom: 1em;
          padding: 0.5em 1em;
          background: linear-gradient(180deg, #2563eb, #1d4ed8);
          color: #fff;
          border: 1px solid #1d4ed8;
          border-radius: 0.5em;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.25);
        }
        .add-btn:hover {
          background: linear-gradient(180deg, #1d4ed8, #1e40af);
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
          min-width: 190px;
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
        }
        .menu-item:hover {
          background: #edf3ff;
        }
        input {
          width: 100%;
          min-width: 90px;
          padding: 0.3rem 0.45rem;
          border: 1px solid #d5e2f8;
          border-radius: 0.35rem;
        }
        input:focus {
          border-color: #3b82f6;
          outline: 2px solid #dbeafe;
        }
        select {
          width: 100%;
          min-width: 90px;
          padding: 0.45rem 0.5rem;
          border: 1px solid #d5e2f8;
          border-radius: 0.35rem;
          background: #fff;
        }
        select:focus {
          border-color: #3b82f6;
          outline: 2px solid #dbeafe;
        }
        .empty-state {
          margin-top: 0.8rem;
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
          .inventario-container {
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
