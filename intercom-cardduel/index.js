#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              INTERCOM-CARDDUEL  v1.0.0                      ║
 * ║         1v1 Turn-Based P2P Card Duel Game                   ║
 * ║         Built for the Intercom Vibe Competition             ║
 * ║         Trac Network | Hyperswarm | Termux-Ready            ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * GAME RULES:
 *   · Each player starts with 30 HP and a hand of 5 cards
 *   · Players alternate turns (30-second timer each)
 *   · On your turn: play one card from your hand, then draw one
 *   · Card types:
 *       ATTACK  — deal damage to opponent (5–12 dmg)
 *       DEFEND  — shield yourself next turn (absorbs next attack)
 *       HEAL    — restore your own HP (4–8 HP)
 *       COMBO   — double effect if last card played was same type
 *   · First player to reach 0 HP loses
 *   · Timeout (30s) = auto-skip turn, opponent gets a free turn
 *
 * Author : [INSERT_YOUR_TRAC_ADDRESS_HERE]
 * License: MIT
 */

import Hyperswarm from 'hyperswarm'
import b4a        from 'b4a'
import crypto     from 'crypto'
import readline   from 'readline'

// ─── Constants ──────────────────────────────────────────────────────────────

const APP_VERSION    = '1.0.0'
const DEFAULT_CHANNEL = 'intercom-cardduel-v1'
const HAND_SIZE      = 5
const MAX_HP         = 30
const TURN_TIMEOUT   = 30_000   // 30 seconds

// ─── Card definitions ────────────────────────────────────────────────────────

const CARD_POOL = [
  // ATTACK cards
  { id: 'A1', type: 'ATTACK', name: 'Slash',       value: 6,  desc: 'Deal 6 damage'         },
  { id: 'A2', type: 'ATTACK', name: 'Heavy Blow',  value: 9,  desc: 'Deal 9 damage'         },
  { id: 'A3', type: 'ATTACK', name: 'Fireball',    value: 12, desc: 'Deal 12 damage'        },
  { id: 'A4', type: 'ATTACK', name: 'Quick Jab',   value: 5,  desc: 'Deal 5 damage'         },
  { id: 'A5', type: 'ATTACK', name: 'Power Strike', value: 10, desc: 'Deal 10 damage'       },
  // DEFEND cards
  { id: 'D1', type: 'DEFEND', name: 'Iron Wall',   value: 0,  desc: 'Block next attack'     },
  { id: 'D2', type: 'DEFEND', name: 'Shield Up',   value: 0,  desc: 'Block next attack'     },
  { id: 'D3', type: 'DEFEND', name: 'Parry',       value: 0,  desc: 'Block next attack'     },
  // HEAL cards
  { id: 'H1', type: 'HEAL',   name: 'Potion',      value: 6,  desc: 'Restore 6 HP'          },
  { id: 'H2', type: 'HEAL',   name: 'Bandage',     value: 4,  desc: 'Restore 4 HP'          },
  { id: 'H3', type: 'HEAL',   name: 'Elixir',      value: 8,  desc: 'Restore 8 HP'          },
  // COMBO cards
  { id: 'C1', type: 'COMBO',  name: 'Echo Strike', value: 7,  desc: 'ATK 7; x2 if after ATTACK' },
  { id: 'C2', type: 'COMBO',  name: 'Mend Surge',  value: 5,  desc: 'HEAL 5; x2 if after HEAL'  },
  { id: 'C3', type: 'COMBO',  name: 'Reflect',     value: 0,  desc: 'DEFEND; x2 next ATK if after DEFEND' },
]

function drawCard () {
  const pool = [...CARD_POOL]
  return pool[Math.floor(Math.random() * pool.length)]
}

function dealHand () {
  const hand = []
  for (let i = 0; i < HAND_SIZE; i++) hand.push(drawCard())
  return hand
}

// ─── ANSI colours ───────────────────────────────────────────────────────────

