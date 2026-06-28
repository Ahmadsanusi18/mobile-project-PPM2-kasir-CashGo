## CashGo

CashGo adalah aplikasi kasir (Point of Sale) berbasis mobile yang dibangun menggunakan React Native dengan Expo, serta menggunakan Supabase sebagai backend dan database. Aplikasi ini ditujukan untuk membantu pelaku usaha dalam mengelola transaksi penjualan, data produk, dan laporan secara langsung dari perangkat mobile.

## Fitur Utama

- Autentikasi pengguna menggunakan Supabase Auth
- Pencatatan transaksi kasir secara real-time
- Pencatatan stock produk secara real-time
- Fitur diskon dengan persen (%)
- Riwayat transaksi
- Sistem cetak struck
- Sistem Draft
- Manajemen data produk
- Manajemen data customer
- Export data pelanggan (csv)
- Draft transaksi yang belum diselesaikan
- Visualisasi data penjualan dalam bentuk diagram dan persentase kenaikan/turun
- Profil

## Tech Stack

| Kategori          | Teknologi               |
|-------------------|-------------------------|
| Framework         | React Native + Expo     |
| Routing           | Expo Router             |
| Backend & Database| Supabase (PostgreSQL)   |
| Autentikasi       | Supabase Auth           |
| Bahasa            | TypeScript              |
| Build Service     | EAS (Expo Application Services) |

## Struktur Folder

Kasir.V1/
├── app/                          # Routing utama berbasis Expo Router
│   ├── (tabs)/                    # Grup rute dengan navigasi tab bawah
│   │   ├── _layout.tsx             # Layout dan konfigurasi tab navigator
│   │   ├── index.tsx               # Halaman utama / dashboard kasir
│   │   ├── kasir.tsx                # Halaman transaksi kasir
│   │   ├── produk.tsx               # Halaman manajemen produk
│   │   ├── profil.tsx               # Halaman profil pengguna
│   │   └── transaksi.tsx            # Halaman riwayat transaksi
│   │
│   ├── auth/                      # Grup rute autentikasi
│   │   ├── _layout.tsx             # Layout untuk halaman auth
│   │   ├── customer.tsx             # Halaman terkait data customer
│   │   ├── diagram.tsx              # Halaman visualisasi data
│   │   ├── draft.tsx                # Halaman draft transaksi
│   │   ├── index.tsx                # Halaman login / register
│   │   └── modal.tsx                # Modal pendukung autentikasi
│   │
│   └── assets/                    # Gambar, icon, dan aset statis
│       ├── icon/
│       └── images/
│
├── komponen/                    # Komponen UI yang dapat dipakai ulang
├── konstanta/                     # Konstanta (warna, ukuran, konfigurasi, dll)
├── hooks/                          # Custom React hooks
├── lib/                            # Fungsi utilitas dan konfigurasi service
│   └── supabase.ts                  # Inisialisasi client Supabase
│
├── screen/                        # Komponen layar tambahan (non-route)
│   ├── customerScreen.tsx
│   ├── diagramScreen.tsx
│   └── draftScreen.tsx
│
├── scripts/                       # Script pendukung pengembangan/pembangunan
├── node_modules/                  # Dependencies (otomatis, tidak di-commit)
│
├── .env                             # Variabel lingkungan (tidak di-commit)
├── .gitignore
├── app.json                         # Konfigurasi Expo
├── eas.json                         # Konfigurasi EAS Build
├── eslint.config.js                  # Konfigurasi ESLint
├── expo-env.d.ts                     # Type deklarasi Expo
├── package.json
├── package-lock.json
├── tsconfig.json                     # Konfigurasi TypeScript
├── AGENTS.md                         # Dokumentasi/instruksi untuk AI agent
├── CLAUDE.md                         # Dokumentasi/instruksi untuk Claude
└── README.md

## Persiapan dan Instalasi

### 1. Clone Repository

```bash
git clone https://github.com/Ahmadsanusi18/mobile-project-PPM2-kasir-CashGo.git
cd mobile-project-PPM2-kasir-CashGo
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Konfigurasi Environment Variables

Buat file `.env` di root project, lalu isi dengan kredensial Supabase:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Kredensial dapat diperoleh dari Project Settings > API di dashboard Supabase.

### 4. Jalankan Aplikasi

```bash
npx expo start
```

Setelah itu, scan QR code menggunakan aplikasi Expo Go (Android/iOS), atau jalankan di emulator:

```bash
npx expo start --android
npx expo start --ios
```

## Skema Database (Supabase)

| Tabel              | Deskripsi                                   |
|--------------------|---------------------------------------------|
| users              | Data pengguna/akun kasir                    |
| products           | Data produk (nama, harga, stok, kategori)   |
| transactions       | Data transaksi penjualan                    |
| transaction_items  | Detail item dalam setiap transaksi          |
| customers          | Data pelanggan                              |

Skema dapat disesuaikan dan dikelola melalui Supabase Table Editor atau migrasi SQL.

## Build untuk Produksi

Aplikasi ini menggunakan EAS Build untuk build native Android/iOS:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android
```

## Kontribusi

Kontribusi terbuka untuk siapa saja. Silakan fork repository ini, buat branch baru, dan ajukan pull request.

```bash
git checkout -b fitur-baru
git commit -m "Menambahkan fitur baru"
git push origin fitur-baru
```
