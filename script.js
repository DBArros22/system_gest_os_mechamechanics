// ==========================================
// BANCO DE DADOS LOCAL & DADOS INICIAIS (SEED)
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyBc-m8z_4s9ntQ_vgvpqxX_XdpSbGUiXJc",
    authDomain: "system-gestos-mcmotos.firebaseapp.com",
    projectId: "system-gestos-mcmotos",
    storageBucket: "system-gestos-mcmotos.firebasestorage.app",
    messagingSenderId: "775485221125",
    appId: "1:775485221125:web:2b8ef6e909d7f93983af6c",
    measurementId: "G-57LCNLEFC6"
  };

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const firestore = firebase.firestore();

// Estado em memória alimentado 100% pelo Firebase (sem dados chumbados)
let db = {
  products: [],
  orders: [],
  exits: []
};

let currentOSParts = [];
let selectedPartForOS = null;

// ==========================================
// 2. FORMATAÇÃO E MÁSCARAS DE INPUTS
// ==========================================
function maskCurrency(input) {
  let value = input.value.replace(/\D/g, '');
  if (!value) value = '0';
  const floatVal = parseInt(value, 10) / 100;
  input.value = floatVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseCurrency(formattedStr) {
  if (!formattedStr) return 0;
  const clean = formattedStr.replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

function formatBRL(val) {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function maskPlate(input) {
  let val = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (val.length > 3) {
    val = val.slice(0, 3) + '-' + val.slice(3, 7);
  }
  input.value = val;
}

function getTodayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now - offset).toISOString().split('T')[0];
}

// ==========================================
// 3. AUTENTICAÇÃO (LOGIN & LOGOUT)
// ==========================================
auth.onAuthStateChanged(user => {
  const loginOverlay = document.getElementById('login-overlay');
  const appContainer = document.getElementById('app-container');

  if (user) {
    loginOverlay.classList.add('hidden');
    appContainer.classList.remove('hidden');
    document.getElementById('dash-month').value = getTodayISO().slice(0, 7);
    initRealtimeSync();
  } else {
    loginOverlay.classList.remove('hidden');
    appContainer.classList.add('hidden');
  }
});

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  const msg = document.getElementById('login-msg');
  const btn = document.getElementById('btn-login');

  msg.textContent = '';
  btn.textContent = 'Entrando...';
  btn.disabled = true;

  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (err) {
    msg.textContent = 'E-mail ou senha inválidos. Verifique seus dados.';
  } finally {
    btn.textContent = 'Acessar Painel';
    btn.disabled = false;
  }
}

function handleLogout() {
  auth.signOut();
}

// ==========================================
// 4. SINCRONIZAÇÃO EM TEMPO REAL (FIRESTORE)
// ==========================================
function initRealtimeSync() {
  // Escuta Estoque
  firestore.collection('products').orderBy('code').onSnapshot(snap => {
    db.products = snap.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
    refreshAllViews();
  });

  // Escuta Ordens de Serviço
  firestore.collection('orders').orderBy('createdAt', 'desc').onSnapshot(snap => {
    db.orders = snap.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
    refreshAllViews();
  });

  // Escuta Saídas e Ocorrências
  firestore.collection('exits').orderBy('createdAt', 'desc').onSnapshot(snap => {
    db.exits = snap.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
    refreshAllViews();
  });
}

function navigate(viewId, btnElement) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`view-${viewId}`).classList.add('active');
  if (btnElement) btnElement.classList.add('active');
  refreshAllViews();
}

function refreshAllViews() {
  renderDashboard();
  renderStock();
  renderSelectOptions();
  renderOSHistory();
  renderExitsHistory();
  renderRanking();
}

