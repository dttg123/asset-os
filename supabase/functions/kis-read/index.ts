import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { normalizeBalance, normalizeOrders, normalizeQuote, normalizeRights, safeRange } from './core.js'

const KIS_BASE = 'https://openapi.koreainvestment.com:9443'
const REFRESH_MARGIN_MS = 5 * 60 * 1000
const MAX_PAGES = 10

type AccountKind = 'pension' | 'irp'
type Action = 'balance' | 'orders' | 'rights' | 'quote'
type AccountConfig = { appkey: string; appsecret: string; cano: string; productCode: string }

function env(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error('SERVER_CONFIG_MISSING')
  return value
}

function serverClient() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function allowedOrigin(origin: string | null) {
  if (!origin) return ''
  const allowed = env('ASSET_OS_ALLOWED_ORIGINS').split(',').map((value) => value.trim()).filter(Boolean)
  return allowed.includes(origin) ? origin : ''
}

function response(body: unknown, status: number, origin = '') {
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    vary: 'Origin',
  }
  if (origin) headers['access-control-allow-origin'] = origin
  return new Response(JSON.stringify(body), { status, headers })
}

function accountConfig(accountKind: AccountKind): AccountConfig {
  const prefix = accountKind === 'pension' ? 'KIS_PENSION_' : 'KIS_IRP_'
  return {
    appkey: env(prefix + 'APP_KEY'),
    appsecret: env(prefix + 'APP_SECRET'),
    cano: env(prefix + 'CANO'),
    productCode: env(prefix + 'ACNT_PRDT_CD'),
  }
}

async function authenticate(req: Request) {
  const authorization = req.headers.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) throw new Error('AUTH_REQUIRED')
  const { data, error } = await serverClient().auth.getUser(token)
  if (error || !data.user) throw new Error('AUTH_INVALID')
  if (data.user.id !== env('ASSET_OS_OWNER_USER_ID')) throw new Error('AUTH_FORBIDDEN')
}

async function readValidToken(db: ReturnType<typeof serverClient>, accountKind: AccountKind) {
  const { data, error } = await db.from('kis_token_cache').select('access_token,expires_at')
    .eq('account_type', accountKind).maybeSingle()
  if (error) throw new Error('TOKEN_CACHE_READ_FAILED')
  if (!data?.access_token || !data?.expires_at) return null
  if (new Date(data.expires_at).getTime() <= Date.now() + REFRESH_MARGIN_MS) return null
  return data.access_token as string
}

function tokenCacheKind(accountKind: AccountKind, cfg: AccountConfig): AccountKind {
  if (accountKind === 'irp' && cfg.appkey === Deno.env.get('KIS_PENSION_APP_KEY') && cfg.appsecret === Deno.env.get('KIS_PENSION_APP_SECRET')) return 'pension'
  return accountKind
}

async function accessToken(accountKind: AccountKind, cfg: AccountConfig) {
  const db = serverClient()
  const cacheKind = tokenCacheKind(accountKind, cfg)
  const cached = await readValidToken(db, cacheKind)
  if (cached) return cached

  const { data: claimed, error: claimError } = await db.rpc('claim_kis_token_refresh', {
    p_account_type: cacheKind,
  })
  if (claimError) throw new Error('TOKEN_REFRESH_LOCK_FAILED')
  if (!claimed) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      const waiting = await readValidToken(db, cacheKind)
      if (waiting) return waiting
    }
    throw new Error('TOKEN_REFRESH_BUSY')
  }

  try {
    const tokenResponse = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', appkey: cfg.appkey, appsecret: cfg.appsecret }),
    })
    const body = await tokenResponse.json().catch(() => ({}))
    const token = body?.access_token
    if (!tokenResponse.ok || !token) throw new Error('TOKEN_FAILED')
    const expiresIn = Math.max(Number(body?.expires_in) || 86400, 300)
    const { error } = await db.from('kis_token_cache').upsert({
      account_type: cacheKind,
      access_token: token,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      refreshing_until: null,
      updated_at: new Date().toISOString(),
    })
    if (error) throw new Error('TOKEN_CACHE_SAVE_FAILED')
    return token as string
  } catch (error) {
    await db.from('kis_token_cache').update({
      refreshing_until: null,
      updated_at: new Date().toISOString(),
    }).eq('account_type', cacheKind)
    throw error
  }
}