const C = {
  reset  : '\x1b[0m',  bold   : '\x1b[1m',  dim    : '\x1b[2m',
  cyan   : '\x1b[36m', green  : '\x1b[32m', yellow : '\x1b[33m',
  red    : '\x1b[31m', magenta: '\x1b[35m', blue   : '\x1b[34m',
  white  : '\x1b[97m', bgRed  : '\x1b[41m', bgGreen: '\x1b[42m',
  bgBlue : '\x1b[44m', bgMag  : '\x1b[45m',
}

const TYPE_COLOR = {
  ATTACK: C.red,  DEFEND: C.blue,
  HEAL  : C.green, COMBO : C.magenta,
}
const TYPE_ICON = { ATTACK: '⚔️ ', DEFEND: '🛡️ ', HEAL: '💚 ', COMBO: '✨ ' }

function ts () { return new Date().toLocaleTimeString() }
function log (icon, col, msg) {
  process.stdout.write(`\r${C[col]??''}[${ts()}] ${icon}${C.reset} ${msg}\n`)
  rl && rl.prompt(true)
}

function encode (o) { return Buffer.from(JSON.stringify(o) + '\n') }
function decode (s) { try { return JSON.parse(s.trim()) } catch { return null } }

function topicFromString (s) {
  return crypto.createHash('sha256').update(s).digest()
}
function shortId (hex) { return hex.slice(0,8)+'…'+hex.slice(-4) }

// ─── HP bar renderer ─────────────────────────────────────────────────────────

function hpBar (hp, max = MAX_HP) {
  const pct   = Math.max(0, hp) / max
  const bars  = Math.round(pct * 20)
  const color = pct > 0.5 ? C.green : pct > 0.25 ? C.yellow : C.red
  return color + '█'.repeat(bars) + C.dim + '░'.repeat(20 - bars) + C.reset +
         ` ${C.white}${hp}/${max}${C.reset}`
}

// ─── Card renderer ───────────────────────────────────────────────────────────

function renderCard (card, index, highlight = false) {
  const col  = TYPE_COLOR[card.type] ?? ''
  const icon = TYPE_ICON[card.type] ?? ''
  const hl   = highlight ? C.bold : C.dim
  return (
    `  ${hl}[${index + 1}]${C.reset} ` +
    `${col}${icon}${card.name}${C.reset}` +
    ` ${C.dim}(${card.type} · ${card.desc})${C.reset}`
  )
}

function renderHand (hand) {
  return hand.map((c, i) => renderCard(c, i, true)).join('\n')
}

// ─── Game state ──────────────────────────────────────────────────────────────

let myAlias   = ''
let myPeerId  = ''
let swarm, rl

// Roles: 'host' | 'guest' | null
let myRole    = null

// Full game state (mirrored on both peers)
let game = null
/*
game = {
  phase     : 'waiting'|'playing'|'over',
  myHp      : number,
  oppHp     : number,
  myHand    : Card[],
  shield    : boolean,   // my shield active?
  oppShield : boolean,   // opponent shield active?
  lastMyCard  : string|null,   // type of last card I played
  lastOppCard : string|null,
  myTurn    : boolean,
  turnCount : number,
  log       : string[],
  winner    : string|null,
}
*/

let turnTimer  = null   // NodeJS Timeout
let timerStart = 0

// ─── Peer connection ─────────────────────────────────────────────────────────

const peers = new Map()  // peerId → { conn, alias }

function broadcast (obj) {
  const f = encode(obj)
  for (const [, p] of peers) { try { p.conn.write(f) } catch {} }
}

