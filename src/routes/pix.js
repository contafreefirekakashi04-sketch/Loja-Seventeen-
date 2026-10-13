const express = require('express');
const QRCode = require('qrcode');
const { pool } = require('../db');
const { logado } = require('../auth');

const router = express.Router();

function montarPixPayload({ chave, nome, cidade, valor, txid }) {
  const campo = (id, val) => {
    const len = String(val.length).padStart(2, '0');
    return id + len + val;
  };
  const nomeLimpo = nome.substring(0, 25).toUpperCase();
  const cidadeLimpa = cidade.substring(0, 15).toUpperCase();
  const txidLimpo = (txid || '***').substring(0, 25);

  let payload =
    campo('00', '01') +
    campo('26', campo('00', 'BR.GOV.BCB.PIX') + campo('01', chave)) +
    campo('52', '0000') +
    campo('53', '986') +
    campo('54', Number(valor).toFixed(2)) +
    campo('58', 'BR') +
    campo('59', nomeLimpo) +
    campo('60', cidadeLimpa) +
    campo('62', campo('05', txidLimpo)) +
    '6304';

  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return payload + crc.toString(16).toUpperCase().padStart(4, '0');
}

router.post('/gerar/:pedidoId', logado, async (req, res) => {
  try {
    const p = await pool.query(
      'SELECT * FROM pedidos WHERE id = $1 AND usuario_id = $2',
      [req.params.pedidoId, req.session.usuarioId]
    );
    if (p.rows.length === 0) return res.status(404).json({ erro: 'pedido nao encontrado' });
    const pedido = p.rows[0];
    if (pedido.status !== 'pendente') return res.status(400).json({ erro: 'pedido ja processado' });

    if (pedido.metodo === 'pix_manual') {
      const payload = montarPixPayload({
        chave: process.env.PIX_CHAVE,
        nome: process.env.PIX_NOME,
        cidade: process.env.PIX_CIDADE,
        valor: pedido.valor,
        txid: 'PEDIDO' + pedido.id
      });
      const qr = await QRCode.toDataURL(payload);
      await pool.query('UPDATE pedidos SET pix_codigo = $1 WHERE id = $2', [payload, pedido.id]);
      return res.json({ tipo: 'manual', payload, qr });
    }

    if (!process.env.MP_ACCESS_TOKEN) {
      return res.status(400).json({ erro: 'mercadopago nao configurado' });
    }
    const { MercadoPagoConfig, Payment } = require('mercadopago');
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const payment = new Payment(client);
    const prod = await pool.query('SELECT nome FROM produtos WHERE id = $1', [pedido.produto_id]);

    const result = await payment.create({
      body: {
        transaction_amount: Number(pedido.valor),
        description: prod.rows[0].nome + ' - ' + pedido.plano,
        payment_method_id: 'pix',
        payer: { email: 'comprador@email.com' },
        external_reference: String(pedido.id)
      }
    });
    const td = result.point_of_interaction.transaction_data;
    await pool.query(
      'UPDATE pedidos SET mp_payment_id = $1, pix_codigo = $2 WHERE id = $3',
      [String(result.id), td.qr_code, pedido.id]
    );
    res.json({
      tipo: 'mercadopago',
      qr: 'data:image/png;base64,' + td.qr_code_base64,
      payload: td.qr_code,
      payment_id: result.id
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'erro ao gerar pix' });
  }
});

router.post('/webhook', express.json(), async (req, res) => {
  try {
    const { type, data } = req.body;
    if (type === 'payment' && data && data.id) {
      const { MercadoPagoConfig, Payment } = require('mercadopago');
      const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
      const payment = new Payment(client);
      const pag = await payment.get({ id: data.id });
      if (pag.status === 'approved' && pag.external_reference) {
        await liberarPedido(Number(pag.external_reference));
      }
    }
  } catch (e) {
    console.error(e);
  }
  res.sendStatus(200);
});

async function liberarPedido(pedidoId) {
  const p = await pool.query('SELECT * FROM pedidos WHERE id = $1', [pedidoId]);
  if (p.rows.length === 0) return;
  const pedido = p.rows[0];
  if (pedido.status === 'pago') return;

  const dias = { diario: 1, semanal: 7, mensal: 30 }[pedido.plano] || 1;
  await pool.query(
    "UPDATE pedidos SET status = 'pago', pago_em = NOW(), expira_em = NOW() + INTERVAL '" + dias + " days' WHERE id = $1",
    [pedidoId]
  );
  await pool.query(
    "INSERT INTO acessos (usuario_id, produto_id, pedido_id, expira_em) VALUES ($1, $2, $3, NOW() + INTERVAL '" + dias + " days')",
    [pedido.usuario_id, pedido.produto_id, pedidoId]
  );
}

module.exports = router;
module.exports.liberarPedido = liberarPedido;
