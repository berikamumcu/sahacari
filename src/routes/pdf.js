const express = require('express');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const pool = require('../db/pool');
const { requireAuth } = require('../middlewareAuth');

const router = express.Router();

router.use(requireAuth);

/* ==================================================
   HELPERS
================================================== */

function money(n) {
  return Number(n || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' TL';
}

function fmtDate(v) {
  if (!v) return '';

  const s = String(v);

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);

  return m
    ? `${m[3]}.${m[2]}.${m[1]}`
    : s;
}

function todayTR() {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();

  return `${day}.${month}.${year}`;
}

/*
 * Yavuz Su Mekanik'in resmi şirket adı uzun olsa bile
 * PDF başlığında marka adı gösterilir.
 *
 * Diğer firmalarda kayıtlı şirket adı olduğu gibi kullanılır.
 */
function getDisplayCompanyName(companyName) {
  const name = String(companyName || '').trim();

  if (!name) return '';

  if (
    name
      .toLocaleUpperCase('tr-TR')
      .startsWith('YAVUZ SU MEKANİK')
  ) {
    return 'YAVUZ SU MEKANİK';
  }

  return name;
}

function cleanAddress(address) {
  if (!address) return '';

  return String(address)
    .replace(/\s+/g, ' ')
    .trim();
}

/* ==================================================
   FONTLAR
================================================== */

/*
 * Fontlar artık projenin içinde.
 *
 * Proje:
 *
 * Yavuz_Su_Mekanik_GUNCEL_SISTEM_FINAL_v2/
 * └── fonts/
 *     ├── DejaVuSans.ttf
 *     └── DejaVuSans-Bold.ttf
 */

const regularFont = path.join(
  __dirname,
  '../../fonts/DejaVuSans.ttf'
);

const boldFont = path.join(
  __dirname,
  '../../fonts/DejaVuSans-Bold.ttf'
);


/*
 * Fontlar yoksa uygulamayı sessizce
 * bozuk PDF üretmek yerine hata ver.
 */
if (!fs.existsSync(regularFont)) {
  console.error(
    'DejaVuSans.ttf bulunamadı:',
    regularFont
  );
}

if (!fs.existsSync(boldFont)) {
  console.error(
    'DejaVuSans-Bold.ttf bulunamadı:',
    boldFont
  );
}


/* ==================================================
   PDF
================================================== */