function handleConnection (conn, info) {
  const pid   = b4a.toString(info.publicKey, 'hex')
  const short = shortId(pid)
  peers.set(pid, { conn, alias: short })
  log('⟳', 'green', `Lawan terhubung: ${C.cyan}${short}${C.reset}`)

  try { conn.write(encode({ type: 'HELLO', alias: myAlias, version: APP_VERSION })) } catch {}

  let buf = ''
  conn.on('data', d => {
    buf += d.toString()
    const lines = buf.split('\n'); buf = lines.pop()
    for (const line of lines) {
      if (!line.trim()) continue
      const msg = decode(line)
      if (msg) handleMessage(pid, msg)
    }
  })
  conn.on('close', () => {
    peers.delete(pid)
    log('✕', 'dim', `${short} terputus`)
    if (game && game.phase === 'playing') {
      log('🏳️', 'yellow', 'Lawan disconnect — kamu menang by forfeit!')
      endGame(myAlias)
    }
  })
  conn.on('error', err => {
    if (err.code !== 'ECONNRESET') log('✕', 'red', err.message)
    peers.delete(pid)
  })

  // If we already have a game running (reconnect scenario), resync
  if (game && game.phase === 'playing') {
    try { conn.write(encode({ type: 'RESYNC', game })) } catch {}
  }
}

// ─── Message router ──────────────────────────────────────────────────────────

function handleMessage (pid, msg) {
  const peer = peers.get(pid)

  switch (msg.type) {

    case 'HELLO':
      if (peer) peer.alias = msg.alias || shortId(pid)
      log('👋', 'blue', `${C.cyan}${msg.alias}${C.reset} siap bertarung! Ketik /duel untuk mulai.`)
      break

    // Host sends DEAL to start the game
    case 'DEAL':
      if (game && game.phase !== 'waiting') break
      receiveGameStart(msg)
      break

    // A played card from the opponent
    case 'PLAY':
      if (!game || game.phase !== 'playing') break
      if (game.myTurn) break  // shouldn't happen but guard it
      receiveOpponentPlay(msg)
      break

    // Opponent skipped (timeout)
    case 'SKIP':
      if (!game || game.phase !== 'playing') break
      if (game.myTurn) break
      log('⏱', 'yellow', `Lawan timeout — giliranmu!`)
      game.lastOppCard = null
      startMyTurn()
      break

    // Game over broadcast
    case 'GAMEOVER':
      endGame(msg.winner)
      break

    case 'RESYNC':
      // Passive resync if we somehow desynced
      break

    case 'REMATCH':
      log('🔄', 'cyan', `${(peer && peer.alias) || 'Lawan'} ingin rematch! Ketik /duel untuk setuju.`)
      break
  }
}

// ─── Game flow ───────────────────────────────────────────────────────────────

function startDuel () {
  if (peers.size === 0) { log('✕', 'red', 'Belum ada lawan! Tunggu lawan terhubung dulu.'); return }
  if (game && game.phase === 'playing') { log('✕', 'yellow', 'Duel sedang berlangsung!'); return }

  myRole = 'host'

  // Determine who goes first: host always goes first in round 1
  const myHand  = dealHand()
  const oppHand = dealHand()

  game = {
    phase      : 'playing',
    myHp       : MAX_HP,
    oppHp      : MAX_HP,
    myHand,
    shield     : false,
    oppShield  : false,
    lastMyCard : null,
    lastOppCard: null,
    myTurn     : true,
    turnCount  : 1,
    log        : [],
    winner     : null,
  }

  // Send DEAL to guest with their hand + game seed
  broadcast({
    type   : 'DEAL',
    oppHand: myHand,    // guest sees host's hand as "opp"
    myHand : oppHand,
    hostAlias: myAlias,
  })

  printBattlefield()
  log('⚔️', 'cyan', `Duel dimulai! Giliranmu pertama. Pilih kartu (1-${HAND_SIZE}) atau /skip`)
  startTurnTimer()
}

function receiveGameStart (msg) {
  myRole = 'guest'
  game = {
    phase      : 'playing',
    myHp       : MAX_HP,
    oppHp      : MAX_HP,
    myHand     : msg.myHand,
    shield     : false,
    oppShield  : false,
    lastMyCard : null,
    lastOppCard: null,
    myTurn     : false,   // host goes first
    turnCount  : 1,
    log        : [],
    winner     : null,
  }
  printBattlefield()
  log('⚔️', 'cyan', `Duel dimulai! ${C.yellow}${msg.hostAlias}${C.reset} jalan duluan — tunggu giliranmu…`)
}

