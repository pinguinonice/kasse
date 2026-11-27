'use strict';

/* =========================================================
   Weihnachtsmarkt-Kasse – alles lokal im Browser (localStorage)
   ========================================================= */

const LS = { products: 'kasse.products.v1', sales: 'kasse.sales.v1', cart: 'kasse.cart.v1', startCash: 'kasse.startCash.v1' };

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const fmt = cents => eur.format((cents || 0) / 100);
const toCents = v => Math.round(parseFloat(String(v).replace(',', '.')) * 100);
const centsToInput = c => (c == null ? '' : (c / 100).toFixed(2).replace(/\.00$/, '').replace('.', ','));
const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = s => document.querySelector(s);

const DEFAULT_PRODUCTS = () => [
  {
    id: uid(), name: 'Kartoffelspirale', emoji: '🥔', color: '#e6a23c', price: 300, customPrice: false,
    options: [{ id: uid(), name: 'Ketchup', price: null }, { id: uid(), name: 'Mayo', price: null }, { id: uid(), name: 'Apfelmus', price: null }],
  },
  {
    id: uid(), name: 'Crêpes', emoji: '🥞', color: '#c8372d', price: 300, customPrice: false,
    options: [{ id: uid(), name: 'Käse', price: null }, { id: uid(), name: 'Käse-Schinken', price: 350 }, { id: uid(), name: 'Nutella', price: null }],
  },
  {
    id: uid(), name: 'Misteln', emoji: '🌿', color: '#2f8f57', price: 500, customPrice: true,
    options: [{ id: uid(), name: 'Klein', price: 300 }, { id: uid(), name: 'Mittel', price: 500 }, { id: uid(), name: 'Groß', price: 800 }],
  },
];

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { toast('⚠️ Speichern fehlgeschlagen'); }
}

const state = {
  products: load(LS.products, null) || DEFAULT_PRODUCTS(),
  sales: load(LS.sales, []),
  cart: load(LS.cart, []),
  startCash: load(LS.startCash, {}), // { 'YYYY-MM-DD': cents }
};
save(LS.products, state.products);

const saveProducts = () => save(LS.products, state.products);
const saveSales = () => save(LS.sales, state.sales);
const saveCart = () => save(LS.cart, state.cart);

/* ---------------- Toast ---------------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------------- Tabs ---------------- */
document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
function showView(name) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  if (name === 'kasse') renderGrid();
  if (name === 'stats') renderStats();
  if (name === 'products') renderEditor();
}

/* =========================================================
   KASSE
   ========================================================= */
function optPrice(p, o) { return o && o.price != null ? o.price : p.price; }

function cartQtyFor(productId, optionId) {
  return state.cart.filter(i => i.productId === productId && (optionId === undefined || i.optionId === optionId))
    .reduce((s, i) => s + i.qty, 0);
}

function renderGrid() {
  const grid = $('#productGrid');
  if (!state.products.length) {
    grid.innerHTML = '<div class="empty">Noch keine Produkte – unter „Produkte“ anlegen.</div>';
    return;
  }
  grid.innerHTML = state.products.map(p => {
    const opts = p.options || [];
    let buttons = '';
    if (!opts.length && !p.customPrice) {
      const q = cartQtyFor(p.id);
      buttons = `<button class="opt single" data-add="${p.id}">${esc(p.emoji)} ${esc(p.name)}<small>${fmt(p.price)}</small>${q ? `<span class="badge">${q}</span>` : ''}</button>`;
    } else {
      buttons = opts.map(o => {
        const q = cartQtyFor(p.id, o.id);
        return `<button class="opt" data-add="${p.id}" data-opt="${o.id}">${esc(o.name)}<small>${fmt(optPrice(p, o))}</small>${q ? `<span class="badge">${q}</span>` : ''}</button>`;
      }).join('');
      if (p.customPrice) buttons += `<button class="opt custom" data-custom="${p.id}">Freier<br>Preis</button>`;
    }
    const showPrice = opts.length && opts.every(o => o.price == null) ? fmt(p.price) : '';
    return `<div class="pcard" style="--accent:${esc(p.color)}">
      <div class="pcard-head"><span class="pcard-emoji">${esc(p.emoji)}</span><span class="pcard-name">${esc(p.name)}</span><span class="pcard-price">${showPrice}</span></div>
      <div class="opts">${buttons}</div>
    </div>`;
  }).join('');
}

