/**
 * Host half of dsh-game-corner.
 * 只做一件事：把棋局转成一次模型请求，把回答转成坐标。
 * 密钥永远只从本机配置读，绝不写进代码、不写进日志、不出现在任何响应里。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const HOME_DIR = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'game-corner')
const CONFIG = join(HOME_DIR, 'config.json')

function readConfig() {
  try {
    if (!existsSync(CONFIG)) return null
    const raw = JSON.parse(readFileSync(CONFIG, 'utf8'))
    if (!raw || typeof raw.apiKey !== 'string' || !raw.apiKey) return null
    return {
      baseUrl: typeof raw.baseUrl === 'string' && raw.baseUrl ? raw.baseUrl : 'https://api.deepseek.com/chat/completions',
      model: typeof raw.model === 'string' && raw.model ? raw.model : 'deepseek-chat',
      apiKey: raw.apiKey,
      timeoutMs: Number(raw.timeoutMs) > 0 ? Number(raw.timeoutMs) : 15000,
    }
  } catch (e) {
    return null
  }
}

function json(res, code, body) {
  const text = JSON.stringify(body)
  res.statusCode = code
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(text)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > 200000) { reject(new Error('请求太大')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

// 把 15×15 棋盘写成文字：行号 + 每格符号，比坐标列表好读得多。
function boardToText(board, size) {
  const lines = []
  lines.push('    ' + Array.from({ length: size }, (_, i) => String.fromCharCode(65 + i)).join(' '))
  for (let y = 0; y < size; y++) {
    const row = board[y] || []
    const cells = row.map((v) => (v === 1 ? 'X' : v === 2 ? 'O' : '.')).join(' ')
    lines.push(String(size - y).padStart(2, ' ') + '  ' + cells)
  }
  return lines.join('\n')
}

function pickCoordinate(text, size) {
  // 接受 A1 / a1 / (A,1) / A 1 这几种写法，取第一个合法坐标
  const re = /\b([A-Oa-o])\s*[,，]?\s*(1[0-5]|[1-9])\b/
  const m = re.exec(String(text || ''))
  if (!m) return null
  const x = m[1].toUpperCase().charCodeAt(0) - 65
  const y = size - Number(m[2])
  if (x < 0 || x >= size || y < 0 || y >= size) return null
  return { x, y }
}

// 象棋：10 行 9 列的字符棋盘，问「起点列,起点行,终点列,终点行」
function xiangqiText(board) {
  const rows = []
  rows.push('   ' + Array.from({ length: 9 }, (_, i) => String(i + 1)).join(' '))
  for (let r = 0; r < 10; r++) {
    const line = []
    for (let c = 0; c < 9; c++) line.push(board[r * 9 + c] || '·')
    rows.push(String(r + 1).padStart(2, ' ') + ' ' + line.join(' '))
  }
  return rows.join('\n')
}

function parseXq(text) {
  const nums = String(text || '').match(/\d+/g)
  if (!nums || nums.length < 4) return null
  const col1 = Number(nums[0]), row1 = Number(nums[1]), col2 = Number(nums[2]), row2 = Number(nums[3])
  if (col1 < 1 || col1 > 9 || col2 < 1 || col2 > 9) return null
  if (row1 < 1 || row1 > 10 || row2 < 1 || row2 > 10) return null
  return {
    from: { x: col1 - 1, y: row1 - 1 },
    to: { x: col2 - 1, y: row2 - 1 },
  }
}

export function apply(ctx) {
  const webServer = ctx.get('webServer')
  if (!webServer) {
    ctx.effect(() => {
      const t = setTimeout(() => apply(ctx), 800)
      return () => clearTimeout(t)
    })
    return
  }

  webServer.register({
    kind: 'prefix',
    path: '/game-corner',
    handler: async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      const path = url.pathname.replace(/^\/game-corner/, '') || '/'
      try {
        // 只回答「配没配」，永远不回显密钥
        if (path === '/api/status' && req.method === 'GET') {
          const cfg = readConfig()
          return json(res, 200, { ok: true, configured: Boolean(cfg), model: cfg ? cfg.model : null })
        }

        if (path === '/api/move' && req.method === 'POST') {
          const cfg = readConfig()
          if (!cfg) return json(res, 200, { ok: false, reason: 'no-key', message: '还没配置接口：在 ~/.dsh/game-corner/config.json 里填 apiKey' })
          const body = await readBody(req)
          const game = body.game === 'xiangqi' ? 'xiangqi' : (body.game === 'chess' ? 'chess' : (body.game === 'go' ? 'go' : 'gomoku'))

          if (game === 'chess') {
            const flat = Array.isArray(body.board) ? body.board : null
            if (!flat || flat.length !== 64) return json(res, 400, { ok: false, reason: 'bad-board', message: '缺 8×8 棋盘' })
            const lines = []
            lines.push('   ' + Array.from({ length: 8 }, (_, i) => String(i + 1)).join(' '))
            for (let r = 0; r < 8; r++) {
              const row = []
              for (let c = 0; c < 8; c++) row.push(flat[r * 8 + c] || '·')
              lines.push(String(r + 1).padStart(2, ' ') + ' ' + row.join(' '))
            }
            const prompt = [
              '你在下国际象棋。你执黑（小写 k q r b n p），对手执白（大写 K Q R B N P）。',
              '棋盘如下，左边是行号（1 在最上面，黑方底线），顶上是列号：',
              lines.join('\n'),
              '',
              '只回答四个数字，格式：起点列,起点行,终点列,终点行。行列都从 1 开始数，不要任何解释。',
              '必须是合法的一步；能将军就将军，能吃子就吃子。',
            ].join('\n')

            const ctrl = new AbortController()
            const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs)
            let payload = null
            try {
              const resp = await fetch(cfg.baseUrl, {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.apiKey },
                body: JSON.stringify({
                  model: cfg.model,
                  messages: [{ role: 'user', content: prompt }],
                  temperature: 0.2,
                  max_tokens: 24,
                  stream: false,
                }),
                signal: ctrl.signal,
              })
              payload = await resp.json().catch(() => null)
              if (!resp.ok) {
                const msg = payload && payload.error && payload.error.message ? String(payload.error.message).slice(0, 200) : ''
                return json(res, 200, { ok: false, reason: 'upstream', status: resp.status, message: msg || ('上游返回 ' + resp.status) })
              }
            } catch (e) {
              return json(res, 200, { ok: false, reason: 'network', message: (e && e.message ? e.message : '请求失败') + (ctrl.signal.aborted ? '（超时）' : '') })
            } finally {
              clearTimeout(timer)
            }

            const text = payload && payload.choices && payload.choices[0] && payload.choices[0].message
              ? payload.choices[0].message.content
              : ''
            const mv = parseXq(text)
            if (!mv) return json(res, 200, { ok: false, reason: 'unparsable', message: '模型没给出可读走法：' + String(text).slice(0, 80) })
            return json(res, 200, { ok: true, from: mv.from, to: mv.to, raw: String(text).slice(0, 40) })
          }

          if (game === 'go') {
            const flat = Array.isArray(body.board) ? body.board : null
            const size = Number(body.size) || 13
            if (!flat || flat.length !== size * size) return json(res, 400, { ok: false, reason: 'bad-board', message: '缺棋盘' })
            const lines = []
            lines.push('    ' + Array.from({ length: size }, (_, i) => String(i + 1)).join(' '))
            for (let r = 0; r < size; r++) {
              const row = []
              for (let c = 0; c < size; c++) row.push(flat[r * size + c] === 1 ? 'X' : flat[r * size + c] === 2 ? 'O' : '.')
              lines.push(String(r + 1).padStart(2, ' ') + '  ' + row.join(' '))
            }
            const prompt = [
              '你在下围棋（' + size + '×' + size + '），执 O，对手执 X。',
              '棋盘如下，左边是行号，顶上是列号：',
              lines.join('\n'),
              '',
              '只回答一个坐标，格式：列,行（都从 1 开始数），不要任何解释。',
              '优先走能吃掉对方棋子的点、或能救自己只剩一口气的棋块的点。',
            ].join('\n')

            const ctrl = new AbortController()
            const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs)
            let payload = null
            try {
              const resp = await fetch(cfg.baseUrl, {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.apiKey },
                body: JSON.stringify({
                  model: cfg.model,
                  messages: [{ role: 'user', content: prompt }],
                  temperature: 0.3,
                  max_tokens: 16,
                  stream: false,
                }),
                signal: ctrl.signal,
              })
              payload = await resp.json().catch(() => null)
              if (!resp.ok) {
                const msg = payload && payload.error && payload.error.message ? String(payload.error.message).slice(0, 200) : ''
                return json(res, 200, { ok: false, reason: 'upstream', status: resp.status, message: msg || ('上游返回 ' + resp.status) })
              }
            } catch (e) {
              return json(res, 200, { ok: false, reason: 'network', message: (e && e.message ? e.message : '请求失败') + (ctrl.signal.aborted ? '（超时）' : '') })
            } finally {
              clearTimeout(timer)
            }
            const text = payload && payload.choices && payload.choices[0] && payload.choices[0].message
              ? payload.choices[0].message.content
              : ''
            const nums = String(text || '').match(/\d+/g)
            if (!nums || nums.length < 2) return json(res, 200, { ok: false, reason: 'unparsable', message: '模型没给出坐标：' + String(text).slice(0, 60) })
            const gx = Number(nums[0]) - 1, gy = Number(nums[1]) - 1
            if (gx < 0 || gy < 0 || gx >= size || gy >= size) return json(res, 200, { ok: false, reason: 'range', message: '坐标越界：' + text.slice(0, 40) })
            return json(res, 200, { ok: true, x: gx, y: gy, raw: String(text).slice(0, 40) })
          }

          if (game === 'xiangqi') {
            const flat = Array.isArray(body.board) ? body.board : null
            if (!flat || flat.length !== 90) return json(res, 400, { ok: false, reason: 'bad-board', message: '缺 10×9 棋盘' })
            const prompt = [
              '你在下中国象棋（10 行 9 列），你执黑（小写：帅将被写作 k、车 r、马 n、象 b、士 a、炮 c、兵 p），对手执红（大写）。',
              '棋盘如下，左边是行号（1 在最上面），顶上是列号：',
              xiangqiText(flat),
              '',
              '只回答四个数字，格式：起点列,起点行,终点列,终点行。行列都从 1 开始数，不要任何解释。',
              '你必须只下合法的一步。',
            ].join('\n')

            const ctrl = new AbortController()
            const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs)
            let payload = null
            try {
              const resp = await fetch(cfg.baseUrl, {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.apiKey },
                body: JSON.stringify({
                  model: cfg.model,
                  messages: [{ role: 'user', content: prompt }],
                  temperature: 0.2,
                  max_tokens: 24,
                  stream: false,
                }),
                signal: ctrl.signal,
              })
              payload = await resp.json().catch(() => null)
              if (!resp.ok) {
                const msg = payload && payload.error && payload.error.message ? String(payload.error.message).slice(0, 200) : ''
                return json(res, 200, { ok: false, reason: 'upstream', status: resp.status, message: msg || ('上游返回 ' + resp.status) })
              }
            } catch (e) {
              return json(res, 200, { ok: false, reason: 'network', message: (e && e.message ? e.message : '请求失败') + (ctrl.signal.aborted ? '（超时）' : '') })
            } finally {
              clearTimeout(timer)
            }

            const text = payload && payload.choices && payload.choices[0] && payload.choices[0].message
              ? payload.choices[0].message.content
              : ''
            const mv = parseXq(text)
            if (!mv) return json(res, 200, { ok: false, reason: 'unparsable', message: '模型没给出可读走法：' + String(text).slice(0, 80) })
            return json(res, 200, { ok: true, from: mv.from, to: mv.to, raw: String(text).slice(0, 40) })
          }

          const board = Array.isArray(body.board) ? body.board : null
          const size = Number(body.size) || 15
          if (!board) return json(res, 400, { ok: false, reason: 'bad-board', message: '缺棋盘' })

          const prompt = [
            '你在下五子棋（15×15），执 O，对手执 X，X 先手。',
            '棋盘如下，左边数字是行号，顶部字母是列号：',
            boardToText(board, size),
            '',
            '只回答一个坐标，格式如 H8，不要任何解释。',
            '如果你已经能连成五子，直接下那一手；否则优先堵对手的活三和活四。',
          ].join('\n')

          const ctrl = new AbortController()
          const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs)
          let payload = null
          try {
            const resp = await fetch(cfg.baseUrl, {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.apiKey },
              body: JSON.stringify({
                model: cfg.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.2,
                max_tokens: 16,
                stream: false,
              }),
              signal: ctrl.signal,
            })
            payload = await resp.json().catch(() => null)
            if (!resp.ok) {
              // 只报状态码和错误类型，不回显请求头
              const msg = payload && payload.error && payload.error.message ? String(payload.error.message).slice(0, 200) : ''
              return json(res, 200, { ok: false, reason: 'upstream', status: resp.status, message: msg || ('上游返回 ' + resp.status) })
            }
          } catch (e) {
            return json(res, 200, { ok: false, reason: 'network', message: (e && e.message ? e.message : '请求失败') + (ctrl.signal.aborted ? '（超时）' : '') })
          } finally {
            clearTimeout(timer)
          }

          const text = payload && payload.choices && payload.choices[0] && payload.choices[0].message
            ? payload.choices[0].message.content
            : ''
          const at = pickCoordinate(text, size)
          if (!at) return json(res, 200, { ok: false, reason: 'unparsable', message: '模型没给出可读坐标：' + String(text).slice(0, 80) })
          return json(res, 200, { ok: true, x: at.x, y: at.y, raw: String(text).slice(0, 40) })
        }

        return json(res, 404, { ok: false, message: '没有这个接口：' + path })
      } catch (e) {
        return json(res, 500, { ok: false, message: e && e.message ? e.message : '宿主出错' })
      }
    },
  })
}