async function kisPages(
  cfg: AccountConfig,
  token: string,
  path: string,
  trId: string,
  params: Record<string, string>,
  outputKey: 'output' | 'output1',
) {
  const collected: Record<string, unknown>[] = []
  let body: Record<string, any> = {}
  let firstBody: Record<string, any> = {}
  let trCont = ''
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams(params)
    const upstream = await fetch(`${KIS_BASE}${path}?${query.toString()}`, {
      headers: {
        authorization: `Bearer ${token}`,
        appkey: cfg.appkey,
        appsecret: cfg.appsecret,
        tr_id: trId,
        tr_cont: page === 0 ? '' : 'N',
        custtype: 'P',
      },
    })
    body = await upstream.json().catch(() => ({}))
    if (page === 0) firstBody = body
    if (!upstream.ok || body?.rt_cd !== '0') throw new Error('KIS_UPSTREAM_FAILED')
    const nextRows = Array.isArray(body?.[outputKey]) ? body[outputKey] : []
    collected.push(...nextRows.filter((row: unknown) => row && typeof row === 'object'))
    trCont = upstream.headers.get('tr_cont') || ''
    if (trCont !== 'M' && trCont !== 'F') break
    const fk100 = String(body?.ctx_area_fk100 || '')
    const nk100 = String(body?.ctx_area_nk100 || '')
    if (!fk100 || !nk100 || page === MAX_PAGES - 1) throw new Error('KIS_RESULT_TRUNCATED')
    params = { ...params, CTX_AREA_FK100: fk100, CTX_AREA_NK100: nk100 }
    await new Promise((resolve) => setTimeout(resolve, 1100))
  }
  return { body, firstBody, rows: collected }
}

async function balance(accountKind: AccountKind, cfg: AccountConfig, token: string, fetchedAt: string) {
  const irp = accountKind === 'irp'
  const result = await kisPages(
    cfg,
    token,
    irp ? '/uapi/domestic-stock/v1/trading/pension/inquire-balance' : '/uapi/domestic-stock/v1/trading/inquire-balance',
    irp ? 'TTTC2208R' : 'TTTC8434R',
    irp ? {
      CANO: cfg.cano, ACNT_PRDT_CD: cfg.productCode, ACCA_DVSN_CD: '00', INQR_DVSN: '00',
      CTX_AREA_FK100: '', CTX_AREA_NK100: '',
    } : {
      CANO: cfg.cano, ACNT_PRDT_CD: cfg.productCode, AFHR_FLPR_YN: 'N', OFL_YN: '',
      INQR_DVSN: '02', UNPR_DVSN: '01', FUND_STTL_ICLD_YN: 'N',
      FNCG_AMT_AUTO_RDPT_YN: 'N', PRCS_DVSN: '00', CTX_AREA_FK100: '', CTX_AREA_NK100: '',
    },
    'output1',
  )
  return normalizeBalance({ output1: result.rows, output2: result.firstBody?.output2 ?? result.body?.output2 }, fetchedAt)
}

async function orders(accountKind: AccountKind, cfg: AccountConfig, token: string, from?: string, to?: string) {
  const range = safeRange(from, to, 31, 31)
  const recentBoundary = new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10).replaceAll('-', '')
  const trId = accountKind === 'irp' || range.from < recentBoundary ? 'CTSC9215R' : 'TTTC0081R'
  const result = await kisPages(cfg, token, '/uapi/domestic-stock/v1/trading/inquire-daily-ccld', trId, {
    CANO: cfg.cano, ACNT_PRDT_CD: cfg.productCode, INQR_STRT_DT: range.from, INQR_END_DT: range.to,
    SLL_BUY_DVSN_CD: '00', PDNO: '', CCLD_DVSN: '00', INQR_DVSN: '00', INQR_DVSN_3: '00',
    ORD_GNO_BRNO: '', ODNO: '', INQR_DVSN_1: '', CTX_AREA_FK100: '', CTX_AREA_NK100: '',
    EXCG_ID_DVSN_CD: 'KRX',
  }, 'output1')
  return normalizeOrders(result.rows)
}

async function rights(cfg: AccountConfig, token: string, from?: string, to?: string) {
  const range = safeRange(from, to, 365, 366)
  const result = await kisPages(cfg, token, '/uapi/domestic-stock/v1/trading/period-rights', 'CTRGA011R', {
    INQR_DVSN: '03', CANO: cfg.cano, ACNT_PRDT_CD: cfg.productCode,
    INQR_STRT_DT: range.from, INQR_END_DT: range.to, CUST_RNCNO25: '', HMID: '', RGHT_TYPE_CD: '',
    PDNO: '', PRDT_TYPE_CD: '', CTX_AREA_NK100: '', CTX_AREA_FK100: '',
  }, 'output')
  return normalizeRights(result.rows)
}

