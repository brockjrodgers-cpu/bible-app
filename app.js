/* Daily Bible PWA - no build step, no dependencies. */
(() => {
'use strict';
const $view = document.getElementById('view');
const $title = document.getElementById('pageTitle');
const $back = document.getElementById('backBtn');
const AHEAD = 7;               // how many days ahead can be browsed
const cache = {};
const getJSON = p => cache[p] || (cache[p] = fetch(p).then(r => { if (!r.ok) throw new Error(p); return r.json(); }));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// ---------- dates (device-local) ----------
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const todayISO = () => iso(new Date());
const fmtLong = s => parse(s).toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'});
const fmtShort = s => parse(s).toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'});
const relLabel = s => {
  const t = todayISO();
  if (s === t) return '<span class="chip today">Today</span>';
  if (s === addDays(t, -1)) return '<span class="chip">Yesterday</span>';
  if (s === addDays(t, 1)) return '<span class="chip future">Tomorrow</span>';
  return s > t ? '<span class="chip future">Upcoming</span>' : '<span class="chip">Past</span>';
};

// ---------- theme ----------
const applyTheme = () => { const t = localStorage.getItem('theme'); if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
applyTheme();
document.getElementById('themeBtn').onclick = () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  localStorage.setItem('theme', dark ? 'light' : 'dark'); applyTheme();
};
$back.onclick = () => history.length > 1 ? history.back() : (location.hash = '#/library');

function setChrome(title, tab, back) {
  $title.textContent = title;
  document.title = title === 'Daily Bible' ? title : `${title} · Daily Bible`;
  $back.hidden = !back;
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
}
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
}

// ---------- renderers for daily items ----------
function devoCard(d, open) {
  if (!d) return `<div class="card"><summary><div class="when">4:30 AM · Bible book devotional</div>
    <div class="ttl empty">No book devotional for this day</div><div class="sub">Volume 1 (Genesis–Amos) runs Nov 9 – Dec 8, 2026.</div></summary></div>`;
  return `<details class="card"${open ? ' open' : ''}><summary><span class="more"></span>
    <div class="when">4:30 AM · Christ in All the Scriptures</div>
    <div class="ttl">${esc(d.book)}: ${esc(d.title.replace(d.book + ': ', ''))}</div>
    <div class="sub">Day ${d.n} of ${d.of}</div></summary><div class="body">${d.html}</div></details>`;
}
function tidbitCard(t, date) {
  const head = `<div class="when">7:00 AM · Theology tidbit</div>`;
  if (!t) {
    const msg = date > todayISO() || (date === todayISO()) ? 'Arrives each morning'
      : 'No tidbit saved in the app for this day';
    const sub = date >= todayISO() ? 'A new quote and a longer read come each morning at 7:00. They aren’t written ahead of time.' : '';
    return `<div class="card"><summary>${head}<div class="ttl empty">${msg}</div><div class="sub">${sub}</div></summary></div>`;
  }
  const q = t.quote || {}, r = t.read || {};
  let qhtml = '';
  if (q.text) qhtml += `<p class="quote">“${esc(q.text)}”</p>`;
  qhtml += `<div class="attr">${esc(q.author)}${q.work ? ', <i>' + esc(q.work) + '</i>' : ''}${q.url ? ` · <a href="${esc(q.url)}" target="_blank" rel="noopener">source</a>` : ''}</div>`;
  if (!q.text && q.topic) qhtml += `<p>${esc(q.topic)}</p>`;
  if (q.comment) qhtml += `<p>${esc(q.comment)}</p>`;
  const rhtml = r.title ? `<div class="read"><div class="label" style="margin-top:0">Long read</div>
    <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>
    <div class="attr">${esc(r.author)}${r.source ? ' · ' + esc(r.source) : ''}</div>${r.note ? `<p style="margin:6px 0 0">${esc(r.note)}</p>` : ''}</div>` : '';
  const summ = q.text ? esc(q.author) : `${esc(q.author)}${q.work ? ' · ' + esc(q.work) : ''}`;
  return `<details class="card" open><summary><span class="more"></span>${head}<div class="ttl">${summ}</div>
    <div class="sub">${r.title ? 'Long read: ' + esc(r.title) : ''}</div></summary>
    <div class="body"><div class="label">Quote</div>${qhtml}${rhtml}</div></details>`;
}
function familyBody(f) {
  const p = s => esc(s);
  return `<p class="ref" style="margin-top:12px">${esc(f.scriptureRef)} (ESV)</p>
    ${f.scriptureText ? `<div class="scripture">${p(f.scriptureText)}</div>` : ''}
    ${f.context ? `<div class="label">Context</div><p>${p(f.context)}</p>` : ''}
    ${f.jesusConnection ? `<div class="label">Connection to Jesus</div><p>${p(f.jesusConnection)}</p>` : ''}
    ${f.application ? `<div class="label">Family application</div><p>${p(f.application)}</p>` : ''}
    ${f.talk ? `<div class="label">Talk question</div><p><b>${p(f.talk)}</b></p>` : ''}
    ${f.prayer ? `<div class="label">Prayer</div><p class="prayer">${p(f.prayer)}</p>` : ''}`;
}
function familyCard(f, open) {
  if (!f) return `<div class="card"><summary><div class="when">7:00 PM · Family devotional</div>
    <div class="ttl empty">No family devotional planned</div><div class="sub">The 60-day plan runs Mon Nov 16, 2026 – Thu Jan 14, 2027 (see the Family tab).</div></summary></div>`;
  return `<details class="card"${open ? ' open' : ''}><summary><span class="more"></span>
    <div class="when">7:00 PM · Family devotional</div><div class="ttl">${esc(f.theme)}</div>
    <div class="sub">${esc(f.scriptureRef)} · Day ${esc(f.day)} of 60</div></summary>
    <div class="body">${familyBody(f)}<p class="note-muted">This is the plan’s text. The evening message may expand on it.</p></div></details>`;
}

// ---------- views ----------
async function viewDay(date) {
  const data = await getJSON('data/days.json');
  const t = todayISO();
  const min = data.meta.first, max = addDays(t, AHEAD);
  if (date < min) date = min;
  if (date > max) { date = max; setTimeout(() => toast('You can look up to a week ahead.'), 50); }
  setChrome(date === t ? 'Today' : fmtShort(date), 'today', false);
  const d = data.days[date] || {};
  const prev = addDays(date, -1), next = addDays(date, 1);
  $view.innerHTML = `
    <div class="daynav">
      <button id="prevDay" aria-label="Previous day" ${prev < min ? 'disabled' : ''}>‹</button>
      <div class="d"><b>${esc(fmtLong(date).replace(/, \d{4}$/, ''))}</b><small>${relLabel(date)} ${date !== t ? '· <a href="#/today">back to today</a>' : ''}</small></div>
      <button id="nextDay" aria-label="Next day" ${next > max ? 'disabled' : ''}>›</button>
    </div>
    ${devoCard(d.devo, true)}
    ${tidbitCard(d.tidbit, date)}
    ${familyCard(d.family, false)}
    <p class="note-muted">Swipe or use the arrows for other days · <a href="#/calendar">all days</a></p>`;
  document.getElementById('prevDay').onclick = () => go(`#/day/${prev}`);
  document.getElementById('nextDay').onclick = () => go(`#/day/${next}`);
  // swipe between days
  let x0 = null, y0 = null;
  $view.ontouchstart = e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; };
  $view.ontouchend = e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 80 && Math.abs(dx) > 2 * Math.abs(dy)) {
      if (dx < 0 && next <= max) go(`#/day/${next}`, true);
      if (dx > 0 && prev >= min) go(`#/day/${prev}`, true);
    }
  };
}
function go(h, replace) { if (replace) location.replace(h); else location.hash = h; }

