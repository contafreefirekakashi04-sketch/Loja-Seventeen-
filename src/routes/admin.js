const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { admin } = require('../auth');
const { liberarPedido } = require('./pix');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'public', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

async function log(adminId, acao, detalhe) {
  try {
    await pool.query(
      'INSERT INTO logs_admin (admin_id, acao, detalhe) VALUES ($1, $2, $3)',
      [adminId, acao, detalhe || null]
    );
  } catch (e) {}
}

router.get('/produtos', admin, async (req, res) => {
  const r = await pool.query('SELECT * FROM produtos ORDER BY id DESC');
  res.json(r.rows);
});

router.post('/produtos', admin, upload.single('imagem'), async (req, res) => {
  try {
    const { nome, descricao, tipo_entrega, conteudo_entrega,
            preco_diario, preco_semanal, preco_mensal, ativo } = req.body;
    const imagem = req.file ? '/uploads/' + req.file.filename : null;
    const r = await pool.query(
      'INSERT INTO produtos (nome, descricao, imagem, tipo_entrega, conteudo_entrega, preco_diario, preco_semanal, preco_mensal, ativo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [nome, descricao, imagem, tipo_entrega || 'link', conteudo_entrega,
       Number(preco_diario) || 0, Number(preco_semanal) || 0,
       Number(preco_mensal) || 0, ativo == '1' || ativo === true ? 1 : 0]
    );
    await log(req.session.usuarioId, 'criar_produto', nome);
    res.json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'erro ao criar' });
  }
});

router.put('/produtos/:id', admin, upload.single('imagem'), async (req, res) => {
  try {
    const { nome, descricao, tipo_entrega, conteudo_entrega,
            preco_diario, preco_semanal, preco_mensal, ativo } = req.body;
    const campos = {
      nome, descricao, tipo_entrega, conteudo_entrega,
      preco_diario: Number(preco_diario) || 0,
      preco_semanal: Number(preco_semanal) || 0,
      preco_mensal: Number(preco_mensal) || 0,
      ativo: ativo == '1' || ativo === true ? 1 : 0
    };
    if (req.file) campos.imagem = '/uploads/' + req.file.filename;
    const keys = Object.keys(campos);
    const sets = keys.map((k, i) => k + ' = $' + (i + 1)).join(', ');
    const values = keys.map(k => campos[k]);
    values.push(req.params.id);
    await pool.query('UPDATE produtos SET ' + sets + ' WHERE id = $' + values.length, values);
    await log(req.session.usuarioId, 'editar_produto', req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'erro ao editar' });
  }
});

router.delete('/produtos/:id', admin, async (req, res) => {
  await pool.query('UPDATE produtos SET ativo = 0 WHERE id = $1', [req.params.id]);
  await log(req.session.usuarioId, 'desativar_produto', req.params.id);
  res.json({ ok: true });
});

router.get('/pedidos', admin, async (req, res) => {
  const r = await pool.query(
    'SELECT p.*, u.nome AS usuario_nome, u.email AS usuario_email, pr.nome AS produto_nome FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id JOIN produtos pr ON pr.id = p.produto_id ORDER BY p.id DESC LIMIT 200'
  );
  res.json(r.rows);
});

router.post('/pedidos/:id/liberar', admin, async (req, res) => {
  await liberarPedido(Number(req.params.id));
  await log(req.session.usuarioId, 'liberar_pedido', req.params.id);
  res.json({ ok: true });
});

router.post('/pedidos/:id/cancelar', admin, async (req, res) => {
  await pool.query("UPDATE pedidos SET status = 'cancelado' WHERE id = $1", [req.params.id]);
  await log(req.session.usuarioId, 'cancelar_pedido', req.params.id);
  res.json({ ok: true });
});

router.get('/usuarios', admin, async (req, res) => {
  const r = await pool.query('SELECT id, nome, email, is_admin, criado_em FROM usuarios ORDER BY id DESC');
  res.json(r.rows);
});

router.get('/config', admin, async (req, res) => {
  const r = await pool.query('SELECT * FROM config');
  const obj = {};
  r.rows.forEach(x => obj[x.chave] = x.valor);
  res.json(obj);
});

router.post('/config', admin, async (req, res) => {
  for (const [k, v] of Object.entries(req.body)) {
    await pool.query(
      'INSERT INTO config (chave, valor) VALUES ($1, $2) ON CONFLICT (chave) DO UPDATE SET valor = $2',
      [k, String(v)]
    );
  }
  await log(req.session.usuarioId, 'editar_config', 'ok');
  res.json({ ok: true });
});

router.get('/logs', admin, async (req, res) => {
  const r = await pool.query(
    'SELECT l.*, u.nome AS admin_nome FROM logs_admin l LEFT JOIN usuarios u ON u.id = l.admin_id ORDER BY l.id DESC LIMIT 200'
  );
  res.json(r.rows);
});

module.exports = router;
