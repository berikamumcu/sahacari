# Yavuz Su Mekanik - Tam Sistem

## İçindekiler
- Kayıt ol / giriş yap
- Her şirket için ayrı veri alanı
- Müşteri yönetimi
- Cari hareketler: satış, tahsilat, devir, iade
- Otomatik borç/alacak/bakiye
- Cari rapor + en altta TOPLAM
- PDF/yazdırma önizlemesi
- Günlük saha işleri
- Gidilen yer, müşteri, yapılan iş, işçilik ve toplam ücret
- Kullanılan malzeme + miktar + birim + birim fiyat
- Saha işi tarih aralığı filtreleme
- Firma ayarları

## Kurulum
1. PostgreSQL'de `yavuz_cari` veritabanı oluştur.
2. `.env.example` dosyasını `.env` olarak kopyala.
3. `.env` içindeki DATABASE_URL ve JWT_SECRET'i ayarla.
4. `npm install`
5. `npm start`
6. `http://localhost:3000`

## Not
Server açılırken schema.sql otomatik çalışır ve önceki prototipte oluşmuş boş/eski tablolar için temel migration kolonlarını ekler. Gerçek müşteri verisi eklemeden önce yedek almak doğru olur.

## Güncellemeler v1.2
- Gerçek server taraflı PDF endpointi: `/api/pdf/cari/:customerId`
- PDF şirket adı / müşteri adı ile oluşturulur; alt kısımda sadece şirket adı bulunur.
- Günlük saha işlerinde ISO tarihleri düzgün gösterilir.
- Saha işi düzenleme ve silme eklendi; malzemeler düzenlenebilir.
- PDF indirme artık tarayıcı yazdırma başlık/altbilgilerini kullanmaz.
