require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
const { iniciarBanco } = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_troque',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/produtos', require('./src/routes/produtos'));
app.use('/api/pedidos', require('./src/routes/pedidos'));
app.use('/api/pix', require('./src/routes/pix'));
app.use('/api/admin', require('./src/routes/admin'));

iniciarBanco()
  .then(() => {
    app.listen(PORT, () => console.log('SEVENTEEN CHEATS rodando na porta ' + PORT));
  })
  .catch(err => {
    console.error('Erro ao iniciar banco:', err);
    process.exit(1);
  });
