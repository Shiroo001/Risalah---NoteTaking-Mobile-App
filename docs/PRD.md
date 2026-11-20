# Risalah Mobile — Product & Technical Specification (PRD)

Dokumen ini adalah spesifikasi produk dan teknis lengkap untuk membangun **Risalah Mobile** (porting dari aplikasi web *smart note-taking* **Risalah** ke platform mobile). Dokumen ini dirancang sebagai acuan kerja langsung bagi developer maupun AI coding agent.

---

## 0. Aturan Eksekusi untuk AI Agent (Wajib Dipatuhi)

Agar proses build tetap ringan, stabil, dan langsung bisa dijalankan di HP tanpa error *native build*:

1. **Kerjakan Bertahap (Phase-by-Phase):** Mulai dengan membangun **Fase 1 (Core MVP)** saja sampai 100% berjalan mulus dan lolos *Acceptance Criteria* Fase 1. **Jangan** langsung mengerjakan Fase 2 atau Fase 3 sebelum diminta secara eksplisit.
2. **Wajib Kompatibel dengan Expo Go:** Gunakan hanya *core* React Native dan paket resmi Expo yang didukung langsung oleh **Expo Go** (mis. `@react-native-async-storage/async-storage`, `expo-haptics`, `expo-secure-store`, `expo-file-system`, `expo-sharing`, `expo-document-picker`, `expo-image-picker`). **Hindari** *library* yang membutuhkan `expo prebuild`, Android Studio, atau *custom native module* di Fase 1–2.
3. **Format Konten (`content`):** Gunakan **Plain Text / Markdown ringan** pada komponen `TextInput` native untuk Fase 1 & 2 agar performa dan stabilitas *keyboard* maksimal. *Rich-text* berbasis HTML (seperti `contenteditable` di web) **tidak** digunakan di Fase 1–2.
4. **Pakai Ulang `mathEngine.js`:** Jangan menulis ulang logika kalkulator dari nol; impor langsung fungsi dari `mathEngine.js` sesuai kontrak API di Bagian 4.

---

## 1. Ringkasan Proyek & Tujuan

**Risalah** adalah aplikasi pencatat (*note-taker*) minimalis-modern dengan fitur unggulan **Living Text Calculator**—catatan yang mampu mengevaluasi ekspresi matematika dan variabel secara *real-time* baris demi baris.

### Target & Lingkungan Teknis
* **Platform:** Android & iOS menggunakan **React Native (Expo — Managed Workflow)**.
* **Environment:** Cukup menggunakan **Node.js** dan diuji langsung di HP lewat aplikasi **Expo Go**.
* **Arsitektur Data:** *Offline-first* menggunakan `@react-native-async-storage/async-storage` (atau `expo-sqlite` jika dibutuhkan di tahap lanjut).
* **Aset yang Dipakai Ulang dari Proyek Web Lama:**
  * `js/mathEngine.js` → salin ke proyek mobile (murni JavaScript tanpa referensi DOM).
  * `logo.png` → ikon aplikasi (`expo.icon` di `app.json`).
  * `splash.png` → layar pembuka (`expo.splash.image` dengan `backgroundColor: "#FDFCF5"`).

---

## 2. Sistem Desain & Identitas Visual

Desain mengadopsi gaya **Material 3 / Soft Rounded** dari `style.css` versi web dengan dukungan penuh **Light Mode** dan **Dark Mode**.

### Palet Warna Lengkap (Design Tokens)

