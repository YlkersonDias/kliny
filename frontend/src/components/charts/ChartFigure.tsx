import { Suspense, type ReactNode } from 'react'

interface ChartFigureProps {
  labelledBy: string
  chart: ReactNode
  // A mesma altura do gráfico, para a tela não pular enquanto ele carrega.
  heightClass: string
  caption: ReactNode
  tableLabel: string
  table: ReactNode
  before?: ReactNode
}

// O gráfico é só visual (aria-hidden): quem usa leitor de tela recebe o resumo e a tabela completa.
export function ChartFigure({ labelledBy, chart, heightClass, caption, tableLabel, table, before }: ChartFigureProps) {
  return (
    <figure aria-labelledby={labelledBy} className="m-0">
      {before}
      {/* overflow-hidden: ao encolher a janela, o Recharts mantém a largura antiga por um instante. */}
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
