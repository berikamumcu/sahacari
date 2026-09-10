const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middlewareAuth');

const router = express.Router();

router.use(requireAuth);


/* =========================
   MÜŞTERİLERİ LİSTELE
========================= */

router.get('/', async (req, res, next) => {
  try {

    const { rows } = await pool.query(
      `
      SELECT
        c.id,
        c.company_name,
        c.tax_number,
        c.phone,
        c.email,
        c.address,

        COALESCE(
          SUM(
            CASE
              WHEN t.movement_type IN ('SATIS','DEVIR')
                THEN t.amount

              WHEN t.movement_type IN ('TAHSILAT','IADE')
                THEN -t.amount

              ELSE 0
            END
          ),
          0
        ) AS balance

      FROM customers c

      LEFT JOIN current_account_transactions t
        ON t.customer_id = c.id
       AND t.company_id = $1

      WHERE c.company_id = $1

      GROUP BY c.id

      ORDER BY c.company_name
      `,
      [req.auth.company_id]
    );

    res.json(rows);

  } catch (e) {
    next(e);
  }
});


/* =========================
   MÜŞTERİ EKLE
========================= */

router.post('/', async (req, res, next) => {
  try {

    const {
      company_name,
      tax_number,
      phone,
      email,
      address
    } = req.body;

    if (!company_name || !company_name.trim()) {
      return res.status(400).json({
        error: 'Müşteri firma adı zorunludur.'
      });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO customers
      (
        company_id,
        company_name,
        tax_number,
        phone,
        email,
        address
      )
      VALUES
      ($1,$2,$3,$4,$5,$6)

      RETURNING *
      `,
      [
        req.auth.company_id,
        company_name.trim(),
        tax_number?.trim() || null,
        phone?.trim() || null,
        email?.trim() || null,
        address?.trim() || null
      ]
    );

    res.status(201).json(rows[0]);

  } catch (e) {
    next(e);
  }
});


/* =========================
   MÜŞTERİ DÜZENLE
========================= */

router.put('/:id', async (req, res, next) => {
  try {

    const {
      company_name,
      tax_number,
      phone,
      email,
      address
    } = req.body;

    if (!company_name || !company_name.trim()) {
      return res.status(400).json({
        error: 'Müşteri firma adı zorunludur.'
      });
    }

    const { rows } = await pool.query(
      `
      UPDATE customers

      SET
        company_name = $1,
        tax_number = $2,
        phone = $3,
        email = $4,
        address = $5

      WHERE
        id = $6
        AND company_id = $7

      RETURNING *
      `,
      [
        company_name.trim(),
        tax_number?.trim() || null,
        phone?.trim() || null,
        email?.trim() || null,
        address?.trim() || null,
        req.params.id,
        req.auth.company_id
      ]
    );

    if (!rows[0]) {
      return res.status(404).json({
        error: 'Müşteri bulunamadı.'
      });
    }

    res.json(rows[0]);

  } catch (e) {
    next(e);
  }
});


/* =========================
   MÜŞTERİ SİL
========================= */

router.delete('/:id', async (req, res, next) => {
  try {

    const { rowCount } = await pool.query(
      `
      DELETE FROM customers

      WHERE
        id = $1
        AND company_id = $2
      `,
      [
        req.params.id,
        req.auth.company_id
      ]
    );

    if (!rowCount) {
      return res.status(404).json({
        error: 'Müşteri bulunamadı.'
      });
    }

    res.json({
      ok: true,
      message: 'Müşteri silindi.'
    });

  } catch (e) {
    next(e);
  }
});


module.exports = router;