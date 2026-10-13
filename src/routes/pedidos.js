const express = require('express');
const { pool } = require('../db');
const { logado } = require('../auth');

const router = express.Router();

router.post('/', logado, async (req, res) => {
  try {
    const { produto_id, plano, metodo } = req.body;
    if (!['diario', 'semanal', 'mensal'].includes(plano))
      return res.status(400).json({ erro: 'plano invalido' });
    if (!['pix_manual', 'mercadopago'].includes(metodo))
      return res.status(400).json({ erro: 'metodo invalido' });

    const p = await pool.query('SELECT * FROM produtos WHERE id = $1 AND ativo = 1', [produto_id]);
    if (p.rows.length === 0) return res.status(404).json({ erro: 'produto nao encontrado' });
    const produto = p.rows[0];

    const valor = Number(produto['preco_' + plano]);
    if (!valor || valor <= 0) return res.status(400).json({ erro: 'plano sem preco' });

    const r = await pool.query(
      'INSERT INTO pedidos (usuario_id, produto_id, plano, valor, metodo) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.session.usuarioId, produto_id, plano, valor, metodo]
    );

    res.json({ ok: true, pedido_id: r.rows[0].id, valor });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'erro ao criar pedido' });
  }
});

router.get('/meus', logado, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT p.*, pr.nome AS produto_nome, pr.imagem FROM pedidos p JOIN produtos pr ON pr.id = p.produto_id WHERE p.usuario_id = $1 ORDER BY p.id DESC',
      [req.session.usuarioId]
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ erro: 'erro' });
  }
});

router.get('/acessos', logado, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT a.*, pr.nome AS produto_nome, pr.imagem, pr.conteudo_entrega FROM acessos a JOIN produtos pr ON pr.id = a.produto_id WHERE a.usuario_id = $1 AND a.expira_em > NOW() ORDER BY a.id DESC',
      [req.session.usuarioId]
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ erro: 'erro' });
  }
});

module.exports = router;
