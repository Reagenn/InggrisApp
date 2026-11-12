# Oxford 3000 — Belajar Bahasa Inggris

Aplikasi belajar Bahasa Inggris mandiri untuk Rainy: 3000 kata terpenting (Oxford 3000, level A1–B2)
dengan arti Bahasa Indonesia, grammar lengkap dengan kuis per topik, kuis kosakata, latihan speaking,
dan cerita pendek. Progress hafalan tersimpan di komputer sendiri.

## Jujur dulu

- **Ini rekreasi setia, bukan salinan byte-for-byte** dari aplikasi hosted
  “Oxford 3000 - Belajar Bahasa Inggris” (aplikasi fullstack Muse, privat).
  Aplikasi hosted itu tidak bisa diunduh source-nya, jadi versi lokal ini ditulis ulang
  dari spesifikasi fitur yang sama. Fitur dan alurnya dibuat sama, kodenya baru.
- **Daftar kata** berasal dari PDF *The Oxford 3000 (American English)* yang diunggah Rainy.
  **Arti Bahasa Indonesia dan contoh kalimatnya disiapkan untuk aplikasi ini — bukan arti
  resmi dari Oxford.**
- Contoh kalimat dibuat dari template per jenis kata (bukan contoh Oxford).

## Cara menjalankan

Butuh Node.js 18+ (tanpa npm dependencies, jadi tidak perlu `npm install`).

```bash
node --version   # harus v18 atau lebih baru
npm start
```

Lalu buka **http://localhost:3000** di browser.

Port bisa diubah lewat environment: `PORT=4000 npm start` → http://localhost:4000

> ⚠️ Jangan buka `index.html` langsung dengan klik ganda (file://) — progress tidak akan
> tersimpan dan data tidak dimuat. Aplikasi menampilkan peringatan kuning bila dibuka
> dengan cara itu. Selalu lewat `npm start`.

## Fitur

- **Beranda / Progress** — total kata hapal X/3000 + persen (1 desimal), per level
  A1 (900), A2 (800), B1 (700), B2 (600) beserta sisa kata. Semua angka dihitung dari
  data yang tersimpan, bukan angka tetap. Mulai dari 0.
- **Kosakata** — 3000 kata, cari (Inggris/Indonesia), filter level + status
  (sudah/belum hapal), urut A–Z atau per level, “Muat lebih banyak” (50 kata sekali).
  Tiap kartu: kata, jenis kata, badge level, arti Indonesia, label “arti 1/2” untuk
  kata bersense ganda, contoh kalimat sehari-hari (Inggris + Indonesia), tombol Dengar,
  dan tombol Tandai/Batalkan Hapal.
- **Kuis Kosakata** — pilihan ganda (Inggris → Indonesia dan sebaliknya, 4 opsi,
  pengecoh dari level yang sama) dan ketik arti (toleransi huruf besar/kecil dan spasi).
  Pilih level dan jumlah soal (10/20). Skor + riwayat tersimpan.
- **Grammar** — 40 topik (10 per level A1–B2), masing-masing dengan penjelasan Bahasa
  Indonesia, pola/rumus, dan contoh. Setiap topik punya kuis sendiri yang terpisah:
  8 soal pilihan ganda + 6 soal ketik. Skor terakhir per topik tampil di daftar topik.
- **Speaking** — dengar kalimat (speechSynthesis), latihan ucap dengan pengenalan suara
  (Web Speech API, bila browser mendukung — Chrome di desktop/Android) beserta persen
  kata yang cocok dan kata yang terlewat; bila tidak didukung, tampil penjelasan dan
  mode tirukan mandiri (“Saya sudah mengucapkan”, tersimpan, bukan skor pengenalan suara).
- **Cerita** — 8 cerita pendek (2 per level, 150–250 kata), masing-masing dengan tombol
  dengar, ringkasan Bahasa Indonesia, daftar kata Oxford 3000 yang muncul di cerita
  (dengan artinya), 3 soal pemahaman, dan tanda sudah dibaca yang tersimpan.

## Struktur proyek

```text
oxford-3000-local-v1/
├── package.json                 # "start": node backend/src/server.js
├── README.md
├── LICENSE                      # MIT
├── .gitignore                   # node_modules/ dan backend/data/data.json
├── backend/
│   ├── src/server.js            # server HTTP Node murni, tanpa dependensi
│   └── data/
│       ├── vocab.json           # 3000 entri kosakata (data statis, jangan diedit)
│       └── data.json            # progress pengguna (dibuat otomatis saat start)
└── frontend/
    ├── index.html
    ├── app.js
    ├── style.css
    └── data/
        ├── grammar.json         # 40 topik grammar + 560 soal
        ├── stories.json         # 8 cerita + soal pemahaman
        └── speaking.json        # kalimat latihan speaking per level
```

## Reset progress

Hapus file `backend/data/data.json` (lalu restart server bila sedang jalan).
Server membuat file kosong yang baru secara otomatis. File ini sengaja masuk
`.gitignore` supaya progress pribadi tidak ikut ke-commit ke GitHub.

## Push ke GitHub

```bash
git init
git add .
git commit -m "Initial commit"
```

Lalu buat repo kosong di GitHub (tanpa README/.gitignore/LICENSE, karena sudah ada
di sini), kemudian:

```bash
git remote add origin <url-repo>
git push -u origin main
```

**Deskripsi repo (untuk kolom About di GitHub):**

> Oxford 3000 — Belajar Bahasa Inggris: aplikasi belajar mandiri dengan 3000 kata Oxford (A1–B2) beserta arti Bahasa Indonesia, 40 topik grammar dengan kuis per topik, kuis kosakata, latihan speaking, dan cerita pendek. Dibangun dengan Node.js tanpa dependensi; progress tersimpan lokal.

## Hal yang belum dites di browser asli

- Tombol **Dengar** (speechSynthesis) dan pengenalan suara speaking di browser Rainy
  (diuji hanya lewat logika/API di lingkungan build, bukan lewat klik di browser asli).
- Tampilan di layar HP kecil — layout dibuat mobile-friendly, tetapi belum dicek visual
  di perangkat sungguhan.

Kalau ada yang tidak jalan, laporkan pesan error persisnya.
