/* ============================================================
   STYLUS VINYL — script.js
   ============================================================ */

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

  // ✅ 필터 변경 시 → 그리드 완전 초기화 후 재렌더
  resetGrid();
}

/* ── Genre chips ────────────────────────────────────────────── */

function buildGenreChips() {
  const genres = [...new Set(state.data.map(d => (d.genre || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ko', { sensitivity: 'base' }));
  genreChips.innerHTML = '';
  genres.forEach(g => {
    const btn = document.createElement('button');
    btn.className   = 'genre-chip';
    btn.dataset.genre = g;
    btn.textContent = g;
    btn.addEventListener('click', () => selectGenre(g));
    genreChips.appendChild(btn);
  });
  document.getElementById('chipAll').addEventListener('click', () => selectGenre('all'));
}

function selectGenre(genre) {
  state.activeGenre = genre;
  document.querySelectorAll('.genre-chip').forEach(c =>
    c.classList.toggle('active', c.dataset.genre === genre)
  );
  applyFilters();
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
  img.src         = item.cover ? thumb(item.cover) : COVER_PLACEHOLDER;
  img.onerror     = () => { img.src = COVER_PLACEHOLDER; };
  img.alt         = item.album || '';
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

/* ── Render ─────────────────────────────────────────────────── */

// 현재 DOM에 렌더된 카드 수
let renderedCount = 0;
let observer      = null;

/**
 * resetGrid — 필터·검색 변경 시만 호출
 * 그리드를 비우고 처음부터 다시 그림
 */
function resetGrid() {
  if (observer) { observer.disconnect(); observer = null; }
  grid.innerHTML    = '';
  moreWrap.innerHTML = '';
  renderedCount     = 0;
  state.limit       = 40;

  const total = state.filtered.length;
  loadingEl.classList.add('hidden');
  countLabel.textContent = `${total} records`;

  if (total === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  appendCards(); // 첫 40장 동기 렌더
}

/**
 * appendCards — 무한스크롤 시 호출
 * 기존 카드는 절대 건드리지 않고 새 카드만 추가
 */
function appendCards() {
  const total = state.filtered.length;
  const shown = Math.min(state.limit, total);

  if (renderedCount < shown) {
    const frag = document.createDocumentFragment();
    state.filtered.slice(renderedCount, shown).forEach(item => {
      frag.appendChild(createCard(item));
    });
    grid.appendChild(frag);
    renderedCount = shown;
  }

  // sentinel 갱신 — 더 불러올 게 있을 때만
  moreWrap.innerHTML = '';
  if (renderedCount < total) {
    const sentinel = document.createElement('div');
    sentinel.id = 'sentinel';
    moreWrap.appendChild(sentinel);
    observeSentinel();
  }
}

/* ── Infinite scroll ────────────────────────────────────────── */

function observeSentinel() {
  if (observer) observer.disconnect();
  const sentinel = document.getElementById('sentinel');
  if (!sentinel) return;

  observer = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    observer.disconnect();         // 중복 방지
    state.limit += 40;
    appendCards();                 // 기존 DOM 유지, 카드만 추가
  }, { rootMargin: '300px', threshold: 0 });

  observer.observe(sentinel);
}

/* ── Detail ─────────────────────────────────────────────────── */

function openDetail(item) {
  dCover.src    = item.cover ? large(item.cover) : COVER_PLACEHOLDER;
  dCover.srcset = item.cover ? [
    proxify(item.cover, { w: 390, h: 390, fit: 'cover' }) + ' 390w',
    proxify(item.cover, { w: 750, h: 750, fit: 'cover' }) + ' 750w',
    proxify(item.cover, { w: 900, h: 900, fit: 'cover' }) + ' 900w',
  ].join(', ') : '';
  dCover.sizes  = '100vw';
  dCover.onerror = () => { dCover.src = COVER_PLACEHOLDER; dCover.removeAttribute('srcset'); };

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

function closeDetail() {
  detailView.classList.add('hidden');
  listView.classList.remove('hidden');
}

/* ── Search toggle ──────────────────────────────────────────── */

function openSearch() {
  searchWrap.classList.add('open');
  btnToggleSearch.classList.add('active');
  requestAnimationFrame(() => searchInput.focus());
}

function closeSearch() {
  searchWrap.classList.remove('open');
  btnToggleSearch.classList.remove('active');
  searchInput.value = '';
  state.query = '';
  btnClear.classList.remove('visible');
  applyFilters();
}

btnToggleSearch.addEventListener('click', () => {
  searchWrap.classList.contains('open') ? closeSearch() : openSearch();
});

/* ── Events ─────────────────────────────────────────────────── */

const handleSearch = debounce(() => {
  state.query = searchInput.value.trim();
  btnClear.classList.toggle('visible', state.query.length > 0);
  applyFilters();
}, 300);

searchInput.addEventListener('input', handleSearch);

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter')  { e.preventDefault(); searchInput.blur(); }
  if (e.key === 'Escape') closeSearch();
});

btnClear.addEventListener('click', () => {
  searchInput.value = '';
  state.query       = '';
  btnClear.classList.remove('visible');
  applyFilters();
  searchInput.focus();
});

btnBack.addEventListener('click', () => history.back());

window.addEventListener('popstate', () => {
  if (location.hash !== '#detail') closeDetail();
});

/* ── Init ───────────────────────────────────────────────────── */

async function init() {
  try {
    const data = await fetchData();
    state.data     = data;
    state.filtered = sortRandom(data);
    buildGenreChips();
    resetGrid();
  } catch (e) {
    loadingEl.innerHTML = `<p style="color:var(--sub);font-size:13px;text-align:center;padding:20px">불러오기 실패: ${e.message}</p>`;
  }
}

init();
