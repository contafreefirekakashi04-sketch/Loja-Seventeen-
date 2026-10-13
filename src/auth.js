function logado(req, res, next) {
  if (!req.session || !req.session.usuarioId) {
    return res.status(401).json({ erro: 'nao autenticado' });
  }
  next();
}

function admin(req, res, next) {
  if (!req.session || !req.session.usuarioId) {
    return res.status(401).json({ erro: 'nao autenticado' });
  }
  if (!req.session.isAdmin) {
    return res.status(403).json({ erro: 'sem permissao' });
  }
  next();
}

module.exports = { logado, admin };