// ==========================================
// 5. ESTOQUE & ENTRADAS (FIREBASE)
// ==========================================
async function registerProduct(e) {
  e.preventDefault();
  const nextNum = db.products.length + 1;
  const code = `PEC-${String(nextNum).padStart(3, '0')}`;

  const newProd = {
    code,
    name: document.getElementById('prod-nome').value.trim(),
    cost: parseCurrency(document.getElementById('prod-custo').value),
    price: parseCurrency(document.getElementById('prod-venda').value),
    qty: parseInt(document.getElementById('prod-qtd').value, 10),
    min: parseInt(document.getElementById('prod-min').value, 10),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await firestore.collection('products').add(newProd);
    e.target.reset();
    document.getElementById('prod-custo').value = 'R$ 0,00';
    document.getElementById('prod-venda').value = 'R$ 0,00';
    alert(`Peça cadastrada no banco com código: ${code}`);
  } catch (err) {
    alert('Erro ao salvar peça: ' + err.message);
  }
}

async function registerStockEntry(e) {
  e.preventDefault();
  const docId = document.getElementById('entry-prod-select').value;
  const qty = parseInt(document.getElementById('entry-qty').value, 10);
  const newCost = parseCurrency(document.getElementById('entry-cost').value);

  if (!docId) return;

  const updateData = {
    qty: firebase.firestore.FieldValue.increment(qty)
  };
  if (newCost > 0) {
    updateData.cost = newCost;
  }

  try {
    await firestore.collection('products').doc(docId).update(updateData);
    e.target.reset();
    alert('Entrada de estoque registrada com sucesso!');
  } catch (err) {
    alert('Erro ao atualizar estoque: ' + err.message);
  }
}

function renderStock(filterText = '') {
  const tbody = document.getElementById('stock-table-body');
  tbody.innerHTML = '';

  const filtered = db.products.filter(p =>
    p.name.toLowerCase().includes(filterText.toLowerCase()) ||
    p.code.toLowerCase().includes(filterText.toLowerCase())
  );

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhuma peça cadastrada no estoque.</td></tr>';
    return;
  }

  filtered.forEach(p => {
    const isLow = p.qty <= p.min;
    tbody.innerHTML += `
      <tr>
        <td><strong>${p.code}</strong></td>
        <td>${p.name}</td>
        <td>${formatBRL(p.cost)}</td>
        <td>${formatBRL(p.price)}</td>
        <td><strong>${p.qty}</strong></td>
        <td><span class="badge ${isLow ? 'badge-low' : 'badge-ok'}">${isLow ? 'Estoque Baixo' : 'Normal'}</span></td>
      </tr>
    `;
  });
}

function filterStockTable() {
  const val = document.getElementById('stock-search-input').value;
  const list = document.getElementById('stock-suggestions');
  renderStock(val);

  if (!val.trim()) {
    list.classList.add('hidden');
    return;
  }

  const matches = db.products.filter(p =>
    p.name.toLowerCase().includes(val.toLowerCase()) ||
    p.code.toLowerCase().includes(val.toLowerCase())
  );

  if (matches.length > 0) {
    list.innerHTML = matches.map(m => `
      <li onclick="selectStockSuggestion('${m.code}')">
        <span><strong>${m.code}</strong> - ${m.name}</span>
        <span>Saldo: ${m.qty}</span>
      </li>
    `).join('');
    list.classList.remove('hidden');
  } else {
    list.classList.add('hidden');
  }
}

function selectStockSuggestion(code) {
  document.getElementById('stock-search-input').value = code;
  document.getElementById('stock-suggestions').classList.add('hidden');
  renderStock(code);
}

function renderSelectOptions() {
  const optionsHTML = db.products.map(p =>
    `<option value="${p.docId}">${p.code} - ${p.name} (Saldo: ${p.qty})</option>`
  ).join('');

  document.getElementById('entry-prod-select').innerHTML = optionsHTML || '<option value="">Cadastre uma peça primeiro</option>';
  document.getElementById('exit-prod-select').innerHTML = `<option value="">-- Nenhuma peça (apenas financeiro) --</option>` + optionsHTML;
}