$('#productGrid').addEventListener('click', e => {
  const add = e.target.closest('[data-add]');
  if (add) {
    const p = state.products.find(x => x.id === add.dataset.add);
    if (!p) return;
    const o = add.dataset.opt ? p.options.find(x => x.id === add.dataset.opt) : null;
    addToCart(p, o, optPrice(p, o));
    add.classList.remove('flash'); void add.offsetWidth; add.classList.add('flash');
    return;
  }
  const custom = e.target.closest('[data-custom]');
  if (custom) {
    const p = state.products.find(x => x.id === custom.dataset.custom);
    if (!p) return;
    openAmount(`${p.emoji} ${p.name} – Preis`, cents => addToCart(p, { id: 'custom', name: 'Freier Preis' }, cents));
  }
});

function addToCart(p, o, price) {
  const key = `${p.id}|${o ? o.id : ''}|${price}`;
  const existing = state.cart.find(i => i.key === key);
  if (existing) existing.qty++;
  else state.cart.push({ key, productId: p.id, optionId: o ? o.id : null, name: p.name, emoji: p.emoji, option: o ? o.name : '', price, qty: 1 });
  saveCart();
  renderCart();
  renderGrid();
}

function cartTotal() { return state.cart.reduce((s, i) => s + i.price * i.qty, 0); }

function renderCart() {
  const list = $('#cartList');
  if (!state.cart.length) {
    list.innerHTML = '<li class="cart-empty">Produkt antippen zum Hinzufügen</li>';
  } else {
    list.innerHTML = state.cart.map((i, idx) => `
      <li class="citem">
        <div class="citem-left">
          <span class="citem-name">${esc(i.emoji)} ${esc(i.name)}</span>
          <span class="citem-opt">${esc(i.option)}${i.option ? ' · ' : ''}${fmt(i.price)} · <b>${fmt(i.price * i.qty)}</b></span>
        </div>
        <div class="qty">
          <button data-dec="${idx}" aria-label="weniger">−</button>
          <span>${i.qty}</span>
          <button data-inc="${idx}" aria-label="mehr">+</button>
        </div>
      </li>`).join('');
  }
  const total = cartTotal();
  $('#cartTotal').textContent = fmt(total);
  $('#payBtn').disabled = !state.cart.length;
  $('#payBtn').textContent = state.cart.length ? `Kassieren ${fmt(total)}` : 'Kassieren';
}

$('#cartList').addEventListener('click', e => {
  const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]');
  if (inc) state.cart[+inc.dataset.inc].qty++;
  else if (dec) {
    const i = +dec.dataset.dec;
    if (--state.cart[i].qty <= 0) state.cart.splice(i, 1);
  } else return;
  saveCart(); renderCart(); renderGrid();
});

$('#clearCart').addEventListener('click', () => {
  if (!state.cart.length) return;
  state.cart = []; saveCart(); renderCart(); renderGrid();
});

/* ---------------- Numpad ---------------- */
function makeNumpad(padEl, displayEl, onChange) {
  let str = '';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'];
  padEl.innerHTML = keys.map(k => `<button data-k="${k}">${k}</button>`).join('');
  const value = () => (str ? Math.round(parseFloat(str.replace(',', '.') || '0') * 100) || 0 : 0);
  const update = () => { displayEl.textContent = str ? `${str} €` : '0,00 €'; onChange && onChange(value()); };
  padEl.addEventListener('click', e => {
    const k = e.target.closest('[data-k]')?.dataset.k;
    if (!k) return;
    if (k === '⌫') str = str.slice(0, -1);
    else if (k === ',') { if (!str.includes(',')) str = (str || '0') + ','; }
    else {
      const dec = str.split(',')[1];
      if (dec !== undefined && dec.length >= 2) return;
      if (str === '0') str = '';
      if (str.replace(',', '').length >= 6) return;
      str += k;
    }
    update();
  });
  return { value, reset() { str = ''; update(); } };
}

