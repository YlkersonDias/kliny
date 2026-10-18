import { describe, expect, it } from 'vitest'
import { decodeStatement, OfxError, parseOfx, parseOfxAmount, parseOfxDate } from './ofx'

// Extratos de exemplo com dados inventados, no jeito de cada banco.
const SGML_HEADER = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE
`

function bank(bankId: string, acctId: string, transactions: string): string {
  return `${SGML_HEADER}
<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>20261005<LANGUAGE>POR</SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>${bankId}
<ACCTID>${acctId}
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20261001
<DTEND>20261005
${transactions}
</BANKTRANLIST>
<LEDGERBAL><BALAMT>100.00<DTASOF>20261005</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`
}

describe('parseOfx', () => {
  it('Inter: SGML com MEMO e FITID', () => {
    const text = bank('077', '12345678', `<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261001
<TRNAMT>3500.00
<FITID>INTER-0001
<MEMO>Pix recebido: "Empresa Exemplo Ltda"
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261002
<TRNAMT>-42.9
<FITID>INTER-0002
<MEMO>Compra no debito: Mercado Bom Preco
</STMTTRN>`)
    const { lines, skipped } = parseOfx(text)
    expect(skipped).toBe(0)
    expect(lines).toEqual([
      { source: '077:5678', externalId: 'INTER-0001', date: '2026-10-01', amount: 3500, description: 'Pix recebido: "Empresa Exemplo Ltda"', occurrence: 1 },
      { source: '077:5678', externalId: 'INTER-0002', date: '2026-10-02', amount: -42.9, description: 'Compra no debito: Mercado Bom Preco', occurrence: 1 },
    ])
  })

  it('Nubank: cartão de crédito, tags fechadas e data com fuso', () => {
    const text = `${SGML_HEADER}
<OFX>
<CREDITCARDMSGSRSV1>
<CCSTMTTRNRS>
<CCSTMTRS>
<CURDEF>BRL</CURDEF>
<CCACCTFROM><ACCTID>a1b2c3d4-0000-4000-8000-1234567890ab</ACCTID></CCACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20261003000000[-3:BRT]</DTPOSTED>
<TRNAMT>-59.90</TRNAMT>
<FITID>6512a1b2c3d4e5f6a7b8c9d0</FITID>
<MEMO>Streaming Exemplo</MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20261004000000[-3:BRT]</DTPOSTED>
<TRNAMT>1200.00</TRNAMT>
<FITID>6512a1b2c3d4e5f6a7b8c9d1</FITID>
<MEMO>Pagamento recebido</MEMO>
</STMTTRN>
</BANKTRANLIST>
</CCSTMTRS>
</CCSTMTTRNRS>
</CREDITCARDMSGSRSV1>
</OFX>`
    const { lines } = parseOfx(text)
    expect(lines.map((l) => [l.source, l.date, l.amount, l.description])).toEqual([
      ['cc:90ab', '2026-10-03', -59.9, 'Streaming Exemplo'],
      ['cc:90ab', '2026-10-04', 1200, 'Pagamento recebido'],
    ])
  })

  it('Bradesco: NAME e MEMO diferentes viram uma descrição só', () => {
    const text = bank('0237', '0012345-6', `<STMTTRN>
<TRNTYPE>OTHER
<DTPOSTED>20261002120000
<TRNAMT>-150.00
<FITID>20261002150001
<NAME>PIX QR CODE
<MEMO>PADARIA EXEMPLO
</STMTTRN>
<STMTTRN>
<TRNTYPE>OTHER
<DTPOSTED>20261003120000
<TRNAMT>-80.00
<FITID>20261003080001
<NAME>TARIFA
<MEMO>TARIFA BANCARIA CESTA
</STMTTRN>`)
    const { lines } = parseOfx(text)
    expect(lines.map((l) => [l.source, l.description])).toEqual([
      ['0237:3456', 'PIX QR CODE - PADARIA EXEMPLO'],
      ['0237:3456', 'TARIFA BANCARIA CESTA'],
    ])
  })

  it('Itaú: duas compras iguais no mesmo dia com o mesmo FITID ficam como duas linhas', () => {
    const repeated = `<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261005
<TRNAMT>-4.50
<FITID>20261005001
<MEMO>CAFE EXEMPLO 05/10
</STMTTRN>`
    const text = bank('0341', '1234 56789-0', `${repeated}\n${repeated}`)
    const { lines } = parseOfx(text)
    expect(lines.map((l) => [l.source, l.externalId, l.occurrence])).toEqual([
      ['0341:7890', '20261005001', 1],
      ['0341:7890', '20261005001', 2],
    ])
  })

  it('Caixa: vírgula decimal e milhar com ponto', () => {
    const text = bank('104', '000123456789', `<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261001
<TRNAMT>-25,00
<FITID>000001
<MEMO>CP MAESTRO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261001
<TRNAMT>1.234,56
<FITID>000002
<MEMO>CRED PIX
</STMTTRN>`)
    expect(parseOfx(text).lines.map((l) => l.amount)).toEqual([-25, 1234.56])
  })

  it('Santander: sem FITID, a descrição separa as linhas e a posição separa as iguais', () => {
    const line = (memo: string) => `<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261002
