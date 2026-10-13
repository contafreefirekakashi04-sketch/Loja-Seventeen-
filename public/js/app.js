async function api(url, opts){
  opts = opts || {};
  const r = await fetch(url, Object.assign({headers:{'Content-Type':'application/json'},credentials:'same-origin'}, opts));
  const d = await r.json().catch(function(){return {}});
  if(!r.ok) throw new Error(d.erro || 'erro');
  return d;
}
function fmt(v){ return 'R$ ' + Number(v).toFixed(2).replace('.', ','); }

async function renderNav(){
  const nav = document.getElementById('nav');
  if(!nav) return;
  const eu = await fetch('/api/auth/eu').then(function(r){return r.json()});
  let html = '<a href="/">Loja</a>';
  if(eu.logado){
    html += '<a href="/conta.html">Minha conta</a>';
    if(eu.is_admin) html += '<a href="/admin.html" style="color:var(--vermelho2);font-weight:600">Admin</a>';
    html += '<button onclick="logout()">Sair</button>';
  } else {
    html += '<a href="/login.html">Entrar</a>';
    html += '<a href="/cadastro.html" class="btn" style="padding:6px 12px">Criar conta</a>';
  }
  nav.innerHTML = html;
}
async function logout(){ await fetch('/api/auth/logout',{method:'POST'}); location.href='/'; }

async function carregarProdutos(){
  const box = document.getElementById('produtos');
  if(!box) return;
  const lista = await api('/api/produtos');
  if(!lista.length){ box.innerHTML = '<p class="sub">Nenhum produto disponivel ainda.</p>'; return; }
  const svg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='150'%3E%3Crect fill='%23161616' width='300' height='150'/%3E%3C/svg%3E";
  box.innerHTML = lista.map(function(p){
    const min = Math.min(p.preco_diario||9999, p.preco_semanal||9999, p.preco_mensal||9999);
    return '<a class="card" href="/produto.html?id='+p.id+'">' +
      '<img src="'+(p.imagem||svg)+'">' +
      '<div class="corpo"><h3>'+p.nome+'</h3>' +
      '<p>'+(p.descricao||'').substring(0,70)+'</p>' +
      '<div class="preco">a partir de '+fmt(min)+'</div></div></a>';
  }).join('');
}

let produtoAtual = null, planoEscolhido = null;
async function carregarProduto(id){
  const box = document.getElementById('conteudo');
  try {
    const p = await api('/api/produtos/'+id);
    produtoAtual = p;
    box.innerHTML =
      '<h1>'+p.nome+'</h1>' +
      '<p class="sub">'+(p.descricao||'')+'</p>' +
      (p.imagem ? '<img src="'+p.imagem+'" style="max-width:100%;border-radius:10px;margin-bottom:20px">' : '') +
      '<h2>Escolha o plano</h2>' +
      '<div class="planos" id="planos"></div>' +
      '<button class="btn full" id="comprar" disabled>Selecione um plano</button>' +
      '<div id="msg"></div>';
    const planos = [
      {id:'diario', nome:'Diario', valor:p.preco_diario},
      {id:'semanal', nome:'Semanal', valor:p.preco_semanal},
      {id:'mensal', nome:'Mensal', valor:p.preco_mensal}
    ].filter(function(x){return Number(x.valor) > 0});
    document.getElementById('planos').innerHTML = planos.map(function(pl){
      return '<div class="plano" data-id="'+pl.id+'" data-valor="'+pl.valor+'"><div class="nome">'+pl.nome+'</div><div class="valor">'+fmt(pl.valor)+'</div></div>';
    }).join('');
    document.querySelectorAll('.plano').forEach(function(el){
      el.onclick = function(){
        document.querySelectorAll('.plano').forEach(function(x){x.classList.remove('sel')});
        el.classList.add('sel');
        planoEscolhido = {id:el.dataset.id, valor:Number(el.dataset.valor)};
        const b = document.getElementById('comprar');
        b.disabled = false;
        b.textContent = 'Comprar ' + planoEscolhido.id + ' - ' + fmt(planoEscolhido.valor);
      };
    });
    document.getElementById('comprar').onclick = async function(){
      const eu = await fetch('/api/auth/eu').then(function(r){return r.json()});
      if(!eu.logado){ location.href='/login.html'; return; }
      try {
        const r = await api('/api/pedidos', {method:'POST', body:JSON.stringify({produto_id:p.id, plano:planoEscolhido.id, metodo:'pix_manual'})});
        location.href = '/checkout.html?pedido=' + r.pedido_id;
      } catch(e){
        document.getElementById('msg').innerHTML = '<div class="msg erro">'+e.message+'</div>';
      }
    };
  } catch(e){
    box.innerHTML = '<div class="msg erro">'+e.message+'</div>';
  }
}

