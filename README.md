# Risalah Mobile

Aplikasi catatan offline-first bergaya **Swiss Editorial** berbasis React Native (Expo Managed Workflow).

## Fitur Utama
- **Catatan & Organisasi:** Pencarian instan, filter `#tag`, Pin/Unpin, drag-to-reorder, Archive terlindungi PIN 4 digit (`expo-secure-store`), dan Trash (restore / hapus permanen).
- **Editor WYSIWYG:** Bold, Italic, Underline, Strikethrough, tautan, warna teks & highlight (14 preset + HSV color picker), pilihan font & ukuran, perataan teks, checklist interaktif, serta daftar bersarang hingga 5 level.
- **Media & Alat:** Sisipkan foto galeri/kamera dan sketsa gambar bebas (auto-crop PNG) yang bisa diubah ukuran & digeser berdampingan, plus kalkulator pop-up.
- **Tema & Sinkronisasi:** 5 pilihan tema Swiss Editorial (Swiss White, Warm Paper, Zurich Blue, Carbon Dark, Midnight Ink), ekspor/impor backup `.json`, dan sinkronisasi opsional ke backend PHP LAN.

## Menjalankan di Mode Pengembangan (Expo Go)
```powershell
npm.cmd install
npx.cmd expo start -c
```

## Verifikasi Lokal
```powershell
node scripts/verify-core.mjs
npx.cmd tsc --noEmit
```

## Build `.apk` Standalone (EAS Build)
```powershell
npx.cmd eas-cli login
npx.cmd eas-cli build -p android --profile preview
```
Profil `preview` di `eas.json` otomatis menghasilkan file `.apk` siap pasang tanpa Expo Go.
