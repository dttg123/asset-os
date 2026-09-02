export function cleanText(value, max = 160) {
  return String(value ?? '').trim().slice(0, max)
}

export function numberValue(value) {
  const number = Number(String(value ?? '').replaceAll(',', ''))
  return Number.isFinite(number) ? number : 0
}

export function nonNegative(value) {
  return Math.max(0, numberValue(value))
}

export function compactDate(value) {
  const digits = cleanText(value, 10).replaceAll('-', '')
  return /^\d{8}$/.test(digits)
    ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
    : ''
}

function pick(row, names) {
  for (const name of names) {
    if (row?.[name] !== undefined && row?.[name] !== null && String(row[name]).trim() !== '') {
      return row[name]
    }
  }
  return ''
}

function rows(value) {
  if (Array.isArray(value)) return value.filter((row) => row && typeof row === 'object')
  return value && typeof value === 'object' ? [value] : []
}

function side(value) {
  const code = cleanText(value, 20).toLowerCase()
  if (code === '01' || code === 'sell' || code.includes('매도')) return 'sell'
  if (code === '02' || code === 'buy' || code.includes('매수')) return 'buy'
  return ''
}

export function normalizeOrders(input) {
  const normalized = []
  for (const row of rows(input)) {
    const filledQty = nonNegative(pick(row, ['tot_ccld_qty', 'ccld_qty', 'exec_qty']))
    const avgPrice = nonNegative(pick(row, ['avg_prvs', 'avg_pric', 'ccld_unpr']))
    const filledAmount = nonNegative(pick(row, ['tot_ccld_amt', 'ccld_amt'])) || filledQty * avgPrice
    const cancelledQty = nonNegative(pick(row, ['cncl_cfrm_qty', 'cncl_qty']))
    const order = {
      orderDate: compactDate(pick(row, ['ord_dt', 'ord_date'])),
      orderTime: cleanText(pick(row, ['ord_tmd', 'ord_time']), 12),
      branchNo: cleanText(pick(row, ['ord_gno_brno', 'ord_brno']), 40),
      orderNo: cleanText(pick(row, ['odno', 'ord_no']), 80),
      productCode: cleanText(pick(row, ['pdno', 'prdt_no']), 80),
      productName: cleanText(pick(row, ['prdt_name', 'prdt_name1', 'item_name']), 160),
      exchangeCode: cleanText(pick(row, ['excg_id_dvsn_cd', 'excg_dvsn_cd', 'mket_name']), 30),
      side: side(pick(row, ['sll_buy_dvsn_cd', 'sll_buy_dvsn_cd_name', 'trad_dvsn_name'])),
      orderQty: nonNegative(pick(row, ['ord_qty'])),
      filledQty,
      filledAmount,
      remainingQty: nonNegative(pick(row, ['nccs_qty', 'rmn_qty'])),
      cancelledQty,
      fee: nonNegative(pick(row, ['fee_amt', 'tot_fee'])),
      tax: nonNegative(pick(row, ['tax_amt', 'tot_tax'])),
      cancelled: cleanText(pick(row, ['cncl_yn']), 4).toUpperCase() === 'Y' || cancelledQty > 0,
    }
    if (order.orderDate && order.orderNo && order.productCode && order.side) normalized.push(order)
  }
  return normalized
}

export function normalizeBalance(body, fetchedAt = new Date().toISOString()) {
  const output1 = rows(body?.output1)
  const summary = rows(body?.output2)[0] || {}
  const holdings = output1.map((row) => ({
    productCode: cleanText(pick(row, ['pdno', 'prdt_no']), 80),
    productName: cleanText(pick(row, ['prdt_name', 'prdt_name1']), 160),
    quantity: nonNegative(pick(row, ['hldg_qty', 'cblc_qty', 'hold_qty'])),
    avgPrice: nonNegative(pick(row, ['pchs_avg_pric', 'avg_pric'])),
    currentPrice: nonNegative(pick(row, ['prpr', 'now_pric'])),
    marketValue: nonNegative(pick(row, ['evlu_amt', 'evlu_amt_smtl_amt'])),
    profitLoss: numberValue(pick(row, ['evlu_pfls_amt', 'evlu_pfls_amt2'])),
  })).filter((row) => row.productCode)

  const holdingsValue = holdings.reduce((sum, row) => sum + row.marketValue, 0)
  const cash = nonNegative(pick(summary, [
    'dnca_tot_amt', 'prvs_rcdl_excc_amt', 'nxdy_excc_amt', 'd2_auto_rdpt_amt', 'cash_amt',
  ]))
  const securitiesValue = nonNegative(pick(summary, [
    'scts_evlu_amt', 'evlu_amt_smtl_amt',
  ])) || holdingsValue
  const totalValue = nonNegative(pick(summary, [
    'tot_evlu_amt', 'tot_asst_amt', 'nass_amt',
  ])) || cash + securitiesValue

  return {
    date: cleanText(fetchedAt, 10),
    cash,
    securitiesValue,
    totalValue,
    holdings,
  }
}

export function normalizeRights(input) {
  const normalized = []
  for (const row of rows(input)) {
    const right = {
      rightTypeCode: cleanText(pick(row, ['rght_type_cd']), 30),
      baseDate: compactDate(pick(row, ['bass_dt'])),
      cashPaymentDate: compactDate(pick(row, ['cash_dfrm_dt'])),
      productCode: cleanText(pick(row, ['pdno', 'prdt_no']), 80),
      productName: cleanText(pick(row, ['prdt_name', 'prdt_name1']), 160),
      amount: nonNegative(pick(row, ['last_alct_amt', 'alct_amt'])),
      tax: nonNegative(pick(row, ['tax_amt'])),
    }
    if (right.rightTypeCode && right.productCode && (right.baseDate || right.cashPaymentDate)) {
      normalized.push(right)
    }
  }
  return normalized
}

export function safeRange(from, to, defaultDays, maxDays, now = new Date()) {
  const cleanTo = cleanText(to, 10)
  const cleanFrom = cleanText(from, 10)
  const end = /^\d{4}-\d{2}-\d{2}$/.test(cleanTo) ? new Date(`${cleanTo}T00:00:00Z`) : now
  const fallback = new Date(end)
  fallback.setUTCDate(fallback.getUTCDate() - defaultDays)
  const start = /^\d{4}-\d{2}-\d{2}$/.test(cleanFrom) ? new Date(`${cleanFrom}T00:00:00Z`) : fallback
  const span = Math.floor((end.getTime() - start.getTime()) / 86400000)
  if (!Number.isFinite(span) || span < 0 || span > maxDays) throw new Error('DATE_RANGE_INVALID')
  const ymd = (date) => date.toISOString().slice(0, 10).replaceAll('-', '')
  return { from: ymd(start), to: ymd(end) }
}