/* ---------------- Freier Preis ---------------- */
let amountCb = null;
const amountPad = makeNumpad($('#amountPad'), $('#amountDisplay'));
function openAmount(title, cb) {
  $('#amountTitle').textContent = title;
  amountCb = cb; amountPad.reset();
  $('#amountModal').hidden = false;
}
$('#amountOk').addEventListener('click', () => {
  const v = amountPad.value();
  if (v <= 0) { toast('Bitte Betrag eingeben'); return; }
  $('#amountModal').hidden = true;
  amountCb && amountCb(v);
});

/* ---------------- Kassieren ---------------- */
const givenPad = makeNumpad($('#givenPad'), $('#givenDisplay'), v => {
  const total = cartTotal();
  const el = $('#changePreview');
  if (!v) el.innerHTML = '';
  else if (v < total) el.innerHTML = `Es fehlen <b>${fmt(total - v)}</b>`;
  else el.innerHTML = `Rückgeld <b>${fmt(v - total)}</b>`;
});

function quickAmounts(total) {
  const notes = [500, 1000, 2000, 5000, 10000];
  const set = new Set();
  // nächste glatte Beträge
  [100, 200, 500, 1000].forEach(step => { const v = Math.ceil(total / step) * step; if (v > total) set.add(v); });
  notes.forEach(n => { if (n > total) set.add(n); });
  return [...set].sort((a, b) => a - b).slice(0, 6);
}

$('#payBtn').addEventListener('click', () => {
  const total = cartTotal();
  if (!total && !state.cart.length) return;
  $('#payTotal').textContent = fmt(total);
  $('#quickGiven').innerHTML =
    `<button class="btn exact" data-given="${total}">Passend</button>` +
    quickAmounts(total).map(v => `<button class="btn" data-given="${v}">${fmt(v).replace(',00', '')}</button>`).join('');
  givenPad.reset();
  $('#changePreview').innerHTML = '';
  $('#payModal').hidden = false;
});

$('#quickGiven').addEventListener('click', e => {
  const b = e.target.closest('[data-given]');
  if (b) completeSale(+b.dataset.given);
});
$('#givenOk').addEventListener('click', () => {
  const v = givenPad.value() || cartTotal();
  if (v < cartTotal()) { toast('Gegebener Betrag zu klein'); return; }
  completeSale(v);
});

let lastSaleId = null;
function completeSale(given) {
  const total = cartTotal();
  const sale = {
    id: uid(), ts: Date.now(), total, given,
    items: state.cart.map(i => ({ productId: i.productId, name: i.name, option: i.option, price: i.price, qty: i.qty })),
  };
  state.sales.push(sale);
  saveSales();
  lastSaleId = sale.id;
  state.cart = []; saveCart();
  renderCart(); renderGrid();
  $('#payModal').hidden = true;
  $('#changeBig').textContent = fmt(given - total);
  $('#doneSub').textContent = `Summe ${fmt(total)} · gegeben ${fmt(given)}`;
  $('#doneModal').hidden = false;
}

$('#doneOk').addEventListener('click', () => { $('#doneModal').hidden = true; });
$('#undoSale').addEventListener('click', () => {
  const idx = state.sales.findIndex(s => s.id === lastSaleId);
  if (idx >= 0) {
    const [sale] = state.sales.splice(idx, 1);
    saveSales();
    // Bestellung wiederherstellen, damit man korrigieren kann
    state.cart = sale.items.map(i => {
      const p = state.products.find(x => x.id === i.productId);
      const optionId = i.option === 'Freier Preis' ? 'custom' : (p?.options.find(o => o.name === i.option)?.id ?? null);
      return { key: `${i.productId}|${optionId ?? ''}|${i.price}`, productId: i.productId, optionId, name: i.name, emoji: p?.emoji || '', option: i.option, price: i.price, qty: i.qty };
    });
    saveCart(); renderCart(); renderGrid();
    toast('Verkauf storniert – Bestellung wiederhergestellt');
  }
  $('#doneModal').hidden = true;
});

document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { b.closest('.modal').hidden = true; }));
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => {
  if (e.target === m) m.hidden = true;
}));

/* =========================================================
   TAGESÜBERSICHT
   ========================================================= */