// ─── Playing a card ──────────────────────────────────────────────────────────

function playCard (indexInput) {
  if (!game || game.phase !== 'playing') { log('✕', 'red', 'Tidak ada duel aktif.'); return }
  if (!game.myTurn) { log('✕', 'yellow', 'Bukan giliranmu!'); return }

  const idx = parseInt(indexInput) - 1
  if (isNaN(idx) || idx < 0 || idx >= game.myHand.length) {
    log('✕', 'red', `Pilih kartu 1–${game.myHand.length}`)
    return
  }

  clearTurnTimer()

  const card   = game.myHand[idx]
  const result = applyCard(card, 'self')

  // Replace played card with a new draw
  game.myHand[idx] = drawCard()
  game.lastMyCard   = card.type

  const gameEntry = `Giliran ${game.turnCount}: ${myAlias} mainkan ${card.name} → ${result.desc}`
  game.log.push(gameEntry)

  // Broadcast the play
  broadcast({ type: 'PLAY', card, result, turnCount: game.turnCount })

  // Check win
  if (game.oppHp <= 0) {
    broadcast({ type: 'GAMEOVER', winner: myAlias })
    endGame(myAlias)
    return
  }

  printBattlefield()
  log(TYPE_ICON[card.type], 'white',
    `Kamu mainkan ${TYPE_COLOR[card.type]}${card.name}${C.reset} → ${C.white}${result.desc}${C.reset}`)

  game.myTurn = false
  game.turnCount++
  log('⏳', 'dim', 'Menunggu giliran lawan…')
}

function receiveOpponentPlay (msg) {
  clearTurnTimer()

  const { card, result } = msg
  const peer   = [...peers.values()][0]
  const oppName = (peer && peer.alias) || 'Lawan'

  // Apply opponent's card effects to our state (mirrored)
  applyCard(card, 'opp')
  game.lastOppCard = card.type
  game.turnCount   = msg.turnCount + 1

  printBattlefield()
  log(TYPE_ICON[card.type] ?? '🃏', 'yellow',
    `${C.cyan}${oppName}${C.reset} mainkan ${TYPE_COLOR[card.type]}${card.name}${C.reset} → ${C.yellow}${result.desc}${C.reset}`)

  // Check if we're dead
  if (game.myHp <= 0) {
    broadcast({ type: 'GAMEOVER', winner: oppName })
    endGame(oppName)
    return
  }

  startMyTurn()
}

// ─── Card effect engine ──────────────────────────────────────────────────────