router.get(
  '/cari/:customerId',
  async (req, res, next) => {

    try {

      /* ==================================================
         MÜŞTERİ + FİRMA
      ================================================== */

      const cust = await pool.query(
        `
        SELECT
          c.id,
          c.company_name,
          c.tax_number,
          c.phone,
          c.email,
          c.address,

          co.id AS own_company_id,
          co.company_name AS own_company,
          co.tax_number AS own_tax_number,
          co.phone AS own_phone,
          co.email AS own_email,
          co.address AS own_address,
          co.logo_url

        FROM customers c

        JOIN companies co
          ON co.id = c.company_id

        WHERE
          c.id = $1
          AND c.company_id = $2
        `,
        [
          req.params.customerId,
          req.auth.company_id
        ]
      );


      if (!cust.rows[0]) {

        return res.status(404).json({
          error: 'Müşteri bulunamadı.'
        });

      }


      const meta = cust.rows[0];


      /* ==================================================
         CARİ HAREKETLER
      ================================================== */

      const { rows } =
        await pool.query(
          `
          SELECT
            id,

            TO_CHAR(
              transaction_date,
              'YYYY-MM-DD'
            ) AS transaction_date,

            TO_CHAR(
              due_date,
              'YYYY-MM-DD'
            ) AS due_date,

            movement_type,
            description,
            document_no,
            amount

          FROM current_account_transactions

          WHERE
            customer_id = $1
            AND company_id = $2

          ORDER BY
            transaction_date,
            id
          `,
          [
            req.params.customerId,
            req.auth.company_id
          ]
        );


      /* ==================================================
         BAKİYE + TOPLAMLAR
      ================================================== */

      let bal = 0;

      let totalPayment = 0;
      let totalDebit = 0;
      let totalCredit = 0;


      const tx = rows.map(r => {

        const amount =
          Number(r.amount || 0);


        /*
         * SATIŞ + DEVİR
         * BORÇ
         */

        if (
          r.movement_type === 'SATIS' ||
          r.movement_type === 'DEVIR'
        ) {

          bal += amount;
          totalDebit += amount;

        }


        /*
         * TAHSİLAT
         * ÖDEME
         */

        else if (
          r.movement_type === 'TAHSILAT'
        ) {

          bal -= amount;
          totalPayment += amount;

        }


        /*
         * İADE
         * ALACAK
         */

        else if (
          r.movement_type === 'IADE'
        ) {

          bal -= amount;
          totalCredit += amount;

        }


        return {
          ...r,
          amount,
          balance: bal
        };

      });


      /* ==================================================
         PDF
      ================================================== */

      const doc =
        new PDFDocument({
          size: 'A4',
          margin: 36,
          autoFirstPage: true
        });


      res.setHeader(
        'Content-Type',
        'application/pdf'
      );


      const safeName =
        `cari-${meta.own_company_id || req.auth.company_id}-${meta.company_name || 'musteri'}`
          .replace(
            /[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ_-]+/g,
            '-'
          )
          .toLowerCase();


      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeName}.pdf"`
      );


      doc.pipe(res);


      const pageWidth =
        doc.page.width;

      const pageHeight =
        doc.page.height;


      const left = 36;

      const right =
        pageWidth - 36;

      const contentWidth =
        right - left;


      /* ==================================================
         ÜST BÖLÜM
      ================================================== */

      let companyX = left;


      /* ==================================================
         LOGO
      ================================================== */

      if (
        meta.logo_url &&
        /^data:image\/[^;]+;base64,/i.test(
          meta.logo_url
        )
      ) {

        try {

          const base64 =
            meta.logo_url.split(',')[1];


          const buffer =
            Buffer.from(
              base64,
              'base64'
            );


          doc.image(
            buffer,
            left,
            41,
            {
              fit: [28, 28]
            }
          );


          companyX =
            left + 42;

        } catch (err) {

          console.warn(
            'Logo PDF içine eklenemedi:',
            err.message
          );

        }

      }


      /* ==================================================
         ŞİRKET ADI
      ================================================== */

      const displayCompanyName =
        getDisplayCompanyName(
          meta.own_company
        );


      doc
        .font(boldFont)
        .fontSize(12)
        .fillColor('#c62828')
        .text(
          displayCompanyName,
          companyX,
          42,
          {
            width: 220,
            height: 16,
            lineBreak: false,
            ellipsis: true
          }
        );


      /* ==================================================
         E-POSTA
      ================================================== */

      if (meta.own_email) {

        doc
          .font(regularFont)
          .fontSize(7)
          .fillColor('#555')
          .text(
            meta.own_email,
            companyX,
            59,
            {
              width: 230,
              height: 10,
              lineBreak: false,
              ellipsis: true
            }
          );

      }


      /* ==================================================
         ADRES
      ================================================== */

      const address =
        cleanAddress(
          meta.own_address
        );


      if (address) {

        doc
          .font(regularFont)
          .fontSize(7)
          .fillColor('#555')
          .text(
            address,
            companyX,
            71,
            {
              width: 235,
              height: 11,
              lineBreak: false,
              ellipsis: true
            }
          );

      }


      /* ==================================================
         MÜŞTERİ ADI
      ================================================== */

      doc
        .font(boldFont)
        .fontSize(10)
        .fillColor('#111')
        .text(
          meta.company_name || '',
          300,
          43,
          {
            width: 255,
            height: 16,
            align: 'right',
            lineBreak: false,
            ellipsis: true
          }
        );


      /* ==================================================
         RAPOR TARİHİ
      ================================================== */

      doc
        .font(regularFont)
        .fontSize(8.5)
        .fillColor('#222')
        .text(
          `Rapor Tarihi: ${todayTR()}`,
          300,
          65,
          {
            width: 255,
            height: 12,
            align: 'right',
            lineBreak: false
          }
        );


      /* ==================================================
         ÜST ÇİZGİ
      ================================================== */

      doc
        .moveTo(
          left,
          99
        )
        .lineTo(
          right,
          99
        )
        .strokeColor('#1e527d')
        .lineWidth(1)
        .stroke();


      /* ==================================================
         TABLO KOLONLARI
      ================================================== */

    const widths = [
      42, // Tarih
      42, // Vade
      52, // Hareket
      98, // Açıklama
      70, // Belge / Fatura No
      50, // Ödeme
      50, // Borç
      50, // Alacak
      68  // Bakiye
    ];


      const cols = [left];


      for (const width of widths) {

        cols.push(
          cols[cols.length - 1] +
          width
        );

      }


      const heads = [
        'Tarih',
        'Vade',
        'Hareket',
        'Açıklama',
        'Belge / Fatura No',
        'Ödeme',
        'Borç',
        'Alacak',
        'Bakiye'
      ];


      let y = 111;


      /* ==================================================
         TABLO BAŞLIĞI
      ================================================== */

      function drawTableHeader() {

        const headerHeight = 28;


        /*
         * Mavi zemin
         */

        doc
          .rect(
            left,
            y,
            contentWidth,
            headerHeight
          )
          .fill('#1e527d');


        /*
         * Hücre çizgileri
         */

        doc
          .strokeColor('#dbe7f2')
          .lineWidth(0.5);


        for (
          const x of cols
        ) {

          doc
            .moveTo(
              x,
              y
            )
            .lineTo(
              x,
              y + headerHeight
            )
            .stroke();

        }


        doc
          .moveTo(
            left,
            y
          )
          .lineTo(
            right,
            y
          )
          .stroke();


        doc
          .moveTo(
            left,
            y + headerHeight
          )
          .lineTo(
            right,
            y + headerHeight
          )
          .stroke();


        /*
         * Başlıklar
         */

        doc
          .font(boldFont)
          .fontSize(6.1)
          .fillColor('#fff');


        heads.forEach(
          (head, i) => {

            const cellWidth =
              cols[i + 1] -
              cols[i];


            doc.text(
              head,
              cols[i] + 3,
              y + 9,
              {
                width:
                  cellWidth - 6,

                align:
                  i >= 5
                    ? 'right'
                    : 'left',

                lineBreak: false,
                ellipsis: true
              }
            );

          }
        );


        y += headerHeight;

      }


      drawTableHeader();


      /* ==================================================
         HAREKETLER
      ================================================== */

      tx.forEach(
        (r, idx) => {

          const movement =
            r.movement_type === 'SATIS'
              ? 'Satış'
              : r.movement_type === 'TAHSILAT'
                ? 'Tahsilat'
                : r.movement_type === 'DEVIR'
                  ? 'Devir'
                  : 'İade';


          /*
           * DOĞRU MUHASEBE MANTIĞI
           *
           * TAHSİLAT -> ÖDEME
           * SATIŞ/DEVİR -> BORÇ
           * İADE -> ALACAK
           */

          const vals = [

            fmtDate(
              r.transaction_date
            ),

            fmtDate(
              r.due_date
            ),

            movement,

            r.description || '',

            r.document_no || '',

            /* ÖDEME */

            r.movement_type === 'TAHSILAT'
              ? money(r.amount)
              : '',

            /* BORÇ */

            (
              r.movement_type === 'SATIS' ||
              r.movement_type === 'DEVIR'
            )
              ? money(r.amount)
              : '',

            /* ALACAK */

            r.movement_type === 'IADE'
              ? money(r.amount)
              : '',

            /* BAKİYE */

            money(r.balance)

          ];


          const rowHeight = 30;


          const bottomLimit =
            pageHeight - 70;


          /*
           * Sayfaya sığmazsa yeni sayfa
           */

          if (
            y + rowHeight >
            bottomLimit
          ) {

            doc.addPage();

            y = 45;

            drawTableHeader();

          }


          /*
           * Zebra
           */

          if (idx % 2 === 0) {

            doc
              .rect(
                left,
                y,
                contentWidth,
                rowHeight
              )
              .fill('#f5f8fc');

          }


          /*
           * Hücre çizgileri
           */

          doc
            .strokeColor('#cfd8e3')
            .lineWidth(0.5);


          for (
            const x of cols
          ) {

            doc
              .moveTo(
                x,
                y
              )
              .lineTo(
                x,
                y + rowHeight
              )
              .stroke();

          }


          doc
            .moveTo(
              left,
              y
            )
            .lineTo(
              right,
              y
            )
            .stroke();


          doc
            .moveTo(
              left,
              y + rowHeight
            )
            .lineTo(
              right,
              y + rowHeight
            )
            .stroke();


          /*
           * Metinler
           */

          vals.forEach(
            (value, i) => {

              const cellWidth =
                cols[i + 1] -
                cols[i];


              doc
                .font(regularFont)
                .fontSize(6)
                .fillColor('#182334')
                .text(
                  value,
                  cols[i] + 3,
                  y + 9,
                  {
                    width:
                      cellWidth - 6,

                    height:
                      rowHeight - 9,

                    align:
                      i >= 5
                        ? 'right'
                        : 'left',

                    ellipsis: true,

                    lineBreak: false
                  }
                );

            }
          );


          y += rowHeight;

        }
      );


      /* ==================================================
         TOPLAM
      ================================================== */

      const totalHeight = 29;


      if (
        y + totalHeight >
        pageHeight - 70
      ) {

        doc.addPage();

        y = 45;

        drawTableHeader();

      }


      /*
       * Toplam arka plan
       */

      doc
        .rect(
          left,
          y,
          contentWidth,
          totalHeight
        )
        .fill('#eaf2fb');


      /*
       * Hücre çizgileri
       */

      doc
        .strokeColor('#cfd8e3')
        .lineWidth(0.5);


      for (
        const x of cols
      ) {

        doc
          .moveTo(
            x,
            y
          )
          .lineTo(
            x,
            y + totalHeight
          )
          .stroke();

      }


      doc
        .moveTo(
          left,
          y
        )
        .lineTo(
          right,
          y
        )
        .stroke();


      doc
        .moveTo(
          left,
          y + totalHeight
        )
        .lineTo(
          right,
          y + totalHeight
        )
        .stroke();


      /* ==================================================
         TOPLAM YAZISI
      ================================================== */

      doc
        .font(boldFont)
        .fontSize(7.2)
        .fillColor('#182334');


      doc.text(
        'TOPLAM',
        cols[3] + 3,
        y + 10,
        {
          width:
            cols[5] -
            cols[3] -
            6,

          align: 'right',

          lineBreak: false
        }
      );


      /* ==================================================
         TOPLAM ÖDEME
      ================================================== */

      doc.text(
        money(totalPayment),
        cols[5] + 3,
        y + 10,
        {
          width:
            cols[6] -
            cols[5] -
            6,

          align: 'right',

          lineBreak: false
        }
      );


      /* ==================================================
         TOPLAM BORÇ
      ================================================== */

      doc.text(
        money(totalDebit),
        cols[6] + 3,
        y + 10,
        {
          width:
            cols[7] -
            cols[6] -
            6,

          align: 'right',

          lineBreak: false
        }
      );


      /* ==================================================
         TOPLAM ALACAK
      ================================================== */

      doc.text(
        money(totalCredit),
        cols[7] + 3,
        y + 10,
        {
          width:
            cols[8] -
            cols[7] -
            6,

          align: 'right',

          lineBreak: false
        }
      );


      /* ==================================================
         TOPLAM BAKİYE
      ================================================== */

      doc.text(
        money(bal),
        cols[8] + 3,
        y + 10,
        {
          width:
            cols[9] -
            cols[8] -
            6,

          align: 'right',

          lineBreak: false
        }
      );


      /* ==================================================
         PDF BİTİR
      ================================================== */

      doc.end();

    } catch (e) {

      next(e);

    }

  }
);


module.exports = router;