| Token | Light Mode | Dark Mode | Penggunaan |
| :--- | :--- | :--- | :--- |
| `bg` | `#FDFCF5` | `#121212` | Latar belakang utama layar & splash |
| `text` | `#1B1B1F` | `#E3E2E6` | Teks utama & judul |
| `card` | `#F2F0F4` | `#2A2A2E` | Kartu catatan & item pengaturan |
| `cardHover` | `#FFFFFF` | `#323236` | State *pressed* / aktif pada kartu |
| `accent` | `#445E91` | `#ADC6FF` | Warna aksen, link, badge kalkulator |
| `accentLight` | `#DCE2F9` | `#3F4759` | Latar pill/badge aksen & tombol aktif |
| `muted` | `#757780` | `#C4C6D0` | Teks pratinjau, tanggal, placeholder |
| `border` | `rgba(0, 0, 0, 0.05)` | `rgba(255, 255, 255, 0.05)` | Garis pemisah header & modal |
| `searchBg` | `#E2E2E9` | `#2A2A2E` | Latar kolom pencarian & badge tanggal |
| `fabBg` | `#6750A4` | `#D0BCFF` | Tombol tambah catatan (FAB) |
| `fabText` | `#FFFFFF` | `#381E72` | Ikon `+` pada FAB |
| `toolbarBg` | `#FFFFFF` | `#252529` | Latar floating toolbar & pop-up menu |
| `toolbarBorder` | `#E2E2E9` | `#3A3A3E` | Garis tepi toolbar & pop-up menu |
| `tagBg` | `#DCE2F9` | `#3F4759` | Latar chip tag |
| `tagText` | `#001D35` | `#C7D2FE` | Teks chip tag |
| `pinnedBg` | `#FEF3C7` | `rgba(180, 83, 9, 0.3)` | Latar badge `PINNED` |
| `pinnedText` | `#92400E` | `#FCD34D` | Teks badge `PINNED` |
| `modalBg` | `#F2F0F4` | `#1E1E1E` | Latar modal Settings, PIN, Context, Calculator |
| `inputBg` | `#F3F4F6` | `rgba(0, 0, 0, 0.3)` | Latar input di dalam modal |
| `danger` | `#EF4444` | `#EF4444` | Aksi hapus & reset data |

### Karakteristik UI Mobile
* **Border Radius:** Kartu catatan `20px`, tombol FAB `22px–24px` (*squircle*), modal/bottom sheet `24px–28px`, input pencarian `14px`, pill & badge `9999px`.
* **Tipografi:** Sans-serif bersih untuk UI (*Inter* / system sans), dengan opsi Serif (*Lora*) dan Monospace (*JetBrains Mono*) untuk editor/kalkulator.
* **Thumb-Friendly:** FAB di pojok kanan bawah; menu konteks dan opsi tambahan memakai modal/bottom sheet yang nyaman dijangkau satu tangan.
* **Haptic Feedback:** Getaran halus (`expo-haptics`) saat *long press* kartu (`600ms`), menekan tombol penting, atau memulai *drag reorder*.

---

## 3. Model Data

Mengikuti skema `database.sql` agar kompatibel dengan struktur export/import JSON versi web.

### Entitas `Note`

| Field | Tipe | Default | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | `number` | `Date.now()` | ID unik catatan |
| `title` | `string` | `""` | Judul catatan |
| `content` | `string` | `""` | Isi catatan (Plain text / Markdown di Fase 1–2) |
| `tags` | `string[]` | `[]` | Daftar tag tanpa simbol `#` |
| `isPinned` | `boolean` | `false` | Disematkan di posisi teratas |
| `isArchived` | `boolean` | `false` | Disembunyikan ke ruang Arsip |
| `isDeleted` | `boolean` | `false` | Soft-delete (masuk ke Trash) |
| `sortOrder` | `number` | `0` | Urutan kustom (*drag-and-drop*) |
| `createdAt` | `number` | `Date.now()` | Timestamp pembuatan (ms) |
| `updatedAt` | `number` | `Date.now()` | Timestamp perubahan terakhir (ms) |

### Entitas `Settings`

| Key | Tipe | Default | Keterangan |
| :--- | :--- | :--- | :--- |
| `theme` | `'light' \| 'dark'` | `'light'` | Preferensi tema aplikasi |
| `archivePin` | `string` | `""` | PIN 4 digit untuk mengunci Arsip (kosong = tidak terkunci) |

---

## 4. Kontrak Modul Bawaan (`mathEngine.js`)

Aplikasi wajib mengimpor dan memakai langsung file `mathEngine.js` dari proyek lama dengan antarmuka berikut:

* **`parseMathLines(content: string)`**
  * Membersihkan tag HTML (jika ada dari catatan impor web) dan memproses teks baris per baris.
  * Mendukung assignment variabel: `harga = 25000`, `jumlah = 3`, lalu baris berikutnya `harga * jumlah`.
  * Otomatis mengabaikan simbol mata uang (`$`, `€`, `£`) dan satuan umum (`days`, `weeks`, `months`, `hrs`, `hours`, `kg`, `lbs`, `mins`, `minutes`), serta mendukung operator `÷` dan `×`.
  * Mengembalikan array objek hasil: `{ lineIndex, expression, result, isVariableAssignment, variableName? }`.
  * Menangani kasus batas secara aman: pembagian nol menghasilkan `'∞'` atau `'-∞'`, hasil tidak terdefinisi menghasilkan `'Undefined'`.
