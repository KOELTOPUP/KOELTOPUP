CREATE TABLE IF NOT EXISTS orders (
  code TEXT PRIMARY KEY,
  g TEXT NOT NULL,
  gname TEXT NOT NULL,
  uid TEXT NOT NULL,
  srv TEXT NOT NULL,
  item TEXT NOT NULL,
  price INTEGER NOT NULL,
  pay TEXT NOT NULL,
  wa TEXT NOT NULL,
  sender TEXT,
  st TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  hist TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_st ON orders(st, created_at DESC);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'ok'
);
