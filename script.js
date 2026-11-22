// ==========================================
// BANCO DE DADOS LOCAL & DADOS INICIAIS (SEED)
// ==========================================
const DB_KEY = 'mcmotos_tinydesk_db_v1';

const defaultData = {
  config: {
    expiryDate: '2026-12-31', // Data inicial de validade do SaaS
    masterKey: 'MCMOTOS-PRO'
  },
  products: [
    { id: 1, code: 'PEC-001', name: 'Óleo Mobil Super Moto 4T 20W50 1L', cost: 24.00, price: 42.00, qty: 18, min: 5 },
    { id: 2, code: 'PEC-002', name: 'Kit Relação Honda CG 160 Titan/Fan', cost: 78.00, price: 145.00, qty: 6, min: 2 },
    { id: 3, code: 'PEC-003', name: 'Pastilha de Freio Dianteira Cobreq', cost: 19.50, price: 45.00, qty: 10, min: 3 },
    { id: 4, code: 'PEC-004', name: 'Vela de Ignição NGK CPR8EA-9', cost: 18.00, price: 35.00, qty: 12, min: 4 },
    { id: 5, code: 'PEC-005', name: 'Câmara de Ar Aro 18 Pirelli', cost: 26.00, price: 50.00, qty: 8, min: 3 },
    { id: 6, code: 'PEC-006', name: 'Filtro de Óleo Yamaha Fazer 250', cost: 15.00, price: 32.00, qty: 9, min: 3 },
    { id: 6, code: 'PEC-007', name: 'Kit relação Honda CG 125 FAN 2009 - 2013', cost: 15.00, price: 60, qty: 9, min: 3 }
  ],
  orders: [
    {
      id: 1,
      code: 'OS-001',
      date: getTodayISO(),
      client: 'Carlos Eduardo',
      moto: 'Honda CG 160 Fan - BRA2E19',
      serviceDesc: 'Troca de óleo e kit relação completo',
      labor: 60.00,
      parts: [
        { code: 'PEC-001', name: 'Óleo Mobil Super Moto 4T 20W50 1L', qty: 1, price: 42.00, cost: 24.00 },
        { code: 'PEC-002', name: 'Kit Relação Honda CG 160 Titan/Fan', qty: 1, price: 145.00, cost: 78.00 }
      ],
      totalRevenue: 247.00,
      totalCost: 102.00
    }
  ],
  exits: [
    {
      id: 1,
      date: getTodayISO(),
      type: 'venda',
      prodCode: 'PEC-004',
      prodName: 'Vela de Ignição NGK CPR8EA-9',
      qty: 1,
      revenue: 35.00,
      cost: 18.00,
      obs: 'Venda direta no balcão'
    }
  ]
};

let db = JSON.parse(localStorage.getItem(DB_KEY)) || defaultData;
let currentOSParts = [];
let selectedPartForOS = null;
let devClicks = 0;

function saveDB() {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function getTodayISO() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function formatBRL(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}


function exportBackup() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `backup_mcmotos_${getTodayISO()}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

// ==========================================
// NAVEGAÇÃO SPA
// ==========================================
function navigate(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`view-${viewId}`).classList.add('active');
  event.currentTarget.classList.add('active');
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
// 1. ESTOQUE & ENTRADAS AUTOMÁTICAS
// ==========================================
function registerProduct(e) {
  e.preventDefault();
  const nextNum = db.products.length + 1;
  const code = `PEC-${String(nextNum).padStart(3, '0')}`;

  const newProd = {
    id: Date.now(),
    code,
    name: document.getElementById('prod-nome').value.trim(),
    cost: parseFloat(document.getElementById('prod-custo').value),
    price: parseFloat(document.getElementById('prod-venda').value),
    qty: parseInt(document.getElementById('prod-qtd').value),
    min: parseInt(document.getElementById('prod-min').value)
  };

  db.products.push(newProd);
  saveDB();
  e.target.reset();
  refreshAllViews();
  alert(`Peça cadastrada com código interno: ${code}`);
}

function registerStockEntry(e) {
  e.preventDefault();
  const prodId = parseInt(document.getElementById('entry-prod-select').value);
  const qty = parseInt(document.getElementById('entry-qty').value);
  const newCost = parseFloat(document.getElementById('entry-cost').value);

  const prod = db.products.find(p => p.id === prodId);
  if (!prod) return;

  prod.qty += qty;
  if (!isNaN(newCost) && newCost > 0) {
    prod.cost = newCost;
  }

  saveDB();
  e.target.reset();
  refreshAllViews();
  alert(`Entrada registrada! Novo saldo de ${prod.name}: ${prod.qty} un.`);
}

function renderStock(filterText = '') {
  const tbody = document.getElementById('stock-table-body');
  tbody.innerHTML = '';

  const filtered = db.products.filter(p =>
    p.name.toLowerCase().includes(filterText.toLowerCase()) ||
    p.code.toLowerCase().includes(filterText.toLowerCase())
  );

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
    `<option value="${p.id}">${p.code} - ${p.name} (Saldo: ${p.qty})</option>`
  ).join('');

  document.getElementById('entry-prod-select').innerHTML = optionsHTML;
  document.getElementById('exit-prod-select').innerHTML = `<option value="">-- Nenhuma peça (apenas financeiro) --</option>` + optionsHTML;
}

// ==========================================
// 2. ORDEM DE SERVIÇO (OS)
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
      <li onclick="pickOSPart(${p.id})">
        <span><strong>${p.code}</strong> - ${p.name}</span>
        <span>${formatBRL(p.price)} (${p.qty} disp.)</span>
      </li>
    `).join('');
    list.classList.remove('hidden');
  } else {
    list.classList.add('hidden');
  }
}