* **`formatNumber(num: number | string): string`**
  * Memformat angka dengan pemisah ribuan (maksimal 4 digit desimal) atau mengembalikan string apa adanya untuk `'∞'`, `'-∞'`, dan `'Undefined'`.

---

## 5. Daftar Fitur Lengkap (Bertahap)

### Fase 1 — Core MVP (Target Build Pertama)

1. **Halaman Utama (Daftar Catatan)**
   * **Header:** Judul dinamis (`Risalah` di tampilan aktif, `Archive` di tampilan arsip), tombol Back (hanya muncul saat di mode arsip), kolom pencarian, toggle Light/Dark Mode, dan tombol Avatar (`R`) untuk membuka Settings/Arsip.
   * **Pencarian Real-Time:** Menyaring catatan berdasarkan judul, isi, dan `#tag` (*case-insensitive*).
   * **Aturan Pengurutan:** `isPinned: true` selalu di atas $\rightarrow$ lalu urut `sortOrder` menaik $\rightarrow$ lalu `updatedAt` terbaru.
   * **Kartu Catatan:** Menampilkan judul (fallback `"Untitled"`), tanggal lokal `id-ID` (`DD MMM YYYY, HH:mm`), pratinjau isi maksimal 2 baris (tag HTML di-*strip* untuk kompatibilitas impor), chip `#tag`, dan badge `PINNED`.
   * **Empty State:** Ikon sederhana dan teks panduan saat belum ada catatan atau pencarian nihil.
   * **FAB (`+`):** Membuat catatan baru dan langsung membuka Editor. Jika ditekan saat berada di tampilan **Archive**, catatan baru otomatis dibuat dengan `isArchived: true`.

2. **Editor Catatan**
   * Input judul berukuran besar, baris manajemen `#tag`, dan area isi multi-baris.
   * **Perilaku Input Tag:** Menekan `Space` atau `Enter` menambahkan tag baru (spasi di dalam tag diubah menjadi `-`, duplikat diabaikan); menekan `Backspace` saat input tag kosong menghapus tag terakhir; mengetuk tombol `×` pada chip menghapus tag tersebut.
   * **Auto-Save (Debounce):** Menyimpan otomatis setelah berhenti mengetik ($\approx 800\text{ ms} - 1500\text{ ms}$) serta langsung menyimpan saat editor ditutup.
   * **Pencegahan Catatan Kosong:** Jika catatan baru ditutup dalam keadaan judul, isi, dan tag kosong, jangan disimpan ke daftar.
   * **Undo / Redo:** Riwayat perubahan teks (*history stack*) yang bisa diakses lewat tombol Undo/Redo di header editor.

3. **Living Text Calculator (`mathEngine.js`)**
   * Mengevaluasi isi catatan secara *real-time* saat pengguna mengetik.
   * Menampilkan **Floating Math Result Pill** di bagian bawah editor (format: `= <hasil terakhir>`) hanya ketika ada minimal satu ekspresi valid.
   * *(UX Mobile)* Mengetuk pill hasil dapat menyalin hasil ke *clipboard* atau menyisipkan hasil ke baris baru catatan.

4. **Menu Konteks Kartu Catatan**
   * Dipicu lewat **Long Press** ($\approx 600\text{ ms}$) pada kartu catatan disertai *haptic feedback*. *(Opsional: tambahan gestur swipe-to-archive).*
   * Opsi aksi:
     * **Pin / Unpin**
     * **Archive / Restore**
     * **Share** (via `Share.share` bawaan React Native)
     * **Delete** (melakukan *soft delete* ke Trash dengan `isDeleted: true`)

---

### Fase 2 — Parity Fitur Inti Risalah

