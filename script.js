/* ============================================================
   STYLUS VINYL — script.js
   ============================================================ */

const COVER_PLACEHOLDER = 'https://stylusseoul.github.io/vinyl/images/prepare.jpg';

const state = {
  data:        [],
  filtered:    [],
  activeGenre: 'all',
  query:       '',
  limit:       40,
};

/* ── DOM ────────────────────────────────────────────────────── */
const listView        = document.getElementById('listView');
const detailView      = document.getElementById('detailView');
const searchInput     = document.getElementById('searchInput');
const searchWrap      = document.getElementById('searchWrap');
const btnToggleSearch = document.getElementById('btnToggleSearch');
const btnClear        = document.getElementById('btnClear');
const btnBack         = document.getElementById('btnBack');
const genreChips      = document.getElementById('genreChips');
const countLabel      = document.getElementById('countLabel');
const grid            = document.getElementById('grid');
const moreWrap        = document.getElementById('moreWrap');
const loadingEl       = document.getElementById('loading');
const emptyEl         = document.getElementById('emptyState');
const dCover          = document.getElementById('dCover');
const dAlbum          = document.getElementById('dAlbum');
const dArtist         = document.getElementById('dArtist');
const dMeta           = document.getElementById('dMeta');
const dTracks         = document.getElementById('dTracks');
const dTrackCount     = document.getElementById('dTrackCount');

/* ── Utils ──────────────────────────────────────────────────── */

function safeImage(imgEl, url, transformer = null) {
  const finalUrl = url ? (transformer ? transformer(url) : url) : COVER_PLACEHOLDER;

  imgEl.src = finalUrl;

  imgEl.onerror = () => {
    imgEl.onerror = null;
    imgEl.removeAttribute('srcset');
    imgEl.src = COVER_PLACEHOLDER;
  };
}

function toTracks(s) {
  if (Array.isArray(s)) return s;
  if (!s) return [];
  return s.split(/\s*;\s*|\s*·\s*|\s*\|\s*/).map(t => t.trim()).filter(Boolean);
}

function isValid(it) {
  const a = (it.album  || '').trim();
  const b = (it.artist || '').trim();
  return (a || b) && a.toLowerCase() !== 'ok' && b.toLowerCase() !== 'ok';
}

function sortByArtist(arr) {
  return [...arr].sort((a, b) =>
    (a.artist || '').localeCompare(b.artist || '', 'ko', { sensitivity: 'base' })
  );
}

function sortRandom(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function proxify(url, { w, h, fit = 'cover' } = {}) {
  if (!url) return '';
  let s = String(url).trim()
    .replace(/&amp;/g, '&')
    .replace(/^\/\//, 'https://')
    .replace(/^http:\/\//, 'https://');
  const core = s.replace(/^https?:\/\//, '');
  let q = `https://images.weserv.nl/?url=${encodeURIComponent(core)}`;
  if (w) q += `&w=${w}`;
  if (h) q += `&h=${h}`;
  q += `&fit=${fit}`;
  return q;
}
const thumb = url => proxify(url, { w: 400, h: 400, fit: 'cover' });
const large = url => proxify(url, { w: 900, h: 900, fit: 'contain' });

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Fetch ──────────────────────────────────────────────────── */

function parseGviz(text) {
  const json = JSON.parse(text.replace(/^[^{]*/, '').replace(/\);\s*$/, ''));
  const cols = json.table.cols.map(c => c.label || c.id);
  return json.table.rows
    .filter(r => r && r.c)
    .map(r => {
      const row = {};
      r.c.forEach((cell, i) => { row[cols[i]] = cell ? (cell.v ?? '') : ''; });
      return row;
    });
}

function mapGvizRow(row) {
  const g = k => {
    for (const key of Object.keys(row))
      if (key.toLowerCase() === k.toLowerCase()) return row[key] ?? '';
    return '';
  };
  return {
    artist:  String(g('Artist') || ''),
    album:   String(g('Album')  || ''),
    year:    String(g('Year')   || '').replace(/\.0$/, ''),
    genre:   String(g('Genre')  || ''),
    cover:   String(g('cover')  || g('Cover') || ''),
    discogs: String(g('Discogs URL') || g('Discogs') || ''),
    tracks:  toTracks(g('Tracks')),
  };
}

async function fetchData() {
  const res = await fetch(SHEET_GVIZ_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = parseGviz(await res.text());
  return rows.map(mapGvizRow).filter(isValid);
}

/* ── Filters ────────────────────────────────────────────────── */

function applyFilters() {
  const q = state.query.toLowerCase();
  const filtered = state.data.filter(it => {
    const genreOk = state.activeGenre === 'all' || it.genre.trim() === state.activeGenre;
    if (!genreOk) return false;
    if (!q) return true;
    return [it.album, it.artist, it.genre, ...it.tracks].join(' ').toLowerCase().includes(q);
  });

  state.filtered = (state.activeGenre === 'all' && !q)
    ? sortRandom(filtered)
    : sortByArtist(filtered);

  window.scrollTo(0, 0);
  resetGrid();
}

/* ── 카드 생성 ───────────────────────────────────────────────── */

function createCard(item) {
  const card = document.createElement('article');
  card.className = 'card';
  card.addEventListener('click', () => openDetail(item));

  const wrap = document.createElement('div');
  wrap.className = 'card-thumb-wrap';

  const img = document.createElement('img');
  img.className   = 'card-thumb';
  img.loading     = 'lazy';
  img.decoding    = 'async';
  img.alt         = item.album || '';

  safeImage(img, item.cover, thumb);

  wrap.appendChild(img);

  const info = document.createElement('div');
  info.className = 'card-info';
  info.innerHTML = `
    <p class="card-album">${esc(item.album  || '(제목 없음)')}</p>
    <p class="card-artist">${esc(item.artist || '')}</p>
  `;

  card.appendChild(wrap);
  card.appendChild(info);
  return card;
}

/* ── Detail ─────────────────────────────────────────────────── */

function openDetail(item) {
  safeImage(dCover, item.cover, large);

  if (item.cover) {
    dCover.srcset = [
      proxify(item.cover, { w: 390, h: 390, fit: 'cover' }) + ' 390w',
      proxify(item.cover, { w: 750, h: 750, fit: 'cover' }) + ' 750w',
      proxify(item.cover, { w: 900, h: 900, fit: 'cover' }) + ' 900w',
    ].join(', ');
  } else {
    dCover.removeAttribute('srcset');
  }

  dCover.sizes  = '100vw';

  dAlbum.textContent  = item.album  || '';
  dArtist.textContent = item.artist || '';

  dMeta.innerHTML = '';
  [item.year, item.genre].filter(Boolean).forEach(val => {
    const span = document.createElement('span');
    span.className  = 'meta-tag';
    span.textContent = val;
    dMeta.appendChild(span);
  });

  const tracks = item.tracks || [];
  dTrackCount.textContent = `${tracks.length}곡`;
  dTracks.innerHTML = '';

  tracks.forEach((t, i) => {
    const li = document.createElement('li');
    li.className = 'track-item';
    li.innerHTML = `<span class="track-num">${i + 1}</span><span class="track-name">${esc(t)}</span>`;
    dTracks.appendChild(li);
  });

  listView.classList.add('hidden');
  detailView.classList.remove('hidden');
  window.scrollTo(0, 0);
  history.pushState({ detail: true }, '', '#detail');
}
