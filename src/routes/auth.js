const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { requireAuth } = require('../middlewareAuth');

const router = express.Router();

/* ==================================================
   JWT
================================================== */

function sign(user) {
  return jwt.sign(
    {
      user_id: user.id,
      company_id: user.company_id,
      email: user.email
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );
}

/* ==================================================
   REGISTER
================================================== */

router.post('/register', async (req, res, next) => {

  const client = await pool.connect();

  try {

    const body = req.body || {};

    /*
     * full_name öncelikli.
     * name gönderilirse onu da kabul ediyoruz.
     */
    const fullName =
      String(
        body.full_name ??
        body.name ??
        ''
      ).trim();

    const email =
      String(
        body.email ?? ''
      ).trim().toLowerCase();

    const password =
      String(
        body.password ?? ''
      );

    const company =
      body.company || {};

    const companyName =
      String(
        company.company_name ?? ''
      ).trim();

    const taxNumber =
      String(
        company.tax_number ?? ''
      ).trim();

    const phone =
      String(
        company.phone ?? ''
      ).trim();

    const companyEmail =
      String(
        company.email ?? ''
      ).trim();

    const address =
      String(
        company.address ?? ''
      ).trim();

    const logoUrl =
      company.logo_url
        ? String(company.logo_url)
        : null;

    /* ==================================================
       KONTROLLER
    ================================================== */

    if (
      !fullName ||
      !email ||
      !password ||
      !companyName
    ) {
      return res.status(400).json({
        error:
          'Ad soyad, e-posta, şifre ve firma adı zorunludur.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error:
          'Şifre en az 6 karakter olmalıdır.'
      });
    }

    /* E-posta kontrolü */

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error:
          'Geçerli bir e-posta adresi girin.'
      });
    }

    /* ==================================================
       TRANSACTION
    ================================================== */

    await client.query('BEGIN');

    /* ==================================================
       AYNI E-POSTA VAR MI?
    ================================================== */

    const existingUser =
      await client.query(
        `
        SELECT id
        FROM users
        WHERE lower(email) = lower($1)
        LIMIT 1
        `,
        [email]
      );

    if (existingUser.rowCount > 0) {

      await client.query('ROLLBACK');

      return res.status(409).json({
        error:
          'Bu e-posta zaten kayıtlı.'
      });
    }

    /* ==================================================
       ŞİRKET OLUŞTUR
    ================================================== */

    const companyResult =
      await client.query(
        `
        INSERT INTO companies (
          company_name,
          tax_number,
          phone,
          email,
          address,
          logo_url
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6
        )
        RETURNING
          id,
          company_name,
          tax_number,
          phone,
          email,
          address,
          logo_url
        `,
        [
          companyName,
          taxNumber || null,
          phone || null,
          companyEmail || null,
          address || null,
          logoUrl
        ]
      );

    const companyRow =
      companyResult.rows[0];

    /* ==================================================
       ŞİFRE
    ================================================== */

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );

    /* ==================================================
       KULLANICI OLUŞTUR
    ================================================== */

    const userResult =
      await client.query(
        `
        INSERT INTO users (
          company_id,
          full_name,
          email,
          password_hash
        )
        VALUES (
          $1,
          $2,
          $3,
          $4
        )
        RETURNING
          id,
          company_id,
          full_name,
          email
        `,
        [
          companyRow.id,
          fullName,
          email,
          passwordHash
        ]
      );

    const user =
      userResult.rows[0];

    /* ==================================================
       COMMIT
    ================================================== */

    await client.query('COMMIT');

    /* ==================================================
       TOKEN
    ================================================== */

    const token =
      sign(user);

    /* ==================================================
       RESPONSE
    ================================================== */

    return res.status(201).json({
      token,

      user,

      company: companyRow
    });

  } catch (error) {

    await client
      .query('ROLLBACK')
      .catch(() => {});

    console.error(
      'Kayıt hatası:',
      error
    );

    next(error);

  } finally {

    client.release();
  }
});

/* ==================================================
   LOGIN
================================================== */

router.post(
  '/login',
  async (req, res, next) => {

    try {

      const email =
        String(
          req.body?.email ?? ''
        ).trim().toLowerCase();

      const password =
        String(
          req.body?.password ?? ''
        );

      if (
        !email ||
        !password
      ) {
        return res.status(400).json({
          error:
            'E-posta ve şifre zorunludur.'
        });
      }

      const result =
        await pool.query(
          `
          SELECT
            u.id,
            u.company_id,
            u.full_name,
            u.email,
            u.password_hash,

            c.company_name,
            c.tax_number,
            c.phone,
            c.email AS company_email,
            c.address,
            c.logo_url

          FROM users u

          JOIN companies c
            ON c.id = u.company_id

          WHERE lower(u.email) = lower($1)

          LIMIT 1
          `,
          [email]
        );

      const user =
        result.rows[0];

      if (
        !user ||
        !(await bcrypt.compare(
          password,
          user.password_hash
        ))
      ) {
        return res.status(401).json({
          error:
            'E-posta veya şifre hatalı.'
        });
      }

      const token =
        sign(user);

      return res.json({

        token,

        user: {
          id: user.id,
          company_id: user.company_id,
          full_name: user.full_name,
          email: user.email
        },

        company: {
          id: user.company_id,
          company_name: user.company_name,
          tax_number: user.tax_number,
          phone: user.phone,
          email: user.company_email,
          address: user.address,
          logo_url: user.logo_url
        }

      });

    } catch (error) {

      next(error);

    }
  }
);

/* ==================================================
   ME
================================================== */

router.get(
  '/me',
  requireAuth,
  async (req, res, next) => {

    try {

      const result =
        await pool.query(
          `
          SELECT
            u.id,
            u.company_id,
            u.full_name,
            u.email,

            c.company_name,
            c.tax_number,
            c.phone,
            c.email AS company_email,
            c.address,
            c.logo_url

          FROM users u

          JOIN companies c
            ON c.id = u.company_id

          WHERE
            u.id = $1
            AND u.company_id = $2

          LIMIT 1
          `,
          [
            req.auth.user_id,
            req.auth.company_id
          ]
        );

      if (!result.rows[0]) {

        return res.status(404).json({
          error:
            'Kullanıcı bulunamadı.'
        });
      }

      const row =
        result.rows[0];

      return res.json({

        user: {
          id: row.id,
          company_id: row.company_id,
          full_name: row.full_name,
          email: row.email
        },

        company: {
          id: row.company_id,
          company_name: row.company_name,
          tax_number: row.tax_number,
          phone: row.phone,
          email: row.company_email,
          address: row.address,
          logo_url: row.logo_url
        }

      });

    } catch (error) {

      next(error);

    }
  }
);

module.exports = router;