async function viewCalendar() {
  setChrome('All days', 'calendar', false);
  const data = await getJSON('data/days.json');
  const t = todayISO(), max = addDays(t, AHEAD);
  let html = '', month = '';
  const dates = Object.keys(data.days).filter(d => d <= max).sort().reverse();
  html += `<p class="note-muted" style="margin-top:4px">Newest first · up to a week ahead</p>`;
  for (const ds of dates) {
    const m = parse(ds).toLocaleDateString(undefined, {month: 'long', year: 'numeric'});
    if (m !== month) { html += `<div class="month">${m}</div>`; month = m; }
    const d = data.days[ds], dt = parse(ds);
    const q = d.tidbit && d.tidbit.quote;
    html += `<a class="dayrow${ds === t ? ' isToday' : ''}" href="#/day/${ds}">
      <div class="dn"><b>${dt.getDate()}</b><small>${dt.toLocaleDateString(undefined, {weekday: 'short'})}</small></div>
      <div class="it">
        ${ds === t ? '<div>' + relLabel(ds) + '</div>' : ds > t ? '<div><span class="chip future">Upcoming</span></div>' : ''}
        ${d.devo ? `<div><span>Book</span>${esc(d.devo.book)}: ${esc(d.devo.title)}</div>` : ''}
        ${q ? `<div><span>Tidbit</span>${esc(q.author)}${d.tidbit.read ? ' · ' + esc(d.tidbit.read.title) : ''}</div>` : ''}
        ${d.family ? `<div><span>Family</span>${esc(d.family.theme)} · ${esc(d.family.scriptureRef)}</div>` : ''}
      </div></a>`;
  }
  $view.innerHTML = html;
  const cur = $view.querySelector('.isToday'); if (cur) cur.scrollIntoView({block: 'center'});
}