function applyCard (card, who) {
  // who = 'self' (I played it) | 'opp' (opponent played it)
  let desc = ''

  if (who === 'self') {
    switch (card.type) {
      case 'ATTACK': {
        let dmg = card.value
        // COMBO check: double if last card was also ATTACK
        if (card.type === 'COMBO') {
          if (game.lastMyCard === 'ATTACK') { dmg *= 2; desc += '✨COMBO x2! ' }
        }
        if (game.oppShield) {
          desc += `Serangan diblok oleh shield lawan!`
          game.oppShield = false
        } else {
          game.oppHp -= dmg
          game.oppHp = Math.max(0, game.oppHp)
          desc += `Lawan -${dmg} HP (sisa: ${game.oppHp})`
        }
        break
      }
      case 'DEFEND':
        game.shield = true
        desc = 'Shield aktif! Serangan berikutnya diblok'
        break
      case 'HEAL': {
        let hp = card.value
        game.myHp = Math.min(MAX_HP, game.myHp + hp)
        desc = `+${hp} HP (total: ${game.myHp})`
        break
      }
      case 'COMBO': {
        // Echo Strike: ATK + double if after ATTACK
        if (card.name === 'Echo Strike') {
          let dmg = card.value
          if (game.lastMyCard === 'ATTACK') { dmg *= 2; desc += '✨COMBO x2! ' }
          if (game.oppShield) { desc += 'Blok!'; game.oppShield = false }
          else { game.oppHp = Math.max(0, game.oppHp - dmg); desc += `Lawan -${dmg} HP (sisa: ${game.oppHp})` }
        }
        // Mend Surge: HEAL + double if after HEAL
        else if (card.name === 'Mend Surge') {
          let hp = card.value
          if (game.lastMyCard === 'HEAL') { hp *= 2; desc += '✨COMBO x2! ' }
          game.myHp = Math.min(MAX_HP, game.myHp + hp)
          desc += `+${hp} HP (total: ${game.myHp})`
        }
        // Reflect: DEFEND + counter boost
        else if (card.name === 'Reflect') {
          game.shield = true
          desc = '✨Shield aktif! Serangan balik x2 jika lawan menyerang'
        }
        break
      }
    }
  } else {
    // Opponent played — mirror effects
    switch (card.type) {
      case 'ATTACK': {
        let dmg = card.value
        if (game.shield) {
          desc = 'Serangan lawan diblok oleh shieldmu!'
          game.shield = false
        } else {
          game.myHp = Math.max(0, game.myHp - dmg)
          desc = `-${dmg} HP untukmu (sisa: ${game.myHp})`
        }
        break
      }
      case 'DEFEND':
        game.oppShield = true
        desc = 'Lawan pasang shield'
        break
      case 'HEAL': {
        game.oppHp = Math.min(MAX_HP, game.oppHp + card.value)
        desc = `Lawan +${card.value} HP (sisa: ${game.oppHp})`
        break
      }
      case 'COMBO': {
        if (card.name === 'Echo Strike') {
          let dmg = card.value
          if (game.lastOppCard === 'ATTACK') dmg *= 2
          if (game.shield) { desc = 'COMBO diblok shieldmu!'; game.shield = false }
          else { game.myHp = Math.max(0, game.myHp - dmg); desc = `-${dmg} HP untukmu (sisa: ${game.myHp})` }
        } else if (card.name === 'Mend Surge') {
          let hp = card.value
          if (game.lastOppCard === 'HEAL') hp *= 2
          game.oppHp = Math.min(MAX_HP, game.oppHp + hp)
          desc = `Lawan +${hp} HP (sisa: ${game.oppHp})`
        } else if (card.name === 'Reflect') {
          game.oppShield = true
          desc = 'Lawan pasang Reflect shield'
        }
        break
      }
    }
  }

  return { desc }
}

// ─── Turn management ─────────────────────────────────────────────────────────

function startMyTurn () {
  game.myTurn = true
  printBattlefield()
  log('🎯', 'green', `Giliranmu! Pilih kartu 1–${game.myHand.length} atau /skip (${TURN_TIMEOUT/1000}s)`)
  startTurnTimer()
}

function startTurnTimer () {
  clearTurnTimer()
  timerStart = Date.now()
  turnTimer  = setTimeout(() => {
    log('⏱', 'red', 'Waktu habis! Giliranmu di-skip.')
    broadcast({ type: 'SKIP' })
    game.myTurn     = false
    game.lastMyCard = null
    game.turnCount++
    log('⏳', 'dim', 'Menunggu giliran lawan…')
  }, TURN_TIMEOUT)
}

function clearTurnTimer () {
  if (turnTimer) { clearTimeout(turnTimer); turnTimer = null }
}

// ─── Battlefield display ─────────────────────────────────────────────────────

