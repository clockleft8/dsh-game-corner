// dsh-game-corner —— 浏览器半（小游戏角）
// 两处入口：对话栏目里一格「小游戏」，以及 shell.overlay 上一个可拖动的浮窗。
// 三个游戏：五子棋（三档难度）、2048、扫雷（两档）。
// 浮窗留在对话上面，等任务时玩，又看得见任务什么时候结束。
window.__ModuleLoader__.load({
  id: 'dsh-game-corner',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const C = {
      ink: '#e8eef6',
      dim: '#93a4b8',
      line: 'rgba(147,164,184,0.35)',
      panel: '#151b24',
      accent: '#6ea8fe',
      human: '#f2f6fb',
      ai: '#3d4a5c',
    };

    function btn(extra) {
      return Object.assign({
        border: '1px solid ' + C.line, background: 'transparent', color: C.ink,
        borderRadius: 6, padding: '3px 9px', fontSize: 12, cursor: 'pointer',
      }, extra || {});
    }

    function tabBtn(active) {
      return btn({
        borderColor: active ? C.accent : C.line,
        color: active ? C.accent : C.dim,
      });
    }

    // ═══════════ 五子棋 ═══════════
    const GSIZE = 15;
    const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

    function gBlank() {
      const rows = [];
      for (let y = 0; y < GSIZE; y++) rows.push(new Array(GSIZE).fill(0));
      return rows;
    }
    function inside(x, y) { return x >= 0 && y >= 0 && x < GSIZE && y < GSIZE; }

    function gWin(board, x, y, who) {
      for (let d = 0; d < DIRS.length; d++) {
        const dx = DIRS[d][0];
        const dy = DIRS[d][1];
        let n = 1;
        for (let s = 1; s < 5; s++) {
          const nx = x + dx * s, ny = y + dy * s;
          if (!inside(nx, ny) || board[ny][nx] !== who) break;
          n++;
        }
        for (let s = 1; s < 5; s++) {
          const nx = x - dx * s, ny = y - dy * s;
          if (!inside(nx, ny) || board[ny][nx] !== who) break;
          n++;
        }
        if (n >= 5) return true;
      }
      return false;
    }

    function gScore(board, x, y, who) {
      let total = 0;
      for (let d = 0; d < DIRS.length; d++) {
        const dx = DIRS[d][0], dy = DIRS[d][1];
        let run = 1, open = 0;
        for (const sign of [1, -1]) {
          for (let s = 1; s < 5; s++) {
            const nx = x + dx * s * sign, ny = y + dy * s * sign;
            if (!inside(nx, ny)) break;
            const v = board[ny][nx];
            if (v === who) { run++; continue; }
            if (v === 0) open++;
            break;
          }
        }
        if (run >= 5) total += 100000;
        else if (run === 4) total += open > 0 ? 12000 : 900;
        else if (run === 3) total += open > 1 ? 900 : 120;
        else if (run === 2) total += open > 1 ? 60 : 8;
        else total += 1;
      }
      return total;
    }

    function gCandidates(board) {
      const out = [];
      for (let y = 0; y < GSIZE; y++) {
        for (let x = 0; x < GSIZE; x++) {
          if (board[y][x] !== 0) continue;
          let near = false;
          for (let dy = -2; dy <= 2 && !near; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const nx = x + dx, ny = y + dy;
              if (inside(nx, ny) && board[ny][nx] !== 0) { near = true; break; }
            }
          }
          if (near) out.push([x, y]);
        }
      }
      if (!out.length) out.push([7, 7]);
      return out;
    }

    function gPlace(board, x, y, who) {
      const next = board.map((row) => row.slice());
      next[y][x] = who;
      return next;
    }

    function gPick(board, level, aiColor) {
      const me = aiColor === 1 ? 1 : 2;
      const foe = 3 - me;
      const list = gCandidates(board);
      if (level === 'easy') {
        // 会下，但只看眼前一步、还带随机；给它留点人情味
        return list[Math.floor(Math.random() * list.length)];
      }
      let best = list[0], bestScore = -1;
      list.forEach(([x, y]) => {
        const atk = gScore(board, x, y, me);
        const def = gScore(board, x, y, foe);
        const score = atk * 1.05 + def + (level === 'normal' ? Math.random() * 3 : 0);
        if (score > bestScore) { bestScore = score; best = [x, y]; }
      });
      if (level === 'hard') {
        // 再看一手：对手下一手能捞到多少，代价要扣掉
        let hardBest = best, hardBestVal = -Infinity;
        list.forEach(([x, y]) => {
          const atk = gScore(board, x, y, me);
          const def = gScore(board, x, y, foe);
          const mine = atk * 1.1 + def;
          const after = gPlace(board, x, y, me);
          let reply = 0;
          gCandidates(after).forEach(([ox, oy]) => {
            const v = gScore(after, ox, oy, foe);
            if (v > reply) reply = v;
          });
          const val = mine - reply * 0.85;
          if (val > hardBestVal) { hardBestVal = val; hardBest = [x, y]; }
        });
        return hardBest;
      }
      return best;
    }

    function Gomoku(props) {
      const levelState = React.useState('normal');
      const level = levelState[0];
      const setLevel = levelState[1];
      const boardState = React.useState(gBlank);
      const board = boardState[0];
      const setBoard = boardState[1];
      const turnState = React.useState(1);
      const turn = turnState[0];
      const setTurn = turnState[1];
      const overState = React.useState('');
      const over = overState[0];
      const setOver = overState[1];
      const movesState = React.useState(0);
      const moves = movesState[0];
      const setMoves = movesState[1];
      const sideState = React.useState(1);
      const myColor = sideState[0];
      const setMyColor = sideState[1];
      const aiColor = 3 - myColor;
      const placedState = React.useState(0);
      const placed = placedState[0];
      const setPlaced = placedState[1];

      const reset = function () {
        setBoard(gBlank());
        setTurn(1);
        setOver('');
        setMoves(0);
      };

      // 你选后手（执白）时，黑方电脑先下天元
      React.useEffect(function () {
        if (over || moves !== 0 || aiColor !== 1) return;
        const t = window.setTimeout(function () {
          const mid = Math.floor(GSIZE / 2);
          const nb = gPlace(board, mid, mid, 1);
          setBoard(nb); setMoves(1); setTurn(myColor);
        }, 200);
        return function () { window.clearTimeout(t); };
      }, [over, moves, aiColor, board, myColor]);

      const play = function (x, y) {
        if (over || turn !== myColor || board[y][x] !== 0) return;
        const afterHuman = gPlace(board, x, y, myColor);
        setMoves(moves + 1);
        if (gWin(afterHuman, x, y, myColor)) {
          setBoard(afterHuman);
          setTurn(0);
          setOver('你赢了');
          return;
        }
        setBoard(afterHuman);
        setTurn(aiColor);
        const applyAi = function (mv) {
          if (over) return;
          const afterAi = gPlace(afterHuman, mv[0], mv[1], aiColor);
          setMoves((m) => m + 1);
          if (gWin(afterAi, mv[0], mv[1], aiColor)) {
            setBoard(afterAi);
            setTurn(0);
            setOver('电脑赢了');
            return;
          }
          const full = afterAi.every((row) => row.every((v) => v !== 0));
          setBoard(afterAi);
          setTurn(myColor);
          if (full) setOver('和棋');
        };
        const localMove = function () {
          const mv = gPick(afterHuman, level, aiColor);
          applyAi(mv);
        };
        // deepseek 档走模型；没配 key、断网、回答读不懂，一律退回本地搜索
        if (level !== 'deepseek') {
          window.setTimeout(localMove, 200);
          return;
        }
        fetch('/game-corner/api/move', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ board: afterHuman, size: GSIZE }),
        }).then(function (r) { return r.json(); }).then(function (res) {
          if (!res || !res.ok) throw new Error((res && res.message) || '接口没给结果');
          if (!afterHuman[res.y] || afterHuman[res.y][res.x] !== 0) throw new Error('模型给的位置已被占');
          applyAi([res.x, res.y]);
        }).catch(function () {
          localMove();
        });
      };

      const cell = props.cell || 24;
      const cells = [];
      for (let y = 0; y < GSIZE; y++) {
        for (let x = 0; x < GSIZE; x++) {
          const v = board[y][x];
          cells.push(h('button', {
            key: x + ':' + y,
            onClick: function () { play(x, y); },
            style: {
              width: cell, height: cell, padding: 0, border: 0,
              borderRight: '1px solid ' + C.line, borderBottom: '1px solid ' + C.line,
              background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: over || v !== 0 ? 'default' : 'pointer',
            },
          }, v === 0 ? null : h('span', {
            style: {
              width: Math.round(cell * 0.78), height: Math.round(cell * 0.78), borderRadius: '50%',
              background: v === 1 ? C.human : C.ai,
              boxShadow: v === 1 ? '0 1px 2px rgba(0,0,0,0.45)' : 'inset 0 0 0 1px rgba(255,255,255,0.18)',
              display: 'block',
            },
          })));
        }
      }

      const status = over || (turn === aiColor ? '电脑在想…' : ('该你走（' + (myColor === 1 ? '黑' : '白') + '）'));

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
          h('span', { style: { color: C.ink, fontSize: 13, fontWeight: 600 } }, status),
          h('span', { style: { color: C.dim, fontSize: 11 } }, moves + ' 手'),
          h('span', { style: { flex: 1 } }),
          h('button', { onClick: reset, style: btn() }, '重开')),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
          h('span', { style: { color: C.dim, fontSize: 11 } }, '难度'),
          ['easy', 'normal', 'hard', 'deepseek'].map(function (lv) {
            const label = lv === 'easy' ? '简单' : (lv === 'normal' ? '普通' : (lv === 'hard' ? '困难' : 'deepseek 模型'));
            return h('button', {
              key: lv,
              onClick: function () { setLevel(lv); reset(); },
              style: tabBtn(level === lv),
            }, label);
          }),
          h('button', {
            onClick: function () {
              const nextSide = myColor === 1 ? 2 : 1;
              setMyColor(nextSide);
              reset();
            },
            style: tabBtn(myColor === 2),
            title: '换先后手，会重开一局',
          }, myColor === 1 ? '先手·执黑' : '后手·执白')),
        h('div', {
          style: {
            display: 'grid', gridTemplateColumns: 'repeat(' + GSIZE + ', ' + cell + 'px)',
            borderLeft: '1px solid ' + C.line, borderTop: '1px solid ' + C.line,
            background: C.panel, borderRadius: 6, overflow: 'hidden', userSelect: 'none',
          },
        }, cells));
    }

    // ═══════════ 2048 ═══════════
    const N2048 = 4;
    function blank2048() {
      return [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    }
    function spawn(grid) {
      const free = [];
      for (let y = 0; y < N2048; y++) {
        for (let x = 0; x < N2048; x++) if (!grid[y][x]) free.push([x, y]);
      }
      if (!free.length) return grid;
      const [x, y] = free[Math.floor(Math.random() * free.length)];
      grid[y][x] = Math.random() < 0.9 ? 2 : 4;
      return grid;
    }
    function slideLine(line) {
      const vals = line.filter((v) => v);
      const out = [];
      let gained = 0;
      for (let i = 0; i < vals.length; i++) {
        if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
          out.push(vals[i] * 2);
          gained += vals[i] * 2;
          i++;
        } else {
          out.push(vals[i]);
        }
      }
      while (out.length < N2048) out.push(0);
      return { out, gained };
    }
    function move2048(grid, dir) {
      const next = grid.map((r) => r.slice());
      let gained = 0;
      if (dir === 'left' || dir === 'right') {
        for (let y = 0; y < N2048; y++) {
          let line = next[y].slice();
          if (dir === 'right') line.reverse();
          const r = slideLine(line);
          gained += r.gained;
          let out = r.out;
          if (dir === 'right') out = out.reverse();
          next[y] = out;
        }
      } else {
        for (let x = 0; x < N2048; x++) {
          let line = [];
          for (let y = 0; y < N2048; y++) line.push(next[y][x]);
          if (dir === 'down') line.reverse();
          const r = slideLine(line);
          gained += r.gained;
          let out = r.out;
          if (dir === 'down') out = out.reverse();
          for (let y = 0; y < N2048; y++) next[y][x] = out[y];
        }
      }
      return { grid: next, gained };
    }
    function canMove2048(grid) {
      for (const d of ['left', 'right', 'up', 'down']) {
        const r = move2048(grid, d);
        if (r.grid.some((row, y) => row.some((v, x) => v !== grid[y][x]))) return true;
      }
      return false;
    }

    function Game2048() {
      const gridState = React.useState(function () { return spawn(spawn(blank2048())); });
      const grid = gridState[0];
      const setGrid = gridState[1];
      const scoreState = React.useState(0);
      const score = scoreState[0];
      const setScore = scoreState[1];
      const deadState = React.useState(false);
      const dead = deadState[0];
      const setDead = deadState[1];

      const reset = function () {
        setGrid(spawn(spawn(blank2048())));
        setScore(0);
        setDead(false);
      };

      const doMove = React.useCallback(function (dir) {
        setGrid(function (cur) {
          const r = move2048(cur, dir);
          const changed = r.grid.some((row, y) => row.some((v, x) => v !== cur[y][x]));
          if (!changed) return cur;
          const next = spawn(r.grid.map((row) => row.slice()));
          setScore(function (s) { return s + r.gained; });
          if (!canMove2048(next)) setDead(true);
          return next;
        });
      }, []);

      React.useEffect(function () {
        const onKey = function (event) {
          const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
          const dir = map[event.key];
          if (!dir) return;
          event.preventDefault();
          doMove(dir);
        };
        window.addEventListener('keydown', onKey);
        return function () { window.removeEventListener('keydown', onKey); };
      }, [doMove]);

      const colors = {
        2: '#2b3542', 4: '#33404f', 8: '#3c5266', 16: '#456a7a',
        32: '#4f7f80', 64: '#5f8f6a', 128: '#7a8f5a', 256: '#93873f',
        512: '#a8783a', 1024: '#b25f3a', 2048: '#c2452f',
      };

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          h('span', { style: { color: C.ink, fontSize: 13, fontWeight: 600 } }, '得分 ' + score),
          dead ? h('span', { style: { color: '#ff9a9a', fontSize: 12 } }, '没有可走的了') : null,
          h('span', { style: { flex: 1 } }),
          h('button', { onClick: reset, style: btn() }, '重开')),
        h('div', {
          style: {
            display: 'grid', gridTemplateColumns: 'repeat(4, 62px)', gap: 6,
            background: C.panel, padding: 6, borderRadius: 8, userSelect: 'none',
          },
        }, grid.map(function (row, y) {
          return row.map(function (v, x) {
            return h('div', {
              key: y + ':' + x,
              style: {
                width: 62, height: 62, borderRadius: 6, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: colors[v] || '#1a212b',
                color: v ? C.ink : C.dim, fontSize: v > 999 ? 14 : 18, fontWeight: 600,
              },
            }, v || '');
          });
        })),
        h('div', { style: { display: 'flex', gap: 6 } },
          h('button', { onClick: function () { doMove('left'); }, style: btn() }, '←'),
          h('button', { onClick: function () { doMove('up'); }, style: btn() }, '↑'),
          h('button', { onClick: function () { doMove('down'); }, style: btn() }, '↓'),
          h('button', { onClick: function () { doMove('right'); }, style: btn() }, '→')),
        h('div', { style: { color: C.dim, fontSize: 11 } }, '也可以用方向键。'));
    }

    // ═══════════ 扫雷 ═══════════
    const MS_LEVELS = {
      easy: { w: 9, h: 9, mines: 10, label: '初级 9×9' },
      hard: { w: 16, h: 16, mines: 40, label: '中级 16×16' },
      expert: { w: 30, h: 16, mines: 99, label: '高级 16×30' },
    };

    function msNew(level) {
      const cfg = MS_LEVELS[level];
      const cells = [];
      for (let i = 0; i < cfg.w * cfg.h; i++) {
        cells.push({ mine: false, open: false, flag: false, n: 0 });
      }
      // 随机布雷，全不重样
      let placed = 0;
      while (placed < cfg.mines) {
        const i = Math.floor(Math.random() * cells.length);
        if (cells[i].mine) continue;
        cells[i].mine = true;
        placed++;
      }
      for (let y = 0; y < cfg.h; y++) {
        for (let x = 0; x < cfg.w; x++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= cfg.w || ny >= cfg.h) continue;
              if (cells[ny * cfg.w + nx].mine) n++;
            }
          }
          cells[y * cfg.w + x].n = n;
        }
      }
      return { cfg, cells, dead: false, won: false, opened: 0 };
    }

    function Minesweeper() {
      const levelState = React.useState('easy');
      const level = levelState[0];
      const setLevel = levelState[1];
      const gameState = React.useState(function () { return msNew('easy'); });
      const game = gameState[0];
      const setGame = gameState[1];

      const reset = function (lv) { setGame(msNew(lv || level)); };

      const reveal = function (index) {
        if (game.dead || game.won) return;
        const g = { cfg: game.cfg, cells: game.cells.map((c) => Object.assign({}, c)), dead: false, won: false, opened: game.opened };
        const cell = g.cells[index];
        if (cell.open || cell.flag) return;
        const stack = [index];
        const seen = new Set();
        while (stack.length) {
          const i = stack.pop();
          if (seen.has(i)) continue;
          seen.add(i);
          const c = g.cells[i];
          if (c.open || c.flag) continue;
          c.open = true;
          g.opened++;
          if (c.mine) { g.dead = true; break; }
          if (c.n === 0) {
            const x = i % g.cfg.w, y = Math.floor(i / g.cfg.w);
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= g.cfg.w || ny >= g.cfg.h) continue;
                stack.push(ny * g.cfg.w + nx);
              }
            }
          }
        }
        const need = g.cfg.w * g.cfg.h - g.cfg.mines;
        if (g.opened >= need) g.won = true;
        setGame(g);
      };

      const flag = function (index) {
        if (game.dead || game.won) return;
        const g = { cfg: game.cfg, cells: game.cells.map((c) => Object.assign({}, c)), dead: false, won: false, opened: game.opened };
        if (g.cells[index].open) return;
        g.cells[index].flag = !g.cells[index].flag;
        setGame(g);
      };

      const size = level === 'easy' ? 26 : (level === 'hard' ? 20 : 16);
      const rows = [];
      for (let y = 0; y < game.cfg.h; y++) {
        for (let x = 0; x < game.cfg.w; x++) {
          const i = y * game.cfg.w + x;
          const c = game.cells[i];
          const label = c.open ? (c.mine ? '✳' : (c.n || '')) : (c.flag ? '⚑' : '');
          rows.push(h('button', {
            key: i,
            onClick: function () { reveal(i); },
            onContextMenu: function (event) { event.preventDefault(); flag(i); },
            style: {
              width: size, height: size, padding: 0, borderRadius: 3,
              border: '1px solid ' + C.line,
              background: c.open ? (c.mine ? '#7a3b3b' : '#26303c') : '#1b2230',
              color: c.open && c.n ? C.ink : (c.flag ? C.accent : C.dim),
              fontSize: 12, cursor: 'pointer',
            },
          }, label));
        }
      }
      const status = game.dead ? '踩雷了' : (game.won ? '清完了' : '点开格子，右键插旗');
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
          h('span', { style: { color: C.ink, fontSize: 13, fontWeight: 600 } }, status),
          h('span', { style: { flex: 1 } }),
          h('button', { onClick: function () { reset(); }, style: btn() }, '重开')),
        h('div', { style: { display: 'flex', gap: 6 } },
          ['easy', 'hard', 'expert'].map(function (lv) {
            return h('button', {
              key: lv,
              onClick: function () { setLevel(lv); setGame(msNew(lv)); },
              style: tabBtn(level === lv),
            }, MS_LEVELS[lv].label);
          })),
        h('div', {
          style: {
            display: 'grid', gridTemplateColumns: 'repeat(' + game.cfg.w + ', ' + size + 'px)',
            gap: 2, background: C.panel, padding: 4, borderRadius: 6, userSelect: 'none',
          },
        }, rows));
    }

    // ═══════════ 中国象棋 ═══════════
    const XQ_CH = { K: '帥', A: '仕', B: '相', N: '馬', R: '車', C: '炮', P: '兵', k: '將', a: '士', b: '象', n: '馬', r: '車', c: '砲', p: '卒' };
    const XQ_VAL = { k: 1000, r: 9, c: 4.5, n: 4, b: 2, a: 2, p: 1 };
    const xqS = function (p) { return p ? (p === p.toUpperCase() ? 'r' : 'b') : ''; };
    const xqR = function (i) { return (i / 9) | 0; };
    const xqC = function (i) { return i % 9; };
    function xqNew() {
      const b = new Array(90).fill('');
      const back = ['r', 'n', 'b', 'a', 'k', 'a', 'b', 'n', 'r'];
      for (let c = 0; c < 9; c++) { b[c] = back[c]; b[81 + c] = back[c].toUpperCase(); }
      b[19] = 'c'; b[25] = 'c'; b[64] = 'C'; b[70] = 'C';
      [0, 2, 4, 6, 8].forEach(function (c) { b[27 + c] = 'p'; b[54 + c] = 'P'; });
      return b;
    }
    function xqMoves(b, i) {
      const p = b[i]; if (!p) return [];
      const s = xqS(p), r = xqR(i), c = xqC(i), t = p.toUpperCase(), out = [];
      const add = function (rr, cc, slide) {
        if (rr < 0 || rr > 9 || cc < 0 || cc > 8) return false;
        const q = b[rr * 9 + cc];
        if (q && xqS(q) === s) return false;
        out.push(rr * 9 + cc);
        return !q && !!slide;
      };
      if (t === 'K') {
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          const rr = r + d[0], cc = c + d[1];
          if (cc < 3 || cc > 5) return;
          if (s === 'r' ? (rr < 7 || rr > 9) : (rr < 0 || rr > 2)) return;
          add(rr, cc, false);
        });
      } else if (t === 'A') {
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (d) {
          const rr = r + d[0], cc = c + d[1];
          if (cc < 3 || cc > 5) return;
          if (s === 'r' ? (rr < 7 || rr > 9) : (rr < 0 || rr > 2)) return;
          add(rr, cc, false);
        });
      } else if (t === 'B') {
        [[2, 2], [2, -2], [-2, 2], [-2, -2]].forEach(function (d) {
          const rr = r + d[0], cc = c + d[1];
          if (rr < 0 || rr > 9 || cc < 0 || cc > 8) return;
          if (s === 'r' ? rr < 5 : rr > 4) return;
          if (b[(r + d[0] / 2) * 9 + (c + d[1] / 2)]) return;
          add(rr, cc, false);
        });
      } else if (t === 'N') {
        [[-2, -1, -1, 0], [-2, 1, -1, 0], [2, -1, 1, 0], [2, 1, 1, 0], [-1, -2, 0, -1], [1, -2, 0, -1], [-1, 2, 0, 1], [1, 2, 0, 1]].forEach(function (d) {
          if (b[(r + d[2]) * 9 + (c + d[3])]) return;
          add(r + d[0], c + d[1], false);
        });
      } else if (t === 'R' || t === 'C') {
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          let rr = r + d[0], cc = c + d[1], screen = false;
          for (;;) {
            if (rr < 0 || rr > 9 || cc < 0 || cc > 8) break;
            const q = b[rr * 9 + cc];
            if (t === 'R') {
              if (!q) out.push(rr * 9 + cc);
              else { if (xqS(q) !== s) out.push(rr * 9 + cc); break; }
            } else {
              if (!screen) { if (!q) out.push(rr * 9 + cc); else screen = true; }
              else if (q) { if (xqS(q) !== s) out.push(rr * 9 + cc); break; }
            }
            rr += d[0]; cc += d[1];
          }
        });
      } else if (t === 'P') {
        if (s === 'r') {
          add(r - 1, c, false);
          if (r <= 4) { add(r, c - 1, false); add(r, c + 1, false); }
        } else {
          add(r + 1, c, false);
          if (r >= 5) { add(r, c - 1, false); add(r, c + 1, false); }
        }
      }
      return out;
    }
    function xqFacing(b) {
      const a = b.indexOf('K'), z = b.indexOf('k');
      if (a < 0 || z < 0 || xqC(a) !== xqC(z)) return false;
      const lo = Math.min(a, z), hi = Math.max(a, z);
      for (let i = lo + 9; i < hi; i += 9) if (b[i]) return false;
      return true;
    }
    function xqInCheck(b, s) {
      const kp = b.indexOf(s === 'r' ? 'K' : 'k');
      if (kp < 0) return true;
      const other = s === 'r' ? 'b' : 'r';
      for (let i = 0; i < 90; i++) {
        if (b[i] && xqS(b[i]) === other && xqMoves(b, i).indexOf(kp) >= 0) return true;
      }
      return xqFacing(b);
    }
    function xqLegal(b, s) {
      const out = [];
      for (let i = 0; i < 90; i++) {
        if (!b[i] || xqS(b[i]) !== s) continue;
        xqMoves(b, i).forEach(function (to) {
          const n = b.slice(); n[to] = n[i]; n[i] = '';
          if (!xqInCheck(n, s)) out.push([i, to]);
        });
      }
      return out;
    }
    function xqEval(b) {
      let v = 0;
      for (let i = 0; i < 90; i++) {
        const p0 = b[i]; if (!p0) continue;
        const val = XQ_VAL[p0.toLowerCase()] || 0;
        v += xqS(p0) === 'b' ? val : -val;
      }
      return v;
    }
    // side：替哪一方算（'b' 黑 / 'r' 红）。开局加一点随机，别每盘都走同一条线。
    function xqBest(b, side) {
      const me = side === 'r' ? 'r' : 'b';
      const foe = me === 'b' ? 'r' : 'b';
      const sign = me === 'b' ? 1 : -1;
      const moves = xqLegal(b, me);
      if (!moves.length) return null;
      const scored = [];
      moves.forEach(function (mv) {
        const cap = b[mv[1]];
        const nb = b.slice(); nb[mv[1]] = nb[mv[0]]; nb[mv[0]] = '';
        let sc = sign * xqEval(nb);
        if ((cap || '').toLowerCase() === 'k') sc = 1e6;
        else {
          const rep = xqLegal(nb, foe);
          if (!rep.length) sc = 1e5;
          else {
            let worst = 1e9, worstBoard = null;
            for (let k = 0; k < rep.length; k++) {
              const r = rep[k], cap2 = nb[r[1]];
              const nb2 = nb.slice(); nb2[r[1]] = nb2[r[0]]; nb2[r[0]] = '';
              const e2 = sign * xqEval(nb2);
              if (e2 < worst) { worst = e2; worstBoard = nb2; }
            }
            // 预判：对手最疼的那一手之后，我还能怎么应？三步合起来看
            if (worstBoard && worst > -90000) {
              const follow = xqLegal(worstBoard, me);
              if (follow.length) {
                let bestF = -1e9;
                for (let k2 = 0; k2 < follow.length; k2++) {
                  const f = follow[k2];
                  const nb3 = worstBoard.slice();
                  nb3[f[1]] = nb3[f[0]]; nb3[f[0]] = '';
                  const v = sign * xqEval(nb3);
                  if (v > bestF) bestF = v;
                }
                worst = worst * 0.35 + bestF * 0.65;
              }
            }
            sc = worst;
          }
        }
        scored.push({ mv: mv, sc: sc });
      });
      scored.sort(function (a, b2) { return b2.sc - a.sc; });
      // 前几手：跟最优相差 25 分以内的都算好棋，随机挑一个；残局就不再随机，免得乱走
      const top = scored[0].sc;
      if (scored.length > 2 && top < 90000) {
        const pool = scored.filter(function (x) { return x.sc >= top - 25; }).slice(0, 4);
        return pool[Math.floor(Math.random() * pool.length)].mv;
      }
      return scored[0].mv;
    }
    function XqGame(props) {
      const cell = (props.cell || 26) + 8;
      const boardState = React.useState(xqNew);
      const board = boardState[0], setBoard = boardState[1];
      const turnState = React.useState('r');
      const turn = turnState[0], setTurn = turnState[1];
      const overState = React.useState('');
      const over = overState[0], setOver = overState[1];
      const selState = React.useState(-1);
      const sel = selState[0], setSel = selState[1];
      const modeState = React.useState('ai');
      const mode = modeState[0], setMode = modeState[1];
      const legal = React.useMemo(function () { return xqLegal(board, turn); }, [board, turn]);
      const targets = React.useMemo(function () {
        const out = [];
        legal.forEach(function (m) { if (m[0] === sel) out.push(m[1]); });
        return out;
      }, [legal, sel]);
      const sideState = React.useState('r');
      const mySide = sideState[0], setMySide = sideState[1];
      const aiSide = mySide === 'r' ? 'b' : 'r';
      const aiTurn = mode === 'ai' && turn === aiSide && !over;
      const modelState = React.useState(false);
      const useModel = modelState[0], setUseModel = modelState[1];
      React.useEffect(function () {
        if (!aiTurn) return;
        let cancelled = false;
        const foe = aiSide === 'b' ? 'r' : 'b';
        const applyMove = function (mv) {
          if (cancelled || !mv) return false;
          const legalNow = xqLegal(board, aiSide);
          const fits = legalNow.some(function (m) { return m[0] === mv[0] && m[1] === mv[1]; });
          if (!fits) return false;
          const cap = board[mv[1]];
          const nb = board.slice(); nb[mv[1]] = nb[mv[0]]; nb[mv[0]] = '';
          setBoard(nb);
          if ((cap || '').toLowerCase() === 'k') { setOver(aiSide === 'b' ? '黑方胜' : '红方胜'); return true; }
          setTurn(foe);
          if (!xqLegal(nb, foe).length) setOver(aiSide === 'b' ? '黑方胜' : '红方胜');
          return true;
        };
        const t = setTimeout(function () {
          if (!useModel) { applyMove(xqBest(board, aiSide)); return; }
          fetch('/game-corner/api/move', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ game: 'xiangqi', board: board }),
          }).then(function (r) { return r.json(); }).then(function (res) {
            if (!res || !res.ok) throw new Error('没拿到走法');
            return [res.from.y * 9 + res.from.x, res.to.y * 9 + res.to.x];
          }).then(function (mv) {
            if (!applyMove(mv)) applyMove(xqBest(board, aiSide));
          }).catch(function () { applyMove(xqBest(board, aiSide)); });
        }, 260);
        return function () { cancelled = true; clearTimeout(t); };
      }, [aiTurn, board, useModel]);
      const click = function (i) {
        if (over) return;
        if (mode === 'ai' && turn !== mySide) return;
        if (sel >= 0 && targets.indexOf(i) >= 0) {
          const cap = board[i];
          const nb = board.slice(); nb[i] = nb[sel]; nb[sel] = '';
          const next = turn === 'r' ? 'b' : 'r';
          setBoard(nb); setSel(-1);
          if ((cap || '').toLowerCase() === 'k') { setOver(turn === 'r' ? '红方胜' : '黑方胜'); return; }
          setTurn(next);
          if (!xqLegal(nb, next).length) setOver(turn === 'r' ? '红方胜' : '黑方胜');
          return;
        }
        if (board[i] && xqS(board[i]) === turn) setSel(i);
        else setSel(-1);
      };
      const check = over ? '' : (xqInCheck(board, turn) ? '（将军）' : '');
      const status = over ? over : (turn === 'r' ? '红方走' : '黑方走') + check;
      const cells = [];
      for (let i = 0; i < 90; i++) {
        const p = board[i];
        const red = p && xqS(p) === 'r';
        const isSel = i === sel;
        const isT = targets.indexOf(i) >= 0;
        cells.push(h('button', {
          key: i, onClick: function () { click(i); },
          style: {
            width: cell, height: cell, padding: 0, border: '1px solid rgba(120,140,170,.35)',
            background: isSel ? 'rgba(255,190,60,.35)' : (isT ? 'rgba(80,200,140,.22)' : 'transparent'),
            color: p ? (red ? '#ff8a80' : '#d7c9a0') : 'transparent',
            fontSize: Math.round(cell * 0.62), lineHeight: 1, cursor: 'pointer',
            fontFamily: '"KaiTi","STKaiti",serif', borderRadius: 3,
          },
        }, p ? XQ_CH[p] : ''));
      }
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
          h('span', { style: { color: C.ink, fontSize: 13, fontWeight: 600 } }, status),
          h('span', { style: { flex: 1 } }),
          h('button', {
            onClick: function () {
              setBoard(xqNew()); setTurn('r'); setOver(''); setSel(-1);
            }, style: btn(),
          }, '重开'),
          h('button', {
            onClick: function () { setMode(mode === 'ai' ? 'pvp' : 'ai'); }, style: tabBtn(mode === 'pvp'),
          }, mode === 'ai' ? '人机' : '双人'),
          h('button', {
            onClick: function () {
              const nextSide = mySide === 'r' ? 'b' : 'r';
              setMySide(nextSide);
              setBoard(xqNew()); setTurn('r'); setOver(''); setSel(-1);
            },
            style: tabBtn(mySide === 'b'),
            title: '换先后手，会重开一局',
          }, mySide === 'r' ? '先手·执红' : '后手·执黑'),
          h('button', {
            onClick: function () { setUseModel(!useModel); },
            style: tabBtn(useModel),
            title: '让模型替你走对面；没配 key 会自动退回本地搜索',
          }, useModel ? '模型：开' : '模型：关')),
        h('div', {
          style: {
            display: 'grid', gridTemplateColumns: 'repeat(9, ' + cell + 'px)',
            gap: 0, background: 'rgba(190,160,100,.10)', padding: 3, borderRadius: 6, userSelect: 'none',
            width: 'max-content',
          },
        }, cells),
        h('div', { style: { color: C.dim, fontSize: 11 } }, '人机模式下你执红先行；暂不支持开局飞将/长将等特殊裁定。'));
    }

    // ═══════════ 国际象棋 ═══════════
    const CH_GLYPH = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
    const CH_VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 1000 };
    const chS = function (p) { return p ? (p === p.toUpperCase() ? 'w' : 'b') : ''; };
    const chR = function (i) { return (i / 8) | 0; };
    const chC = function (i) { return i % 8; };
    function chNew() {
      const b = new Array(64).fill('');
      const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
      for (let c = 0; c < 8; c++) { b[c] = back[c]; b[56 + c] = back[c].toUpperCase(); b[8 + c] = 'p'; b[48 + c] = 'P'; }
      return b;
    }
    function chMoves(b, i) {
      const p = b[i]; if (!p) return [];
      const s = chS(p), r = chR(i), c = chC(i), t = p.toUpperCase(), out = [];
      const add = function (rr, cc) {
        if (rr < 0 || rr > 7 || cc < 0 || cc > 7) return false;
        const q = b[rr * 8 + cc];
        if (q && chS(q) === s) return false;
        out.push(rr * 8 + cc);
        return !q;
      };
      if (t === 'P') {
        const dir = s === 'w' ? -1 : 1;
        const start = s === 'w' ? 6 : 1;
        if (!b[(r + dir) * 8 + c]) {
          out.push((r + dir) * 8 + c);
          if (r === start && !b[(r + 2 * dir) * 8 + c]) out.push((r + 2 * dir) * 8 + c);
        }
        [-1, 1].forEach(function (dc) {
          const rr = r + dir, cc = c + dc;
          if (rr < 0 || rr > 7 || cc < 0 || cc > 7) return;
          const q = b[rr * 8 + cc];
          if (q && chS(q) !== s) out.push(rr * 8 + cc);
        });
      } else if (t === 'N') {
        [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].forEach(function (d) {
          add(r + d[0], c + d[1]);
        });
      } else if (t === 'K') {
        [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].forEach(function (d) {
          add(r + d[0], c + d[1]);
        });
      } else {
        const dirs = t === 'B' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
          : t === 'R' ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
            : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        dirs.forEach(function (d) {
          let rr = r + d[0], cc = c + d[1];
          for (;;) {
            if (rr < 0 || rr > 7 || cc < 0 || cc > 7) break;
            const q = b[rr * 8 + cc];
            if (!q) out.push(rr * 8 + cc);
            else { if (chS(q) !== s) out.push(rr * 8 + cc); break; }
            rr += d[0]; cc += d[1];
          }
        });
      }
      return out;
    }
    function chAttacked(b, sq, by) {
      for (let i = 0; i < 64; i++) {
        if (b[i] && chS(b[i]) === by && chMoves(b, i).indexOf(sq) >= 0) return true;
      }
      return false;
    }
    function chInCheck(b, s) {
      const kp = b.indexOf(s === 'w' ? 'K' : 'k');
      return kp < 0 ? true : chAttacked(b, kp, s === 'w' ? 'b' : 'w');
    }
    function chLegal(b, s) {
      const out = [];
      for (let i = 0; i < 64; i++) {
        if (!b[i] || chS(b[i]) !== s) continue;
        chMoves(b, i).forEach(function (to) {
          const n = b.slice(); n[to] = n[i]; n[i] = '';
          if (!chInCheck(n, s)) out.push([i, to]);
        });
      }
      return out;
    }
    function chEval(b) {
      let v = 0;
      for (let i = 0; i < 64; i++) {
        const p0 = b[i]; if (!p0) continue;
        const val = CH_VAL[p0.toLowerCase()] || 0;
        v += chS(p0) === 'b' ? val : -val;
        v += (chS(p0) === 'b' ? 1 : -1) * (3.5 - Math.abs(3.5 - chR(i)) - Math.abs(3.5 - chC(i))) * 0.02;
      }
      return v;
    }
    function chBest(b, side) {
      const me = side === 'w' ? 'w' : 'b';
      const foe = me === 'b' ? 'w' : 'b';
      const sign = me === 'b' ? 1 : -1;
      const moves = chLegal(b, me);
      if (!moves.length) return null;
      let best = moves[0], bs = -1e9;
      moves.forEach(function (mv) {
        const cap = b[mv[1]];
        const nb = b.slice(); nb[mv[1]] = nb[mv[0]]; nb[mv[0]] = '';
        let sc = sign * chEval(nb);
        if ((cap || '').toLowerCase() === 'k') sc = 1e6;
        else {
          const rep = chLegal(nb, foe);
          if (!rep.length) sc = chInCheck(nb, foe) ? 1e5 : 0;
          else {
            let worst = 1e9, worstBoard = null;
            for (let k = 0; k < rep.length; k++) {
              const r = rep[k], cap2 = nb[r[1]];
              const nb2 = nb.slice(); nb2[r[1]] = nb2[r[0]]; nb2[r[0]] = '';
              let e2 = sign * chEval(nb2);
              if ((cap2 || '').toLowerCase() === 'k') e2 = -1e6;
              if (e2 < worst) { worst = e2; worstBoard = nb2; }
            }
            // 预判：对手最狠的一手之后，我还能怎么应
            if (worstBoard && worst > -90000) {
              const follow = chLegal(worstBoard, me);
              if (follow.length) {
                let bestF = -1e9;
                for (let k2 = 0; k2 < follow.length; k2++) {
                  const f = follow[k2];
                  const nb3 = worstBoard.slice();
                  nb3[f[1]] = nb3[f[0]]; nb3[f[0]] = '';
                  const v = sign * chEval(nb3);
                  if (v > bestF) bestF = v;
                }
                worst = worst * 0.35 + bestF * 0.65;
              }
            }
            sc = worst;
          }
        }
        sc += Math.random() * 0.01;
        if (sc > bs) { bs = sc; best = mv; }
      });
      return best;
    }
    function ChGame(props) {
      const cell = (props.cell || 26) + 8;
      const boardState = React.useState(chNew);
      const board = boardState[0], setBoard = boardState[1];
      const turnState = React.useState('w');
      const turn = turnState[0], setTurn = turnState[1];
      const overState = React.useState('');
      const over = overState[0], setOver = overState[1];
      const selState = React.useState(-1);
      const sel = selState[0], setSel = selState[1];
      const modeState = React.useState('ai');
      const mode = modeState[0], setMode = modeState[1];
      const legal = React.useMemo(function () { return chLegal(board, turn); }, [board, turn]);
      const targets = React.useMemo(function () {
        const out = [];
        legal.forEach(function (m) { if (m[0] === sel) out.push(m[1]); });
        return out;
      }, [legal, sel]);
      const sideState = React.useState('w');
      const mySide = sideState[0], setMySide = sideState[1];
      const aiColor = mySide === 'w' ? 'b' : 'w';
      const aiTurn = mode === 'ai' && turn === aiColor && !over;
      const modelState = React.useState(false);
      const useModel = modelState[0], setUseModel = modelState[1];
      React.useEffect(function () {
        if (!aiTurn) return;
        let cancelled = false;
        const foe = aiColor === 'b' ? 'w' : 'b';
        const applyMove = function (mv) {
          if (cancelled || !mv) return false;
          if (chMoves(board, mv[0]).indexOf(mv[1]) < 0) return false;
          const cap = board[mv[1]];
          const nb = board.slice(); nb[mv[1]] = nb[mv[0]]; nb[mv[0]] = '';
          setBoard(nb);
          if ((cap || '').toLowerCase() === 'k') { setOver(aiColor === 'b' ? '黑方胜' : '白方胜'); return true; }
          setTurn(foe);
          if (!chLegal(nb, foe).length) setOver(aiColor === 'b' ? '黑方胜' : '白方胜');
          return true;
        };
        const localBest = function () {
          const mv = chBest(board, aiColor);
          if (mv) applyMove(mv);
          else setOver(aiColor === 'b' ? '白方胜' : '黑方胜');
        };
        const t = setTimeout(function () {
          if (!useModel) { localBest(); return; }
          fetch('/game-corner/api/move', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ game: 'chess', board: board }),
          }).then(function (r) { return r.json(); }).then(function (res) {
            if (!res || !res.ok) throw new Error('没拿到走法');
            return [res.from.y * 8 + res.from.x, res.to.y * 8 + res.to.x];
          }).then(function (mv) {
            if (!applyMove(mv)) localBest();
          }).catch(function () { localBest(); });
        }, 260);
        return function () { cancelled = true; clearTimeout(t); };
      }, [aiTurn, board, useModel]);
      const click = function (i) {
        if (over) return;
        if (mode === 'ai' && turn !== mySide) return;
        if (sel >= 0 && targets.indexOf(i) >= 0) {
          const cap = board[i];
          const nb = board.slice(); nb[i] = nb[sel]; nb[sel] = '';
          const next = turn === 'w' ? 'b' : 'w';
          setBoard(nb); setSel(-1);
          if ((cap || '').toLowerCase() === 'k') { setOver(turn === 'w' ? '白方胜' : '黑方胜'); return; }
          setTurn(next);
          if (!chLegal(nb, next).length) {
            setOver(chInCheck(nb, next) ? (turn === 'w' ? '将死，白方胜' : '将死，黑方胜') : '和棋（困毙）');
          }
          return;
        }
        if (board[i] && chS(board[i]) === turn) setSel(i);
        else setSel(-1);
      };
      const check = over ? '' : (chInCheck(board, turn) ? '（将军）' : '');
      const status = over ? over : (turn === 'w' ? '白方走' : '黑方走') + check;
      const cells = [];
      for (let i = 0; i < 64; i++) {
        const p = board[i];
        const white = p && chS(p) === 'w';
        const light = (chR(i) + chC(i)) % 2 === 0;
        const isSel = i === sel;
        const isT = targets.indexOf(i) >= 0;
        cells.push(h('button', {
          key: i, onClick: function () { click(i); },
          style: {
            width: cell, height: cell, padding: 0, border: 'none', borderRadius: 2,
            background: isSel ? 'rgba(255,190,60,.5)' : (isT ? 'rgba(80,200,140,.35)' : (light ? '#b9c2d3' : '#5d6780')),
            color: p ? (white ? '#f7f3e6' : '#161a22') : 'transparent',
            fontSize: Math.round(cell * 0.72), lineHeight: 1, cursor: 'pointer',
            textShadow: white
              ? '0 0 2px #000, 0 0 2px #000, 0 1px 2px #000'
              : '0 0 1px rgba(255,255,255,.55)',
          },
        }, p ? CH_GLYPH[p] : ''));
      }
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
          h('span', { style: { color: C.ink, fontSize: 13, fontWeight: 600 } }, status),
          h('span', { style: { flex: 1 } }),
          h('button', {
            onClick: function () { setBoard(chNew()); setTurn('w'); setOver(''); setSel(-1); }, style: btn(),
          }, '重开'),
          h('button', {
            onClick: function () { setMode(mode === 'ai' ? 'pvp' : 'ai'); }, style: tabBtn(mode === 'pvp'),
          }, mode === 'ai' ? '人机' : '双人'),
          h('button', {
            onClick: function () {
              const nextSide = mySide === 'w' ? 'b' : 'w';
              setMySide(nextSide);
              setBoard(chNew()); setTurn('w'); setOver(''); setSel(-1);
            },
            style: tabBtn(mySide === 'b'),
            title: '换先后手，会重开一局',
          }, mySide === 'w' ? '先手·执白' : '后手·执黑'),
          h('button', {
            onClick: function () { setUseModel(!useModel); },
            style: tabBtn(useModel),
            title: '让模型替你走对面；没配 key 会自动退回本地搜索',
          }, useModel ? '模型：开' : '模型：关')),
        h('div', {
          style: {
            display: 'grid', gridTemplateColumns: 'repeat(8, ' + cell + 'px)',
            gap: 0, padding: 3, borderRadius: 6, userSelect: 'none', width: 'max-content',
          },
        }, cells),
        h('div', { style: { color: C.dim, fontSize: 11 } }, '人机模式下你执白先行；王车易位、吃过路兵暂不支持，兵到底自动升后。'));
    }

    // ═══════════ 公式本 ═══════════
    const FORMULA = [
      {
        title: '中国象棋',
        rows: [
          ['子力价值', '车 9 ｜ 炮 4.5 ｜ 马 4 ｜ 相/仕 2 ｜ 兵 1（过河 2）'],
          ['走子口诀', '马走日、象走田、车走直线、炮打隔山；兵过河可横走；将帅不出九宫'],
          ['铁律', '双王不能照面（飞将）；走完不能让自己的将被吃'],
          ['开局 A', '中炮对屏风马：炮二平五 → 马8进7、马2进3（稳）'],
          ['开局 B', '顺炮：炮二平五 炮8平5（对攻）'],
          ['开局 C', '飞相局：相三进五（先守后攻）；仙人指路：兵七进一（探路）'],
          ['中局思路', '先活车马、占肋道；没算清别兑子；车不轻易换马炮'],
        ],
      },
      {
        title: '国际象棋',
        rows: [
          ['子力价值', '后 9 ｜ 车 5 ｜ 象 3 ｜ 马 3 ｜ 兵 1'],
          ['开局原则', '抢中心（e4/d4）、轻子先出、尽早易位、后别太早动；每步先问：这步送子吗？'],
          ['开局 A', '意大利：1.e4 e5 2.Nf3 Nc6 3.Bc4'],
          ['开局 B', '西班牙：3.Bb5；西西里：1.e4 c5；后翼弃兵：1.d4 d5 2.c4'],
          ['关键术语', '将军 = 王被攻击；将死 = 无解；困毙 = 无子可走（和棋）'],
          ['小技巧', '兵形决定中局；车占开放线；象比马强于开阔局面，马强于封闭局面'],
        ],
      },
      {
        title: '五子棋',
        rows: [
          ['胜负', '横竖斜任意方向连成五子（含以上）即胜；本盘是无禁手简版，长连也算赢'],
          ['形状力度', '活五 > 活四 > 冲四 > 活三 > 眠三 > 活二；活三必须立刻挡，冲四只有一种挡法'],
          ['开局', '先手走天元或星位附近；第二手斜指、直指都行，别贴着对手下'],
          ['先手意识', '每步先看对手有没有活三、活四；再看自己能不能做出双活三或四三'],
          ['二三点', '活二的两端是未来的活三点，抢「二三点」比追着挡更快'],
          ['常见错误', '只顾自己连不管对手活三；反先手时下在对方已有两子的延长线上'],
        ],
      },
      {
        title: '围棋',
        rows: [
          ['基本概念', '气 = 相邻空点；气尽则被提；两只真眼即活，杀不死'],
          ['禁入点', '下完自己没气又不能提对方，就是自杀，规则禁止'],
          ['打劫', '提一子后对方立刻提回会成循环，须先在别处应一手（劫材）才能提回'],
          ['布局', '金角银边草肚皮：先占角（星位、小目），再挂角、拆边，最后才进中腹'],
          ['线位', '三线取地、四线取势；别一二线爬，也别过早五线空跳'],
          ['死活常形', '直三、曲三一点即死；直四、曲四是活形；方四、刀把五要小心'],
          ['收官', '先收双方先手的大官子（扳、挡、双先），再收逆收官子，最后填单官'],
          ['本盘提醒', '19 路、无让子；本盘 AI 只会吃子与贴身，别指望它做眼'],
        ],
      },
      {
        title: '2048',
        rows: [
          ['规则', '同数相撞合并翻倍；每步后空位随机生出 2 或 4；凑出 2048 即通关'],
          ['核心策略', '把最大数固定在一个角，之后只用三个方向（例如只按左、上），别让大数离开角'],
          ['蛇形排法', '数字按大小沿边排成一条蛇：最大在角、次大贴边，依次递减'],
          ['避免', '别上下乱按把大数从角里挤出来；别让空位全被小数堵死'],
          ['判断步法', '按之前先想：这一下会不会让最大的两块分开？会就别按'],
          ['节奏', '512 之前随便合并；1024 之后只做加法、刻意不引入新格子'],
        ],
      },
      {
        title: '扫雷',
        rows: [
          ['数字含义', '数字 = 周围八格里的雷数；点到空白格会自动展开'],
          ['起手', '第一下点角或边，展开面积大、信息多'],
          ['减法推理', '相邻两个数字差 1，差值那一侧必有雷；差 0 那一侧必空'],
          ['定式 1-2-1', '边上连成 1-2-1，两侧的 1 下面各一颗雷'],
          ['定式 1-2-2-1', '中间两个 2 下面各一颗雷'],
          ['标记', '确定是雷就插旗；数字周围插满旗，其余格子全是安全格'],
          ['该猜时', '信息算尽仍无解，选概率最低处点，别硬猜角落'],
        ],
      },
      {
        title: '坦克',
        rows: [
          ['规则', '子弹撞墙反弹，弹两次后消失；一炮毙命，敌我都一样'],
          ['自身危险', '子弹离开炮口就变成公共的，反弹回来照样能打死自己'],
          ['走位', '贴着墙和角走，留退路；不要停在长直走廊正中间'],
          ['预判', '直线进墙会原路返回；斜着进角会沿邻边折回'],
          ['开火时机', '只打同一行/列、距离八格内、中间没有墙的目标，否则别浪费那发'],
          ['躲弹', '看到子弹朝自己来，往侧面一格躲，别顺着子弹方向跑'],
          ['噩梦档', '对面会算十几拍弹道并提前挪位；逼它进窄道、用反弹封退路'],
        ],
      },
      {
        title: '象棋·进阶',
        rows: [
          ['杀法库', '马后炮、卧槽马（马占对方三楼肋）、双车错、平顶冠、仙鹤大伸腿、三楼的贵宾（老将上三楼就危险）'],
          ['残局定式', '单车必胜马双士；单兵擒王（将左兵右、兵临城下）；困毙算赢，不用非将死'],
          ['判断顺序', '先看自己有没有杀（以暴制暴），再算对手的反击；没杀再求稳'],
          ['阵型弱点', '老将上不去、下不来，就是弱点；用马反复将军逼它上楼，再收网'],
          ['弃子手法', '弃车砍底士引开守子，接着马后炮或退炮绝杀；弃子必须算清后续'],
          ['导入技巧', '记住定式不是背谱，是让脑子里「有那一手」；想不到的棋永远不会走出来'],
        ],
      },
      {
        title: '五子棋·进阶',
        rows: [
          ['必胜形', '三三（两个活三交叉）、四三（冲四+活三）、双活三——无禁手规则下都是连不下去的杀'],
          ['六步套路', '天元 → 马步 → 三三点 → 逼应手 → 活三 → 三三收网；每步都要「攻守兼备」'],
          ['牵制', '先做二三点，让对手每步只能被动应；先手不丢，比追着挡强得多'],
          ['读对手', '对手活三必挡、冲四只有一条挡路；算清他的挡点，再决定自己下一手做双三'],
          ['常见误区', '只顾自己连不挡活三；抢攻时下在对方两子延长线上送先手'],
        ],
      },
      {
        title: '围棋·进阶',
        rows: [
          ['点三三', '对方只有一颗星位子，可点（能活）；对方已小飞守角，再点就不好，会把外围走厚，只算大官子'],
          ['两边有手', '对方两边都展开时点进去，只能打劫活，角里还容易被做成刀把五（死形）'],
          ['缩小眼位', '被压低时用「猴」一手做眼，别硬挡——硬挡会被一点成死'],
          ['侵分手段', '二五侵分、二路潜入、拆三、大飞安定；进角不是只有点三三一条路'],
          ['劫的选择', '自己劫材多就打劫转换，劫材少就老实做活，别为劫把外围走死'],
          ['出处', 'B站 BV1zjVr6SEUY（星位守角后点三三的死活）'],
        ],
      },
      {
        title: '先后手·各棋差异',
        rows: [
          ['中国象棋', '红先。先手有优势但不压倒性，先手方要抢出车、抢先手；后手方求稳反击（顺炮、屏风马）'],
          ['国际象棋', '白先。白方主动，先手约值零点几兵；白方开局抢中心、快出轻子，黑方求均衡再反击'],
          ['五子棋', '黑先，且先手优势极大——自由规则下黑几乎必胜，所以正式比赛用禁手或交换规则来平衡'],
          ['围棋', '黑先，必须贴目来抵消先手：中国规则黑贴 3¾ 子（7.5 目），日韩规则贴 6.5 目；贴完大致均衡'],
          ['2048／扫雷', '没有先后手的说法，只有先后顺序：2048 先占角、扫雷先点边角'],
          ['坦克', '你永远是红方、先动半个回合；先手优势在于先摆位置，被围在角落时先手反而吃亏'],
          ['记住一句', '先手不是「快一步」，是「能决定局面往哪儿走」；丢先手比丢一子更贵'],
        ],
      },
    ];
    function FormulaBook() {
      const jump = function (title) {
        const el = document.getElementById('gc-formula-' + title);
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
      };
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
          FORMULA.map(function (sec) {
            return h('button', {
              key: 'j' + sec.title,
              onClick: function () { jump(sec.title); },
              style: btn({ padding: '1px 7px', fontSize: 11 }),
            }, sec.title);
          })),
        h('div', {
          // 公式本自己滚：拦下滚轮，别让它冒到外层去带动整页
          onWheel: function (e) { e.stopPropagation(); },
          onTouchMove: function (e) { e.stopPropagation(); },
          style: {
            display: 'flex', flexDirection: 'column', gap: 12,
            maxHeight: '54vh', overflowY: 'auto', overscrollBehavior: 'contain',
            paddingRight: 6, border: '1px solid ' + C.line, borderRadius: 8, padding: 10,
          },
        },
          FORMULA.map(function (sec) {
            return h('div', { key: sec.title, id: 'gc-formula-' + sec.title },
              h('div', { style: { color: C.ink, fontSize: 13, fontWeight: 600, marginBottom: 4 } }, sec.title),
              h('div', { style: { display: 'flex', flexDirection: 'column', gap: 3 } },
                sec.rows.map(function (r) {
                  return h('div', { key: r[0], style: { display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.6 } },
                    h('span', { style: { color: C.ink, minWidth: 64, flex: '0 0 auto' } }, r[0]),
                    h('span', { style: { color: C.dim } }, r[1]));
                })));
          })),
        h('div', { style: { color: C.dim, fontSize: 11 } }, '记住口诀和开局骨架，比多背变化有用。上面那颗按钮可以直接跳到对应游戏。'));
    }

    // ═══════════ T-90 坦克 ═══════════
    let TK_W = 15;
    let TK_H = 15;
    const TK_DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const TK_FLIP = { up: 'down', down: 'up', left: 'right', right: 'left' };

    function tkInit(level, hp, foeCount, size) {
      TK_W = size || 15;
      TK_H = TK_W;
      const spawnP = { x: Math.floor(TK_W / 2), y: TK_H - 2 };
      const speed = level === 'easy' ? 3 : (level === 'normal' ? 2 : 1);
      const count = foeCount || (level === 'easy' ? 2 : (level === 'normal' ? 3 : 4));
      const playerHp = hp || 1;
      let walls = {};
      let enemies = [];
      // 墙每局随机生：不压出生点、边界留一格，并保证从你出发能走到每个敌人
      for (let attempt = 0; attempt < 80; attempt++) {
        const w = {};
        for (let y = 1; y < TK_H - 1; y++) {
          for (let x = 1; x < TK_W - 1; x++) {
            if (x === spawnP.x && y === spawnP.y) continue;
            if (Math.random() < 0.2) w[x + ',' + y] = true;
          }
        }
        const cand = [];
        let ok = true;
        for (let i = 0; i < count && ok; i++) {
          let placed = null;
          for (let tries = 0; tries < 60 && !placed; tries++) {
            const px = 1 + Math.floor(Math.random() * (TK_W - 2));
            const py = 1 + Math.floor(Math.random() * 3);
            if (w[px + ',' + py]) continue;
            if (px === spawnP.x && py === spawnP.y) continue;
            if (cand.some(function (c) { return c.x === px && c.y === py; })) continue;
            placed = { x: px, y: py };
          }
          if (placed) cand.push(placed); else ok = false;
        }
        if (!ok) continue;
        const seen = {};
        const queue = [[spawnP.x, spawnP.y]];
        seen[spawnP.x + ',' + spawnP.y] = true;
        while (queue.length) {
          const cur2 = queue.shift();
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dd) {
            const nx = cur2[0] + dd[0];
            const ny = cur2[1] + dd[1];
            if (nx < 0 || ny < 0 || nx >= TK_W || ny >= TK_H) return;
            const k = nx + ',' + ny;
            if (seen[k] || w[k]) return;
            seen[k] = true;
            queue.push([nx, ny]);
          });
        }
        if (cand.every(function (c) { return seen[c.x + ',' + c.y]; })) {
          walls = w;
          enemies = cand.map(function (c, i) {
            return { x: c.x, y: c.y, dir: 'down', cd: 6 + i * 2, hp: 1 };
          });
          break;
        }
      }
      if (!enemies.length) {
        // 兜底：随机 80 次都不连通时，用一组一定走得通的阵型
        walls = { '4,4': true, '4,5': true, '9,7': true, '8,7': true };
        enemies = [];
        for (let i = 0; i < count; i++) {
          enemies.push({ x: 2 + i * 3, y: 1, dir: 'down', cd: 6 + i * 2, hp: 1 });
        }
      }
      return {
        walls,
        player: { x: spawnP.x, y: spawnP.y, dir: 'up', hp: playerHp, cd: 0 },
        enemies,
        bullets: [],
        over: '',
        kills: 0,
        need: enemies.length,
        tick: 0,
        speed,
        level,
      };
    }

    function tkBlocked(walls, x, y) {
      if (x < 0 || y < 0 || x >= TK_W || y >= TK_H) return true;
      return Boolean(walls[x + ',' + y]);
    }

    function TankGame(props) {
      const levelState = React.useState('normal');
      const level = levelState[0];
      const setLevel = levelState[1];
      const hpState = React.useState(1);
      const hp = hpState[0];
      const setHp = hpState[1];
      const foeState = React.useState(3);
      const foeCount = foeState[0];
      const setFoeCount = foeState[1];
      const sizeState = React.useState(15);
      const size = sizeState[0];
      const setSize = sizeState[1];
      const gState = React.useState(function () { return tkInit('normal', 1, 3, 15); });
      const g = gState[0];
      const setG = gState[1];
      const reload = function (lv, nextHp, nextFoe, nextSize) {
        setLevel(lv);
        setG(tkInit(lv, nextHp || hp, nextFoe || foeCount, nextSize || size));
      };

      // 移动：把「人」挪一格，撞墙不动
      const move = function (dir) {
        setG(function (cur) {
          if (cur.over) return cur;
          const p = Object.assign({}, cur.player, { dir: dir });
          const d = TK_DIRS[dir];
          const nx = p.x + d[0];
          const ny = p.y + d[1];
          // 撞墙、或者那一格已经有敌方坦克，都只转向不前进（禁止重叠）
          const blocked = tkBlocked(cur.walls, nx, ny)
            || cur.enemies.some(function (t) { return t.x === nx && t.y === ny; });
          if (blocked) return Object.assign({}, cur, { player: p });
          p.x = nx; p.y = ny;
          return Object.assign({}, cur, { player: p });
        });
      };

      const fire = function () {
        setG(function (cur) {
          if (cur.over || cur.player.cd > 0) return cur;
          const p = cur.player;
          // 从车自己这一格出发；刚出厂这颗弹不伤人，飞出去一格之后才算公共的
          const bullets = cur.bullets.concat([{ x: p.x, y: p.y, dir: p.dir, enemy: false, armed: false, bounce: 0 }]);
          return Object.assign({}, cur, { bullets: bullets, player: Object.assign({}, p, { cd: 2 }) });
        });
      };

      // 键盘：方向键 / WASD 走，J K L（或空格）开火。
      React.useEffect(function () {
        const onKey = function (event) {
          const t = event.target;
          if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
          const k = event.key.length === 1 ? event.key.toLowerCase() : event.key;
          const dirs = {
            ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
            w: 'up', s: 'down', a: 'left', d: 'right',
          };
          if (dirs[k]) { event.preventDefault(); move(dirs[k]); return; }
          if (k === 'j' || k === 'k' || k === 'l' || k === ' ') { event.preventDefault(); fire(); }
        };
        window.addEventListener('keydown', onKey);
        return function () { window.removeEventListener('keydown', onKey); };
      }, []);

      React.useEffect(function () {
        const timer = window.setInterval(function () {
          setG(function (cur) {
            if (cur.over) return cur;
            let walls = Object.assign({}, cur.walls);
            let bullets = [];
            let player = Object.assign({}, cur.player, { cd: Math.max(0, cur.player.cd - 1) });
            let enemies = cur.enemies.map(function (e) { return Object.assign({}, e, { cd: e.cd - 1 }); });
            let over = '';
            let kills = cur.kills;

            // 子弹：撞墙反弹（Tank Trouble 那套），打中坦克就停；弹太多次自动消失。
            cur.bullets.forEach(function (b) {
              const flip = { up: 'down', down: 'up', left: 'right', right: 'left' };
              const bounce = function (atX, atY) {
                b.dir = flip[b.dir];
                const times = (b.bounce || 0) + 1;
                if (times > 2) return;
                bullets.push({ x: atX, y: atY, dir: b.dir, enemy: b.enemy, bounce: times, armed: true });
              };
              const hitTank = function (cx, cy) {
                // 出厂第一格（还没离开发射者）不伤人；离开之后就是公共敌人，能打到自己
                if (!b.armed) return false;
                if (player.x === cx && player.y === cy) {
                  player = Object.assign({}, player, { hp: player.hp - 1 });
                  if (player.hp <= 0) over = '被击毁了';
                  return true;
                }
                const e = enemies.find(function (t) { return t.x === cx && t.y === cy; });
                if (e) {
                  enemies = enemies.filter(function (t) { return t !== e; });
                  if (!b.enemy) kills++;
                  return true;
                }
                return false;
              };

              if (walls[b.x + ',' + b.y]) { bounce(b.x, b.y); return; }
              if (hitTank(b.x, b.y)) return;

              const d = TK_DIRS[b.dir];
              const nx = b.x + d[0];
              const ny = b.y + d[1];
              if (nx < 0 || ny < 0 || nx >= TK_W || ny >= TK_H) { bounce(b.x, b.y); return; }
              if (walls[nx + ',' + ny]) { bounce(b.x, b.y); return; }
              if (hitTank(nx, ny)) return;
              bullets.push({ x: nx, y: ny, dir: b.dir, enemy: b.enemy, bounce: b.bounce || 0, armed: true });
            });

            // 敌方坦克：每隔 speed 拍走一次，朝玩家方向蹭，偶尔开火
            if (cur.tick % cur.speed === 0) {
              // 预判深度按难度走：简单完全不躲，deepseek 会算到很远
              const lookahead = cur.level === 'deepseek' ? 16 : (cur.level === 'hard' ? 10 : (cur.level === 'normal' ? 6 : 0));
              const danger = {};
              cur.bullets.forEach(function (b) {
                let bx = b.x, by = b.y, bd = b.dir, armed2 = b.armed, bounced = 0;
                for (let step = 0; step < lookahead; step++) {
                  const dd = TK_DIRS[bd];
                  const px = bx + dd[0];
                  const py = by + dd[1];
                  if (px < 0 || py < 0 || px >= TK_W || py >= TK_H || walls[px + ',' + py]) {
                    bd = TK_FLIP[bd];
                    bounced++;
                    if (bounced > 2) break;
                    continue;
                  }
                  bx = px; by = py; armed2 = true;
                  if (armed2) danger[bx + ',' + by] = true;
                }
              });

              // 我方射程：我这四格能打到的位置，它也要躲
              const threat = {};
              [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dd) {
                for (let s = 1; s <= 4; s++) {
                  const tx = player.x + dd[0] * s;
                  const ty = player.y + dd[1] * s;
                  if (tx < 0 || ty < 0 || tx >= TK_W || ty >= TK_H) break;
                  if (walls[tx + ',' + ty]) break;
                  threat[tx + ',' + ty] = true;
                }
              });

              // 只有「子弹会扫过」才触发逃跑；我方枪口范围只做轻度扣分，别因此一直不动
              const bad = Object.assign({}, danger);
              const bfsStep = function (e, ok) {
                const start = e.x + ',' + e.y;
                const seen = {};
                seen[start] = true;
                const parent = {};
                const queue = [[e.x, e.y, 0]];
                while (queue.length) {
                  const node = queue.shift();
                  if (node[2] > 0 && ok(node[0], node[1])) {
                    let key = node[0] + ',' + node[1];
                    while (parent[key] && parent[key] !== start) key = parent[key];
                    return { x: Number(key.split(',')[0]), y: Number(key.split(',')[1]) };
                  }
                  if (node[2] >= 5) continue;
                  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dd) {
                    const nx = node[0] + dd[0];
                    const ny = node[1] + dd[1];
                    if (nx < 0 || ny < 0 || nx >= TK_W || ny >= TK_H) return;
                    const k = nx + ',' + ny;
                    if (seen[k] || walls[k]) return;
                    if (player.x === nx && player.y === ny) return;
                    if (enemies.some(function (o) { return o !== e && o.x === nx && o.y === ny; })) return;
                    seen[k] = true;
                    parent[k] = node[0] + ',' + node[1];
                    queue.push([nx, ny, node[2] + 1]);
                  });
                }
                return null;
              };

              // 看得到我就能开火（中间不能隔墙），和射程判定共用
              const canSee = function (ax, ay) {
                if (ax === player.x) {
                  const dy = Math.sign(player.y - ay);
                  if (!dy) return false;
                  for (let y = ay + dy; y !== player.y; y += dy) if (walls[ax + ',' + y]) return false;
                  return true;
                }
                if (ay === player.y) {
                  const dx = Math.sign(player.x - ax);
                  if (!dx) return false;
                  for (let x = ax + dx; x !== player.x; x += dx) if (walls[x + ',' + ay]) return false;
                  return true;
                }
                return false;
              };

              enemies = enemies.map(function (e) {
                const here = e.x + ',' + e.y;
                const stepOf = function (step) {
                  if (!step) return null;
                  const dir2 = step.x > e.x ? 'right' : (step.x < e.x ? 'left' : (step.y > e.y ? 'down' : 'up'));
                  return Object.assign({}, e, { x: step.x, y: step.y, dir: dir2 });
                };
                // 只有站在弹道上才强制跑；其余交给下面的打分（会找射界、会保持距离）
                if (danger[here]) {
                  const escaped = stepOf(bfsStep(e, function (x, y) { return !danger[x + ',' + y]; }));
                  if (escaped) return escaped;
                }
                const options = [];
                [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dd) {
                  const nx = e.x + dd[0];
                  const ny = e.y + dd[1];
                  if (nx < 0 || ny < 0 || nx >= TK_W || ny >= TK_H) return;
                  if (walls[nx + ',' + ny]) return;
                  if (player.x === nx && player.y === ny) return;
                  if (enemies.some(function (o) { return o !== e && o.x === nx && o.y === ny; })) return;
                  const dir2 = dd[1] === -1 ? 'up' : (dd[1] === 1 ? 'down' : (dd[0] === 1 ? 'right' : 'left'));
                  const nd = Math.abs(player.x - nx) + Math.abs(player.y - ny);
                  let score = 0;
                  if (danger[nx + ',' + ny]) score -= 100;        // 子弹要经过的格子，躲
                  if (threat[nx + ',' + ny]) score -= 12;         // 站我枪口上，稍微避一避
                  if (canSee(nx, ny)) score += 20;                // 能打到我，加分：它也会主动进攻
                  if (nd < 4) score -= (4 - nd) * 7;              // 太近就往后撤
                  if (nd > 6) score -= (nd - 6) * 2;              // 太远就往前压
                  if (nd >= 4 && nd <= 6) score += 9;             // 中远距离，安全射击位
                  score += Math.random() * 2;
                  options.push({ x: nx, y: ny, dir: dir2, score: score });
                });
                if (!options.length) return e;
                options.sort(function (a2, b2) { return b2.score - a2.score; });
                const best = options[0];
                return Object.assign({}, e, { x: best.x, y: best.y, dir: best.dir });
              });
            }
            // 所有敌人是「同时对着一帧的旧位置」算的，可能挤进同一格：按顺序落地，重复的挪到空邻格
            (function () {
              const used = {};
              used[player.x + ',' + player.y] = true;
              enemies.forEach(function (e) {
                const key = e.x + ',' + e.y;
                if (!used[key]) { used[key] = true; return; }
                const cand = [[1, 0], [-1, 0], [0, 1], [0, -1]]
                  .map(function (d) { return { x: e.x + d[0], y: e.y + d[1] }; })
                  .filter(function (c) {
                    if (c.x < 0 || c.y < 0 || c.x >= TK_W || c.y >= TK_H) return false;
                    if (walls[c.x + ',' + c.y]) return false;
                    return !used[c.x + ',' + c.y];
                  });
                if (cand.length) {
                  e.x = cand[0].x;
                  e.y = cand[0].y;
                  used[e.x + ',' + e.y] = true;
                }
              });
            })();
            enemies.forEach(function (e) {
              const sameRow = e.y === player.y;
              const sameCol = e.x === player.x;
              const dist = Math.abs(player.x - e.x) + Math.abs(player.y - e.y);
              // 只有对准、八格以内、中间没有墙时才开枪；其余时候不开，别乱放
              let clear = false;
              if ((sameRow || sameCol) && dist > 0 && dist <= 8) {
                clear = true;
                const dx = sameRow ? Math.sign(player.x - e.x) : 0;
                const dy = sameCol ? Math.sign(player.y - e.y) : 0;
                for (let s = 1; s < dist; s++) {
                  if (walls[(e.x + dx * s) + ',' + (e.y + dy * s)]) { clear = false; break; }
                }
              }
              if (sameRow) e.dir = player.x > e.x ? 'right' : 'left';
              else if (sameCol) e.dir = player.y > e.y ? 'down' : 'up';
              if (e.cd <= 0 && clear) {
                bullets.push({ x: e.x, y: e.y, dir: e.dir, enemy: true, armed: false, bounce: 0 });
                e.cd = 5 + Math.floor(Math.random() * 3);
              }
            });

            if (!over && enemies.length === 0) over = '全部清掉了';

            return {
              walls, player, enemies, bullets, over, kills,
              need: cur.need, tick: cur.tick + 1, speed: cur.speed, level: cur.level,
            };
          });
        }, 220);
        return function () { window.clearInterval(timer); };
      }, []);

      const cell = Math.max(10, Math.min(props.cell || 22, Math.floor(520 / TK_W)));
      const cells = [];
      for (let y = 0; y < TK_H; y++) {
        for (let x = 0; x < TK_W; x++) {
          const isWall = Boolean(g.walls[x + ',' + y]);
          const e = g.enemies.find(function (t) { return t.x === x && t.y === y; });
          const isP = g.player.x === x && g.player.y === y;
          const b = g.bullets.find(function (t) { return t.x === x && t.y === y; });
          let glyph = '';
          let bg = '#121821';
          if (isWall) bg = '#6b5433';
          // 画面上只让「车」和「墙」抢注意力，子弹缩成一个点，别整格换色。
          const myBg = '#2f5f7a';
          const foeBg = '#7a3b3b';
          if (e) { glyph = '▣'; bg = foeBg; }
          if (isP) { glyph = '▤'; bg = myBg; }
          const dot = (!glyph && b) ? h('span', {
            style: {
              width: Math.max(4, Math.round(cell * 0.24)),
              height: Math.max(4, Math.round(cell * 0.24)),
              borderRadius: '50%',
              background: b.enemy ? '#e0655a' : '#5aa9e0',
              display: 'block',
            },
          }) : null;
          cells.push(h('div', {
            key: x + ':' + y,
            style: {
              width: cell, height: cell, background: bg, borderRadius: 3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.ink, fontSize: Math.round(cell * 0.56), lineHeight: 1,
            },
          }, dot || glyph));
        }
      }

      const status = g.over ? g.over : ('击毁 ' + g.kills + ' / ' + g.need);
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
          h('span', { style: { color: C.ink, fontSize: 13, fontWeight: 600 } }, status),
          h('span', { style: { color: C.dim, fontSize: 11 } }, '血 ' + Math.max(0, g.player.hp)),
          h('span', { style: { flex: 1 } }),
          h('button', { onClick: function () { setG(tkInit(level, hp, foeCount, size)); }, style: btn() }, '重开')),
        h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
          [['easy', '简单'], ['normal', '普通'], ['hard', '困难'], ['deepseek', '噩梦']].map(function (it) {
            return h('button', {
              key: it[0],
              onClick: function () { reload(it[0]); },
              style: tabBtn(level === it[0]),
            }, it[1]);
          })),
        h('div', { style: { display: 'flex', gap: 6, alignItems: 'center' } },
          h('span', { style: { color: C.dim, fontSize: 11 } }, '我的血'),
          [1, 2, 3, 5].map(function (n) {
            return h('button', {
              key: 'hp' + n,
              onClick: function () { setHp(n); reload(level, n, foeCount); },
              style: tabBtn(hp === n),
            }, String(n));
          })),
        h('div', { style: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } },
          h('span', { style: { color: C.dim, fontSize: 11 } }, '敌车数量'),
          [1, 2, 3, 4, 5, 6].map(function (k) {
            return h('button', {
              key: 'foe' + k,
              onClick: function () { setFoeCount(k); reload(level, hp, k); },
              style: tabBtn(foeCount === k),
            }, String(k));
          })),
        h('div', { style: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } },
          h('span', { style: { color: C.dim, fontSize: 11 } }, '地图大小'),
          [13, 15, 19, 23].map(function (n) {
            return h('button', {
              key: 'sz' + n,
              onClick: function () { setSize(n); reload(level, hp, foeCount, n); },
              style: tabBtn(size === n),
            }, n + '×' + n);
          })),
        h('div', {
          style: {
            display: 'grid', gridTemplateColumns: 'repeat(' + TK_W + ', ' + cell + 'px)',
            gap: 2, background: C.panel, padding: 4, borderRadius: 6, userSelect: 'none',
          },
        }, cells),
        h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
          h('button', { onClick: function () { move('up'); }, style: btn() }, '↑'),
          h('button', { onClick: function () { move('left'); }, style: btn() }, '←'),
          h('button', { onClick: function () { move('down'); }, style: btn() }, '↓'),
          h('button', { onClick: function () { move('right'); }, style: btn() }, '→'),
          h('button', { onClick: fire, style: btn({ borderColor: C.accent, color: C.accent }) }, '开火')),
        h('div', { style: { color: C.dim, fontSize: 11 } },
          '移动：方向键 或 W A S D。开火：J / K / L，或空格。也可以点下面的按钮。子弹撞墙反弹两次就散，一炮毙命，清光敌方算赢。'));
    }

    // ═══════════ 面板 ═══════════
    // ═══════════ 围棋 ═══════════
    const GO_N = 19;
    const GO_P = GO_N * GO_N;
    const goBlank = function () { return new Array(GO_P).fill(0); };
    function goNbrs(i) {
      const x = i % GO_N, y = Math.floor(i / GO_N), out = [];
      if (x > 0) out.push(i - 1);
      if (x < GO_N - 1) out.push(i + 1);
      if (y > 0) out.push(i - GO_N);
      if (y < GO_N - 1) out.push(i + GO_N);
      return out;
    }
    function goGroup(b, start) {
      const color = b[start], stones = new Set([start]), libs = new Set(), stack = [start];
      while (stack.length) {
        const cur = stack.pop();
        goNbrs(cur).forEach(function (nb) {
          if (b[nb] === 0) libs.add(nb);
          else if (b[nb] === color && !stones.has(nb)) { stones.add(nb); stack.push(nb); }
        });
      }
      return { stones: stones, libs: libs };
    }
    function goPlay(b, i, color) {
      if (b[i] !== 0) return null;
      const nb = b.slice(); nb[i] = color;
      const foe = 3 - color;
      let captured = 0;
      goNbrs(i).forEach(function (j) {
        if (nb[j] === foe) {
          const g = goGroup(nb, j);
          if (g.libs.size === 0) g.stones.forEach(function (s) { nb[s] = 0; captured++; });
        }
      });
      if (captured === 0 && goGroup(nb, i).libs.size === 0) return null;
      return { board: nb, captured: captured };
    }
    function goSame(a, b) {
      for (let i = 0; i < GO_P; i++) if (a[i] !== b[i]) return false;
      return true;
    }
    function goScore(b) {
      let black = 0, white = 0;
      const seen = new Array(GO_P).fill(false);
      for (let i = 0; i < GO_P; i++) {
        if (b[i] === 1) black++;
        else if (b[i] === 2) white++;
        else if (!seen[i]) {
          const area = [], stack = [i], border = new Set();
          seen[i] = true;
          while (stack.length) {
            const cur = stack.pop(); area.push(cur);
            goNbrs(cur).forEach(function (j) {
              if (b[j] === 0 && !seen[j]) { seen[j] = true; stack.push(j); }
              else if (b[j] !== 0) border.add(b[j]);
            });
          }
          if (border.size === 1) { if (border.has(1)) black += area.length; else white += area.length; }
        }
      }
      return { black: black, white: white };
    }
    function goAi(b, color, easy) {
      const empty = b.every(function (v) { return v === 0; });
      const cand = [];
      for (let i = 0; i < GO_P; i++) {
        if (b[i] !== 0) continue;
        if (empty || goNbrs(i).some(function (j) { return b[j] !== 0; })) cand.push(i);
      }
      if (!cand.length) return null;
      let best = null, bs = -1e9;
      cand.forEach(function (i) {
        const r = goPlay(b, i, color);
        if (!r) return;
        let v = r.captured * 12;
        goNbrs(i).forEach(function (j) { if (b[j] === color) v += 0.6; });
        // 预判：我这一手之后，对手最好的一手能吃我多少子，先扣掉
        let opp = 0;
        for (let k = 0; k < cand.length; k++) {
          const j = cand[k];
          if (r.board[j] !== 0) continue;
          const rr = goPlay(r.board, j, 3 - color);
          if (rr && rr.captured > opp) opp = rr.captured;
        }
        v -= opp * 9;
        if (easy) v += Math.random() * 6;
        if (v > bs) { bs = v; best = i; }
      });
      return best;
    }

    function GoGame(props) {
      const cell = Math.max(13, Math.min(30, Math.floor(500 / GO_N)));
      const st = React.useState(goBlank());
      const board = st[0], setBoard = st[1];
      const turnState = React.useState(1);
      const turn = turnState[0], setTurn = turnState[1];
      const myState = React.useState(1);
      const myColor = myState[0], setMyColor = myState[1];
      const aiColor = 3 - myColor;
      const overState = React.useState('');
      const over = overState[0], setOver = overState[1];
      const lastState = React.useState(-1);
      const last = lastState[0], setLast = lastState[1];
      const capState = React.useState([0, 0]);
      const caps = capState[0], setCaps = capState[1];
      const prevState = React.useState(null);
      const prevBoard = prevState[0], setPrevBoard = prevState[1];
      const passState = React.useState(0);
      const passes = passState[0], setPasses = passState[1];
      const lvState = React.useState('normal');
      const level = lvState[0], setLevel = lvState[1];

      const reset = function () {
        setBoard(goBlank()); setTurn(1); setOver(''); setLast(-1);
        setCaps([0, 0]); setPrevBoard(null); setPasses(0);
      };

      const applyMove = function (i, color) {
        const r = goPlay(board, i, color);
        if (!r) return false;
        if (prevBoard && goSame(r.board, prevBoard)) return false;
        setPrevBoard(board);
        setBoard(r.board);
        setLast(i);
        setPasses(0);
        if (r.captured) {
          setCaps(function (c) {
            const out = c.slice(); out[color - 1] += r.captured; return out;
          });
        }
        setTurn(3 - color);
        return true;
      };

      const click = function (i) {
        if (over || turn !== myColor) return;
        applyMove(i, myColor);
      };

      React.useEffect(function () {
        if (over || turn !== aiColor) return;
        let cancelled = false;
        const t = window.setTimeout(function () {
          const finish = function (mv) {
            if (cancelled) return;
            if (mv === null) { setPasses(function (p) { return p + 1; }); setTurn(myColor); return; }
            if (!applyMove(mv, aiColor)) {
              const alt = goAi(board, aiColor, true);
              if (alt !== null) applyMove(alt, aiColor);
              else { setTurn(myColor); }
            }
          };
          if (level !== 'deepseek') { finish(goAi(board, aiColor, level === 'easy')); return; }
          fetch('/game-corner/api/move', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ game: 'go', board: board, size: GO_N }),
          }).then(function (r) { return r.json(); }).then(function (res) {
            if (!res || !res.ok) throw new Error('没拿到');
            finish(res.y * GO_N + res.x);
          }).catch(function () { finish(goAi(board, aiColor, false)); });
        }, 280);
        return function () { cancelled = true; window.clearTimeout(t); };
      }, [board, turn, over, aiColor, level]);

      const pass = function () {
        if (over) return;
        const np = passes + 1;
        setPasses(np);
        setTurn(3 - turn);
        if (np >= 2) {
          const s = goScore(board);
          setOver('数子：黑 ' + s.black + ' ｜ 白 ' + s.white + (s.black > s.white ? '，黑胜' : s.white > s.black ? '，白胜' : '，和棋'));
        }
      };

      const cells = [];
      for (let i = 0; i < board.length; i++) {
        const v = board[i];
        cells.push(h('button', {
          key: i,
          onClick: function () { click(i); },
          style: {
            width: cell, height: cell, padding: 0, border: 'none', borderRadius: 0,
            background: '#c8a97a', cursor: 'pointer', position: 'relative',
            boxShadow: 'inset 0 0 0 1px rgba(60,45,25,.45)',
          },
        }, v === 0 ? null : h('span', {
          style: {
            position: 'absolute', left: '50%', top: '50%',
            width: Math.round(cell * 0.76), height: Math.round(cell * 0.76),
            marginLeft: -Math.round(cell * 0.38), marginTop: -Math.round(cell * 0.38),
            borderRadius: '50%',
            background: v === 1 ? '#12161d' : '#f2f6fb',
            boxShadow: v === 1 ? 'inset 0 -1px 2px rgba(255,255,255,.25)' : 'inset 0 -1px 2px rgba(0,0,0,.35)',
            outline: i === last ? '2px solid ' + C.accent : 'none',
          },
        })));
      }

      const status = over || (turn === aiColor ? '电脑在想…' : ('该你下（' + (myColor === 1 ? '黑' : '白') + '）'));
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
          h('span', { style: { color: C.ink, fontSize: 13, fontWeight: 600 } }, status),
          h('span', { style: { color: C.dim, fontSize: 11 } }, '提子 黑 ' + caps[0] + ' ／ 白 ' + caps[1]),
          h('span', { style: { flex: 1 } }),
          h('button', { onClick: reset, style: btn() }, '重开'),
          h('button', { onClick: pass, style: btn() }, '停一手'),
          h('button', {
            onClick: function () {
              const s = goScore(board);
              setOver('数子：黑 ' + s.black + ' ｜ 白 ' + s.white + (s.black > s.white ? '，黑胜' : s.white > s.black ? '，白胜' : '，和棋'));
            }, style: btn(),
          }, '数子')),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
          h('span', { style: { color: C.dim, fontSize: 11 } }, '先后手'),
          h('button', {
            onClick: function () { setMyColor(myColor === 1 ? 2 : 1); reset(); },
            style: tabBtn(myColor === 2),
          }, myColor === 1 ? '先手·执黑' : '后手·执白'),
          h('span', { style: { color: C.dim, fontSize: 11 } }, '难度'),
          [['easy', '简单'], ['normal', '普通'], ['deepseek', 'deepseek 模型']].map(function (it) {
            return h('button', {
              key: it[0],
              onClick: function () { setLevel(it[0]); reset(); },
              style: tabBtn(level === it[0]),
            }, it[1]);
          })),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(' + GO_N + ', ' + cell + 'px)', width: 'max-content', userSelect: 'none' } }, cells),
        h('div', { style: { color: C.dim, fontSize: 11 } },
          GO_N + '路。无气的对方子被提；自己下完无气不许下；同一局面重现不许下（简单劫）。两次停一手自动数子。'));
    }

    const GAMES = [
      { id: 'gomoku', label: '五子棋' },
      { id: '2048', label: '2048' },
      { id: 'mines', label: '扫雷' },
      { id: 'tank', label: '坦克' },
      { id: 'xiangqi', label: '象棋' },
      { id: 'chess', label: '国象' },
      { id: 'go', label: '围棋' },
      { id: 'formula', label: '公式本' },
    ];

    function Games(props) {
      const tabState = React.useState('gomoku');
      const tab = tabState[0];
      const setTab = tabState[1];
      const cell = props.compact ? 18 : 24;
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
        h('div', { style: { display: 'flex', gap: 6 } },
          GAMES.map(function (g) {
            return h('button', {
              key: g.id,
              onClick: function () { setTab(g.id); },
              style: tabBtn(tab === g.id),
            }, g.label);
          })),
        tab === 'gomoku' ? h(Gomoku, { cell: cell }) : null,
        tab === '2048' ? h(Game2048, null) : null,
        tab === 'mines' ? h(Minesweeper, null) : null,
        tab === 'tank' ? h(TankGame, { cell: cell }) : null,
        tab === 'xiangqi' ? h(XqGame, { cell: cell }) : null,
        tab === 'chess' ? h(ChGame, { cell: cell }) : null,
        tab === 'go' ? h(GoGame, { cell: cell }) : null,
        tab === 'formula' ? h(FormulaBook, null) : null);
    }

    // ═══════════ 栏目里的一格 ═══════════
    function TabView() {
      const ref = React.useRef(null);
      React.useEffect(function () {
        const el = ref.current;
        if (!el) return;
        // 棋盘上的滚动/拖动一律吃掉：不再带着对话一起滚，也不触发页面拖动。
        const eat = function (e) { e.preventDefault(); e.stopPropagation(); };
        const stop = function (e) { e.stopPropagation(); };
        el.addEventListener('wheel', eat, { passive: false });
        el.addEventListener('touchmove', eat, { passive: false });
        el.addEventListener('pointerdown', stop);
        el.addEventListener('pointermove', stop);
        return function () {
          el.removeEventListener('wheel', eat);
          el.removeEventListener('touchmove', eat);
          el.removeEventListener('pointerdown', stop);
          el.removeEventListener('pointermove', stop);
        };
      }, []);
      const overlayOpen = useOverlayOpen();
      return h('div', {
        ref: ref,
        style: {
          padding: '18px 22px', maxWidth: 620,
          touchAction: 'none', overscrollBehavior: 'contain', userSelect: 'none',
        },
      },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } },
          h('span', { style: { color: C.dim, fontSize: 12 } }, '小游戏'),
          h('span', { style: { flex: 1 } }),
          h('button', {
            onClick: function () { overlayStore.set(!overlayStore.get()); },
            style: btn(),
          }, overlayOpen ? '收浮窗' : '开浮窗')),
        h(Games, { compact: false }),
        h('div', { style: { color: C.dim, fontSize: 12, lineHeight: 1.7, marginTop: 10 } },
          '等任务的时候用。三款都在这里，浮窗里也有同样一套。'));
    }

    // 栏目里那格与浮窗共用的开关：只在这里存一份，两边订阅
    const overlayStore = (function () {
      let open = true;
      const subs = new Set();
      return {
        get: function () { return open; },
        set: function (v) { open = v; subs.forEach(function (f) { f(v); }); },
        sub: function (f) { subs.add(f); return function () { subs.delete(f); }; },
      };
    })();
    function useOverlayOpen() {
      const st = React.useState(overlayStore.get());
      React.useEffect(function () { return overlayStore.sub(st[1]); }, []);
      return st[0];
    }

    // ═══════════ 浮窗 ═══════════
    const POS_KEY = 'dsh-game-corner:pos';
    function readPos() {
      try {
        const raw = window.localStorage.getItem(POS_KEY);
        if (!raw) return null;
        const v = JSON.parse(raw);
        if (typeof v.x !== 'number' || typeof v.y !== 'number') return null;
        // 旧位置如果压在右下角（发送键那一带），就当没存过，回到默认的左侧。
        const w = window.innerWidth || 1200;
        const h = window.innerHeight || 800;
        const nearRight = v.x + 220 > w && v.x < w;
        const nearBottom = v.y + 240 > h && v.y < h;
        if (nearRight && nearBottom) return null;
        return v;
      } catch (e) { /* 存不了就算了 */ }
      return null;
    }

    function Overlay() {
      const posState = React.useState(function () { return readPos() || { x: -1, y: -1 }; });
      const pos = posState[0];
      const setPos = posState[1];
      const collapsedState = React.useState(false);
      const collapsed = collapsedState[0];
      const setCollapsed = collapsedState[1];
      const overlayOpen = useOverlayOpen();
      const dragRef = React.useRef(null);
      const boxRef = React.useRef(null);

      const onPointerDown = function (event) {
        if (event.button !== 0) return;
        // 按在按钮上不开始拖：否则 pointer capture 会吃掉 click，「收起」就像没反应。
        if (event.target && event.target.closest && event.target.closest('button')) return;
        // 别让事件冒到宿主窗口的拖动区去，否则拖这个浮窗会变成拖整个应用窗口。
        event.stopPropagation();
        event.preventDefault();
        // 默认位是用 left/bottom 摆的，这时 pos 还是 (-1,-1)；
        // 开始拖之前先量真实位置，否则第一下会跳到左上角（上一版就坏在这儿）。
        let base = pos;
        if (pos.x < 0 && boxRef.current) {
          const rect = boxRef.current.getBoundingClientRect();
          base = { x: rect.left, y: rect.top };
          setPos(base);
        }
        dragRef.current = { px: event.clientX, py: event.clientY, x: base.x, y: base.y };
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch (e) {}
      };
      const onPointerMove = function (event) {
        const start = dragRef.current;
        if (!start) return;
        const w = window.innerWidth || 1200;
        const h = window.innerHeight || 800;
        const box = boxRef.current ? boxRef.current.getBoundingClientRect() : { width: 260, height: 320 };
        const nx = Math.min(Math.max(start.x + (event.clientX - start.px), 4), Math.max(4, w - box.width - 4));
        const ny = Math.min(Math.max(start.y + (event.clientY - start.py), 4), Math.max(4, h - box.height - 4));
        setPos({ x: nx, y: ny });
      };
      const onPointerUp = function (event) {
        if (!dragRef.current) return;
        dragRef.current = null;
        try { event.currentTarget.releasePointerCapture(event.pointerId); } catch (e) {}
        setPos(function (cur) {
          try { window.localStorage.setItem(POS_KEY, JSON.stringify(cur)); } catch (e) { /* 忽略 */ }
          return cur;
        });
      };

      const style = {
        position: 'fixed', pointerEvents: 'auto',
        background: 'rgba(21,27,36,0.95)', border: '1px solid ' + C.line,
        borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        padding: 10, zIndex: 40, userSelect: 'none',
        // 关键：告诉宿主「这一块不是窗口拖动区」，否则拖它会带着整个 DSH 窗口一起动。
        WebkitAppRegion: 'no-drag',
        appRegion: 'no-drag',
      };
      if (pos.x < 0) Object.assign(style, { left: 18, bottom: 18 });
      else Object.assign(style, { left: pos.x, top: pos.y });

      return h('div', {
        ref: boxRef,
        style: style,
        // 整个浮窗都别把指针事件冒给宿主（它的标题栏拖动可能是 document 级监听）。
        onPointerDown: function (event) { event.stopPropagation(); },
        onMouseDown: function (event) { event.stopPropagation(); },
      },
        h('div', {
          onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp,
          style: {
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'grab',
            paddingBottom: collapsed ? 0 : 8,
            display: overlayOpen ? 'flex' : 'none',
          },
        },
          h('span', { style: { color: C.ink, fontSize: 13, fontWeight: 600 } }, '小游戏'),
          h('span', { style: { color: C.dim, fontSize: 11 } }, '抓标题拖'),
          h('span', { style: { flex: 1 } }),
          h('button', {
            onClick: function () {
              setPos({ x: -1, y: -1 });
              try { window.localStorage.removeItem(POS_KEY); } catch (e) { /* 忽略 */ }
            },
            style: btn({ padding: '1px 7px' }),
            title: '回到左下角默认位置',
          }, '归位'),
          h('button', {
            onClick: function () { setCollapsed(!collapsed); },
            style: btn({ padding: '1px 7px' }),
          }, collapsed ? '展开' : '收起')),
        collapsed ? null : h(Games, { compact: true }));
    }

    function apply(ctx) {
      ctx.slots.inject('conversation.view', function () {
        ctx.slots.register(
          { name: 'conversation.view', id: 'game-corner', order: 8, label: '小游戏' },
          TabView);
      });
      ctx.slots.inject('shell.overlay', function () {
        ctx.slots.register(
          { name: 'shell.overlay', id: 'dsh-game-corner', order: 70, label: '小游戏' },
          Overlay);
      });
    }

    return { inject: ['slots'], apply: apply };
  },
});
