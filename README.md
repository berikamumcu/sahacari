# SahaCari

Saha ve cari hesap yönetimi için geliştirilen çoklu şirket destekli web uygulaması.

## Özellikler

- Kayıt ol / giriş yap
- Her şirket için ayrı veri alanı
- Şirket bazlı kullanıcı ve müşteri yönetimi
- Müşteri ekleme, düzenleme ve silme
- Cari hareket ekleme, düzenleme ve silme
- Satış, tahsilat, devir ve iade işlemleri
- Otomatik borç, ödeme, alacak ve bakiye hesaplama
- Cari hesap raporu
- Cari hesap toplamları
- Şirket bazlı PDF cari hesap ekstresi
- Şirket logosunu PDF ve panelde gösterme
- Firma bilgileri ve logo yönetimi
- Günlük saha işleri
- Saha işi ekleme, düzenleme ve silme
- Gidilen yer ve yapılan iş takibi
- İşçilik ve toplam ücret
- Kullanılan malzeme, miktar, birim ve birim fiyat takibi
- Saha işi tarih aralığı filtreleme
- PostgreSQL veritabanı
- JWT tabanlı kimlik doğrulama
- Çoklu şirket (multi-tenant) yapı

## Teknolojiler

- Node.js
- Express.js
- PostgreSQL
- JavaScript
- HTML
- CSS
- JWT
- PDFKit

## Yerel Kurulum

1. PostgreSQL'de `yavuz_cari` veritabanını oluştur.
2. `.env.example` dosyasını `.env` olarak kopyala.
3. `.env` içindeki `DATABASE_URL` ve `JWT_SECRET` değerlerini ayarla.
4. Bağımlılıkları yükle:

```bash
npm install