function printBattlefield () {
  if (!game) return
  const peer    = [...peers.values()][0]
  const oppName = (peer && peer.alias) || 'Lawan'
  const myShield  = game.shield    ? ` ${C.blue}🛡️ SHIELD${C.reset}` : ''
  const oppShield = game.oppShield ? ` ${C.blue}🛡️ SHIELD${C.reset}` : ''

  process.stdout.write('\r\n')
  process.stdout.write(
    `${C.bold}${C.yellow}╔════════════════════════════════════════════════════╗\n` +
    `║              ⚔️  CARDDUEL BATTLEFIELD  ⚔️             ║\n` +
    `╚════════════════════════════════════════════════════╝${C.reset}\n\n`
  )
  process.stdout.write(`  ${C.cyan}${C.bold}${oppName.padEnd(18)}${C.reset}  HP: ${hpBar(game.oppHp)}${oppShield}\n`)
  process.stdout.write(`  ${C.dim}${'─'.repeat(52)}${C.reset}\n`)
  process.stdout.write(`  ${C.white}${C.bold}${myAlias.padEnd(18)}${C.reset}  HP: ${hpBar(game.myHp)}${myShield}\n\n`)

  process.stdout.write(`  ${C.bold}Tanganmu:${C.reset}\n`)
  process.stdout.write(renderHand(game.myHand) + '\n\n')

  if (game.log.length > 0) {
    const recent = game.log.slice(-3)
    process.stdout.write(`  ${C.dim}Log terbaru:${C.reset}\n`)
    for (const l of recent) process.stdout.write(`  ${C.dim}» ${l}${C.reset}\n`)
    process.stdout.write('\n')
  }
}

// ─── Game over ───────────────────────────────────────────────────────────────