5. **Kalkulator Pop-up (Modal / Bottom Sheet)**
   * Diakses lewat ikon kalkulator di header editor.
   * Grid tombol 4 kolom: `C`, `(`, `)`, `÷`, `7`, `8`, `9`, `×`, `4`, `5`, `6`, `-`, `1`, `2`, `3`, `+`, `0`, `.`, `DEL` (`⌫`), `=`.
   * Evaluasi pratinjau hasil *live* memakai `mathEngine.js`, plus tombol untuk menyisipkan angka hasil langsung ke isi catatan.

6. **Checklist & Daftar Bertingkat (Lists)**
   * **Checklist Interaktif:** Daftar tugas dengan kotak centang; item yang dicentang otomatis berubah redup dan dicoret (*strikethrough*). Menekan `Enter` di item kosong keluar dari mode checklist.
   * **Bullet & Numbered List:** Mendukung indentasi hingga 5 level (indent/outdent) dengan pola siklus `1. → a. → i.` untuk *ordered list* dan `• → ○ → ■` untuk *unordered list*.

7. **Settings, Arsip Ber-PIN, Trash & Backup**
   * **Akses Arsip:** Menampilkan jumlah catatan terarsip. Jika `archivePin` aktif, wajib verifikasi lewat modal **PIN 4 digit numerik** sebelum masuk ke tampilan Arsip.
   * **Deleted History (Trash):** Menampilkan daftar catatan `isDeleted: true` dengan aksi **Restore**, **Delete Permanently**, dan **Empty Trash**.
   * **Backup & Restore:** Export seluruh catatan ke file `risalah_backup_YYYY-MM-DD.json` dan Import kembali dari file `.json` (membuat ID baru agar tidak bentrok).
   * **Keamanan PIN:** Atur, ubah, atau hapus Archive PIN 4 digit (simpan dengan `expo-secure-store`).
   * **Reset App Data:** Menghapus seluruh data lokal setelah dialog konfirmasi.
   * **App Info:** Versi aplikasi dan total catatan tersimpan.

8. **Urutkan Catatan (Drag-to-Reorder)**
   * Ikon *drag handle* (6 titik) pada kartu catatan untuk menyusun ulang `sortOrder`.
   * **Aturan Ketat:** Catatan *pinned* hanya boleh bertukar posisi dengan sesama *pinned*, dan catatan non-*pinned* hanya dengan sesama non-*pinned* (tampilkan toast error jika melanggar).

---

### Fase 3 — Fitur Lanjutan & Eksplorasi (Opsional)

9. **Formatting Toolbar & Custom Color Picker**
   * *Catatan Teknis:* Untuk dukungan *rich-text* per kata (seperti versi web), editor perlu ditingkatkan ke komponen berbasis WebView HTML atau diadaptasi sebagai toolbar Markdown + pengaturan gaya per catatan.
   * Fitur yang dicakup: **Bold**, *Italic*, Underline, Strikethrough, **Insert Link URL**, Alignment (Left/Center/Right), pilihan Font (Sans/Serif/Mono), Ukuran teks (`S`, `M`, `L`, `XL`), 14 preset warna teks + 14 preset warna highlight, serta **Custom HSV Color Picker** (area gradien saturasi/kecerahan, *hue slider*, input kode HEX, dan pratinjau warna).

10. **Sisipkan Media (Insert Menu)**
    * **Upload / Pilih Gambar:** Mengambil foto dari galeri atau kamera (`expo-image-picker`) dan menyimpannya ke catatan.
    * **Draw Sketch:** Kanvas gambar sentuh *fullscreen* dengan 4 pilihan warna (`#000000`, `#EF4444`, `#3B82F6`, `#10B981`), tombol Pen & Eraser, serta **auto-crop** mengikuti batas coretan sebelum disimpan sebagai gambar PNG ke catatan.
    * **Voice Input (*Speech-to-Text*):** *Catatan Expo Go:* Modul *speech recognition* native **tidak** berjalan di Expo Go standar. Untuk Expo Go, andalkan tombol dikte bawaan *keyboard* HP; integrasi tombol Voice Input khusus baru diaktifkan jika proyek berpindah ke *Expo Development Build*.

11. **Opsi Sinkronisasi Backend PHP Lama**
    * Pengaturan opsional untuk memasukkan *base URL* server lokal LAN (contoh: `http://192.168.x.x/Risalah/api/`) agar dapat memanggil `get_notes.php`, `save_note.php`, `delete_note.php`, dan `settings.php`.

---

