const express = require('express');
const { pool } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, nome, descricao, imagem, preco_diario, preco_semanal, preco_mensal FROM produtos WHERE ativo = 1 ORDER BY id DESC'
    );
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'erro ao listar' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, nome, descricao, imagem, preco_diario, preco_semanal, preco_mensal FROM produtos WHERE id = $1 AND ativo = 1',
      [req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ erro: 'produto nao encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ erro: 'erro' });
  }
});

module.exports = router;
