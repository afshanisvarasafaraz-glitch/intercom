# SKILL — intercom-cardduel

> Instruksi agent untuk mengoperasikan **intercom-cardduel**.  
> Mengikuti konvensi Intercom SKILL.md dari Trac Systems.

---

## Apa Itu Aplikasi Ini?

**intercom-cardduel** adalah game duel kartu 1v1 berbasis giliran (turn-based) yang berjalan sepenuhnya P2P via Hyperswarm / Trac Network. Tidak ada server, tidak ada backend — dua peer terhubung langsung dan saling bertarung.

---

## Aturan Game

- Setiap pemain mulai dengan **30 HP** dan **5 kartu di tangan**
- Giliran bergantian; setiap giliran ada **timer 30 detik**
- Setiap giliran: mainkan 1 kartu → kartu baru otomatis ditarik
- **Timeout** = giliran di-skip otomatis, lawan mendapat giliran gratis
- Pemain dengan HP 0 duluan = **KALAH**

---

## Tipe Kartu

| Tipe | Icon | Efek |
|---|---|---|
| `ATTACK` | ⚔️ | Kurangi HP lawan langsung |
| `DEFEND` | 🛡️ | Blok serangan berikutnya dari lawan |
| `HEAL` | 💚 | Pulihkan HP sendiri |
| `COMBO` | ✨ | Efek ganda jika kartu sebelumnya sama tipe |

### Kartu COMBO Detail

| Nama | Efek Dasar | Efek COMBO |
|---|---|---|
| Echo Strike | ATK 7 dmg | ×2 jika setelah ATTACK |
| Mend Surge | HEAL 5 HP | ×2 jika setelah HEAL |
| Reflect | DEFEND + shield | Shield aktif; lawan diserang balik |

---

## Referensi CLI

| Perintah | Keterangan |
|---|---|
| `/duel` | Mulai duel dengan lawan yang terhubung (host deal kartu) |
| `1` – `5` | Mainkan kartu ke-N dari tangan (juga tanpa `/`) |
| `/skip` | Lewati giliran secara manual |
| `/hand` | Tampilkan kartu di tanganmu |
| `/status` | Tampilkan battlefield lengkap |
| `/alias <nama>` | Ganti nama tampilan |
| `/peers` | Lihat lawan yang terhubung |
| `/help` | Menu perintah |
| `/exit` | Keluar |

---

## Opsi Launch

```bash
node index.js [--channel <nama>] [--alias <nama>]
```

| Flag | Default | Fungsi |
|---|---|---|
| `--channel` | `intercom-cardduel-v1` | Channel DHT (harus sama di kedua peer) |
| `--alias` | `duelist-<4hex>` | Nama tampilan di game |

### Contoh

```bash
# Game cepat channel default
node index.js --alias budi

# Private match
node index.js --channel budi-vs-siti --alias budi

# Pear runtime
pear run . duel1 --alias budi
```

---

## Alur Permainan

```
Peer A (host)                     Peer B (guest)
     │                                  │
     │── /duel ──────────────────────── │
     │── DEAL (2 hands) ───────────────>│
     │                                  │
     │  [TURN 1 — A jalan]              │
     │  A mainkan kartu "3"             │
     │── PLAY {card, result} ──────────>│
     │                                  │
     │  [TURN 2 — B jalan]              │
     │<─ PLAY {card, result} ───────────│
     │                                  │
     │  ... (bergantian) ...            │
     │                                  │
     │── GAMEOVER {winner: "A"} ───────>│
```

---

## Protokol Wire (NDJSON)

### `HELLO`
```json
{ "type": "HELLO", "alias": "budi", "version": "1.0.0" }
```

### `DEAL` — Host mulai game
```json
{
  "type": "DEAL",
  "myHand": [{ "id": "A1", "type": "ATTACK", "name": "Slash", "value": 6 }],
  "oppHand": [...],
  "hostAlias": "budi"
}
```

### `PLAY` — Mainkan kartu
```json
{
  "type": "PLAY",
  "card": { "id": "A3", "type": "ATTACK", "name": "Fireball", "value": 12 },
  "result": { "desc": "Lawan -12 HP (sisa: 18)" },
  "turnCount": 3
}
```

### `SKIP` — Timeout / lewati giliran
```json
{ "type": "SKIP" }
```

### `GAMEOVER`
```json
{ "type": "GAMEOVER", "winner": "budi" }
```

---

## Troubleshooting

| Gejala | Solusi |
|---|---|
| Tidak ada lawan | Pastikan `--channel` sama di kedua device |
| Giliran tidak berganti | Restart kedua peer dan `/duel` ulang |
| `ERR_MODULE_NOT_FOUND` | Jalankan `npm install` |
| Crash di Termux | `pkg upgrade nodejs` |

---

*intercom-cardduel — Intercom Vibe Competition Submission*  
*Trac Address: [INSERT_YOUR_TRAC_ADDRESS_HERE]*
