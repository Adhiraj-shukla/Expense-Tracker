/* Kharcha Tracker - monthly bills, expenses, salary, budget and reminders.
   Plain JavaScript (ES6). All data is stored in the browser localStorage. */
(function () {
  'use strict';

  /* ---------- constants ---------- */
  var KEY = 'kharcha_tracker_v1';
  var CATS = [
    { id: 'electricity', name: 'Electricity', icon: '⚡', color: '#f59e0b' },
    { id: 'water', name: 'Water', icon: '💧', color: '#0ea5e9' },
    { id: 'gas', name: 'Gas / LPG', icon: '🔥', color: '#ef4444' },
    { id: 'rent', name: 'House Rent', icon: '🏠', color: '#8b5cf6' },
    { id: 'emi', name: 'EMI / Loan', icon: '🏦', color: '#6366f1' },
    { id: 'mobile', name: 'Mobile Recharge', icon: '📱', color: '#14b8a6' },
    { id: 'internet', name: 'Internet / WiFi', icon: '📶', color: '#06b6d4' },
    { id: 'dth', name: 'DTH / OTT', icon: '📺', color: '#ec4899' },
    { id: 'insurance', name: 'Insurance / LIC', icon: '🛡️', color: '#10b981' },
    { id: 'fees', name: 'School / College Fees', icon: '🎓', color: '#3b82f6' },
    { id: 'society', name: 'Society Maintenance', icon: '🏢', color: '#a855f7' },
    { id: 'groceries', name: 'Groceries / Kirana', icon: '🛒', color: '#22c55e' },
    { id: 'milk', name: 'Milk & Vegetables', icon: '🥛', color: '#84cc16' },
    { id: 'fuel', name: 'Petrol / Fuel', icon: '⛽', color: '#f97316' },
    { id: 'transport', name: 'Travel / Transport', icon: '🚌', color: '#64748b' },
    { id: 'medical', name: 'Medical', icon: '💊', color: '#f43f5e' },
    { id: 'food', name: 'Eating Out', icon: '🍽️', color: '#d97706' },
    { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#db2777' },
    { id: 'other', name: 'Other', icon: '📦', color: '#78716c' }
  ];
  var PRESETS = [
    ['Electricity Bill', 'electricity'], ['Water Bill', 'water'], ['LPG Cylinder', 'gas'],
    ['House Rent', 'rent'], ['Home Loan EMI', 'emi'], ['Mobile Recharge', 'mobile'],
    ['WiFi Bill', 'internet'], ['DTH Recharge', 'dth'], ['LIC Premium', 'insurance'],
    ['College Fees', 'fees'], ['Society Maintenance', 'society']
  ];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON3 = MONTHS.map(function (m) { return m.slice(0, 3); });

  /* ---------- small helpers ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYMD(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function monthOf(s) { return s.slice(0, 7); }
  function todayDate() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function daysBetween(a, b) { return Math.round((a - b) / 86400000); }
  function addMonths(key, n) {
    var p = key.split('-'), t = (+p[0]) * 12 + (+p[1] - 1) + n;
    return Math.floor(t / 12) + '-' + pad((t % 12) + 1);
  }
  function monthTitle(key) { var p = key.split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0]; }
  function fmtDate(s) { var d = parseYMD(s); return d.getDate() + ' ' + MON3[d.getMonth()]; }
  var rupee = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });
  function money(n) { return rupee.format(n || 0); }
  function round2(n) { return Math.round(n * 100) / 100; }
  function sum(list, f) { return round2(list.reduce(function (t, x) { return t + f(x); }, 0)); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cat(id) { for (var i = 0; i < CATS.length; i++) { if (CATS[i].id === id) return CATS[i]; } return CATS[CATS.length - 1]; }
  function $(id) { return document.getElementById(id); }
  function validDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(parseYMD(s)) === s; }

  /* ---------- state & storage ---------- */
  var storageOk = true;
  function defaults() {
    return { v: 1, seq: 1, bills: [], expenses: [], months: {}, settings: { remindDays: 3, theme: 'auto' }, notified: {} };
  }
  function sanitize(o) {
    var s = defaults();
    if (!o || typeof o !== 'object') return s;
    s.seq = Math.max(1, parseInt(o.seq, 10) || 1);
    (Array.isArray(o.bills) ? o.bills : []).forEach(function (b) {
      if (!b || typeof b.name !== 'string' || !validDate(b.due) || !(+b.amount >= 0)) return;
      var id = String(b.id || ('b' + (s.seq++)));
      s.bills.push({
        id: id, name: b.name.slice(0, 60), category: cat(b.category).id, amount: round2(+b.amount),
        due: b.due, paid: !!b.paid, paidOn: validDate(b.paidOn) ? b.paidOn : null,
        repeat: !!b.repeat, series: String(b.series || id), day: parseInt(b.day, 10) || parseYMD(b.due).getDate()
      });
    });
    (Array.isArray(o.expenses) ? o.expenses : []).forEach(function (e) {
      if (!e || typeof e.title !== 'string' || !validDate(e.date) || !(+e.amount >= 0)) return;
      s.expenses.push({ id: String(e.id || ('e' + (s.seq++))), title: e.title.slice(0, 60), category: cat(e.category).id, amount: round2(+e.amount), date: e.date });
    });
    if (o.months && typeof o.months === 'object') {
      Object.keys(o.months).forEach(function (k) {
        var m = o.months[k];
        if (/^\d{4}-\d{2}$/.test(k) && m) s.months[k] = { salary: Math.max(0, +m.salary || 0), budget: Math.max(0, +m.budget || 0) };
      });
    }
    if (o.settings) {
      var rd = parseInt(o.settings.remindDays, 10);
      s.settings.remindDays = rd >= 0 && rd <= 30 ? rd : 3;
      s.settings.theme = ['light', 'dark', 'auto'].indexOf(o.settings.theme) >= 0 ? o.settings.theme : 'auto';
    }
    if (o.notified && typeof o.notified === 'object') s.notified = o.notified;
    return s;
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? sanitize(JSON.parse(raw)) : defaults();
    } catch (e) { storageOk = false; return defaults(); }
  }
  var state = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { storageOk = false; }
  }
  function uid(p) { return p + (state.seq++); }

  /* ---------- view state ---------- */
  var viewMonth = monthOf(ymd(todayDate()));
  var tab = 'bills', filter = 'all', query = '';
  var undoSnap = null, toastTimer = null;

  /* ---------- month settings ---------- */
  function getMonth(key) {
    if (state.months[key]) return { salary: state.months[key].salary, budget: state.months[key].budget, inherited: false };
    var keys = Object.keys(state.months).filter(function (k) { return k < key; }).sort();
    if (keys.length) { var m = state.months[keys[keys.length - 1]]; return { salary: m.salary, budget: m.budget, inherited: true }; }
    return { salary: 0, budget: 0, inherited: false };
  }

  /* ---------- recurring bills ---------- */
  function ensureRecurring(upToKey) {
    var latest = {}, changed = false;
    state.bills.forEach(function (b) {
      if (!b.repeat) return;
      if (!latest[b.series] || b.due > latest[b.series].due) latest[b.series] = b;
    });
    Object.keys(latest).forEach(function (sid) {
      var cur = latest[sid], guard = 0;
      while (monthOf(cur.due) < upToKey && guard++ < 36) {
        var nk = addMonths(monthOf(cur.due), 1), p = nk.split('-');
        var dim = new Date(+p[0], +p[1], 0).getDate();
        var nb = {
          id: uid('b'), name: cur.name, category: cur.category, amount: cur.amount,
          due: nk + '-' + pad(Math.min(cur.day, dim)), paid: false, paidOn: null,
          repeat: true, series: cur.series, day: cur.day
        };
        state.bills.push(nb); cur = nb; changed = true;
      }
    });
    if (changed) save();
  }

  /* ---------- bill status ---------- */
  function daysLeft(b) { return daysBetween(parseYMD(b.due), todayDate()); }
  function statusOf(b) {
    if (b.paid) return 'paid';
    var d = daysLeft(b);
    if (d < 0) return 'overdue';
    if (d <= state.settings.remindDays) return 'soon';
    return 'upcoming';
  }
  function dueText(b) {
    if (b.paid) return '<span class="paid">✔ Paid on ' + fmtDate(b.paidOn || b.due) + '</span>';
    var d = daysLeft(b);
    if (d < 0) return '<span class="over">Overdue by ' + (-d) + ' day' + (d === -1 ? '' : 's') + '</span>';
    if (d === 0) return '<span class="soon">Due today</span>';
    if (d === 1) return '<span class="soon">Due tomorrow</span>';
    if (d <= state.settings.remindDays) return '<span class="soon">Due in ' + d + ' days</span>';
    return 'Due in ' + d + ' days';
  }

  /* ---------- calculations ---------- */
  function calc(key) {
    var mb = state.bills.filter(function (b) { return monthOf(b.due) === key; });
    var me = state.expenses.filter(function (e) { return monthOf(e.date) === key; });
    var paid = sum(mb.filter(function (b) { return b.paid; }), function (b) { return b.amount; });
    var pending = sum(mb.filter(function (b) { return !b.paid; }), function (b) { return b.amount; });
    var exp = sum(me, function (e) { return e.amount; });
    var m = getMonth(key);
    var spent = round2(paid + exp);
    return {
      bills: mb, expenses: me, paid: paid, pending: pending, exp: exp, spent: spent,
      salary: m.salary, budget: m.budget, inherited: m.inherited,
      left: round2(m.budget - spent - pending), savings: round2(m.salary - spent - pending)
    };
  }
  function categoryTotals(c) {
    var map = {};
    c.bills.forEach(function (b) { map[b.category] = (map[b.category] || 0) + b.amount; });
    c.expenses.forEach(function (e) { map[e.category] = (map[e.category] || 0) + e.amount; });
    return Object.keys(map).map(function (id) { return { cat: cat(id), total: round2(map[id]) }; })
      .sort(function (a, b) { return b.total - a.total; });
  }

  /* ---------- rendering ---------- */
  function renderMonth() {
    $('monthLabel').textContent = monthTitle(viewMonth);
    $('btnToday').hidden = viewMonth === monthOf(ymd(todayDate()));
  }

  function dueReminders() {
    var lim = state.settings.remindDays;
    return state.bills.filter(function (b) { return !b.paid && daysLeft(b) <= lim; })
      .sort(function (a, b) { return a.due < b.due ? -1 : 1; });
  }

  function renderReminders() {
    var list = dueReminders(), el = $('reminders');
    if (!list.length) { el.innerHTML = ''; return; }
    var over = list.filter(function (b) { return daysLeft(b) < 0; }).length;
    var title = (over ? '⚠ ' + over + ' overdue · ' : '🔔 ') + list.length + ' bill' + (list.length > 1 ? 's' : '') + ' need attention';
    var html = '<div class="reminder' + (over ? ' bad' : '') + '"><h3>' + title + '</h3><ul>';
    list.slice(0, 6).forEach(function (b) {
      html += '<li><span>' + cat(b.category).icon + ' <b>' + esc(b.name) + '</b> · ' + money(b.amount) +
        '<span class="when">' + fmtDate(b.due) + ' · ' + dueText(b) + '</span></span>' +
        '<button class="btn" data-act="pay" data-id="' + esc(b.id) + '">Mark paid</button></li>';
    });
    if (list.length > 6) html += '<li>+ ' + (list.length - 6) + ' more in the Bills tab</li>';
    el.innerHTML = html + '</ul></div>';
  }

  function renderSummary() {
    var c = calc(viewMonth);
    var leftCls = c.budget ? (c.left < 0 ? 'neg' : 'pos') : '';
    $('cards').innerHTML =
      '<div class="card salary"><button class="link-btn edit" data-act="month">Edit</button><div class="k">Salary</div><div class="v">' + money(c.salary) +
      '</div><div class="s">' + (c.salary ? 'Expected savings ' + money(c.savings) : 'Tap Edit to set salary') + '</div></div>' +
      '<div class="card"><div class="k">Budget</div><div class="v">' + money(c.budget) + '</div><div class="s">' + (c.inherited ? 'carried from earlier month' : 'for this month') + '</div></div>' +
      '<div class="card"><div class="k">Spent</div><div class="v">' + money(c.spent) + '</div><div class="s">paid bills + expenses</div></div>' +
      '<div class="card"><div class="k">Pending bills</div><div class="v">' + money(c.pending) + '</div><div class="s">' + c.bills.filter(function (b) { return !b.paid; }).length + ' unpaid</div></div>' +
      '<div class="card"><div class="k">Left in budget</div><div class="v ' + leftCls + '">' + (c.budget ? money(c.left) : '—') + '</div><div class="s">after pending bills</div></div>';

    var box = $('budgetBox');
    if (!c.budget) {
      box.innerHTML = '<div class="budget-head"><b>Monthly budget</b></div><p class="budget-msg">Set your salary and budget to see the progress bar. <button class="link-btn" data-act="month">Set now</button></p>';
      return;
    }
    var total = c.spent + c.pending, over = total > c.budget;
    var wSpent = Math.min(100, c.spent / c.budget * 100);
    var wPend = Math.max(0, Math.min(100 - wSpent, c.pending / c.budget * 100));
    var pct = Math.round(total / c.budget * 100);
    var msg, cls;
    if (over) { msg = 'Over budget by ' + money(round2(total - c.budget)) + '. Cut some expenses.'; cls = 'bad'; }
    else if (pct >= 80) { msg = 'Careful: ' + pct + '% of the budget is used or committed.'; cls = 'warn'; }
    else { msg = 'On track: ' + pct + '% of the budget is used or committed.'; cls = 'ok'; }
    box.innerHTML = '<div class="budget-head"><b>Budget used</b><span>' + money(total) + ' of ' + money(c.budget) + '</span></div>' +
      '<div class="bar' + (over ? ' over' : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.min(100, pct) + '">' +
      '<i class="b-spent" style="width:' + wSpent + '%"></i><i class="b-pend" style="width:' + wPend + '%"></i></div>' +
      '<div class="legend"><span><i class="dot" style="background:var(--accent)"></i>Spent ' + money(c.spent) + '</span><span><i class="dot" style="background:#f59e0b"></i>Pending ' + money(c.pending) + '</span></div>' +
      '<p class="budget-msg ' + cls + '">' + msg + '</p>';
  }

  function sortBills(a, b) {
    if (a.paid !== b.paid) return a.paid ? 1 : -1;
    return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
  }

  function renderBills() {
    var c = calc(viewMonth), q = query.trim().toLowerCase();
    var list = c.bills.filter(function (b) {
      var s = statusOf(b);
      if (filter === 'paid' && !b.paid) return false;
      if (filter === 'unpaid' && b.paid) return false;
      if (filter === 'overdue' && s !== 'overdue') return false;
      if (q && (b.name + ' ' + cat(b.category).name).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(sortBills);
    var el = $('billList');
    if (!list.length) {
      if (!c.bills.length) {
        el.innerHTML = '<li class="empty"><h3>No bills for ' + monthTitle(viewMonth) + '</h3><p>Add your electricity, water, gas, rent, recharge and other bills with their due dates.</p>' +
          '<button class="btn primary" data-act="add-bill">Add a bill</button>' +
          (state.bills.length || state.expenses.length ? '' : '<button class="btn" data-act="sample">Load sample data</button>') + '</li>';
      } else {
        el.innerHTML = '<li class="empty"><h3>No bills match</h3><p>Try another filter or search.</p></li>';
      }
      return;
    }
    el.innerHTML = list.map(function (b) {
      var s = statusOf(b), k = cat(b.category);
      return '<li class="item s-' + s + '" data-id="' + esc(b.id) + '">' +
        '<div class="cat-ico" aria-hidden="true">' + k.icon + '</div>' +
        '<div><div class="name">' + esc(b.name) + (b.repeat ? '<span class="tag">monthly</span>' : '') + '</div>' +
        '<div class="meta">' + esc(k.name) + ' · ' + fmtDate(b.due) + ' · ' + dueText(b) + '</div></div>' +
        '<div class="amt">' + money(b.amount) + '</div>' +
        '<div class="row-actions">' +
        (b.paid ? '<button class="mini undo" data-act="pay" data-id="' + esc(b.id) + '">Mark unpaid</button>'
                : '<button class="mini pay" data-act="pay" data-id="' + esc(b.id) + '">✔ Mark paid</button>') +
        '<button class="mini" data-act="edit-bill" data-id="' + esc(b.id) + '">Edit</button>' +
        '<button class="mini del" data-act="del-bill" data-id="' + esc(b.id) + '" aria-label="Delete ' + esc(b.name) + '">Delete</button></div></li>';
    }).join('');
  }

  function renderExpenses() {
    var c = calc(viewMonth);
    var list = c.expenses.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var el = $('expenseList');
    if (!list.length) {
      el.innerHTML = '<li class="empty"><h3>No expenses for ' + monthTitle(viewMonth) + '</h3><p>Note daily spending like kirana, milk, petrol or eating out.</p><button class="btn primary" data-act="add-exp">Add an expense</button></li>';
      return;
    }
    el.innerHTML = '<li class="hint">Total this month: <b>' + money(c.exp) + '</b></li>' + list.map(function (e) {
      var k = cat(e.category);
      return '<li class="item s-upcoming" data-id="' + esc(e.id) + '"><div class="cat-ico" aria-hidden="true">' + k.icon + '</div>' +
        '<div><div class="name">' + esc(e.title) + '</div><div class="meta">' + esc(k.name) + ' · ' + fmtDate(e.date) + '</div></div>' +
        '<div class="amt">' + money(e.amount) + '</div>' +
        '<div class="row-actions"><button class="mini" data-act="edit-exp" data-id="' + esc(e.id) + '">Edit</button>' +
        '<button class="mini del" data-act="del-exp" data-id="' + esc(e.id) + '" aria-label="Delete ' + esc(e.title) + '">Delete</button></div></li>';
    }).join('');
  }

  function donutSVG(items, total) {
    var r = 15.9155, off = 25, out = '';
    items.forEach(function (it) {
      var pct = it.total / total * 100;
      out += '<circle cx="21" cy="21" r="' + r + '" fill="none" stroke="' + it.cat.color + '" stroke-width="6" stroke-dasharray="' + pct.toFixed(3) + ' ' + (100 - pct).toFixed(3) + '" stroke-dashoffset="' + off.toFixed(3) + '"></circle>';
      off -= pct;
    });
    return '<svg class="donut" viewBox="0 0 42 42" role="img" aria-label="Spending by category">' +
      '<circle cx="21" cy="21" r="' + r + '" fill="none" stroke="var(--surface-2)" stroke-width="6"></circle>' + out +
      '<text x="21" y="20.5" text-anchor="middle" font-size="3.4" font-weight="700">' + esc(money(total)) + '</text>' +
      '<text x="21" y="25" text-anchor="middle" font-size="2.4" opacity=".7">total</text></svg>';
  }

  function renderInsights() {
    var c = calc(viewMonth), items = categoryTotals(c);
    var total = sum(items, function (i) { return i.total; });
    var html = '<div class="ins-grid"><div class="panel-card"><h3>Where the money goes — ' + monthTitle(viewMonth) + '</h3>';
    if (!total) html += '<p class="hint">Add bills or expenses to see the category chart.</p>';
    else {
      html += '<div class="donut-wrap">' + donutSVG(items, total) + '<ul class="cat-list">' + items.map(function (i) {
        return '<li><i class="dot" style="background:' + i.cat.color + '"></i><span class="nm">' + i.cat.icon + ' ' + esc(i.cat.name) + '</span><b>' + money(i.total) + '</b><span class="pc">' + Math.round(i.total / total * 100) + '%</span></li>';
      }).join('') + '</ul></div>';
    }
    html += '</div>';
    var months = [], i, vals = [], max = 1;
    for (i = 5; i >= 0; i--) { months.push(addMonths(viewMonth, -i)); }
    months.forEach(function (k) { var x = calc(k).spent; vals.push(x); if (x > max) max = x; });
    html += '<div class="panel-card"><h3>Last 6 months (paid + expenses)</h3><div class="trend">' + months.map(function (k, idx) {
      return '<div class="col' + (idx === 5 ? ' cur' : '') + '"><span>' + (vals[idx] ? shortMoney(vals[idx]) : '') + '</span><div class="bar-v" style="height:' + Math.max(2, vals[idx] / max * 78) + '%"></div><small>' + MON3[+k.slice(5) - 1] + '</small></div>';
    }).join('') + '</div></div></div>';
    $('insights').innerHTML = html;
  }
  function shortMoney(n) {
    if (n >= 100000) return '₹' + (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
    if (n >= 1000) return '₹' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return '₹' + Math.round(n);
  }

  function renderAll() {
    ensureRecurring(viewMonth);
    renderMonth(); renderReminders(); renderSummary(); renderBills(); renderExpenses();
    if (tab === 'insights') renderInsights();
    applyTheme();
    updateAlertButton();
  }

  /* ---------- toast ---------- */
  function toast(msg, undoable) {
    var t = $('toast');
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (undoable ? '<button data-act="undo">Undo</button>' : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, undoable ? 6000 : 3000);
  }
  function snapshot() { undoSnap = JSON.stringify(state); }
  function undo() {
    if (!undoSnap) return;
    state = sanitize(JSON.parse(undoSnap)); undoSnap = null; save(); $('toast').hidden = true; renderAll();
  }

  /* ---------- modal ---------- */
  function closeModal() { $('modalRoot').innerHTML = ''; }
  function openModal(html) {
    $('modalRoot').innerHTML = '<div class="overlay" data-act="close-overlay"><div class="modal" role="dialog" aria-modal="true">' + html + '</div></div>';
    var f = $('modalRoot').querySelector('input:not([type=checkbox]):not([type=file]), select, textarea');
    if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  function catOptions(sel) {
    return CATS.map(function (k) { return '<option value="' + k.id + '"' + (k.id === sel ? ' selected' : '') + '>' + k.icon + ' ' + esc(k.name) + '</option>'; }).join('');
  }

  function openEntryForm(kind, item) {
    var isBill = kind === 'bill', edit = !!item;
    var defDate = viewMonth === monthOf(ymd(todayDate())) ? ymd(todayDate()) : viewMonth + '-01';
    var v = item || { name: '', title: '', category: isBill ? 'electricity' : 'groceries', amount: '', due: defDate, date: defDate, repeat: false, paid: false };
    var html = '<h3>' + (edit ? 'Edit ' : 'Add ') + (isBill ? 'bill' : 'expense') + '</h3>';
    if (!edit) html += '<div class="seg" role="group"><button type="button" data-act="kind-bill" class="' + (isBill ? 'on' : '') + '">Bill (with due date)</button><button type="button" data-act="kind-exp" class="' + (!isBill ? 'on' : '') + '">Expense (spent)</button></div>';
    if (isBill && !edit) {
      html += '<div class="presets" aria-label="Quick pick">' + PRESETS.map(function (p) {
        return '<button type="button" class="chip" data-act="preset" data-name="' + esc(p[0]) + '" data-cat="' + p[1] + '">' + cat(p[1]).icon + ' ' + esc(p[0]) + '</button>';
      }).join('') + '</div>';
    }
    html += '<form id="entryForm" novalidate data-kind="' + kind + '" data-id="' + (edit ? esc(item.id) : '') + '">' +
      '<div class="field"><label for="fName">' + (isBill ? 'Bill name' : 'What did you spend on?') + '</label><input type="text" id="fName" maxlength="60" value="' + esc(isBill ? v.name : v.title) + '" placeholder="' + (isBill ? 'e.g. Electricity Bill' : 'e.g. Vegetables') + '"><div class="err" id="eName"></div></div>' +
      '<div class="field"><label for="fCat">Category</label><select id="fCat">' + catOptions(v.category) + '</select></div>' +
      '<div class="row2"><div class="field"><label for="fAmt">Amount (₹)</label><input type="number" id="fAmt" inputmode="decimal" min="0" step="0.01" value="' + esc(v.amount) + '" placeholder="0"><div class="err" id="eAmt"></div></div>' +
      '<div class="field"><label for="fDate">' + (isBill ? 'Due date' : 'Date') + '</label><input type="date" id="fDate" value="' + esc(isBill ? v.due : v.date) + '"><div class="err" id="eDate"></div></div></div>';
    if (isBill) {
      html += '<label class="check"><input type="checkbox" id="fRepeat"' + (v.repeat ? ' checked' : '') + '> Repeat every month</label>' +
        '<label class="check"><input type="checkbox" id="fPaid"' + (v.paid ? ' checked' : '') + '> Already paid</label>';
    }
    html += '<div class="modal-actions"><button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn primary">' + (edit ? 'Save changes' : 'Add') + '</button></div></form>';
    openModal(html);
  }

  function submitEntry(form) {
    var kind = form.getAttribute('data-kind'), id = form.getAttribute('data-id');
    var name = $('fName').value.trim(), amt = parseFloat($('fAmt').value), date = $('fDate').value, ok = true;
    $('eName').textContent = $('eAmt').textContent = $('eDate').textContent = '';
    if (name.length < 2) { $('eName').textContent = 'Enter a name (at least 2 characters).'; ok = false; }
    if (!(amt > 0) || amt > 999999999) { $('eAmt').textContent = 'Enter an amount greater than 0.'; ok = false; }
    if (!validDate(date)) { $('eDate').textContent = 'Choose a valid date.'; ok = false; }
    if (!ok) return;
    amt = round2(amt);
    var category = $('fCat').value, key = monthOf(date);
    snapshot();
    if (kind === 'bill') {
      var repeat = $('fRepeat').checked, paid = $('fPaid').checked, day = parseYMD(date).getDate();
      if (id) {
        var b = findBill(id);
        b.name = name; b.category = category; b.amount = amt; b.due = date; b.day = day;
        if (paid && !b.paid) b.paidOn = ymd(todayDate());
        b.paid = paid; if (!paid) b.paidOn = null;
        state.bills.forEach(function (x) { if (x.series === b.series) { x.repeat = repeat; } });
        b.repeat = repeat;
      } else {
        var nid = uid('b');
        state.bills.push({ id: nid, name: name, category: category, amount: amt, due: date, paid: paid, paidOn: paid ? ymd(todayDate()) : null, repeat: repeat, series: nid, day: day });
      }
    } else if (id) {
      var e = findExp(id); e.title = name; e.category = category; e.amount = amt; e.date = date;
    } else {
      state.expenses.push({ id: uid('e'), title: name, category: category, amount: amt, date: date });
    }
    save(); closeModal();
    viewMonth = key; tab = kind === 'bill' ? 'bills' : 'expenses'; syncTabs();
    renderAll();
    toast((id ? 'Saved' : 'Added') + ' · ' + monthTitle(key), true);
  }

  function findBill(id) { return state.bills.filter(function (b) { return b.id === id; })[0]; }
  function findExp(id) { return state.expenses.filter(function (e) { return e.id === id; })[0]; }

  function openMonthForm() {
    var m = getMonth(viewMonth);
    openModal('<h3>' + monthTitle(viewMonth) + ' · Salary &amp; budget</h3>' +
      '<form id="monthForm" novalidate>' +
      '<div class="row2"><div class="field"><label for="mSal">Monthly salary (₹)</label><input type="number" id="mSal" inputmode="decimal" min="0" value="' + (m.salary || '') + '" placeholder="e.g. 35000"></div>' +
      '<div class="field"><label for="mBud">Budget for the month (₹)</label><input type="number" id="mBud" inputmode="decimal" min="0" value="' + (m.budget || '') + '" placeholder="e.g. 28000"></div></div>' +
      '<div class="field"><label for="mRem">Remind me before the due date (days)</label><input type="number" id="mRem" min="0" max="30" value="' + state.settings.remindDays + '"><div class="err" id="eRem"></div></div>' +
      '<p class="hint">Reminders show on top for bills that are overdue or due within these days.</p>' +
      '<div class="modal-actions"><button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn primary">Save</button></div></form>');
  }
  function submitMonth() {
    var sal = parseFloat($('mSal').value), bud = parseFloat($('mBud').value), rem = parseInt($('mRem').value, 10);
    if (!(rem >= 0 && rem <= 30)) { $('eRem').textContent = 'Enter 0 to 30 days.'; return; }
    state.months[viewMonth] = { salary: sal > 0 ? round2(sal) : 0, budget: bud > 0 ? round2(bud) : 0 };
    state.settings.remindDays = rem;
    save(); closeModal(); renderAll(); toast('Salary and budget saved');
  }

  function openBackup() {
    openModal('<h3>Backup &amp; restore</h3><p class="hint">Copy this text and keep it safe. To restore on another device, paste it here and press Import.</p>' +
      '<div class="field"><textarea id="bkText" spellcheck="false" aria-label="Backup data">' + esc(JSON.stringify(state)) + '</textarea><div class="err" id="eBk"></div></div>' +
      '<div class="modal-actions"><button type="button" class="btn" data-act="bk-copy">Copy</button><button type="button" class="btn" data-act="bk-download">Download file</button>' +
      '<button type="button" class="btn primary" data-act="bk-import">Import</button><button type="button" class="btn" data-act="close">Close</button></div>' +
      '<div class="field" style="margin-top:12px"><label for="bkFile">Or choose a backup file</label><input type="file" id="bkFile" accept=".json,application/json"></div>');
  }
  function importText(text) {
    var o;
    try { o = JSON.parse(text); } catch (e) { $('eBk').textContent = 'This is not valid backup data.'; return; }
    if (!o || (!Array.isArray(o.bills) && !Array.isArray(o.expenses))) { $('eBk').textContent = 'This is not a Kharcha Tracker backup.'; return; }
    snapshot(); state = sanitize(o); save(); closeModal(); renderAll(); toast('Backup imported', true);
  }

  function loadSample() {
    snapshot();
    var t = todayDate(), key = monthOf(ymd(t));
    var lastDay = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    function d(off) { /* date relative to today, kept inside the current month */
      var day = Math.min(lastDay, Math.max(1, t.getDate() + off));
      return key + '-' + pad(day);
    }
    function bill(name, c, amt, due, paid, repeat) {
      var id = uid('b');
      state.bills.push({ id: id, name: name, category: c, amount: amt, due: due, paid: paid, paidOn: paid ? due : null, repeat: repeat, series: id, day: parseYMD(due).getDate() });
    }
    var first = key + '-01', fifth = key + '-05';
    bill('House Rent', 'rent', 8000, first, true, true);
    bill('Electricity Bill', 'electricity', 1480, d(2), false, true);
    bill('Water Bill', 'water', 350, d(-2), false, true);
    bill('LPG Cylinder', 'gas', 903, d(6), false, false);
    bill('Jio Recharge', 'mobile', 299, fifth, true, true);
    bill('WiFi Bill', 'internet', 799, d(9), false, true);
    bill('LIC Premium', 'insurance', 2150, d(12), false, true);
    bill('Society Maintenance', 'society', 1200, d(15), false, true);
    [['Vegetables & fruits', 'milk', 640, -4], ['Kirana / ration', 'groceries', 2350, -6], ['Petrol', 'fuel', 1500, -3], ['Dinner out', 'food', 780, -1], ['Medicines', 'medical', 420, -5]]
      .forEach(function (x) { state.expenses.push({ id: uid('e'), title: x[0], category: x[1], amount: x[2], date: d(x[3]) }); });
    state.months[key] = { salary: 32000, budget: 26000 };
    save(); renderAll(); toast('Sample data added', true);
  }

  /* ---------- notifications ---------- */
  function notifySupported() { try { return 'Notification' in window; } catch (e) { return false; } }
  function updateAlertButton() {
    var b = $('btnAlerts');
    if (!notifySupported()) { b.hidden = true; return; }
    var on = Notification.permission === 'granted';
    b.textContent = on ? '🔔' : '🔕';
    b.title = on ? 'Notifications are on' : 'Enable reminder notifications';
  }
  function enableAlerts() {
    if (!notifySupported()) { toast('Notifications are not supported in this browser.'); return; }
    if (Notification.permission === 'granted') { toast('Notifications are already on.'); maybeNotify(); return; }
    if (Notification.permission === 'denied') { toast('Notifications are blocked. Allow them in the browser settings.'); return; }
    try {
      var r = Notification.requestPermission(function (p) { afterPermission(p); });
      if (r && r.then) r.then(afterPermission).catch(function () { toast('Could not ask for permission here.'); });
    } catch (e) { toast('Could not ask for permission here.'); }
  }
  function afterPermission(p) { updateAlertButton(); if (p === 'granted') { toast('Reminder notifications enabled'); maybeNotify(); } }
  function maybeNotify() {
    if (!notifySupported() || Notification.permission !== 'granted') return;
    var today = ymd(todayDate()), changed = false;
    dueReminders().forEach(function (b) {
      if (state.notified[b.id] === today) return;
      try { new Notification('Bill reminder: ' + b.name, { body: money(b.amount) + ' · ' + dueText(b).replace(/<[^>]+>/g, '').replace('✔ ', '') }); } catch (e) { /* ignore */ }
      state.notified[b.id] = today; changed = true;
    });
    if (changed) save();
  }

  /* ---------- theme ---------- */
  function isDark() {
    var t = state.settings.theme;
    if (t === 'auto') { try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; } }
    return t === 'dark';
  }
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', isDark() ? 'dark' : 'light');
    $('btnTheme').textContent = isDark() ? '☀️' : '🌙';
  }

  /* ---------- tabs ---------- */
  function syncTabs() {
    ['bills', 'expenses', 'insights'].forEach(function (t) { $('tab-' + t).hidden = t !== tab; });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      var on = b.getAttribute('data-tab') === tab;
      b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  /* ---------- events ---------- */
  function deleteBill(id) {
    var b = findBill(id); if (!b) return;
    snapshot();
    var wasRepeat = b.repeat;
    state.bills = state.bills.filter(function (x) { return x.id !== id; });
    if (wasRepeat) state.bills.forEach(function (x) { if (x.series === b.series) x.repeat = false; });
    save(); renderAll();
    toast(wasRepeat ? 'Bill deleted. Monthly repeat stopped.' : 'Bill deleted', true);
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act'), id = el.getAttribute('data-id');
    if (act === 'close-overlay') { if (ev.target === el) closeModal(); return; }
    switch (act) {
      case 'close': closeModal(); break;
      case 'pay':
        var b = findBill(id); if (!b) break;
        b.paid = !b.paid; b.paidOn = b.paid ? ymd(todayDate()) : null;
        save(); renderAll(); toast(b.paid ? 'Marked as paid ✔' : 'Marked as unpaid'); break;
      case 'edit-bill': var eb = findBill(id); if (eb) openEntryForm('bill', eb); break;
      case 'edit-exp': var ee = findExp(id); if (ee) openEntryForm('expense', ee); break;
      case 'del-bill': deleteBill(id); break;
      case 'del-exp':
        snapshot(); state.expenses = state.expenses.filter(function (x) { return x.id !== id; });
        save(); renderAll(); toast('Expense deleted', true); break;
      case 'add-bill': openEntryForm('bill'); break;
      case 'add-exp': openEntryForm('expense'); break;
      case 'kind-bill': openEntryForm('bill'); break;
      case 'kind-exp': openEntryForm('expense'); break;
      case 'preset':
        $('fName').value = el.getAttribute('data-name'); $('fCat').value = el.getAttribute('data-cat'); $('fRepeat').checked = true; $('fAmt').focus(); break;
      case 'month': openMonthForm(); break;
      case 'sample': loadSample(); break;
      case 'undo': undo(); break;
      case 'bk-copy':
        try { navigator.clipboard.writeText($('bkText').value).then(function () { toast('Copied'); }, function () { $('bkText').select(); toast('Press Ctrl+C to copy'); }); }
        catch (e) { $('bkText').select(); toast('Press Ctrl+C to copy'); }
        break;
      case 'bk-download':
        try {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([$('bkText').value], { type: 'application/json' }));
          a.download = 'kharcha-backup-' + ymd(todayDate()) + '.json'; document.body.appendChild(a); a.click(); a.remove();
        } catch (e) { toast('Download not available. Use Copy.'); }
        break;
      case 'bk-import': importText($('bkText').value); break;
    }
  });

  document.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (ev.target.id === 'entryForm') submitEntry(ev.target);
    else if (ev.target.id === 'monthForm') submitMonth();
  });
  document.addEventListener('change', function (ev) {
    if (ev.target.id === 'bkFile' && ev.target.files[0]) {
      var r = new FileReader();
      r.onload = function () { importText(String(r.result)); };
      r.readAsText(ev.target.files[0]);
    }
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeModal(); });

  $('btnAdd').addEventListener('click', function () { openEntryForm(tab === 'expenses' ? 'expense' : 'bill'); });
  $('prevMonth').addEventListener('click', function () { viewMonth = addMonths(viewMonth, -1); renderAll(); });
  $('nextMonth').addEventListener('click', function () { viewMonth = addMonths(viewMonth, 1); renderAll(); });
  $('btnToday').addEventListener('click', function () { viewMonth = monthOf(ymd(todayDate())); renderAll(); });
  $('btnTheme').addEventListener('click', function () { state.settings.theme = isDark() ? 'light' : 'dark'; save(); applyTheme(); });
  $('btnAlerts').addEventListener('click', enableAlerts);
  $('btnBackup').addEventListener('click', openBackup);
  $('search').addEventListener('input', function (e) { query = e.target.value; renderBills(); });
  $('filters').addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]'); if (!b) return;
    filter = b.getAttribute('data-filter');
    Array.prototype.forEach.call($('filters').children, function (c) { c.classList.toggle('active', c === b); });
    renderBills();
  });
  document.querySelector('.tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]'); if (!b) return;
    tab = b.getAttribute('data-tab'); syncTabs(); if (tab === 'insights') renderInsights();
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { renderAll(); maybeNotify(); } });
  setInterval(function () { renderAll(); maybeNotify(); }, 3600000);

  /* ---------- start ---------- */
  renderAll();
  syncTabs();
  maybeNotify();
  if (!storageOk) toast('Saving is blocked in this browser. Data will be lost on reload.');
  try {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function () {});
  } catch (e) { /* ignore */ }
})();