async function viewLibrary() {
  setChrome('Library', 'library', false);
  const lib = await getJSON('data/library.json');
  $view.innerHTML = `<p class="note-muted" style="margin-top:4px">Bible studies and books made for you. Everything works offline except the Overview PDF, which saves once you open it.</p>` +
    lib.map(it => it.type === 'pdf'
      ? `<a class="libitem" href="${esc(it.pdf)}" target="_blank" rel="noopener"><b>${esc(it.title)}</b><small>${esc(it.sub)} · PDF ${esc(it.pdfSize || '')}</small></a>`
      : `<a class="libitem" href="#/library/${esc(it.id)}"><b>${esc(it.title)}</b><small>${esc(it.sub)}</small></a>`).join('');
}
const pdfBtn = it => it.pdf ? `<a class="btn" href="${esc(it.pdf)}" target="_blank" rel="noopener">⬇ PDF${it.pdfSize ? ' (' + esc(it.pdfSize) + ')' : ''}</a>` : '';

// ----- Whole Bible Overview -----
async function viewOverviewHome(tab, q) {
  const lib = await getJSON('data/library.json'), it = lib.find(x => x.id === 'overview');
  setChrome('Bible Overview', 'library', true);
  const ov = await getJSON('data/overview.json');
  tab = tab || sessionStorage.getItem('ovtab') || 'ot';
  const tabs = [['front', 'Intro & timelines'], ['ot', 'Old Testament'], ['nt', 'New Testament']];
  let body = '';
  const groupOf = {front: ['Front matter', 'Back matter'], ot: ['Old Testament'], nt: ['New Testament']}[tab];
  const secs = ov.filter(s => groupOf.includes(s.group));
  if (tab === 'front') {
    body = `<div class="toclist">` + secs.map(s => `<a href="#/library/overview/${s.id}">${esc(s.title)}</a>`).join('') + `</div>`;
  } else {
    let div = null;
    for (const s of secs) {
      if (s.kind === 'division') { if (div) body += '</div>'; body += `<div class="tocdiv"><a href="#/library/overview/${s.id}" style="color:inherit;text-decoration:none">${esc(s.title)}</a></div><div class="bookgrid">`; div = s; continue; }
      body += `<a href="#/library/overview/${s.id}">${esc(s.title)}</a>`;
    }
    if (div) body += '</div>';
  }
  $view.innerHTML = `<h2 style="margin:4px 0 0;font-size:23px">${esc(it.title)}</h2>
    <p class="attr" style="margin:2px 0 6px">${esc(it.sub)}</p>
    <div class="btnrow">${pdfBtn(it)}</div>
    <input class="search" id="ovq" type="search" placeholder="Search the overview…" value="${esc(q || '')}" autocomplete="off">
    <div id="ovres"></div>
    <div id="ovtoc"><div class="seg">${tabs.map(([k, l]) => `<button data-k="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div>${body}</div>`;
  $view.querySelectorAll('.seg button').forEach(b => b.onclick = () => { sessionStorage.setItem('ovtab', b.dataset.k); viewOverviewHome(b.dataset.k, document.getElementById('ovq').value); });
  const input = document.getElementById('ovq');
  const run = () => {
    const term = input.value.trim(), res = document.getElementById('ovres'), toc = document.getElementById('ovtoc');
    if (term.length < 2) { res.innerHTML = ''; toc.hidden = false; return; }
    toc.hidden = true;
    const lc = term.toLowerCase(); const hits = [];
    for (const s of ov) {
      const i = s.text.toLowerCase().indexOf(lc), ti = s.title.toLowerCase().includes(lc);
      if (i < 0 && !ti) continue;
      let n = 0, p = -1; const low = s.text.toLowerCase(); while ((p = low.indexOf(lc, p + 1)) >= 0) n++;
      const j = Math.max(0, i), a = Math.max(0, j - 60);
      const snip = (a > 0 ? '…' : '') + esc(s.text.slice(a, j)) + '<mark>' + esc(s.text.substr(j, term.length)) + '</mark>' + esc(s.text.slice(j + term.length, j + term.length + 90)) + '…';
      hits.push({s, n: n + (ti ? 50 : 0), snip: i >= 0 ? snip : ''});
    }
    hits.sort((x, y) => y.n - x.n);
    res.innerHTML = hits.length ? `<p class="note-muted">${hits.length} section${hits.length > 1 ? 's' : ''} mention “${esc(term)}”</p>` +
      hits.slice(0, 60).map(h => `<a class="result" href="#/library/overview/${h.s.id}?q=${encodeURIComponent(term)}"><b>${esc(h.s.title)}</b><small>${h.snip}</small></a>`).join('')
      : `<p class="note-muted">No matches for “${esc(term)}”.</p>`;
  };
  input.oninput = run; if (q) run();
}
function highlight(root, term) {
  if (!term) return null;
  const lc = term.toLowerCase(); let first = null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = []; let n; while ((n = walker.nextNode())) if (n.nodeValue.toLowerCase().includes(lc) && !n.parentNode.closest('svg')) nodes.push(n);
  for (const node of nodes.slice(0, 200)) {
    const v = node.nodeValue, frag = document.createDocumentFragment(); let i = 0, j;
    while ((j = v.toLowerCase().indexOf(lc, i)) >= 0) {
      frag.appendChild(document.createTextNode(v.slice(i, j)));
      const m = document.createElement('mark'); m.textContent = v.substr(j, term.length); frag.appendChild(m); first = first || m; i = j + term.length;
    }
    frag.appendChild(document.createTextNode(v.slice(i))); node.parentNode.replaceChild(frag, node);
  }
  return first;
}
async function viewOverviewSection(id, anchor, q) {
  const ov = await getJSON('data/overview.json');
  const i = ov.findIndex(s => s.id === id);
  if (i < 0) return viewOverviewHome();
  const s = ov[i], prev = ov[i - 1], next = ov[i + 1];
  setChrome(s.title, 'library', true);
  $view.innerHTML = `<div class="btnrow" style="margin-top:0"><a class="btn" href="#/library/overview">☰ Contents</a>${s.division ? `<span class="chip" style="align-self:center">${esc(s.division)}</span>` : ''}</div>
    <div class="ov">${s.html}</div>
    <div class="pager">${prev ? `<a href="#/library/overview/${prev.id}">‹ ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a class="nx" href="#/library/overview/${next.id}">${esc(next.title)} ›</a>` : '<span></span>'}</div>`;
  $view.querySelectorAll('.ov table').forEach(t => { const w = document.createElement('div'); w.className = 'tablewrap'; t.parentNode.insertBefore(w, t); w.appendChild(t); });
  const m = highlight($view.querySelector('.ov'), q);
  const target = anchor ? document.getElementById(anchor) : m;
  if (target) { target.scrollIntoView({block: 'center'}); if (anchor) target.classList.add('flash'); } else window.scrollTo(0, 0);
}

