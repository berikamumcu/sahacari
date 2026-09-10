const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middlewareAuth');

const router = express.Router();

router.use(requireAuth);


/* =========================
   MÜŞTERİ CARİ HESABI
========================= */

router.get('/customers/:id', async (req, res, next) => {
  try {

    const chk = await pool.query(
      `
      SELECT
        id,
        company_name
      FROM customers
      WHERE
        id = $1
        AND company_id = $2
      `,
      [
        req.params.id,
        req.auth.company_id
      ]
    );

    if (!chk.rows[0]) {
      return res.status(404).json({
        error: 'Müşteri bulunamadı.'
      });
    }


    const { rows } = await pool.query(
      `
      SELECT
        id,
        transaction_date,
        due_date,
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
        req.params.id,
        req.auth.company_id
      ]
    );


    let balance = 0;


    let paymentTotal = 0;
    let debitTotal = 0;
    let creditTotal = 0;


    const transactions = rows.map(r => {

      const amount = Number(r.amount);


      let payment = null;
      let debit = null;
      let credit = null;


      /* SATIŞ ve DEVİR = BORÇ */

      if (
        ['SATIS', 'DEVIR'].includes(
          r.movement_type
        )
      ) {

        debit = amount;

        debitTotal += amount;

        balance += amount;
      }


      /* TAHSİLAT = ÖDEME */

      else if (
        r.movement_type === 'TAHSILAT'
      ) {

        payment = amount;

        paymentTotal += amount;

        balance -= amount;
      }


      /* İADE = ALACAK */

      else if (
        r.movement_type === 'IADE'
      ) {

        credit = amount;

        creditTotal += amount;

        balance -= amount;
      }


      return {
        ...r,

        amount,

        payment,

        debit,

        credit,

        balance
      };

    });


    res.json({
      customer: chk.rows[0],

      transactions,

      totals: {
        payment: paymentTotal,
        debit: debitTotal,
        credit: creditTotal,
        balance
      }
    });

  } catch (e) {
    next(e);
  }
});


/* =========================
   YENİ CARİ İŞLEM
========================= */

router.post('/transactions', async (req, res, next) => {
  try {

    const {
      customer_id,
      transaction_date,
      due_date,
      movement_type,
      description,
      document_no,
      amount
    } = req.body;


    if (
      !customer_id ||
      !transaction_date ||
      !movement_type ||
      amount === undefined ||
      amount === null ||
      amount === ''
    ) {
      return res.status(400).json({
        error:
          'Müşteri, tarih, hareket ve tutar zorunludur.'
      });
    }


    const numericAmount = Number(amount);


    if (
      !Number.isFinite(numericAmount) ||
      numericAmount < 0
    ) {
      return res.status(400).json({
        error:
          'Tutar 0 veya daha büyük olmalıdır.'
      });
    }


    if (
      ![
        'SATIS',
        'TAHSILAT',
        'DEVIR',
        'IADE'
      ].includes(movement_type)
    ) {
      return res.status(400).json({
        error: 'Geçersiz hareket.'
      });
    }


    const customerCheck =
      await pool.query(
        `
        SELECT id
        FROM customers
        WHERE
          id = $1
          AND company_id = $2
        `,
        [
          customer_id,
          req.auth.company_id
        ]
      );


    if (!customerCheck.rows[0]) {
      return res.status(404).json({
        error: 'Müşteri bulunamadı.'
      });
    }


    const { rows } = await pool.query(
      `
      INSERT INTO current_account_transactions
      (
        company_id,
        customer_id,
        transaction_date,
        due_date,
        movement_type,
        description,
        document_no,
        amount
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
      `,
      [
        req.auth.company_id,
        customer_id,
        transaction_date,
        due_date || null,
        movement_type,
        description?.trim() || null,
        document_no?.trim() || null,
        numericAmount
      ]
    );


    res.status(201).json(rows[0]);

  } catch (e) {
    next(e);
  }
});


/* =========================
   CARİ İŞLEM DÜZENLE
========================= */

router.put('/transactions/:id', async (req, res, next) => {
  try {

    const {
      customer_id,
      transaction_date,
      due_date,
      movement_type,
      description,
      document_no,
      amount
    } = req.body;


    if (
      !customer_id ||
      !transaction_date ||
      !movement_type ||
      amount === undefined ||
      amount === null ||
      amount === ''
    ) {
      return res.status(400).json({
        error:
          'Müşteri, tarih, hareket ve tutar zorunludur.'
      });
    }


    const numericAmount = Number(amount);


    if (
      !Number.isFinite(numericAmount) ||
      numericAmount < 0
    ) {
      return res.status(400).json({
        error:
          'Tutar 0 veya daha büyük olmalıdır.'
      });
    }


    if (
      ![
        'SATIS',
        'TAHSILAT',
        'DEVIR',
        'IADE'
      ].includes(movement_type)
    ) {
      return res.status(400).json({
        error: 'Geçersiz hareket.'
      });
    }


    const customerCheck =
      await pool.query(
        `
        SELECT id
        FROM customers
        WHERE
          id = $1
          AND company_id = $2
        `,
        [
          customer_id,
          req.auth.company_id
        ]
      );


    if (!customerCheck.rows[0]) {
      return res.status(404).json({
        error: 'Müşteri bulunamadı.'
      });
    }


    const { rows } = await pool.query(
      `
      UPDATE current_account_transactions
      SET
        customer_id = $1,
        transaction_date = $2,
        due_date = $3,
        movement_type = $4,
        description = $5,
        document_no = $6,
        amount = $7
      WHERE
        id = $8
        AND company_id = $9
      RETURNING *
      `,
      [
        customer_id,
        transaction_date,
        due_date || null,
        movement_type,
        description?.trim() || null,
        document_no?.trim() || null,
        numericAmount,
        req.params.id,
        req.auth.company_id
      ]
    );


    if (!rows[0]) {
      return res.status(404).json({
        error: 'İşlem bulunamadı.'
      });
    }


    res.json(rows[0]);

  } catch (e) {
    next(e);
  }
});


/* =========================
   CARİ İŞLEM SİL
========================= */

router.delete('/transactions/:id', async (req, res, next) => {
  try {

    const { rowCount } = await pool.query(
      `
      DELETE FROM current_account_transactions
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
        error: 'İşlem bulunamadı.'
      });
    }


    res.json({
      ok: true,
      message: 'İşlem silindi.'
    });

  } catch (e) {
    next(e);
  }
});


module.exports = router;