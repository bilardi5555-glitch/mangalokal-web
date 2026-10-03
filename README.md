# MangaLokal Web v1.0

Versi Web/PWA dari prototipe MangaLokal Translator. Bisa dipakai dari Android, Windows, Linux, macOS, dan perangkat lain yang memiliki browser modern.

## Fitur

- Multi-image import untuk halaman manga/manhwa/manhua.
- OCR Jepang (horizontal/vertikal), Korea, Mandarin sederhana/tradisional, dan Inggris dengan Tesseract.js.
- Terjemahan ke Bahasa Indonesia tanpa API berbayar wajib:
  - Browser Translator API bila browser mendukungnya (on-device setelah model tersedia).
  - MyMemory publik sebagai fallback gratis online.
  - Endpoint LibreTranslate kompatibel yang dapat diatur sendiri.
- Overlay hasil terjemahan pada area OCR.
- Editor teks asli dan terjemahan manual.
- Ekspor halaman aktif menjadi PNG dengan overlay terjemahan.
- Ekspor hasil teks ke TXT.
- PWA: bisa dipasang ke layar utama bila disajikan melalui HTTPS/localhost.
- Service Worker untuk cache shell aplikasi dan resource yang sudah pernah dipakai.

## Cara menjalankan paling cepat

Karena browser memblokir beberapa fitur PWA jika file dibuka langsung memakai `file://`, sajikan folder ini melalui web server.

### GitHub Pages

1. Buat repository GitHub baru.
2. Upload seluruh isi folder ini ke root repository.
3. Buka **Settings → Pages**.
4. Pada **Build and deployment**, pilih **Deploy from a branch**.
5. Pilih branch `main`, folder `/ (root)`, lalu Save.
6. Buka alamat GitHub Pages yang diberikan. Di Chrome Android, gunakan menu **Tambahkan ke layar utama / Instal aplikasi**.

### PC lokal

Jika Python tersedia:

```bash
python -m http.server 8080
```

Buka `http://localhost:8080`.

## Android tanpa Android Studio

Setelah aplikasi ditempatkan di GitHub Pages/hosting HTTPS:

1. Buka alamatnya menggunakan Chrome Android.
2. Tekan tombol **Pasang Aplikasi** jika muncul, atau menu Chrome → **Tambahkan ke layar utama**.
3. MangaLokal akan tampil seperti aplikasi tersendiri.

## Catatan OCR

Tesseract.js dan model OCR bahasa diunduh dari internet pada pemakaian pertama. Service worker mencoba menyimpan resource yang telah dipakai agar pemakaian berikutnya lebih ringan. OCR Jepang vertikal dapat dipilih melalui opsi **Jepang vertikal**.

## Catatan terjemahan

- Mode **Browser** paling privat karena teks dapat diproses melalui model bawaan browser bila Translator API tersedia. Dukungan bergantung versi/perangkat browser.
- Mode **MyMemory** tidak membutuhkan API key, tetapi memakai layanan publik dan memiliki batas penggunaan. Teks OCR dikirim ke layanan tersebut.
- Mode **LibreTranslate** membutuhkan endpoint yang mengizinkan request dari browser (CORS). Beberapa server publik mungkin meminta API key atau membatasi penggunaan.

## Struktur

- `index.html` — antarmuka aplikasi.
- `styles.css` — tampilan responsif.
- `app.js` — OCR, translation, overlay, editor, export.
- `sw.js` — service worker/cache.
- `manifest.webmanifest` — metadata instalasi PWA.
- `icons/` — ikon PWA.

## Batasan v1.0

Deteksi bubble khusus manga dan inpainting latar belum menggunakan model vision khusus. Overlay menggunakan bounding box OCR, sehingga halaman dengan teks dekoratif/vertikal kompleks mungkin perlu koreksi manual.
