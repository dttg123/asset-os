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

export function koreaDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
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
  if (Array.isArray(value)) {
    if (value.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('KIS_RESULT_INVALID')
    return value
  }
  if (value && typeof value === 'object') return [value]
  throw new Error('KIS_RESULT_INVALID')
}

// Preserve the distinction between a confirmed zero and an absent/broken field.
function amountField(row, names, error, optional = false, signed = false) {
  const raw = pick(row, names)
  if (raw === '') {
    if (optional) return null
    throw new Error(error)
  }
  const value = Number(String(raw).replaceAll(',', ''))
  if (!['string', 'number'].includes(typeof raw) || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER || (!signed && value < 0)) throw new Error(error)
  return value
}

export function normalizeQuote(row, type, requestedCode = '') {
  const kind = cleanText(type, 10).toLowerCase()
  const code = cleanText(pick(row, kind === 'bond' ? ['stnd_iscd', 'pdno'] : ['stck_shrn_iscd', 'mksc_shrn_iscd', 'pdno']), 20) || cleanText(requestedCode, 20)
  const name = cleanText(pick(row, kind === 'bond' ? ['hts_kor_isnm', 'prdt_name'] : ['hts_kor_isnm', 'bstp_kor_isnm', 'prdt_name']), 160)
  const price = nonNegative(pick(row, kind === 'bond' ? ['bond_prpr'] : ['stck_prpr']))
  const previousClose = nonNegative(pick(row, kind === 'bond' ? ['bond_prdy_clpr'] : ['stck_sdpr']))
  if (!['stock', 'bond'].includes(kind) || !code || !(price > 0)) return null
  return { type: kind, code, name, price, previousClose }
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
    const error = 'KIS_ORDERS_INVALID'
    const field = (names, optional = false) => amountField(row, names, error, optional)
    const filledQty = field(['tot_ccld_qty', 'ccld_qty', 'exec_qty'])
    const reportedAmount = field(['tot_ccld_amt', 'ccld_amt'], true)
    const avgPrice = field(['avg_prvs', 'avg_pric', 'ccld_unpr'], true)
    if (reportedAmount === null && filledQty > 0 && avgPrice === null) throw new Error(error)
    const filledAmount = reportedAmount ?? filledQty * (avgPrice ?? 0)
    if (!Number.isFinite(filledAmount) || filledAmount > Number.MAX_SAFE_INTEGER) throw new Error(error)
    const cancelledQty = field(['cncl_cfrm_qty', 'cncl_qty'], true) ?? 0
    const order = {
      orderDate: compactDate(pick(row, ['ord_dt', 'ord_date'])),
      orderTime: cleanText(pick(row, ['ord_tmd', 'ord_time']), 12),
      branchNo: cleanText(pick(row, ['ord_gno_brno', 'ord_brno']), 40),
      orderNo: cleanText(pick(row, ['odno', 'ord_no']), 80),
      productCode: cleanText(pick(row, ['pdno', 'prdt_no']), 80),
      productName: cleanText(pick(row, ['prdt_name', 'prdt_name1', 'item_name']), 160),
      exchangeCode: cleanText(pick(row, ['excg_id_dvsn_cd', 'excg_dvsn_cd', 'mket_name']), 30),
      side: side(pick(row, ['sll_buy_dvsn_cd', 'sll_buy_dvsn_cd_name', 'trad_dvsn_name'])),
      orderQty: field(['ord_qty'], true) ?? 0,
      filledQty,
      filledAmount,
      remainingQty: field(['nccs_qty', 'rmn_qty'], true) ?? 0,
      cancelledQty,
      fee: field(['fee_amt', 'tot_fee'], true) ?? 0,
      tax: field(['tax_amt', 'tot_tax'], true) ?? 0,
      cancelled: cleanText(pick(row, ['cncl_yn']), 4).toUpperCase() === 'Y' || cancelledQty > 0,
    }
    if (!order.orderDate || !order.orderNo || !order.productCode || !order.side) throw new Error(error)
    normalized.push(order)
  }
  return normalized
}

export function normalizeBalance(body, fetchedAt = new Date().toISOString()) {
  const output1 = rows(body?.output1)
  const summaries = rows(body?.output2)
  if (!summaries.length) throw new Error('KIS_BALANCE_INVALID')
  const summary = summaries[0]
  const error = 'KIS_BALANCE_INVALID'
  const holdings = output1.map((row) => ({
    productCode: cleanText(pick(row, ['pdno', 'prdt_no']), 80),
    productName: cleanText(pick(row, ['prdt_name', 'prdt_name1']), 160),
    quantity: amountField(row, ['hldg_qty', 'cblc_qty', 'hold_qty'], error),
    avgPrice: amountField(row, ['pchs_avg_pric', 'avg_pric'], error, true) ?? 0,
    currentPrice: amountField(row, ['prpr', 'now_pric'], error, true) ?? 0,
    marketValue: amountField(row, ['evlu_amt', 'evlu_amt_smtl_amt'], error),
    profitLoss: amountField(row, ['evlu_pfls_amt', 'evlu_pfls_amt2'], error, true, true) ?? 0,
  }))
  if (holdings.some((row) => !row.productCode)) throw new Error(error)

  const holdingsValue = holdings.reduce((sum, row) => sum + row.marketValue, 0)
  const optionalNumber = (keys) => amountField(summary, keys, error, true)
  const depositCash = optionalNumber(['dnca_tot_amt', 'cash_amt'])
  const settledCash = optionalNumber(['prvs_rcdl_excc_amt'])
  const nextDayCash = optionalNumber(['nxdy_excc_amt'])
  const d2Cash = optionalNumber(['d2_auto_rdpt_amt'])
  const todayBuyAmount = optionalNumber(['thdt_buy_amt'])
  const todaySellAmount = optionalNumber(['thdt_sll_amt'])
  const projectedCash = [depositCash, settledCash, nextDayCash].filter((value) => value !== null)
  const availableCash = projectedCash.length ? Math.min(...projectedCash) : 0
  const cash = depositCash ?? settledCash ?? nextDayCash ?? d2Cash
  if (cash === null) throw new Error(error)
  const securitiesValue = optionalNumber([
    'scts_evlu_amt', 'evlu_amt_smtl_amt',
  ]) ?? holdingsValue
  const totalValue = amountField(summary, [
    'tot_evlu_amt', 'tot_asst_amt', 'nass_amt',
  ], error)

  return {
    date: koreaDate(fetchedAt),
    cash,
    cashDetail: { depositCash, settledCash, nextDayCash, d2Cash, todayBuyAmount, todaySellAmount, availableCash },
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
      amount: amountField(row, ['last_alct_amt', 'alct_amt'], 'KIS_RIGHTS_INVALID'),
      tax: amountField(row, ['tax_amt'], 'KIS_RIGHTS_INVALID', true) ?? 0,
    }
    if (!right.rightTypeCode || !right.productCode || (!right.baseDate && !right.cashPaymentDate)) throw new Error('KIS_RIGHTS_INVALID')
    normalized.push(right)
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