async function iniciarCheckout(){
  const box = document.getElementById('checkout');
  const pedidoId = new URLSearchParams(location.search).get('pedido');
  if(!pedidoId){ box.innerHTML = '<div class="msg erro">pedido invalido</div>'; return; }
  box.innerHTML = '<p class="sub">Aguardando geracao do Pix...</p><div id="pix"></div>';
  try {
    const res = await fetch('/api/pix/gerar/'+pedidoId, {method:'POST', credentials:'same-origin'});
    const r = await res.json();
    if(!res.ok) throw new Error(r.erro);
    document.getElementById('pix').innerHTML =
      '<div class="qrbox"><img src="'+r.qr+'"></div>' +
      '<p class="sub">Ou copie o codigo Pix abaixo e cole no app do seu banco:</p>' +
      '<div class="copia" id="copia">'+r.payload+'</div>' +
      '<button class="btn" onclick="copiarPix()">Copiar codigo Pix</button>' +
      '<div class="aviso"><b>Apos pagar</b>, seu acesso e liberado pela nossa equipe (Pix manual) em ate alguns minutos. Voce recebe o link do Discord na sua conta.</div>' +
      '<p class="sub" style="margin-top:16px"><a href="/conta.html">Ir para minha conta &rarr;</a></p>';
  } catch(e){
    box.innerHTML = '<div class="msg erro">'+e.message+'</div>';
  }
}
function copiarPix(){
  const t = document.getElementById('copia').innerText;
  navigator.clipboard.writeText(t).then(function(){alert('Codigo Pix copiado!')});
}

async function carregarConta(){
  const eu = await fetch('/api/auth/eu').then(function(r){return r.json()});
  if(!eu.logado){ location.href='/login.html'; return; }
  document.getElementById('saudacao').innerText = 'Logado como ' + eu.nome + ' (' + eu.email + ')';
  const acessos = await api('/api/pedidos/acessos');
  const boxA = document.getElementById('acessos');
  if(!acessos.length){
    boxA.innerHTML = '<p class="sub">Voce ainda nao tem acessos ativos.</p>';
  } else {
    boxA.innerHTML = acessos.map(function(a){
      return '<div class="card" style="margin-bottom:12px"><div class="corpo"><h3>'+a.produto_nome+'</h3>' +
        '<p class="sub">Expira em '+new Date(a.expira_em).toLocaleString('pt-BR')+'</p>' +
        (a.conteudo_entrega ? '<div class="copia">'+a.conteudo_entrega+'</div>' : '') +
        '</div></div>';
    }).join('');
  }
  const pedidos = await api('/api/pedidos/meus');
  const boxP = document.getElementById('pedidos');
  if(!pedidos.length){
    boxP.innerHTML = '<p class="sub">Nenhuma compra ainda.</p>';
  } else {
    boxP.innerHTML = '<table class="tabela"><thead><tr><th>Produto</th><th>Plano</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>' +
      pedidos.map(function(p){
        return '<tr><td>'+p.produto_nome+'</td><td>'+p.plano+'</td><td>'+fmt(p.valor)+'</td>' +
          '<td><span class="badge '+p.status+'">'+p.status+'</span></td>' +
          '<td>'+(p.status==='pendente' ? '<a href="/checkout.html?pedido='+p.id+'">pagar</a>' : '')+'</td></tr>';
      }).join('') + '</tbody></table>';
  }
}
