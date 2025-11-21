ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_txn_no VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_txn_no
  ON orders(payment_txn_no)
  WHERE payment_txn_no IS NOT NULL;