// ----- list-style books (catechism, psalms, songs) -----
async function viewList(it, itemId) {
  const data = await getJSON(it.data);
  const items = data.items;
  if (!itemId) {
    setChrome(it.title, 'library', true);
    $view.innerHTML = `<h2 style="margin:4px 0 0;font-size:23px">${esc(it.title)}</h2><p class="attr" style="margin:2px 0 6px">${esc(it.sub)}</p>
      <div class="btnrow">${pdfBtn(it)}</div>${data.source ? `<p class="attr">Catechism text: ${esc(data.source)}</p>` : ''}
      ${data.intro ? `<div class="body">${data.intro}</div>` : ''}
      <div class="toclist">${items.map(x => `<a href="#/library/${it.id}/${x.id}"><b>${esc(x.label)}</b>${x.title && x.title !== x.label ? ' · ' + esc(x.title) : ''}</a>`).join('')}</div>`;
    return;
  }
  const i = items.findIndex(x => x.id === itemId), x = items[i]; if (!x) return viewList(it);
  setChrome(x.label, 'library', true);
  const prev = items[i - 1], next = items[i + 1];
  $view.innerHTML = `<div class="btnrow" style="margin-top:0"><a class="btn" href="#/library/${it.id}">☰ ${esc(it.title)}</a></div>
    <h2 style="margin:6px 0 4px">${esc(x.label)}${x.title && !x.html.includes('<h1') ? ': ' + esc(x.title) : ''}</h2>
    <div class="body">${x.html}</div>
    <div class="pager">${prev ? `<a href="#/library/${it.id}/${prev.id}">‹ ${esc(prev.label)}</a>` : '<span></span>'}${next ? `<a class="nx" href="#/library/${it.id}/${next.id}">${esc(next.label)} ›</a>` : '<span></span>'}</div>`;
  $view.querySelectorAll('.body h1').forEach(h => h.remove());
  window.scrollTo(0, 0);
}
// ----- day-based books (Vol 1, family plan) -----
async function viewDaysBook(it, n) {
  const data = await getJSON('data/days.json');
  const key = it.type === 'days' ? 'devo' : 'family';
  const list = Object.keys(data.days).sort().filter(d => data.days[d][key]).map(d => ({date: d, x: data.days[d][key]}));
  if (!n) {
    setChrome(it.title, 'library', true);
    $view.innerHTML = `<h2 style="margin:4px 0 0;font-size:23px">${esc(it.title)}</h2><p class="attr" style="margin:2px 0 6px">${esc(it.sub)}</p>
      <div class="btnrow">${pdfBtn(it)}</div><div class="toclist">${list.map((e, k) => `<a href="#/library/${it.id}/${k + 1}"><b>${esc(fmtShort(e.date))}</b> · ${key === 'devo' ? esc(e.x.book) + ': ' + esc(e.x.title) : esc(e.x.theme) + ' (' + esc(e.x.scriptureRef) + ')'}</a>`).join('')}</div>`;
    return;
  }
  const k = Number(n) - 1, e = list[k]; if (!e) return viewDaysBook(it);
  setChrome(key === 'devo' ? `Day ${e.x.n}: ${e.x.book}` : e.x.theme, 'library', true);
  const prev = list[k - 1], next = list[k + 1];
  $view.innerHTML = `<div class="btnrow" style="margin-top:0"><a class="btn" href="#/library/${it.id}">☰ All days</a><a class="btn" href="#/day/${e.date}">Open ${esc(fmtShort(e.date))}</a></div>
    <p class="attr">${esc(fmtLong(e.date))}</p>
    ${key === 'devo' ? `<h2 style="margin:4px 0">${esc(e.x.book)}: ${esc(e.x.title)}</h2><div class="body">${e.x.html}</div>`
      : `<h2 style="margin:4px 0">${esc(e.x.theme)}</h2><div class="body">${familyBody(e.x)}</div>`}
    <div class="pager">${prev ? `<a href="#/library/${it.id}/${k}">‹ ${esc(fmtShort(prev.date))}</a>` : '<span></span>'}${next ? `<a class="nx" href="#/library/${it.id}/${k + 2}">${esc(fmtShort(next.date))} ›</a>` : '<span></span>'}</div>`;
  window.scrollTo(0, 0);
}


