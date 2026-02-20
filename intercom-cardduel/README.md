# intercom-cardduel 🃏

> **1v1 Turn-Based P2P Card Duel Game**  
> Submission untuk **Intercom Vibe Competition** — Trac Network / Hyperswarm

[![Node ≥ 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![Pear Runtime](https://img.shields.io/badge/pear-compatible-blue)](https://pears.com)
[![Termux Ready](https://img.shields.io/badge/termux-ready-orange)](https://termux.dev)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

---

## Apa Itu intercom-cardduel?

Game kartu duel 1v1 turn-based yang berjalan murni P2P via Hyperswarm. Tidak ada server, tidak ada backend, tidak ada akun. Dua peer terhubung langsung dan bertarung dengan deck kartu.

```
┌──────────────────┐    DEAL · PLAY · SKIP    ┌──────────────────┐
│  budi (host)     │ ──── Hyperswarm P2P ───── │  siti (guest)    │
│  HP: 30 🟩🟩🟩  │    Noise-encrypted · P2P  │  HP: 30 🟩🟩🟩  │
└──────────────────┘                           └──────────────────┘
```

---

## Aturan Game

- Setiap pemain mulai dengan **30 HP** dan **5 kartu**
- Giliran bergantian dengan **timer 30 detik**
- Setiap giliran: mainkan 1 kartu → tarik 1 kartu baru otomatis
- **Timeout** = giliran auto-skip, lawan mendapat giliran gratis
- HP = 0 → **KALAH**

---

## Tipe Kartu

| Tipe | Icon | Efek | Nilai |
|---|---|---|---|
| ATTACK | ⚔️ | Kurangi HP lawan | 5–12 dmg |
| DEFEND | 🛡️ | Blok serangan berikutnya | - |
| HEAL | 💚 | Pulihkan HP sendiri | 4–8 HP |
| COMBO | ✨ | Efek ganda jika urutan cocok | varies |

### Mekanisme COMBO
Kartu COMBO memberikan efek ganda jika kartu yang dimainkan sebelumnya adalah tipe yang sesuai:
- **Echo Strike** — ATK 7 dmg; jadi 14 dmg jika setelah ATTACK
- **Mend Surge** — HEAL 5 HP; jadi 10 HP jika setelah HEAL  
- **Reflect** — DEFEND aktif; shield ekstra jika setelah DEFEND

---

## Instalasi

```bash
git clone 
cd intercom-cardduel
npm install
node index.js --alias namaKamu
```

### Termux (Android)

```bash
pkg update && pkg upgrade -y
pkg install nodejs git -y
git clone 
cd intercom-cardduel
npm install
node index.js --alias namaKamu
```

---

## Cara Main

### 1. Kedua pemain join channel yang sama

```bash
# Pemain A (host)
node index.js --channel duel-seru --alias budi

# Pemain B (guest) — di device lain
node index.js --channel duel-seru --alias siti
```

### 2. Host mulai duel

```
> /duel
```

### 3. Main giliran bergantian

```
# Lihat tanganmu
> /hand

# Mainkan kartu ke-3
> 3

# Atau lewati giliran
> /skip
```

---

## Perintah Lengkap

| Perintah | Keterangan |
|---|---|
| `/duel` | Mulai duel (host deal kartu) |
| `1`–`5` | Mainkan kartu ke-N |
| `/skip` | Lewati giliran |
| `/hand` | Tampilkan kartu di tangan |
| `/status` | Tampilkan battlefield |
| `/alias <nama>` | Ganti nama |
| `/peers` | Lihat lawan |
| `/help` | Menu lengkap |
| `/exit` | Keluar |

---

## Lisensi

MIT — lihat [LICENSE](LICENSE)

---

## Trac Address

trac1ps3v0xcy4dagk3687vn4gvr400jug6xn5al9xv3lzdq2w8m8mw2setdxd5

---

*Dibangun dengan ♥ untuk Intercom Vibe Competition — Trac Network*