<TRNAMT>-10.00
<MEMO>${memo}
</STMTTRN>`
    const text = bank('033', '01.012345-6', [line('UBER *TRIP'), line('UBER *TRIP'), line('IFOOD *PEDIDO')].join('\n'))
    const { lines } = parseOfx(text)
    expect(lines.map((l) => [l.externalId, l.description, l.occurrence])).toEqual([
      [null, 'UBER *TRIP', 1],
      [null, 'UBER *TRIP', 2],
      [null, 'IFOOD *PEDIDO', 1],
    ])
    expect(lines[0].source).toBe('033:3456')
  })

  it('OFX 2.x em XML, com entidades', () => {
    const text = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="211" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>260</BANKID><ACCTID>9876543</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261001</DTPOSTED><TRNAMT>-30.00</TRNAMT><FITID>x1</FITID><MEMO>Loja A &amp; B &#233;</MEMO></STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
    expect(parseOfx(text).lines[0]).toMatchObject({ source: '260:6543', description: 'Loja A & B é', amount: -30 })
  })

  it('várias contas no mesmo arquivo', () => {
    const one = bank('077', '1111', '<STMTTRN>\n<DTPOSTED>20261001\n<TRNAMT>-1.00\n<FITID>A\n<MEMO>X\n</STMTTRN>')
    const two = bank('077', '2222', '<STMTTRN>\n<DTPOSTED>20261001\n<TRNAMT>-1.00\n<FITID>A\n<MEMO>X\n</STMTTRN>')
    const statements = [one, two].map((t) => t.slice(t.indexOf('<STMTRS>'), t.indexOf('</STMTRS>') + 9)).join('\n')
    expect(parseOfx(`<OFX>${statements}</OFX>`).lines.map((l) => [l.source, l.occurrence])).toEqual([['077:1111', 1], ['077:2222', 1]])
  })

  it('linhas sem data ou valor, ou com valor zero, ficam de fora e são contadas', () => {
    const text = bank('077', '1', `<STMTTRN>
<DTPOSTED>20261301
<TRNAMT>-1.00
</STMTTRN>
<STMTTRN>
<DTPOSTED>20261001
<TRNAMT>abc
</STMTTRN>
<STMTTRN>
<DTPOSTED>20261001
<TRNAMT>0.00
</STMTTRN>
<STMTTRN>
<DTPOSTED>20261001
<TRNAMT>-2.00
<TRNTYPE>FEE
</STMTTRN>`)
    const { lines, skipped } = parseOfx(text)
    expect(skipped).toBe(3)
    expect(lines).toHaveLength(1)
    expect(lines[0].description).toBe('FEE')
  })

  it('descrição longa é cortada em 255 caracteres', () => {
    const text = bank('077', '1', `<STMTTRN>\n<DTPOSTED>20261001\n<TRNAMT>-1\n<MEMO>${'a'.repeat(400)}\n</STMTTRN>`)
    expect(parseOfx(text).lines[0].description).toHaveLength(255)
  })

  it('recusa o que não é OFX e o OFX sem movimentações', () => {
    expect(() => parseOfx('data;valor\n01/10/2026;10')).toThrow(OfxError)
    expect(() => parseOfx(bank('077', '1', ''))).toThrow(expect.objectContaining({ code: 'empty' }))
    expect(() => parseOfx('<html>')).toThrow(expect.objectContaining({ code: 'notOfx' }))
  })
})

describe('decodeStatement', () => {
  it('lê UTF-8 e Windows-1252', () => {
    expect(decodeStatement(new TextEncoder().encode('<MEMO>Padaria São João'))).toBe('<MEMO>Padaria São João')
    // "São João" em Windows-1252: ã = 0xE3.
    const bytes = new Uint8Array([0x53, 0xe3, 0x6f, 0x20, 0x4a, 0x6f, 0xe3, 0x6f])
    expect(decodeStatement(bytes)).toBe('São João')
  })
})

describe('parseOfxAmount', () => {
  it.each([
    ['-12.34', -12.34], ['12', 12], ['+5.5', 5.5], [' -1 234.56 ', -1234.56], ['-12,34', -12.34],
    ['1.234,56', 1234.56], ['1,234.56', 1234.56], ['-12.5000', -12.5], ['0.1', 0.1],
  ])('%s vira %s', (raw, value) => {
    expect(parseOfxAmount(raw)).toBe(value)
  })

  it.each(['', 'abc', '-12.345', '1e5', '--1', '9999999999999.00'])('recusa %s', (raw) => {
    expect(parseOfxAmount(raw)).toBeNull()
  })
})

describe('parseOfxDate', () => {
  it.each([
    ['20261005', '2026-10-05'], ['20261005120000', '2026-10-05'], ['20261005120000.000[-3:BRT]', '2026-10-05'],
    ['2026-10-05', '2026-10-05'], ['20240229', '2024-02-29'],
  ])('%s vira %s', (raw, iso) => {
    expect(parseOfxDate(raw)).toBe(iso)
  })

  it.each(['', '2026105', '20230229', '20261332'])('recusa %s', (raw) => {
    expect(parseOfxDate(raw)).toBeNull()
  })
})
