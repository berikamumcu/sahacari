CREATE TABLE IF NOT EXISTS companies (
 id BIGSERIAL PRIMARY KEY, company_name VARCHAR(255) NOT NULL, tax_number VARCHAR(50), phone VARCHAR(50),
 email VARCHAR(255), address TEXT, logo_url TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS users (
 id BIGSERIAL PRIMARY KEY, company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 full_name VARCHAR(150) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS customers (
 id BIGSERIAL PRIMARY KEY, company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
 company_name VARCHAR(255) NOT NULL, tax_number VARCHAR(50), phone VARCHAR(50), email VARCHAR(255), address TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS current_account_transactions (
 id BIGSERIAL PRIMARY KEY, company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
 customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE, transaction_date DATE NOT NULL, due_date DATE,
 movement_type VARCHAR(20) NOT NULL CHECK(movement_type IN ('SATIS','TAHSILAT','DEVIR','IADE')),
 description TEXT, document_no VARCHAR(100), amount NUMERIC(14,2) NOT NULL CHECK(amount>=0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS field_jobs (
 id BIGSERIAL PRIMARY KEY, company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
 customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL, job_date DATE NOT NULL, location VARCHAR(255) NOT NULL,
 description TEXT, labor_fee NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(labor_fee>=0), total_fee NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(total_fee>=0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS field_job_materials (
 id BIGSERIAL PRIMARY KEY, company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
 field_job_id BIGINT NOT NULL REFERENCES field_jobs(id) ON DELETE CASCADE, material_name VARCHAR(255) NOT NULL,
 quantity NUMERIC(14,3) NOT NULL DEFAULT 1 CHECK(quantity>=0), unit VARCHAR(50), unit_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(unit_price>=0)
);

-- Upgrade older local databases created by the earlier prototype.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_id BIGINT;
ALTER TABLE current_account_transactions ADD COLUMN IF NOT EXISTS company_id BIGINT;
ALTER TABLE field_jobs ADD COLUMN IF NOT EXISTS company_id BIGINT;
ALTER TABLE field_job_materials ADD COLUMN IF NOT EXISTS company_id BIGINT;

DO $$
DECLARE c BIGINT;
BEGIN
  SELECT id INTO c FROM companies ORDER BY id LIMIT 1;
  IF c IS NULL THEN
    INSERT INTO companies(company_name) VALUES ('Yavuz Su Mekanik') RETURNING id INTO c;
  END IF;
  UPDATE customers SET company_id=c WHERE company_id IS NULL;
  UPDATE current_account_transactions t
    SET company_id = COALESCE(cu.company_id, c)
    FROM customers cu
    WHERE t.company_id IS NULL AND t.customer_id = cu.id;
  UPDATE current_account_transactions SET company_id=c WHERE company_id IS NULL;
  UPDATE field_jobs SET company_id=c WHERE company_id IS NULL;
  UPDATE field_job_materials m
    SET company_id=COALESCE(f.company_id,c)
    FROM field_jobs f
    WHERE m.field_job_id=f.id AND m.company_id IS NULL;
  UPDATE field_job_materials SET company_id=c WHERE company_id IS NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customers_company_fk') THEN
    ALTER TABLE customers ADD CONSTRAINT customers_company_fk FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cari_company_fk') THEN
    ALTER TABLE current_account_transactions ADD CONSTRAINT cari_company_fk FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='jobs_company_fk') THEN
    ALTER TABLE field_jobs ADD CONSTRAINT jobs_company_fk FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='job_materials_company_fk') THEN
    ALTER TABLE field_job_materials ADD CONSTRAINT job_materials_company_fk FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_cari_company_customer_date ON current_account_transactions(company_id,customer_id,transaction_date,id);
CREATE INDEX IF NOT EXISTS idx_jobs_company_date ON field_jobs(company_id,job_date);