// ----- Catechism tab -----
async function viewCatechism(itemId) {
  const lib = await getJSON('data/library.json'), it = lib.find(x => x.id === 'catechism');
  const data = await getJSON('data/catechism.json'), items = data.items;
  if (itemId === 'list') {
    const last = localStorage.getItem('catechismDay');
    setChrome('Catechism', 'catechism', false);
    $view.innerHTML = `<h2 style="margin:4px 0 0;font-size:23px">${esc(it.title)}</h2><p class="attr" style="margin:2px 0 6px">${esc(it.sub)}</p>
      <div class="btnrow">${pdfBtn(it)}</div><p class="attr">Catechism text: ${esc(data.source)}</p>
      <div class="toclist">${items.map(x => `<a href="#/catechism/${x.id}" class="${x.id === last ? 'cur' : ''}"><span class="dt">${esc(fmtShort(x.date))}</span><b>${esc(x.label)}</b> · ${esc(x.title)}${x.id === last ? ' <span class="chip">last read</span>' : ''}</a>`).join('')}</div>`;
    window.scrollTo(0, 0); return;
  }
  const t = todayISO();
  const byDate = (items.find(x => x.date === t) || (t < items[0].date ? items[0] : t > items[items.length - 1].date ? items[items.length - 1] : items[0])).id;
  if (!itemId || !items.some(x => x.id === itemId)) {
    // same calendar day: reopen the last day read; a new day: open that day's catechism by date
    itemId = localStorage.getItem('catechismOpenedOn') === t && localStorage.getItem('catechismDay') || byDate;
  }
  if (!items.some(x => x.id === itemId)) itemId = items[0].id;
  localStorage.setItem('catechismDay', itemId); localStorage.setItem('catechismOpenedOn', t);
  const i = items.findIndex(x => x.id === itemId), x = items[i], prev = items[i - 1], next = items[i + 1];
  setChrome('Catechism', 'catechism', false);
  $view.innerHTML = `<div class="daypick">
      <button id="cPrev" aria-label="Previous day" ${prev ? '' : 'disabled'}>‹</button>
      <div class="mid"><b>${esc(x.label)} of ${items.length} · ${esc(fmtShort(x.date))}</b><small>${relLabel(x.date)} ${esc(x.title)}${x.id !== byDate ? ` · <a href="#/catechism/${byDate}">today’s</a>` : ''}</small></div>
      <button id="cNext" aria-label="Next day" ${next ? '' : 'disabled'}>›</button></div>
    <div class="btnrow" style="margin-top:0"><a class="btn" href="#/catechism/list">☰ All 30 days</a>${pdfBtn(it)}</div>
    <div class="card"><div class="body" style="border-top:0;padding-top:12px">${x.html}</div></div>`;
  if (prev) document.getElementById('cPrev').onclick = () => go(`#/catechism/${prev.id}`, true);
  if (next) document.getElementById('cNext').onclick = () => go(`#/catechism/${next.id}`, true);
  swipe(prev && `#/catechism/${prev.id}`, next && `#/catechism/${next.id}`);
  window.scrollTo(0, 0);
}
// ----- Family tab -----
async function viewFamily(arg) {
  const lib = await getJSON('data/library.json'), it = lib.find(x => x.id === 'family-plan');
  const data = await getJSON('data/days.json');
  const list = Object.keys(data.days).sort().filter(d => data.days[d].family);
  const t = todayISO();
  if (arg === 'list') {
    setChrome('Family', 'family', false);
    $view.innerHTML = `<h2 style="margin:4px 0 0;font-size:23px">${esc(it.title)}</h2><p class="attr" style="margin:2px 0 6px">${esc(it.sub)}</p>
      <div class="btnrow">${pdfBtn(it)}</div>
      <div class="toclist">${list.map(d => { const f = data.days[d].family; return `<a id="f-${d}" href="#/family/${d}" class="${d === t ? 'cur' : ''}"><span class="dt">${esc(fmtShort(d))}</span><b>Day ${esc(f.day)}</b> · ${esc(f.theme)}</a>`; }).join('')}</div>`;
    const cur = document.getElementById('f-' + t); if (cur) cur.scrollIntoView({block: 'center'}); else window.scrollTo(0, 0);
    return;
  }
  let date = /^\d{4}-\d\d-\d\d$/.test(arg || '') ? arg : t;
  if (date < list[0]) date = list[0];   // before the plan starts, open Day 1
  if (date > list[list.length - 1]) date = list[list.length - 1];
  if (!data.days[date] || !data.days[date].family) date = list[0];
  const k = list.indexOf(date), f = data.days[date].family, prev = list[k - 1], next = list[k + 1];
  setChrome('Family', 'family', false);
  $view.innerHTML = `<div class="daypick">
      <button id="fPrev" aria-label="Previous day" ${prev ? '' : 'disabled'}>‹</button>
      <div class="mid"><b>${esc(fmtLong(date).replace(/, \d{4}$/, ''))}</b><small>${relLabel(date)} · Day ${esc(f.day)} of ${list.length}${t < list[0] && k === 0 ? ' · starts ' + (list[0] === addDays(t, 1) ? 'tomorrow' : esc(fmtShort(list[0]))) : ''}${date !== t && list.includes(t) ? ' · <a href="#/family">today</a>' : ''}</small></div>
      <button id="fNext" aria-label="Next day" ${next ? '' : 'disabled'}>›</button></div>
    <div class="btnrow" style="margin-top:0"><a class="btn" href="#/family/list">☰ All 60 days</a>${pdfBtn(it)}</div>
    <div class="card"><div class="body" style="border-top:0;padding-top:4px"><h2 style="margin:12px 0 0">${esc(f.theme)}</h2>${familyBody(f)}
    <p class="note-muted">The 7 PM plan for this day. The evening message may expand on it.</p></div></div>`;
  if (prev) document.getElementById('fPrev').onclick = () => go(`#/family/${prev}`, true);
  if (next) document.getElementById('fNext').onclick = () => go(`#/family/${next}`, true);
  swipe(prev && `#/family/${prev}`, next && `#/family/${next}`);
  window.scrollTo(0, 0);
}
function swipe(prevH, nextH) {
  let x0 = null, y0 = null;
  $view.ontouchstart = e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; };
  $view.ontouchend = e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 80 && Math.abs(dx) > 2 * Math.abs(dy)) { if (dx < 0 && nextH) go(nextH, true); if (dx > 0 && prevH) go(prevH, true); }
  };
}