// ==========================================
// 6. ORDEM DE SERVIÇO (OS) COM BAIXA AUTOMÁTICA
// ==========================================
function suggestOSParts() {
  const val = document.getElementById('os-part-search').value.trim().toLowerCase();
  const list = document.getElementById('os-suggestions');
  selectedPartForOS = null;

  if (!val) {
    list.classList.add('hidden');
    return;
  }

  const matches = db.products.filter(p =>
    p.name.toLowerCase().includes(val) || p.code.toLowerCase().includes(val)
  );

  if (matches.length > 0) {
    list.innerHTML = matches.map(p => `
      <li onclick="pickOSPart('${p.docId}')">
        <span><strong>${p.code}</strong> - ${p.name}</span>
        <span>${formatBRL(p.price)} (${p.qty} disp.)</span>
      </li>
    `).join('');
    list.classList.remove('hidden');
  } else {
    list.classList.add('hidden');
  }
}

function pickOSPart(docId) {
  const prod = db.products.find(p => p.docId === docId);
  if (!prod) return;
  selectedPartForOS = prod;
  document.getElementById('os-part-search').value = `${prod.code} - ${prod.name}`;
  document.getElementById('os-suggestions').classList.add('hidden');
}

function addPartToOS() {
  const searchVal = document.getElementById('os-part-search').value.trim().toLowerCase();
  const qty = parseInt(document.getElementById('os-part-qty').value, 10);

  const prod = selectedPartForOS || db.products.find(p =>
    p.code.toLowerCase() === searchVal || p.name.toLowerCase() === searchVal
  );

  if (!prod) {
    alert('Selecione uma peça válida da lista de sugestões.');
    return;
  }

  const alreadyAdded = currentOSParts.find(item => item.docId === prod.docId);
  const totalRequested = (alreadyAdded ? alreadyAdded.qty : 0) + qty;

  if (totalRequested > prod.qty) {
    alert(`Estoque insuficiente! Saldo disponível: ${prod.qty}`);
    return;
  }

  if (alreadyAdded) {
    alreadyAdded.qty += qty;
  } else {
    currentOSParts.push({
      docId: prod.docId,
      code: prod.code,
      name: prod.name,
      qty: qty,
      price: prod.price,
      cost: prod.cost
    });
  }

  document.getElementById('os-part-search').value = '';
  document.getElementById('os-part-qty').value = 1;
  selectedPartForOS = null;
  renderSelectedOSParts();
}

function removeOSPart(index) {
  currentOSParts.splice(index, 1);
  renderSelectedOSParts();
}

function renderSelectedOSParts() {
  const ul = document.getElementById('os-selected-parts');
  ul.innerHTML = currentOSParts.map((item, idx) => `
    <li>
      <span>${item.qty}x <strong>${item.code}</strong> ${item.name}</span>
      <span>
        ${formatBRL(item.price * item.qty)}
        <button type="button" onclick="removeOSPart(${idx})" style="margin-left:8px; color:red; border:none; background:none; cursor:pointer;">✕</button>
      </span>
    </li>
  `).join('');
  updateOSTotal();
}

function updateOSTotal() {
  const labor = parseCurrency(document.getElementById('os-mao-obra').value);
  const partsTotal = currentOSParts.reduce((acc, item) => acc + (item.price * item.qty), 0);
  document.getElementById('os-total-display').textContent = formatBRL(labor + partsTotal);
}

