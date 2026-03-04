import Link from "next/link";

export default function Home() {
  return (
    <div className="dashboard-page">
      <section className="card">
        <div className="card-header">
          <h1 className="text-2xl font-semibold text-slate-900">Bem-vindo ao ResellTracker</h1>
          <p className="mt-2 text-sm text-slate-600">
            Esta plataforma ajuda-te a controlar compras, vendas e performance do teu negócio de revenda.
          </p>
        </div>
        <div className="card-content">
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/inventario" className="btn btn-primary text-center">
              Ir para Inventário
            </Link>
            <Link href="/vendas" className="btn btn-ghost text-center">
              Ir para Vendas
            </Link>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold text-slate-900">Guia rápido</h2>
        </div>
        <div className="card-content">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <a
              href="https://forms.gle/R2Dg8pdhijD8Y7iu5"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary text-center"
            >
              Google Forms (Feedback)
            </a>
            <a
              href="https://discord.gg/y42dW3Py"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost text-center"
            >
              Entrar no Discord
            </a>
          </div>
          <ol className="list-decimal space-y-3 pl-5 text-slate-700">
            <li>
              <strong>Adicionar compras:</strong> entra em <span className="font-semibold">Inventário</span> e cria os teus itens.
            </li>
            <li>
              <strong>Registar vendas:</strong> marca itens como vendidos e guarda preços, taxas e plataforma.
            </li>
            <li>
              <strong>Acompanhar resultados:</strong> consulta os dashboards mensal, anual e global.
            </li>
            <li>
              <strong>Tomar decisões:</strong> usa lucro, margem e tempo de hold para otimizar compras futuras.
            </li>
            <li>
              <strong>Importar CSV (beta):</strong> no <span className="font-semibold">Inventário</span>, carrega o ficheiro,
              valida o preview e clica em importar linhas válidas.
            </li>
          </ol>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold text-slate-900">Por onde começar?</h2>
        </div>
        <div className="card-content">
          <p className="mb-3 text-slate-700">Recomendação: adiciona 3 produtos no inventário e regista a primeira venda.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/inventario/nova-compra" className="btn btn-primary text-center">
              Nova compra
            </Link>
            <Link href="/dashboard/mensal" className="btn btn-ghost text-center">
              Dashboard mensal
            </Link>
            <Link href="/dashboard/global" className="btn btn-ghost text-center">
              Dashboard global
            </Link>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold text-slate-900">Feedback</h2>
        </div>
        <div className="card-content">
          <p className="mb-3 text-slate-700">Ajuda-nos a melhorar: preenche o Google Forms de feedback da aplicação.</p>
          <a
            href="https://forms.gle/R2Dg8pdhijD8Y7iu5"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary inline-block text-center"
          >
            Abrir Google Forms
          </a>
        </div>
      </section>
    </div>
  );
}
