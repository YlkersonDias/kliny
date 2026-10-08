// Cor da barra do navegador e do app instalado (<meta name="theme-color">, 7.4): o fundo das
// páginas (--color-background do index.css) de cada tema. O script do index.html repete estas
// cores; o theme-colors.test.ts (na raiz do frontend) confere os três lugares.
// Sem nada do navegador aqui: o teste roda com os tipos do Node.
export const THEME_COLORS = { dark: '#12132A', light: '#E0E0EE' } as const