async function quoteOne(cfg: AccountConfig, token: string, item: Record<string, unknown>) {
  const type = String(item?.type || '').trim().toLowerCase()
  const code = String(item?.code || '').trim().toUpperCase()
  if (!['stock', 'bond'].includes(type)) throw new Error('QUOTE_TYPE_INVALID')
  if (type === 'stock' ? !/^\d{6}$/.test(code) : !/^[A-Z0-9]{12}$/.test(code)) throw new Error('QUOTE_CODE_INVALID')
  const bond = type === 'bond'
  const path = bond ? '/uapi/domestic-bond/v1/quotations/inquire-price' : '/uapi/domestic-stock/v1/quotations/inquire-price'
  const trId = bond ? 'FHKBJ773400C0' : 'FHKST01010100'
  const params = new URLSearchParams({ FID_COND_MRKT_DIV_CODE: bond ? 'B' : 'J', FID_INPUT_ISCD: code })
  const upstream = await fetch(`${KIS_BASE}${path}?${params.toString()}`, { headers: {
    authorization: `Bearer ${token}`, appkey: cfg.appkey, appsecret: cfg.appsecret,
    tr_id: trId, custtype: 'P',
  } })
  const body = await upstream.json().catch(() => ({}))
  if (!upstream.ok || body?.rt_cd !== '0') throw new Error('KIS_UPSTREAM_FAILED')
  const row = Array.isArray(body?.output) ? body.output[0] : body?.output
  const normalized = normalizeQuote(row, type, code)
  if (!normalized) throw new Error('QUOTE_EMPTY')
  return normalized
}

async function quotes(cfg: AccountConfig, token: string, input: unknown) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 10) throw new Error('QUOTE_LIST_INVALID')
  const result = []
  for (let index = 0; index < input.length; index += 1) {
    if (index) await new Promise((resolve) => setTimeout(resolve, 1100))
    result.push(await quoteOne(cfg, token, input[index] as Record<string, unknown>))
  }
  return result
}

const safeErrors = new Set([
  'AUTH_REQUIRED', 'AUTH_INVALID', 'AUTH_FORBIDDEN', 'ACTION_INVALID', 'ACCOUNT_KIND_INVALID',
  'DATE_RANGE_INVALID', 'SERVER_CONFIG_MISSING',
  'TOKEN_CACHE_READ_FAILED', 'TOKEN_REFRESH_LOCK_FAILED', 'TOKEN_REFRESH_BUSY', 'TOKEN_FAILED',
  'TOKEN_CACHE_SAVE_FAILED', 'KIS_UPSTREAM_FAILED', 'KIS_RESULT_TRUNCATED',
  'QUOTE_TYPE_INVALID', 'QUOTE_CODE_INVALID', 'QUOTE_LIST_INVALID', 'QUOTE_EMPTY',
])

Deno.serve(async (req) => {
  let origin = ''
  try {
    origin = allowedOrigin(req.headers.get('origin'))
  } catch {
    return response({ ok: false, error: 'SERVER_CONFIG_MISSING' }, 503)
  }
  if (!origin) return response({ ok: false, error: 'ORIGIN_FORBIDDEN' }, 403)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'authorization, apikey, content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-max-age': '600',
      vary: 'Origin',
    } })
  }
  if (req.method !== 'POST') return response({ ok: false, error: 'POST_REQUIRED' }, 405, origin)

  try {
    await authenticate(req)
    const input = await req.json()
    const action = input?.action as Action
    const accountKind = input?.accountKind as AccountKind
    if (!['balance', 'orders', 'rights', 'quote'].includes(action)) throw new Error('ACTION_INVALID')
    if (action !== 'quote' && !['pension', 'irp'].includes(accountKind)) throw new Error('ACCOUNT_KIND_INVALID')
    const tokenKind: AccountKind = action === 'quote' ? 'pension' : accountKind
    const cfg = accountConfig(tokenKind)
    const token = await accessToken(tokenKind, cfg)
    const fetchedAt = new Date().toISOString()
    const payload = action === 'quote'
      ? { quotes: await quotes(cfg, token, input?.quotes) }
      : action === 'balance'
      ? { balance: await balance(accountKind, cfg, token, fetchedAt) }
      : action === 'orders'
        ? { orders: await orders(accountKind, cfg, token, input?.from, input?.to) }
        : { rights: await rights(cfg, token, input?.from, input?.to) }
    return response({ ok: true, action, ...(action === 'quote' ? {} : { accountKind }), fetchedAt, ...payload }, 200, origin)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    const status = code === 'AUTH_FORBIDDEN' ? 403
      : code.startsWith('AUTH_') ? 401
        : code.endsWith('_INVALID') ? 400
          : code === 'SERVER_CONFIG_MISSING' ? 503 : 502
    return response({ ok: false, error: safeErrors.has(code) ? code : 'INTERNAL_ERROR' }, status, origin)
  }
})
