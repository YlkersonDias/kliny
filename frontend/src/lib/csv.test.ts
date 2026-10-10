import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyMapping, csvSource, detectDateFormat, findHeaderRow, guessMapping, layoutKey, mappingError, parseCsv,
  parseCsvAmount, parseCsvDate, type CsvMapping,
} from './csv'
import { restoreMapping, saveMapping } from './csvMappingStore'

// Extratos de exemplo com dados inventados, no jeito de layouts conhecidos (conta e cartão do
// Nubank, conta do Inter) e de extratos com colunas de crédito e débito. São modelos, não arquivos reais.

const NUBANK_CONTA = `Data,Valor,Identificador,Descrição
01/10/2026,3500.00,6512a1b2-0001-4000-8000-000000000001,Transferência recebida pelo Pix - EMPRESA EXEMPLO LTDA
02/10/2026,-42.90,6512a1b2-0002-4000-8000-000000000002,Compra no débito - Mercado Bom Preço
03/10/2026,-300.00,6512a1b2-0003-4000-8000-000000000003,Aplicação RDB
`

const NUBANK_CARTAO = `date,title,amount
2026-10-03,Streaming Exemplo,59.90
2026-10-04,Pagamento recebido,-1200.00
2026-10-05,Uber *Trip,18.40
`

const INTER = `Extrato Conta Corrente
Conta ;12345678
Período ;01/10/2026 a 05/10/2026
Saldo ;1.000,00

Data Lançamento;Histórico;Descrição;Valor;Saldo
01/10/2026;Pix recebido;Empresa Exemplo;3.500,00;4.500,00
02/10/2026;Compra no débito;Padaria Pão Quente;-12,50;4.487,50
02/10/2026;Pix enviado;Maria;-100,00;4.387,50
`

const CREDITO_DEBITO = `Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)
01/10/2026;SALDO ANTERIOR;;;;1.000,00
02/10/2026;PIX RECEBIDO;123;250,00;;1.250,00
03/10/2026;TARIFA BANCARIA;456;;35,90;1.214,10
`

