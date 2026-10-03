# MangaLokal Web v2.0 — Scroll Translate

PWA penerjemah manga/manhwa/manhua yang dapat bekerja dari **gambar lokal** atau dari **URL chapter**. Mode website membuat reader vertikal sendiri, lalu OCR + terjemahan dijalankan bertahap ketika gambar mendekati layar saat pengguna scrolling.

## Yang baru dari v1

- Tab **Website / Scroll**.
- Masukkan URL chapter dan impor gambar dari halaman tersebut ke reader vertikal.
- `IntersectionObserver` untuk menerjemahkan halaman ketika mendekati viewport.
- Queue satu-per-satu agar OCR tidak memenuhi RAM HP.
- Worker OCR dipakai ulang untuk mempercepat halaman berikutnya.
- Tombol **Terjemahkan area layar** jika auto-scroll dimatikan.
- Opsi menutup teks asli / hanya menaruh overlay gelap.
- Opsi proxy untuk situs yang memblokir CORS.
- Template Cloudflare Worker gratis di `tools/cloudflare-worker.js`.

## Cara menggunakan mode Website / Scroll

1. Jalankan aplikasi dari GitHub Pages/hosting HTTPS.
2. Buka tab **Website / Scroll**.
3. Tempel URL halaman chapter.
4. Tekan **Buka di Reader**.
5. Jika gambar berhasil ditemukan, scroll seperti membaca webtoon.
6. Saat gambar mendekati layar, status pada gambar berubah dari `menunggu` → `OCR` → `menerjemahkan` → `selesai`.
7. Hasil Indonesia ditaruh sebagai overlay di area teks.

## Kenapa URL tertentu gagal?

Browser menerapkan CORS. Sebagian situs tidak mengizinkan JavaScript dari domain lain mengambil HTML atau gambar mereka. Ada juga situs yang membuat daftar gambar sepenuhnya dengan JavaScript sehingga gambar tidak muncul di HTML awal.

MangaLokal v2 mencoba akses langsung terlebih dahulu. Jika browser menolak, gunakan `Proxy URL`.

## Proxy Cloudflare Worker (opsional)

1. Buat Worker baru di Cloudflare.
2. Salin isi `tools/cloudflare-worker.js`.
3. Ubah `ALLOWED_HOSTS` menjadi domain website dan CDN gambarnya, misalnya:

```js
const ALLOWED_HOSTS = [
  'domain-komik.example',
  'img.domain-komik.example'
];
```

4. Deploy Worker.
5. Salin URL Worker, contoh:

```text
https://mangalokal-proxy.nama-kamu.workers.dev/?url=
```

6. Masukkan URL itu di **Pengaturan website lanjutan → Proxy URL**.

Template sengaja memakai allowlist host agar Worker tidak berubah menjadi open proxy yang bisa dipakai orang lain sesuka hati. Internet sudah cukup kacau tanpa menyumbang satu proxy publik lagi.

## Catatan penting

- Reader URL memproses halaman di dalam MangaLokal, bukan menulis ke situs asli.
- Gunakan pada konten yang kamu berhak akses dan sesuai ketentuan situs asal.
- Situs dengan anti-bot, login kompleks, DRM, atau gambar yang dirakit lewat JavaScript khusus mungkin tidak bisa diimpor oleh PWA biasa.
- Chrome/PWA tidak diizinkan mengubah konten tab website lain secara langsung. Karena itu v2 memakai reader internal.
- Mode terjemahan tetap tidak mewajibkan API berbayar: Browser Translator bila tersedia, MyMemory publik, atau LibreTranslate kompatibel.

## Upgrade dari v1 di GitHub Pages

Ganti file lama dengan isi folder v2 ini. Pastikan `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, dan folder `icons/` ada di root repository. Setelah commit selesai, buka ulang situs lalu refresh. Jika tampilan lama masih tersimpan, tutup PWA dan buka kembali setelah beberapa detik karena service worker perlu memperbarui cache.