// ---------- router ----------
async function route() {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  $view.ontouchstart = $view.ontouchend = null;
  const raw = location.hash.replace(/^#/, '') || '/today';
  const [path, qs] = raw.split('?');
  const q = new URLSearchParams(qs || '').get('q');
  const p = path.split('/').filter(Boolean).map(decodeURIComponent);
  try {
    if (p[0] === 'today' || !p[0]) await viewDay(todayISO());
    else if (p[0] === 'day' && /^\d{4}-\d\d-\d\d$/.test(p[1] || '')) await viewDay(p[1]);
    else if (p[0] === 'calendar') await viewCalendar();
    else if (p[0] === 'catechism') await viewCatechism(p[1]);
    else if (p[0] === 'family') await viewFamily(p[1]);
    else if (p[0] === 'library' && !p[1]) await viewLibrary();
    else if (p[0] === 'library' && p[1] === 'overview') { p[2] ? await viewOverviewSection(p[2], p[3], q) : await viewOverviewHome(null, q); }
    else if (p[0] === 'library') {
      const lib = await getJSON('data/library.json'), it = lib.find(x => x.id === p[1]);
      if (!it) await viewLibrary();
      else if (it.type === 'list') await viewList(it, p[2]);
      else if (it.type === 'days' || it.type === 'family') await viewDaysBook(it, p[2]);
      else await viewLibrary();
    } else await viewDay(todayISO());
    if (!p[0] || p[0] === 'today' || p[0] === 'day' || p[0] === 'library' && !p[1]) window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    $view.innerHTML = `<p class="note-muted">Couldn’t load this page. If you’re offline, open the app once while online so it can save everything.</p>`;
  }
}
addEventListener('hashchange', route);
// in-page anchors (e.g. footnotes) scroll instead of changing the route
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.getAttribute('href').startsWith('#/')) return;
  e.preventDefault();
  const el = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
  if (el) { el.scrollIntoView({block: 'center'}); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2300); }
});
// re-check the date when the app is brought back (e.g. opened the next morning)
let lastDay = todayISO();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && todayISO() !== lastDay) { lastDay = todayISO(); if (/^#?\/?(today)?$/.test(location.hash.replace('#/', '')) || location.hash === '#/today') route(); }
});
route();

// ---------- service worker ----------
if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'activated' && hadController) {
            Object.keys(cache).forEach(k => delete cache[k]); route(); toast('Updated with the latest readings');
          }
        });
      });
    }).catch(e => console.warn('SW registration failed', e));
  });
}
})();
