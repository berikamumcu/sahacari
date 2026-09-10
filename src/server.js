require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const pool = require('./db/pool');

const app = express();

app.use(cors());

app.use(
  express.json({
    limit: '2mb'
  })
);

app.use(
  express.static(
    path.join(__dirname, '..', 'public')
  )
);


/* =========================
   HEALTH CHECK
========================= */

app.get('/api/health', async (_req, res) => {

  try {

    await pool.query('SELECT 1');

    res.json({
      ok: true,
      database: 'connected'
    });

  } catch (e) {

    res.status(503).json({
      ok: false,
      database: 'disconnected'
    });

  }

});


/* =========================
   API ROUTES
========================= */

app.use(
  '/api/auth',
  require('./routes/auth')
);

app.use(
  '/api/customers',
  require('./routes/customers')
);

app.use(
  '/api/cari',
  require('./routes/cari')
);

app.use(
  '/api/field-jobs',
  require('./routes/fieldJobs')
);

app.use(
  '/api/settings',
  require('./routes/settings')
);

app.use(
  '/api/pdf',
  require('./routes/pdf')
);


/* =========================
   HATA YÖNETİMİ
========================= */

app.use(
  (e, _req, res, _next) => {

    console.error(e);

    res.status(500).json({
      error: 'Sunucu hatası.',
      detail:
        process.env.NODE_ENV === 'development'
          ? e.message
          : undefined
    });

  }
);


/* =========================
   SERVER
========================= */

const port =
  Number(process.env.PORT || 3000);


/* =========================
   BAŞLAT
========================= */

async function start() {

  try {

    const schema =
      fs.readFileSync(
        path.join(
          __dirname,
          'db',
          'schema.sql'
        ),
        'utf8'
      );


    await pool.query(schema);


    app.listen(
      port,
      '0.0.0.0',
      () => {

        console.log(
          `SahaCari server ${port} portunda çalışıyor.`
        );

      }
    );

  } catch (e) {

    console.error(
      'Başlatılamadı:',
      e
    );

    process.exit(1);

  }

}


start();