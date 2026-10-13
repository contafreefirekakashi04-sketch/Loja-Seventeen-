(async function(){
  const eu = await fetch('/api/auth/eu').then(function(r){return r.json()});
  if(!eu.logado || !eu.is_admin){ location.href='/login.html'; return; }
  renderNav();

  document.querySelectorAll('.tab-btn').forEach(function(b){
    b.onclick = function(){
      document.querySelectorAll('.tab-panel').forEach(function(p){p.style.display='none'});
      document.getElementById('tab-'+b.dataset.tab).style.display='block';
      if(b.dataset.tab==='produtos') carregarProdutos();
      if(b.dataset.tab==='pedidos') carregarPedidos();
      if(b.dataset.tab==='config') carregarConfig();
      if(b.dataset.tab==='logs') carregarLogs();
      if(b.dataset.tab==='novo') resetForm();
    };
  });

  carregarProdutos();
})();

function resetForm(){
  document.getElementById('formProduto').reset();
  document.getElementById('produtoId').value = '';
  document.getElementById('tituloForm').innerText = 'Novo produto';
}

async function carregarProdutos(){
  const r = await fetch('/api/admin/produtos').then(function(x){return x.json()});
  const box = document.getElementById('listaProdutos');
  if(!r.length){ box.innerHTML = '<p class="sub">Nenhum produto.</p>'; return; }
  box.innerHTML = '<table class="tabela"><thead><tr><th>ID</th><th>Nome</th><th>Diario</th><th>Semanal</th><th>Mensal</th><th>Ativo</th><th></th></tr></thead><tbody>' +
    r.map(function(p){
      return '<tr><td>'+p.id+'</td><td>'+p.nome+'</td><td>'+p.preco_diario+'</td><td>'+p.preco_semanal+'</td><td>'+p.preco_mensal+'</td>' +
        '<td>'+(p.ativo?'Sim':'Nao')+'</td>' +
        '<td><button class="btn ghost" onclick=\'editarProduto('+JSON.stringify(p).replace(/'/g,"&#39;")+')\'>Editar</button> ' +
        '<button class="btn ghost" onclick="desativarProduto('+p.id+')">Desativar</button></td></tr>';
    }).join('') + '</tbody></table>';
}

function editarProduto(p){
  document.getElementById('produtoId').value = p.id;
  document.getElementById('tituloForm').innerText = 'Editar produto #' + p.id;
  const f = document.getElementById('formProduto');
  f.nome.value = p.nome || '';
  f.descricao.value = p.descricao || '';
  f.conteudo_entrega.value = p.conteudo_entrega || '';
  f.preco_diario.value = p.preco_diario || 0;
  f.preco_semanal.value = p.preco_semanal || 0;
  f.preco_mensal.value = p.preco_mensal || 0;
  f.ativo.value = p.ativo ? '1' : '0';
  document.querySelectorAll('.tab-panel').forEach(function(x){x.style.display='none'});
  document.getElementById('tab-novo').style.display = 'block';
}

async function desativarProduto(id){
  if(!confirm('Desativar produto #'+id+'?')) return;
  await fetch('/api/admin/produtos/'+id, {method:'DELETE'});
  carregarProdutos();
}

document.getElementById('formProduto').addEventListener('submit', async function(e){
  e.preventDefault();
  const id = document.getElementById('produtoId').value;
  const fd = new FormData(e.target);
  const url = id ? '/api/admin/produtos/'+id : '/api/admin/produtos';
  const method = id ? 'PUT' : 'POST';
  const r = await fetch(url, {method:method, body:fd});
  const d = await r.json();
  if(r.ok){
    document.getElementById('msgProduto').innerHTML = '<div class="msg ok">Salvo!</div>';
    resetForm();
    setTimeout(carregarProdutos, 800);
  } else {
    document.getElementById('msgProduto').innerHTML = '<div class="msg erro">'+(d.erro||'erro')+'</div>';
  }
});

async function carregarPedidos(){
  const r = await fetch('/api/admin/pedidos').then(function(x){return x.json()});
  const box = document.getElementById('listaPedidos');
  if(!r.length){ box.innerHTML = '<p class="sub">Nenhum pedido.</p>'; return; }
  box.innerHTML = '<table class="tabela"><thead><tr><th>ID</th><th>Usuario</th><th>Produto</th><th>Plano</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>' +
    r.map(function(p){
      const acoes = p.status==='pendente' ?
        '<button class="btn" onclick="liberar('+p.id+')">Liberar</button> <button class="btn ghost" onclick="cancelar('+p.id+')">Cancelar</button>' :
        '';
      return '<tr><td>'+p.id+'</td><td>'+p.usuario_email+'</td><td>'+p.produto_nome+'</td><td>'+p.plano+'</td>' +
        '<td>R$ '+Number(p.valor).toFixed(2)+'</td>' +
        '<td><span class="badge '+p.status+'">'+p.status+'</span></td>' +
        '<td>'+acoes+'</td></tr>';
    }).join('') + '</tbody></table>';
}

async function liberar(id){
  if(!confirm('Liberar acesso do pedido #'+id+'?')) return;
  await fetch('/api/admin/pedidos/'+id+'/liberar', {method:'POST'});
  carregarPedidos();
}
async function cancelar(id){
  if(!confirm('Cancelar pedido #'+id+'?')) return;
  await fetch('/api/admin/pedidos/'+id+'/cancelar', {method:'POST'});
  carregarPedidos();
}

async function carregarConfig(){
  const r = await fetch('/api/admin/config').then(function(x){return x.json()});
  document.getElementById('cfg_pix_chave').value = r.pix_chave || '';
  document.getElementById('cfg_pix_nome').value = r.pix_nome || '';
  document.getElementById('cfg_pix_cidade').value = r.pix_cidade || '';
}

document.getElementById('formConfig').addEventListener('submit', async function(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const body = {};
  f.forEach(function(v,k){body[k]=v});
  const r = await fetch('/api/admin/config', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  document.getElementById('msgConfig').innerHTML = r.ok ? '<div class="msg ok">Salvo</div>' : '<div class="msg erro">Erro</div>';
});

async function carregarLogs(){
  const r = await fetch('/api/admin/logs').then(function(x){return x.json()});
  const box = document.getElementById('listaLogs');
  if(!r.length){ box.innerHTML = '<p class="sub">Sem logs.</p>'; return; }
  box.innerHTML = '<table class="tabela"><thead><tr><th>Quando</th><th>Admin</th><th>Acao</th><th>Detalhe</th></tr></thead><tbody>' +
    r.map(function(l){
      return '<tr><td>'+new Date(l.criado_em).toLocaleString('pt-BR')+'</td><td>'+(l.admin_nome||'-')+'</td><td>'+l.acao+'</td><td>'+(l.detalhe||'-')+'</td></tr>';
    }).join('') + '</tbody></table>';
}
