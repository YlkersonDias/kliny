// Contas dos efeitos de rolagem da landing (8.6), sem DOM, para testar.

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// Quanto da trilha de recursos já andou (0 a 1). A seção é mais alta que a tela; enquanto ela
// passa, o conteúdo fica preso (sticky) e a trilha anda de lado.
export function tourProgress(sectionTop: number, sectionHeight: number, viewportHeight: number): number {
  const scrollable = sectionHeight - viewportHeight
  if (scrollable <= 0) return 0
  return clamp(-sectionTop / scrollable, 0, 1)
}

// Altura da seção para a trilha andar toda a largura dela: o que sobra da trilha além da tela,
// mais uma tela de altura.
export function tourHeight(trackWidth: number, viewportWidth: number, viewportHeight: number): number {
  return Math.max(0, trackWidth - viewportWidth) + viewportHeight
}

// Posição do elemento em relação ao meio da tela: -1 (acima) a 1 (abaixo), 0 no meio.
export function screenOffset(top: number, height: number, viewportHeight: number): number {
  if (viewportHeight <= 0) return 0
  return clamp((top + height / 2 - viewportHeight / 2) / viewportHeight, -1, 1)
}

// Um passo da suavização: anda uma fração do caminho até o alvo a cada quadro.
export function lerp(current: number, target: number, factor = 0.14): number {
  return current + (target - current) * factor
}