function salesDays() {
  const days = new Set(state.sales.map(s => dayKey(s.ts)));
  days.add(dayKey(Date.now()));
  return [...days].sort().reverse();
}

function renderStats() {
  const sel = $('#statsDay');
  const current = sel.value || dayKey(Date.now());
  const days = salesDays();
  sel.innerHTML = [`<option value="all">Alle Tage</option>`, ...days.map(d => {
    const [y, m, dd] = d.split('-');
    return `<option value="${d}">${dd}.${m}.${y}${d === dayKey(Date.now()) ? ' (heute)' : ''}</option>`;
  })].join('');
  sel.value = days.includes(current) || current === 'all' ? current : days[0];
  const day = sel.value;

  const sales = state.sales.filter(s => day === 'all' || dayKey(s.ts) === day);
  const revenue = sales.reduce((s, x) => s + x.total, 0);
  const items = sales.reduce((s, x) => s + x.items.reduce((a, i) => a + i.qty, 0), 0);
  const start = day === 'all' ? 0 : (state.startCash[day] || 0);
  $('#startCash').value = day === 'all' ? '' : centsToInput(state.startCash[day] ?? null);
  $('#startCash').disabled = day === 'all';

  $('#kpis').innerHTML = `
    <div class="kpi main"><span>Umsatz</span><b>${fmt(revenue)}</b></div>
    <div class="kpi"><span>Verkäufe</span><b>${sales.length}</b></div>
    <div class="kpi"><span>Artikel</span><b>${items}</b></div>
    <div class="kpi"><span>Ø Bon</span><b>${fmt(sales.length ? Math.round(revenue / sales.length) : 0)}</b></div>
    ${day !== 'all' ? `<div class="kpi"><span>Soll in der Kasse</span><b>${fmt(start + revenue)}</b></div>` : ''}`;

  // Gruppiert nach Produkt + Option
  const groups = new Map();
  for (const s of sales) for (const i of s.items) {
    if (!groups.has(i.name)) groups.set(i.name, { qty: 0, sum: 0, opts: new Map() });
    const g = groups.get(i.name);
    g.qty += i.qty; g.sum += i.qty * i.price;
    const ok = i.option || '–';
    const o = g.opts.get(ok) || { qty: 0, sum: 0 };
    o.qty += i.qty; o.sum += i.qty * i.price;
    g.opts.set(ok, o);
  }
  const rows = [...groups.entries()].sort((a, b) => b[1].sum - a[1].sum);
  $('#statsTable').innerHTML = rows.length
    ? `<tr><th>Produkt</th><th class="num">Stück</th><th class="num">Umsatz</th></tr>` +
      rows.map(([name, g]) => {
        const p = state.products.find(x => x.name === name);
        const subs = [...g.opts.entries()].sort((a, b) => b[1].qty - a[1].qty);
        const showSubs = !(subs.length === 1 && subs[0][0] === '–');
        return `<tr class="group"><td>${esc(p?.emoji || '')} ${esc(name)}</td><td class="num">${g.qty}</td><td class="num">${fmt(g.sum)}</td></tr>` +
          (showSubs ? subs.map(([on, o]) => `<tr class="sub"><td>${esc(on)}</td><td class="num">${o.qty}</td><td class="num">${fmt(o.sum)}</td></tr>`).join('') : '');
      }).join('')
    : '<tr><td class="empty">Noch keine Verkäufe</td></tr>';

  // Stunden
  const byHour = new Array(24).fill(0);
  sales.forEach(s => { byHour[new Date(s.ts).getHours()] += s.total; });
  let first = byHour.findIndex(v => v > 0), last = 23 - [...byHour].reverse().findIndex(v => v > 0);
  if (first < 0) { first = 14; last = 21; }
  const max = Math.max(...byHour, 1);
  let html = '';
  for (let h = first; h <= last; h++) {
    html += `<div class="hour"><span class="val">${byHour[h] ? Math.round(byHour[h] / 100) + '€' : ''}</span><div class="bar" style="height:${(byHour[h] / max) * 100}%"></div><small>${h}</small></div>`;
  }
  $('#hourChart').innerHTML = html;

  // Letzte Verkäufe
  const recent = [...sales].sort((a, b) => b.ts - a.ts).slice(0, 100);
  $('#salesList').innerHTML = recent.length ? recent.map(s => {
    const t = new Date(s.ts);
    const time = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    const desc = s.items.map(i => `${i.qty}× ${i.name}${i.option ? ' ' + i.option : ''}`).join(', ');
    return `<li><span class="time">${time}</span><span class="desc">${esc(desc)}</span><span class="amt">${fmt(s.total)}</span><button data-del-sale="${s.id}" aria-label="Stornieren">✕</button></li>`;
  }).join('') : '<li class="empty">–</li>';
}