## 6. Peta Layar & Navigasi

```text
[ Splash Screen (splash.png) ]
              |
              v
      [ Home Screen ] <---------------------------+
        |     |     |                             |
        |     |     +--> [ Settings Modal ]       |
        |     |                |-- Archive -------+ (via PIN Modal jika terkunci)
        |     |                |-- Trash Screen (Restore / Hapus Permanen / Clear)
        |     |                |-- Backup Export / Import JSON
        |     |                +-- Set/Change PIN & Reset Data
        |     |
        |     +--> (Long Press Card) --> [ Context Menu Modal ]
        |                                  (Pin, Archive, Share, Delete)
        |
        +--> (Tap Card / Tap FAB '+') --> [ Note Editor Screen ]
                                             |-- Living Math Pill (otomatis)
                                             |-- Calculator Modal (Fase 2)
                                             +-- Formatting / Insert Sheet (Fase 3)
```

---

## 7. Kebutuhan Non-Fungsional & Edge Cases

* **Tombol Back Fisik Android (`BackHandler`):**
  * Di Editor: langsung simpan catatan dan kembali ke Home (bukan keluar aplikasi).
  * Di tampilan Archive: kembali ke tampilan catatan aktif.
  * Di Modal (Settings/Context/Calculator/PIN): menutup modal terlebih dahulu.
* **Keyboard Handling:** Menggunakan `KeyboardAvoidingView` agar area tulis, tombol tag, dan *Math Result Pill* tidak tertutup *soft keyboard*.
* **Safe Area:** Memperhatikan *notch*, *status bar*, dan *gesture bar* iOS/Android via `react-native-safe-area-context`.
* **Performa Daftar:** Gunakan `FlatList` dengan `keyExtractor` stabil dan hindari re-render berlebih.
* **Toast Notification:** Umpan balik singkat non-intrusif (~3 detik) dengan 3 varian warna (`success`, `error`, `info`) untuk aksi penting (`Archived`, `Moved to trash`, `Note restored`, `PIN set`, `Notes reordered`, dll.).

---

## 8. Checklist Pengujian (Acceptance Criteria)

### Verifikasi Fase 1 (Wajib Lulus Dulu)
- [ ] Proyek berjalan langsung di **Expo Go** hanya dengan Node.js tanpa error *native module*.
- [ ] Ikon `logo.png`, splash `splash.png` (`#FDFCF5`), serta tema Light/Dark tampil sesuai Design Tokens.
- [ ] Membuat catatan baru, mengisi judul, isi, dan `#tag` (via Spasi/Enter), lalu menekan Back $\rightarrow$ catatan otomatis tersimpan dan tampil di Home.
- [ ] Menutup catatan baru yang masih kosong sepenuhnya tidak menambah entri kosong ke daftar.
- [ ] Menutup paksa aplikasi dan membukanya ulang mempertahankan seluruh catatan dan preferensi tema.
- [ ] Mengetik ekspresi matematika dengan variabel (mis. `kopi = 18000`, `roti = 12000`, `kopi * 2 + roti`) memunculkan pill `= 48,000` dari `mathEngine.js`, dan `10 / 0` menampilkan `= ∞` tanpa *crash*.
- [ ] Pencarian menyaring catatan secara *real-time* berdasarkan judul, isi, maupun `#tag`.
- [ ] Long press kartu menampilkan menu konteks yang berfungsi untuk **Pin**, **Archive**, **Share**, dan **Delete** (*soft delete*).
- [ ] Menekan FAB `+` saat di mode Archive otomatis membuat catatan dengan status terarsip.

### Verifikasi Fase 2
- [ ] Modal Kalkulator menghitung secara *live* dan dapat menyisipkan hasil ke editor.
- [ ] Checklist mencoret item yang dicentang; *nested list* mendukung indentasi hingga 5 level.
- [ ] Catatan di Trash bisa di-**Restore**, dihapus permanen, atau dikosongkan sekaligus.
- [ ] Mengaktifkan PIN 4 digit mengunci akses Arsip dan menolak PIN yang salah.
- [ ] Export menghasilkan file `.json` valid dan Import memuat ulang catatan tanpa konflik ID.
- [ ] Drag-to-reorder memperbarui urutan dan menolak pertukaran antara catatan *pinned* dan non-*pinned*.