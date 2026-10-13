const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db');

const router = express.Router();

const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { erro: 'muitas tentativas, tente em 15 min' }
});

router.post('/cadastro', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ erro: 'preencha tudo' });
    if (senha.length < 6) return res.status(400).json({ erro: 'senha muito curta' });

    const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existe.rows.length > 0) return res.status(400).json({ erro: 'email ja cadastrado' });

    const hash = await bcrypt.hash(senha, 12);
    const r = await pool.query(
      'INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id',
      [nome, email, hash]
    );

    req.session.usuarioId = r.rows[0].id;
    req.session.isAdmin = 0;
    res.json({ ok: true, nome });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'erro no cadastro' });
  }
});

router.post('/login', limiteLogin, async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: 'preencha tudo' });

    const r = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (r.rows.length === 0) return res.status(401).json({ erro: 'credenciais invalidas' });

    const user = r.rows[0];
    const ok = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) return res.status(401).json({ erro: 'credenciais invalidas' });

    req.session.usuarioId = user.id;
    req.session.isAdmin = user.is_admin;
    res.json({ ok: true, nome: user.nome, isAdmin: !!user.is_admin });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'erro no login' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/eu', async (req, res) => {
  try {
    if (!req.session || !req.session.usuarioId) return res.json({ logado: false });
    const r = await pool.query(
      'SELECT id, nome, email, is_admin FROM usuarios WHERE id = $1',
      [req.session.usuarioId]
    );
    if (r.rows.length === 0) return res.json({ logado: false });
    res.json({ logado: true, ...r.rows[0] });
  } catch (e) {
    res.json({ logado: false });
  }
});

module.exports = router;