$('#statsDay').addEventListener('change', renderStats);
$('#startCash').addEventListener('change', e => {
  const day = $('#statsDay').value;
  if (day === 'all') return;
  const v = e.target.value === '' ? null : toCents(e.target.value);
  if (v == null || isNaN(v)) delete state.startCash[day]; else state.startCash[day] = v;
  save(LS.startCash, state.startCash);
  renderStats();
});
$('#salesList').addEventListener('click', e => {
  const b = e.target.closest('[data-del-sale]');
  if (!b) return;
  const s = state.sales.find(x => x.id === b.dataset.delSale);
  if (!s || !confirm(`Verkauf über ${fmt(s.total)} stornieren?`)) return;
  state.sales = state.sales.filter(x => x.id !== s.id);
  saveSales(); renderStats();
  toast('Verkauf storniert');
});

$('#exportCsv').addEventListener('click', () => {
  const day = $('#statsDay').value;
  const sales = state.sales.filter(s => day === 'all' || dayKey(s.ts) === day);
  const lines = [['Datum', 'Uhrzeit', 'Bon', 'Produkt', 'Option', 'Menge', 'Einzelpreis', 'Summe'].join(';')];
  for (const s of sales) {
    const d = new Date(s.ts);
    for (const i of s.items) {
      lines.push([dayKey(s.ts), d.toLocaleTimeString('de-DE'), s.id, i.name, i.option, i.qty,
        (i.price / 100).toFixed(2).replace('.', ','), (i.price * i.qty / 100).toFixed(2).replace('.', ',')]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    }
  }
  download(`kasse-${day}.csv`, '﻿' + lines.join('\n'), 'text/csv');
});

async function download(filename, content, type) {
  const blob = new Blob([content], { type });
  try {
    const file = new File([blob], filename, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* =========================================================
   PRODUKTE BEARBEITEN
   ========================================================= */
function renderEditor() {
  const el = $('#productEditor');
  el.innerHTML = state.products.map((p, idx) => `
    <div class="pe" data-pid="${p.id}" style="--accent:${esc(p.color)}">
      <div class="pe-row">
        <label>Symbol<input class="emoji" type="text" data-f="emoji" value="${esc(p.emoji)}"></label>
        <label class="grow">Name<input type="text" data-f="name" value="${esc(p.name)}"></label>
        <label>Grundpreis €<input class="price" type="text" inputmode="decimal" data-f="price" value="${centsToInput(p.price)}"></label>
        <label>Farbe<input type="color" data-f="color" value="${esc(p.color)}"></label>
        <label class="check"><input type="checkbox" data-f="customPrice" ${p.customPrice ? 'checked' : ''}> Freier Preis</label>
      </div>
      <div class="pe-opts">
        ${(p.options || []).map((o, oi) => `
          <div class="pe-opt" data-oid="${o.id}">
            <input type="text" data-of="name" value="${esc(o.name)}" placeholder="Option, z.B. Ketchup">
            <input class="price" type="text" inputmode="decimal" data-of="price" value="${centsToInput(o.price)}" placeholder="${centsToInput(p.price)} €">
            <button class="icon-btn" data-oup="${oi}" ${oi === 0 ? 'disabled' : ''}>↑</button>
            <button class="icon-btn danger" data-odel="${o.id}">🗑</button>
          </div>`).join('')}
      </div>
      <div class="pe-actions">
        <button class="btn small" data-oadd>+ Option</button>
        <span class="spacer"></span>
        <button class="btn ghost small" data-up ${idx === 0 ? 'disabled' : ''}>↑ nach oben</button>
        <button class="btn ghost small" data-down ${idx === state.products.length - 1 ? 'disabled' : ''}>↓ nach unten</button>
        <button class="btn ghost small danger" data-del>Produkt löschen</button>
      </div>
    </div>`).join('') || '<div class="empty">Keine Produkte</div>';
}

const editor = $('#productEditor');
editor.addEventListener('change', e => {
  const card = e.target.closest('[data-pid]');
  if (!card) return;
  const p = state.products.find(x => x.id === card.dataset.pid);
  const f = e.target.dataset.f, of = e.target.dataset.of;
  if (f) {
    if (f === 'price') { const v = toCents(e.target.value); p.price = isNaN(v) ? 0 : v; }
    else if (f === 'customPrice') p.customPrice = e.target.checked;
    else p[f] = e.target.value.trim();
  } else if (of) {
    const o = p.options.find(x => x.id === e.target.closest('[data-oid]').dataset.oid);
    if (of === 'price') { const v = toCents(e.target.value); o.price = e.target.value.trim() === '' || isNaN(v) ? null : v; }
    else o.name = e.target.value.trim();
  }
  saveProducts(); renderEditor(); toast('Gespeichert ✓');
});

editor.addEventListener('click', e => {
  const card = e.target.closest('[data-pid]');
  if (!card) return;
  const idx = state.products.findIndex(x => x.id === card.dataset.pid);
  const p = state.products[idx];
  const t = e.target.closest('button');
  if (!t) return;
  if (t.hasAttribute('data-oadd')) { p.options.push({ id: uid(), name: 'Neue Option', price: null }); }
  else if (t.dataset.odel) { p.options = p.options.filter(o => o.id !== t.dataset.odel); }
  else if (t.dataset.oup) { const i = +t.dataset.oup; [p.options[i - 1], p.options[i]] = [p.options[i], p.options[i - 1]]; }
  else if (t.hasAttribute('data-up') && idx > 0) { [state.products[idx - 1], state.products[idx]] = [state.products[idx], state.products[idx - 1]]; }
  else if (t.hasAttribute('data-down') && idx < state.products.length - 1) { [state.products[idx + 1], state.products[idx]] = [state.products[idx], state.products[idx + 1]]; }
  else if (t.hasAttribute('data-del')) { if (!confirm(`„${p.name}“ löschen? (Bisherige Verkäufe bleiben erhalten)`)) return; state.products.splice(idx, 1); }
  else return;
  saveProducts(); renderEditor();
});

$('#addProduct').addEventListener('click', () => {
  state.products.push({ id: uid(), name: 'Neues Produkt', emoji: '⭐', color: '#e6b450', price: 300, customPrice: false, options: [] });
  saveProducts(); renderEditor();
  editor.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
});

$('#resetProducts').addEventListener('click', () => {
  if (!confirm('Alle Produkte durch die Standard-Produkte ersetzen? (Verkäufe bleiben erhalten)')) return;
  state.products = DEFAULT_PRODUCTS(); saveProducts(); renderEditor();
});

$('#exportBackup').addEventListener('click', () => {
  const data = { version: 1, exported: new Date().toISOString(), products: state.products, sales: state.sales, startCash: state.startCash };
  download(`kasse-backup-${dayKey(Date.now())}.json`, JSON.stringify(data, null, 2), 'application/json');
});

$('#importBackup').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.products)) throw new Error('kein Backup');
    const mode = confirm('Backup laden: OK = Verkäufe zusammenführen, Abbrechen = nur Produkte übernehmen');
    state.products = data.products; saveProducts();
    if (mode && Array.isArray(data.sales)) {
      const ids = new Set(state.sales.map(s => s.id));
      state.sales.push(...data.sales.filter(s => !ids.has(s.id)));
      state.sales.sort((a, b) => a.ts - b.ts);
      saveSales();
      Object.assign(state.startCash, data.startCash || {}); save(LS.startCash, state.startCash);
    }
    renderEditor(); toast('Backup geladen ✓');
  } catch (err) { alert('Datei konnte nicht gelesen werden: ' + err.message); }
});

/* ---------------- Start ---------------- */
renderGrid();
renderCart();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
// Speicher möglichst dauerhaft machen (schützt vor automatischem Löschen)
navigator.storage?.persist?.();
