const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon')
    ? { rejectUnauthorized: false }
    : false
});

async function iniciarBanco() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      criado_em TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS produtos (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      imagem TEXT,
      tipo_entrega TEXT DEFAULT 'link',
      conteudo_entrega TEXT,
      preco_diario NUMERIC DEFAULT 0,
      preco_semanal NUMERIC DEFAULT 0,
      preco_mensal NUMERIC DEFAULT 0,
      ativo INTEGER DEFAULT 1,
      criado_em TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pedidos (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      plano TEXT NOT NULL,
      valor NUMERIC NOT NULL,
      metodo TEXT NOT NULL,
      status TEXT DEFAULT 'pendente',
      mp_payment_id TEXT,
      pix_codigo TEXT,
      expira_em TIMESTAMP,
      criado_em TIMESTAMP DEFAULT NOW(),
      pago_em TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS acessos (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      pedido_id INTEGER NOT NULL,
      expira_em TIMESTAMP NOT NULL,
      criado_em TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS config (
      chave TEXT PRIMARY KEY,
      valor TEXT
    );
    CREATE TABLE IF NOT EXISTS cupons (
      id SERIAL PRIMARY KEY,
      codigo TEXT UNIQUE NOT NULL,
      desconto_pct INTEGER NOT NULL,
      usos_max INTEGER DEFAULT 0,
      usos INTEGER DEFAULT 0,
      ativo INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS logs_admin (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER,
      acao TEXT,
      detalhe TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    );
  `);

  // cria admin inicial se nao existir
  const bcrypt = require('bcryptjs');
  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_SENHA;
  if (email && senha) {
    const r = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (r.rows.length === 0) {
      const hash = await bcrypt.hash(senha, 12);
      await pool.query(
        'INSERT INTO usuarios (nome, email, senha_hash, is_admin) VALUES ($1, $2, $3, 1)',
        ['Admin', email, hash]
      );
      console.log('[db] admin criado:', email);
    }
  }
  console.log('[db] banco pronto');
}

module.exports = { pool, iniciarBanco };
