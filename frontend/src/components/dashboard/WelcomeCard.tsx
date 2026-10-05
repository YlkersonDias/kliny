import { Link } from 'react-router'
import { APP_NAME } from '../../config/app'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

// Conta sem nenhuma movimentação: orienta a lançar o "Saldo inicial",
// já que a API não tem campo de saldo de abertura.
export function WelcomeCard({ onStart }: { onStart: () => void }) {
  return (
    <section
      aria-labelledby="comece"
      className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-surface p-6 text-center sm:flex-row sm:items-center sm:p-8 sm:text-left"
    >
      {/* Decorativa: o título já diz tudo. */}
      <picture className="shrink-0">
        <source srcSet="/mascote/kliny-acenando-512.webp" type="image/webp" />
        <img
          src="/mascote/kliny-acenando-512.png"
          width={512}
          height={512}
          alt=""
          draggable={false}
          className="size-36 select-none sm:size-44"
        />
      </picture>
      <div>
        <h2 id="comece" className="text-xl font-semibold text-foreground sm:text-2xl">Comece pelo dinheiro que você já tem</h2>
        <p className="mt-2 max-w-prose text-muted">
          Lance uma receita chamada “Saldo inicial” com o valor que está na sua conta hoje.
          A partir dela, o {APP_NAME} calcula seu saldo.
        </p>
        <p className="mt-1 text-sm text-muted">Se a conta estiver no negativo, lance como gasto.</p>
        <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row">
          <Button onClick={onStart}>
            <Icon name="plus" className="size-4" />
            Lançar saldo inicial
          </Button>
          <Link
            to="/cofres"
            className="rounded px-2 py-2 text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            Criar um cofre
          </Link>
        </div>
      </div>
    </section>
  )
}