async function finalizeOS() {
  const client = document.getElementById('os-cliente').value.trim();
  const modeloAno = document.getElementById('os-modelo-ano').value.trim();
  const placa = document.getElementById('os-placa').value.trim();
  const serviceDesc = document.getElementById('os-servico-desc').value.trim();
  const labor = parseCurrency(document.getElementById('os-mao-obra').value);

  if (!client || !serviceDesc) {
    alert('Preencha pelo menos o nome do cliente e o serviço executado.');
    return;
  }

  const btn = document.getElementById('btn-finalize-os');
  btn.disabled = true;
  btn.textContent = 'Processando OS e Baixa no Estoque...';

  try {
    const batch = firestore.batch();

    // 1. Subtrai automaticamente cada peça vendida na OS do estoque no Firestore
    currentOSParts.forEach(item => {
      const prodRef = firestore.collection('products').doc(item.docId);
      batch.update(prodRef, {
        qty: firebase.firestore.FieldValue.increment(-item.qty)
      });
    });

    // 2. Calcula valores recebidos e custos
    const partsRevenue = currentOSParts.reduce((acc, i) => acc + (i.price * i.qty), 0);
    const partsCost = currentOSParts.reduce((acc, i) => acc + (i.cost * i.qty), 0);

    const newOSRef = firestore.collection('orders').doc();
    const osData = {
      code: `OS-${String(db.orders.length + 1).padStart(3, '0')}`,
      date: getTodayISO(),
      client,
      modeloAno: modeloAno || 'Não informado',
      placa: placa || 'Sem placa',
      serviceDesc,
      labor,
      parts: currentOSParts.map(({ docId, ...rest }) => rest),
      totalRevenue: labor + partsRevenue,
      totalCost: partsCost,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    batch.set(newOSRef, osData);
    await batch.commit();

    // Limpa formulário
    document.getElementById('os-cliente').value = '';
    document.getElementById('os-modelo-ano').value = '';
    document.getElementById('os-placa').value = '';
    document.getElementById('os-servico-desc').value = '';
    document.getElementById('os-mao-obra').value = 'R$ 0,00';
    currentOSParts = [];
    renderSelectedOSParts();

    openPrintOS(newOSRef.id);
  } catch (err) {
    alert('Erro ao finalizar Ordem de Serviço: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Finalizar OS & Dar Baixa no Estoque';
  }
}

function renderOSHistory() {
  const tbody = document.getElementById('os-history-body');
  if (db.orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhuma OS registrada ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = db.orders.map(os => `
    <tr>
      <td><strong>${os.code}</strong></td>
      <td>${os.date.split('-').reverse().join('/')}</td>
      <td>${os.client}<br><small style="color:#64748b">${os.modeloAno} • ${os.placa}</small></td>
      <td><strong>${formatBRL(os.totalRevenue)}</strong></td>
      <td><button onclick="openPrintOS('${os.docId}')" class="btn-secondary">📄 Ver / PDF</button></td>
    </tr>
  `).join('');
}

function openPrintOS(docId) {
  const os = db.orders.find(o => o.docId === docId);
  if (!os) return;

  const partsRows = (os.parts || []).map(p => `
    <tr>
      <td>${p.code}</td>
      <td>${p.name}</td>
      <td>${p.qty}</td>
      <td>${formatBRL(p.price)}</td>
      <td>${formatBRL(p.price * p.qty)}</td>
    </tr>
  `).join('');

  document.getElementById('os-printable-area').innerHTML = `
    <div class="os-sheet-header">
      <div>
        <h2>MC MOTOS</h2>
        <p>Oficina Mecânica Especializada & Peças</p>
      </div>
      <div style="text-align:right;">
        <strong>ORDEM DE SERVIÇO: ${os.code}</strong><br>
        <span>Data: ${os.date.split('-').reverse().join('/')}</span>
      </div>
    </div>
    <p><strong>Cliente:</strong> ${os.client}</p>
    <p><strong>Moto / Ano:</strong> ${os.modeloAno} | <strong>Placa:</strong> ${os.placa}</p>
    <p style="margin: 10px 0;"><strong>Serviço Executado:</strong> ${os.serviceDesc}</p>
    <table style="margin-top:15px;">
      <thead>
        <tr>
          <th>Cód.</th>
          <th>Peça / Item</th>
          <th>Qtd</th>
          <th>Unit.</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${partsRows || '<tr><td colspan="5">Nenhuma peça substituída</td></tr>'}
        <tr>
          <td colspan="4"><strong>Mão de Obra / Serviços</strong></td>
          <td><strong>${formatBRL(os.labor)}</strong></td>
        </tr>
      </tbody>
    </table>
    <div style="text-align:right; margin-top:20px; font-size:1.2rem;">
      <strong>TOTAL GERAL: ${formatBRL(os.totalRevenue)}</strong>
    </div>
    <div style="margin-top:40px; border-top:1px solid #000; width:250px; text-align:center; font-size:0.8rem;">
      Assinatura do Cliente / Responsável
    </div>
  `;

  document.getElementById('os-print-modal').classList.remove('hidden');
}

function closePrintModal() {
  document.getElementById('os-print-modal').classList.add('hidden');
}

// ==========================================
// 7. SAÍDAS & OCORRÊNCIAS ATÍPICAS (FIREBASE)
// ==========================================
function toggleExitFields() {
  const type = document.getElementById('exit-type').value;
  document.getElementById('exit-extra-cost-group').style.display =
    type === 'ressarcimento' ? 'block' : 'none';
}

async function registerStockExit(e) {
  e.preventDefault();
  const type = document.getElementById('exit-type').value;
  const prodDocId = document.getElementById('exit-prod-select').value;
  const qty = parseInt(document.getElementById('exit-qty').value, 10);
  const extraCost = parseCurrency(document.getElementById('exit-extra-cost').value);
  const obs = document.getElementById('exit-obs').value.trim();

  let prodCode = '-';
  let prodName = 'Ocorrência Financeira';
  let revenue = 0;
  let cost = extraCost;

  try {
    const batch = firestore.batch();

    if (prodDocId) {
      const prod = db.products.find(p => p.docId === prodDocId);
      if (!prod || prod.qty < qty) {
        alert('Estoque insuficiente para esta saída!');
        return;
      }

      const prodRef = firestore.collection('products').doc(prodDocId);
      batch.update(prodRef, {
        qty: firebase.firestore.FieldValue.increment(-qty)
      });

      prodCode = prod.code;
      prodName = prod.name;

      if (type === 'venda') {
        revenue = prod.price * qty;
        cost = prod.cost * qty;
      } else {
        cost += prod.cost * qty;
      }
    }

    const exitRef = firestore.collection('exits').doc();
    batch.set(exitRef, {
      date: getTodayISO(),
      type,
      prodCode,
      prodName,
      qty: prodDocId ? qty : 0,
      revenue,
      cost,
      obs,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
    e.target.reset();
    document.getElementById('exit-extra-cost').value = 'R$ 0,00';
    toggleExitFields();
    alert('Movimentação registrada com sucesso!');
  } catch (err) {
    alert('Erro ao registrar saída: ' + err.message);
  }
}

function renderExitsHistory() {
  const labels = {
    venda: '<span class="badge badge-ok">Venda Avulsa</span>',
    insumo: '<span class="badge badge-warn">Insumo</span>',
    avaria: '<span class="badge badge-low">Avaria</span>',
    ressarcimento: '<span class="badge badge-low">Ressarcimento</span>'
  };

  const tbody = document.getElementById('exits-history-body');
  if (db.exits.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhuma saída registrada.</td></tr>';
    return;
  }

  tbody.innerHTML = db.exits.map(ex => `
    <tr>
      <td>${ex.date.split('-').reverse().join('/')}</td>
      <td>${labels[ex.type]}</td>
      <td><strong>${ex.prodName}</strong><br><small>${ex.obs}</small></td>
      <td>${ex.qty || '-'}</td>
      <td class="${ex.revenue > 0 ? 'text-success' : 'text-danger'}">
        ${ex.revenue > 0 ? '+' + formatBRL(ex.revenue) : '-' + formatBRL(ex.cost)}
      </td>
    </tr>
  `).join('');
}

// ==========================================
// 8. FECHAMENTO QUINZENAL & MARGEM
// ==========================================
function renderDashboard() {
  const monthVal = document.getElementById('dash-month').value;
  const period = document.getElementById('dash-period').value;

  if (!monthVal) return;

  const filterByPeriod = (dateStr) => {
    if (!dateStr || !dateStr.startsWith(monthVal)) return false;
    const day = parseInt(dateStr.split('-')[2], 10);
    if (period === 'q1') return day <= 15;
    if (period === 'q2') return day >= 16;
    return true;
  };

  const filteredOS = db.orders.filter(o => filterByPeriod(o.date));
  const filteredExits = db.exits.filter(e => filterByPeriod(e.date));

  let totalRevenue = 0;
  let totalCost = 0;
  const dailyMap = {};

  const ensureDay = (d) => {
    if (!dailyMap[d]) dailyMap[d] = { count: 0, rev: 0, cost: 0 };
  };

  filteredOS.forEach(o => {
    totalRevenue += o.totalRevenue;
    totalCost += o.totalCost;
    ensureDay(o.date);
    dailyMap[o.date].count++;
    dailyMap[o.date].rev += o.totalRevenue;
    dailyMap[o.date].cost += o.totalCost;
  });

  filteredExits.forEach(ex => {
    totalRevenue += ex.revenue;
    totalCost += ex.cost;
    ensureDay(ex.date);
    if (ex.revenue > 0) dailyMap[ex.date].count++;
    dailyMap[ex.date].rev += ex.revenue;
    dailyMap[ex.date].cost += ex.cost;
  });

  const profit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : 0;

  document.getElementById('kpi-faturamento').textContent = formatBRL(totalRevenue);
  document.getElementById('kpi-custos').textContent = formatBRL(totalCost);
  document.getElementById('kpi-lucro').textContent = formatBRL(profit);
  document.getElementById('kpi-margem').textContent = `${margin}%`;

  const daysSorted = Object.keys(dailyMap).sort().reverse();
  document.getElementById('daily-breakdown-body').innerHTML = daysSorted.map(day => {
    const d = dailyMap[day];
    const dProfit = d.rev - d.cost;
    const dMargin = d.rev > 0 ? ((dProfit / d.rev) * 100).toFixed(1) : 0;
    return `
      <tr>
        <td><strong>${day.split('-').reverse().join('/')}</strong></td>
        <td>${d.count}</td>
        <td>${formatBRL(d.rev)}</td>
        <td class="text-danger">${formatBRL(d.cost)}</td>
        <td class="text-success"><strong>${formatBRL(dProfit)}</strong></td>
        <td>${dMargin}%</td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="6">Nenhuma movimentação neste período.</td></tr>';
}

// ==========================================
// 9. RANKING DE VENDAS & FILTRO DE DATA
// ==========================================
function clearRankDate() {
  document.getElementById('rank-date-filter').value = '';
  renderRanking();
}

function renderRanking() {
  const dateFilter = document.getElementById('rank-date-filter').value;
  const dayTotals = {};
  const prodTotals = {};

  const addProdStat = (code, name, qty, rev) => {
    if (!prodTotals[code]) prodTotals[code] = { code, name, qty: 0, rev: 0 };
    prodTotals[code].qty += qty;
    prodTotals[code].rev += rev;
  };

  db.orders.forEach(o => {
    if (dateFilter && o.date !== dateFilter) return;
    dayTotals[o.date] = (dayTotals[o.date] || 0) + o.totalRevenue;
    (o.parts || []).forEach(p => addProdStat(p.code, p.name, p.qty, p.price * p.qty));
  });

  db.exits.forEach(ex => {
    if (ex.type !== 'venda') return;
    if (dateFilter && ex.date !== dateFilter) return;
    dayTotals[ex.date] = (dayTotals[ex.date] || 0) + ex.revenue;
    addProdStat(ex.prodCode, ex.prodName, ex.qty, ex.revenue);
  });

  const rankedDays = Object.entries(dayTotals).sort((a, b) => b[1] - a[1]);
  document.getElementById('rank-days-body').innerHTML = rankedDays.map(([date, val], idx) => `
    <tr>
      <td><strong>#${idx + 1}</strong></td>
      <td>${date.split('-').reverse().join('/')}</td>
      <td class="text-success"><strong>${formatBRL(val)}</strong></td>
    </tr>
  `).join('') || '<tr><td colspan="3">Sem dados para a data selecionada.</td></tr>';

  const rankedProds = Object.values(prodTotals).sort((a, b) => b.qty - a.qty);
  document.getElementById('rank-products-body').innerHTML = rankedProds.map(p => `
    <tr>
      <td><strong>${p.code}</strong></td>
      <td>${p.name}</td>
      <td>${p.qty} un.</td>
      <td>${formatBRL(p.rev)}</td>
    </tr>
  `).join('') || '<tr><td colspan="4">Nenhuma peça vendida no filtro.</td></tr>';
}