function endGame (winner) {
  clearTurnTimer()
  if (!game || game.phase === 'over') return
  game.phase  = 'over'
  game.winner = winner
  const iWon  = (winner === myAlias)

  process.stdout.write('\n')
  if (iWon) {
    process.stdout.write(
      `${C.bgGreen}${C.bold}                                          \n` +
      `   🏆  KAMU MENANG! Selamat, ${myAlias}!   \n` +
      `                                          ${C.reset}\n\n`
    )
  } else {
    process.stdout.write(
      `${C.bgRed}${C.bold}                                    \n` +
      `   💀  KAMU KALAH! ${winner} menang!   \n` +
      `                                    ${C.reset}\n\n`
    )
  }
  log('🔄', 'dim', 'Ketik /duel untuk rematch, /exit untuk keluar.')
  if (rl) rl.prompt(true)
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function printHelp () {
  process.stdout.write(`
${C.bold}${C.yellow}╔══════════════════════════════════════════════════╗
║         INTERCOM-CARDDUEL  COMMANDS              ║
╚══════════════════════════════════════════════════╝${C.reset}
  ${C.yellow}/duel${C.reset}          Tantang lawan yang terhubung (host memulai)
  ${C.yellow}1–5${C.reset}            Mainkan kartu ke-N dari tanganmu
  ${C.yellow}/skip${C.reset}          Lewati giliran (buang giliran)
  ${C.yellow}/hand${C.reset}          Tampilkan kartu di tanganmu
  ${C.yellow}/status${C.reset}        Tampilkan battlefield saat ini
  ${C.yellow}/alias <nama>${C.reset}  Ganti nama tampilan
  ${C.yellow}/peers${C.reset}         Lihat lawan yang terhubung
  ${C.yellow}/help${C.reset}          Tampilkan menu ini
  ${C.yellow}/exit${C.reset}          Keluar

${C.bold}Tipe kartu:${C.reset}
  ${C.red}⚔️  ATTACK${C.reset}   — serang lawan langsung
  ${C.blue}🛡️  DEFEND${C.reset}   — blok serangan berikutnya
  ${C.green}💚 HEAL${C.reset}     — pulihkan HP
  ${C.magenta}✨ COMBO${C.reset}    — efek ganda jika urutan cocok
\n> `)
}

function handleCommand (line) {
  const raw  = line.trim()
  if (!raw) return

  // Shortcut: bare number = play card
  if (/^[1-5]$/.test(raw)) { playCard(raw); return }

  if (!raw.startsWith('/')) { log('ℹ', 'dim', 'Ketik /help untuk perintah.'); return }

  const parts = raw.slice(1).split(' ')
  const cmd   = parts[0].toLowerCase()
  const rest  = parts.slice(1).join(' ').trim()

  switch (cmd) {
    case 'duel':    startDuel();                            break
    case 'skip':
      if (!game || !game.myTurn) { log('✕','yellow','Bukan giliranmu!'); break }
      clearTurnTimer()
      broadcast({ type: 'SKIP' })
      game.myTurn = false; game.lastMyCard = null; game.turnCount++
      log('⏭', 'dim', 'Giliranmu di-skip. Menunggu lawan…')
      break
    case 'hand':
      if (!game) { log('ℹ','yellow','Belum ada duel aktif.'); break }
      process.stdout.write('\n' + renderHand(game.myHand) + '\n\n> ')
      break
    case 'status':  printBattlefield(); if(rl) rl.prompt(true); break
    case 'alias':
      if (!rest) { log('✕','red','Usage: /alias <nama>'); break }
      myAlias = rest.slice(0,24)
      log('✓','green',`Alias: "${myAlias}"`)
      break
    case 'peers':
      if (peers.size === 0) { log('ℹ','yellow','Belum ada lawan.'); break }
      for (const [pid, p] of peers)
        process.stdout.write(`  ${C.cyan}${shortId(pid)}${C.reset}  alias=${p.alias}\n`)
      if (rl) rl.prompt(true)
      break
    case 'help':    printHelp();                            break
    case 'exit': case 'quit':
      clearTurnTimer()
      log('✓','green','Keluar dari duel…')
      process.exit(0)
      break
    default:
      log('✕','yellow',`Perintah tidak dikenal: /${cmd}`)
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main () {
  const args  = process.argv.slice(2)
  let channel = DEFAULT_CHANNEL
  let alias   = ''

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--channel' && args[i+1]) channel = args[++i]
    if (args[i] === '--alias'   && args[i+1]) alias   = args[++i]
  }

  myAlias = alias || `duelist-${crypto.randomBytes(2).toString('hex')}`

  // Banner
  process.stdout.write(`
${C.bold}${C.yellow}
   ██████╗ █████╗ ██████╗ ██████╗      ██████╗ ██╗   ██╗███████╗██╗
  ██╔════╝██╔══██╗██╔══██╗██╔══██╗     ██╔══██╗██║   ██║██╔════╝██║
  ██║     ███████║██████╔╝██║  ██║     ██║  ██║██║   ██║█████╗  ██║
  ██║     ██╔══██║██╔══██╗██║  ██║     ██║  ██║██║   ██║██╔══╝  ██║
  ╚██████╗██║  ██║██║  ██║██████╔╝     ██████╔╝╚██████╔╝███████╗███████╗
   ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝      ╚═════╝  ╚═════╝ ╚══════╝╚══════╝${C.reset}
${C.dim}  intercom-cardduel v${APP_VERSION} · 1v1 P2P Turn-Based Card Duel · Intercom Vibe Competition${C.reset}

`)

  swarm    = new Hyperswarm()
  myPeerId = b4a.toString(swarm.keyPair.publicKey, 'hex')

  log('⚡','green',`Peer ID  : ${shortId(myPeerId)}`)
  log('⚡','green',`Alias    : ${myAlias}`)
  log('⚡','green',`Channel  : ${channel}`)

  swarm.on('connection', handleConnection)
  await swarm.join(topicFromString(channel), { server:true, client:true }).flushed()
  log('✓','green','Bergabung ke DHT — tunggu lawan, lalu ketik /duel!\n')

  for (const sig of ['SIGINT','SIGTERM']) {
    process.on(sig, async () => {
      clearTurnTimer(); await swarm.destroy(); process.exit(0)
    })
  }

  rl = readline.createInterface({ input:process.stdin, output:process.stdout, prompt:'> ', terminal:true })
  rl.prompt()
  rl.on('line', line => { handleCommand(line); rl.prompt() })
  rl.on('close', async () => { clearTurnTimer(); await swarm.destroy(); process.exit(0) })
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