function pickOSPart(id) {
  const prod = db.products.find(p => p.id === id);
  if (!prod) return;
  selectedPartForOS = prod;
  document.getElementById('os-part-search').value = `${prod.code} - ${prod.name}`;
  document.getElementById('os-suggestions').classList.add('hidden');
}

function addPartToOS() {
  const searchVal = document.getElementById('os-part-search').value.trim().toLowerCase();
  const qty = parseInt(document.getElementById('os-part-qty').value);

  const prod = selectedPartForOS || db.products.find(p =>
    p.code.toLowerCase() === searchVal || p.name.toLowerCase() === searchVal
  );

  if (!prod) {
    alert('Selecione uma peça válida da lista de sugestões.');
    return;
  }
  if (qty > prod.qty) {
    alert(`Estoque insuficiente! Saldo atual: ${prod.qty}`);
    return;
  }

  const existing = currentOSParts.find(item => item.code === prod.code);
  if (existing) {
    existing.qty += qty;
  } else {
    currentOSParts.push({
      id: prod.id,
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
  const labor = parseFloat(document.getElementById('os-mao-obra').value) || 0;
  const partsTotal = currentOSParts.reduce((acc, item) => acc + (item.price * item.qty), 0);
  document.getElementById('os-total-display').textContent = formatBRL(labor + partsTotal);
}

function finalizeOS() {
  const client = document.getElementById('os-cliente').value.trim();
  const moto = document.getElementById('os-moto').value.trim();
  const serviceDesc = document.getElementById('os-servico-desc').value.trim();
  const labor = parseFloat(document.getElementById('os-mao-obra').value) || 0;

  if (!client || !serviceDesc) {
    alert('Preencha pelo menos o nome do cliente e o serviço realizado.');
    return;
  }

  // Baixa automática no estoque
  currentOSParts.forEach(item => {
    const prod = db.products.find(p => p.code === item.code);
    if (prod) prod.qty -= item.qty;
  });

  const partsRevenue = currentOSParts.reduce((acc, i) => acc + (i.price * i.qty), 0);
  const partsCost = currentOSParts.reduce((acc, i) => acc + (i.cost * i.qty), 0);

  const newOS = {
    id: Date.now(),
    code: `OS-${String(db.orders.length + 1).padStart(3, '0')}`,
    date: getTodayISO(),
    client,
    moto,
    serviceDesc,
    labor,
    parts: [...currentOSParts],
    totalRevenue: labor + partsRevenue,
    totalCost: partsCost
  };

  db.orders.unshift(newOS);
  saveDB();

  // Limpa formulário
  document.getElementById('os-cliente').value = '';
  document.getElementById('os-moto').value = '';
  document.getElementById('os-servico-desc').value = '';
  document.getElementById('os-mao-obra').value = 0;
  currentOSParts = [];
  renderSelectedOSParts();
  refreshAllViews();
  openPrintOS(newOS.id);
}

function renderOSHistory() {
  const tbody = document.getElementById('os-history-body');
  tbody.innerHTML = db.orders.map(os => `
    <tr>
      <td><strong>${os.code}</strong></td>
      <td>${os.date.split('-').reverse().join('/')}</td>
      <td>${os.client}<br><small style="color:#64748b">${os.moto}</small></td>
      <td><strong>${formatBRL(os.totalRevenue)}</strong></td>
      <td><button onclick="openPrintOS(${os.id})" class="btn-secondary">📄 Ver / PDF</button></td>
    </tr>
  `).join('');
}

function openPrintOS(id) {
  const os = db.orders.find(o => o.id === id);
  if (!os) return;

  const partsRows = os.parts.map(p => `
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
    <p><strong>Cliente:</strong> ${os.client} | <strong>Veículo:</strong> ${os.moto}</p>
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
// 3. SAÍDAS & OCORRÊNCIAS ATÍPICAS
// ==========================================
function toggleExitFields() {
  const type = document.getElementById('exit-type').value;
  document.getElementById('exit-extra-cost-group').style.display =
    type === 'ressarcimento' ? 'block' : 'none';
}

function registerStockExit(e) {
  e.preventDefault();
  const type = document.getElementById('exit-type').value;
  const prodId = parseInt(document.getElementById('exit-prod-select').value);
  const qty = parseInt(document.getElementById('exit-qty').value);
  const extraCost = parseFloat(document.getElementById('exit-extra-cost').value) || 0;
  const obs = document.getElementById('exit-obs').value.trim();

  let prodCode = '-';
  let prodName = 'Ocorrência Financeira';
  let revenue = 0;
  let cost = extraCost;

  if (prodId) {
    const prod = db.products.find(p => p.id === prodId);
    if (!prod || prod.qty < qty) {
      alert('Estoque insuficiente para esta saída!');
      return;
    }
    prod.qty -= qty;
    prodCode = prod.code;
    prodName = prod.name;

    if (type === 'venda') {
      revenue = prod.price * qty;
      cost = prod.cost * qty;
    } else {
      // Avaria, insumo ou ressarcimento: entra apenas como custo/prejuízo
      cost += prod.cost * qty;
    }
  }

  db.exits.unshift({
    id: Date.now(),
    date: getTodayISO(),
    type,
    prodCode,
    prodName,
    qty: prodId ? qty : 0,
    revenue,
    cost,
    obs
  });

  saveDB();
  e.target.reset();
  toggleExitFields();
  refreshAllViews();
  alert('Movimentação registrada com sucesso!');
}

function renderExitsHistory() {
  const labels = {
    venda: '<span class="badge badge-ok">Venda Avulsa</span>',
    insumo: '<span class="badge badge-warn">Insumo</span>',
    avaria: '<span class="badge badge-low">Avaria</span>',
    ressarcimento: '<span class="badge badge-low">Ressarcimento</span>'
  };

  document.getElementById('exits-history-body').innerHTML = db.exits.map(ex => `
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
// 4. FECHAMENTO QUINZENAL & MARGEM
// ==========================================
function renderDashboard() {
  const monthVal = document.getElementById('dash-month').value; // YYYY-MM
  const period = document.getElementById('dash-period').value; // q1, q2, all

  const filterByPeriod = (dateStr) => {
    if (!dateStr.startsWith(monthVal)) return false;
    const day = parseInt(dateStr.split('-')[2]);
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
// 5. RANKING DE VENDAS & FILTRO DE DATA
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
    o.parts.forEach(p => addProdStat(p.code, p.name, p.qty, p.price * p.qty));
  });

  db.exits.forEach(ex => {
    if (ex.type !== 'venda') return;
    if (dateFilter && ex.date !== dateFilter) return;
    dayTotals[ex.date] = (dayTotals[ex.date] || 0) + ex.revenue;
    addProdStat(ex.prodCode, ex.prodName, ex.qty, ex.revenue);
  });

  // Ranking Dias
  const rankedDays = Object.entries(dayTotals).sort((a, b) => b[1] - a[1]);
  document.getElementById('rank-days-body').innerHTML = rankedDays.map(([date, val], idx) => `
    <tr>
      <td><strong>#${idx + 1}</strong></td>
      <td>${date.split('-').reverse().join('/')}</td>
      <td class="text-success"><strong>${formatBRL(val)}</strong></td>
    </tr>
  `).join('') || '<tr><td colspan="3">Sem dados para a data selecionada.</td></tr>';

  // Ranking Produtos
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