describe('parseCsv', () => {
  it('separador ponto e vírgula, vírgula ou tab', () => {
    expect(parseCsv('a;b;c\n1;2;3').delimiter).toBe(';')
    expect(parseCsv('a,b,c\n1,2,3').delimiter).toBe(',')
    expect(parseCsv('a\tb\tc\n1\t2\t3').delimiter).toBe('\t')
  })

  it('aspas com vírgula, aspas e quebra de linha dentro do campo', () => {
    const { rows } = parseCsv('"Data","Descrição","Valor"\r\n"01/10/2026","Loja ""A"", Centro","-10,50"\r\n"02/10/2026","duas\nlinhas","1,00"\r\n')
    expect(rows).toEqual([
      ['Data', 'Descrição', 'Valor'],
      ['01/10/2026', 'Loja "A", Centro', '-10,50'],
      ['02/10/2026', 'duas\nlinhas', '1,00'],
    ])
  })

  it('ignora linhas vazias', () => {
    expect(parseCsv('a;b\n\n;\n1;2\n').rows).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('guessMapping e applyMapping', () => {
  it('Nubank conta: identificador e descrição pelo cabeçalho', () => {
    const { rows } = parseCsv(NUBANK_CONTA)
    const mapping = guessMapping(rows)
    expect(mapping).toMatchObject({ headerRow: 0, hasHeader: true, date: 0, dateFormat: 'dmy', amount: 1, id: 2, description: 3, invert: false })
    const { lines, skipped } = applyMapping(rows, mapping)
    expect(skipped).toBe(0)
    expect(lines[1]).toEqual({
      source: csvSource(rows, mapping), externalId: '6512a1b2-0002-4000-8000-000000000002', date: '2026-10-02',
      amount: -42.9, description: 'Compra no débito - Mercado Bom Preço', occurrence: 1,
    })
  })

  it('Nubank cartão: data ano-mês-dia e, com "inverter", a compra vira gasto', () => {
    const { rows } = parseCsv(NUBANK_CARTAO)
    const mapping = guessMapping(rows)
    expect(mapping).toMatchObject({ date: 0, dateFormat: 'ymd', description: 1, amount: 2, id: null })
    const { lines } = applyMapping(rows, { ...mapping, invert: true })
    expect(lines.map((l) => [l.date, l.description, l.amount])).toEqual([
      ['2026-10-03', 'Streaming Exemplo', -59.9],
      ['2026-10-04', 'Pagamento recebido', 1200],
      ['2026-10-05', 'Uber *Trip', -18.4],
    ])
  })

  it('Inter: pula as linhas antes da tabela, junta Histórico e Descrição e não usa o Saldo', () => {
    const { rows } = parseCsv(INTER)
    const mapping = guessMapping(rows)
    expect(rows[mapping.headerRow][0]).toBe('Data Lançamento')
    expect(mapping).toMatchObject({ hasHeader: true, date: 0, description: 1, description2: 2, amount: 3 })
    const { lines, skipped } = applyMapping(rows, mapping)
    expect(skipped).toBe(0)
    expect(lines.map((l) => [l.description, l.amount])).toEqual([
      ['Pix recebido - Empresa Exemplo', 3500],
      ['Compra no débito - Padaria Pão Quente', -12.5],
      ['Pix enviado - Maria', -100],
    ])
  })

  it('crédito e débito em colunas separadas; a linha sem valor fica de fora', () => {
    const { rows } = parseCsv(CREDITO_DEBITO)
    const mapping = guessMapping(rows)
    expect(mapping).toMatchObject({ amount: null, credit: 3, debit: 4, description: 1 })
    const { lines, skipped } = applyMapping(rows, mapping)
    expect(skipped).toBe(1)
    expect(lines.map((l) => [l.description, l.amount])).toEqual([['PIX RECEBIDO', 250], ['TARIFA BANCARIA', -35.9]])
  })

  it('sem cabeçalho: as colunas vêm pelo conteúdo', () => {
    const { rows } = parseCsv('05/10/2026;PADARIA DO BAIRRO;-12,00\n06/10/2026;SALARIO;3000,00\n')
    const mapping = guessMapping(rows)
    expect(mapping).toMatchObject({ hasHeader: false, date: 0, description: 1, amount: 2 })
    expect(applyMapping(rows, mapping).lines.map((l) => l.amount)).toEqual([-12, 3000])
    expect(csvSource(rows, mapping)).toBe('csv')
  })

  it('compras iguais no mesmo dia viram as posições 1 e 2', () => {
    const { rows } = parseCsv('Data;Descrição;Valor\n01/10/2026;Café;-4,50\n01/10/2026;Café;-4,50\n')
    expect(applyMapping(rows, guessMapping(rows)).lines.map((l) => l.occurrence)).toEqual([1, 2])
  })

  it('sem coluna de valor, a escolha está incompleta', () => {
    const mapping = guessMapping(parseCsv('Data;Descrição\n01/10/2026;x\n').rows)
    expect(mappingError({ ...mapping, amount: null })).toBe('amount')
  })
})

describe('findHeaderRow', () => {
  it('a primeira linha com o número de colunas mais comum', () => {
    expect(findHeaderRow([['Extrato'], ['Conta', '1'], ['a', 'b', 'c'], ['1', '2', '3'], ['4', '5', '6']])).toBe(2)
  })
})

describe('layoutKey e csvSource', () => {
  it('o mesmo cabeçalho dá a mesma chave, sem diferenciar maiúsculas nem acentos', () => {
    expect(layoutKey(['Data', 'Descrição', 'Valor'])).toBe(layoutKey(['DATA', 'descricao', 'valor']))
    expect(layoutKey(['Data', 'Descrição', 'Valor'])).not.toBe(layoutKey(['Data', 'Valor', 'Descrição']))
    expect(layoutKey(['a'])).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('detectDateFormat e parseCsvDate', () => {
  it('detecta o formato', () => {
    expect(detectDateFormat(['01/10/2026', '13/10/2026'])).toBe('dmy')
    expect(detectDateFormat(['10/01/2026', '10/13/2026'])).toBe('mdy')
    expect(detectDateFormat(['2026-10-01'])).toBe('ymd')
    expect(detectDateFormat(['Data'])).toBeNull()
  })

  it.each([
    ['01/10/2026', 'dmy', '2026-10-01'], ['1/2/26', 'dmy', '2026-02-01'], ['01-10-2026 12:30', 'dmy', '2026-10-01'],
    ['10/13/2026', 'mdy', '2026-10-13'], ['2026-10-05', 'ymd', '2026-10-05'], ['2026/10/05', 'ymd', '2026-10-05'],
  ] as const)('%s (%s) vira %s', (raw, format, iso) => {
    expect(parseCsvDate(raw, format)).toBe(iso)
  })

  it.each([['31/02/2026', 'dmy'], ['13/13/2026', 'dmy'], ['ontem', 'dmy'], ['2026-13-01', 'ymd']] as const)('recusa %s', (raw, format) => {
    expect(parseCsvDate(raw, format)).toBeNull()
  })
})

describe('parseCsvAmount', () => {
  it.each([
    ['R$ 1.234,56', 1234.56], ['-R$ 12,00', -12], ['R$ -12,00', -12], ['(12,34)', -12.34], ['12,34-', -12.34], ['-42.90', -42.9],
  ])('%s vira %s', (raw, value) => {
    expect(parseCsvAmount(raw)).toBe(value)
  })

  it.each(['', 'Valor', '12,345'])('recusa %s', (raw) => {
    expect(parseCsvAmount(raw)).toBeNull()
  })
})

describe('csvMappingStore', () => {
  afterEach(() => vi.unstubAllGlobals())

  const base: CsvMapping = guessMapping(parseCsv(NUBANK_CARTAO).rows)

  it('guarda a escolha por layout e devolve na próxima vez', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    })
    saveMapping('abc', { ...base, invert: true, description: 2, amount: 1 })
    expect(restoreMapping('abc', base, 3)).toMatchObject({ invert: true, description: 2, amount: 1 })
    expect(restoreMapping('outro', base, 3)).toBe(base)
    // Coluna que não existe mais no arquivo: fica a sugestão.
    expect(restoreMapping('abc', base, 2)).toBe(base)
    expect(store.get('import.csvLayouts')).not.toContain('Streaming')
  })

  it('guarda no máximo 20 layouts, saindo o mais antigo', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    })
    for (let i = 0; i < 25; i++) saveMapping(`l${i}`, base)
    const saved = Object.keys(JSON.parse(store.get('import.csvLayouts')!))
    expect(saved).toHaveLength(20)
    expect(saved[0]).toBe('l5')
  })

  it('com o localStorage bloqueado ou com lixo, só não lembra', () => {
    const blocked = () => { throw new Error('SecurityError') }
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked })
    expect(() => saveMapping('abc', base)).not.toThrow()
    expect(restoreMapping('abc', base, 3)).toBe(base)
    vi.stubGlobal('localStorage', { getItem: () => '{"abc": {"date": "x"}}', setItem: () => undefined })
    expect(restoreMapping('abc', base, 3)).toBe(base)
  })
})
