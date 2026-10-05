import { Suspense, type ReactNode } from 'react'

interface ChartFigureProps {
  // Id do título da seção, que nomeia a figura.
  labelledBy: string
  // Gráfico do Recharts (lazy), com a própria altura. Fica escondido do leitor de tela.
  chart: ReactNode
  // Altura do bloco mostrado enquanto o gráfico carrega (a mesma do gráfico, para a tela não pular).
  heightClass: string
  // Resumo em texto, sempre visível.
  caption: ReactNode
  // Rótulo do <summary>, como "Ver gastos por dia em tabela".
  tableLabel: string
  // A tabela completa, com <caption> e th scope.
  table: ReactNode
  // Antes do gráfico (como uma legenda em HTML).
  before?: ReactNode
}

// Padrão dos gráficos (Dashboard e Relatórios): o gráfico é só visual (aria-hidden, e o Recharts
// com accessibilityLayer={false}); quem usa leitor de tela recebe o resumo e a tabela completa.
export function ChartFigure({ labelledBy, chart, heightClass, caption, tableLabel, table, before }: ChartFigureProps) {
  return (
    <figure aria-labelledby={labelledBy} className="m-0">
      {before}
      {/* overflow-hidden: ao encolher a janela, o Recharts mantém a largura antiga por um instante
          (até o ResponsiveContainer medir de novo) e empurrava a página para os lados. */}
      <div aria-hidden="true" className="mt-2 overflow-hidden">
        <Suspense fallback={<div className={`${heightClass} rounded-lg bg-background motion-safe:animate-pulse`} />}>
          {chart}
        </Suspense>
      </div>
      <figcaption className="mt-2 text-sm text-muted">{caption}</figcaption>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer rounded font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary">
          {tableLabel}
        </summary>
        <div className="mt-2 overflow-x-auto">{table}</div>
      </details>
    </figure>
  )
}
