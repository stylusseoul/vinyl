/* ============================================================
   STYLUS VINYL — script.js
   ============================================================ */

const state = {
  data: [],
  filtered: [],
  activeGenres: new Set(),
  query: '',
  limit: 40,
};

/* DOM */
const listView        = document.getElementById('listView');
const detailView      = document.getElementById('detailView');
const searchInput     = document.getElementById('searchInput');
const searchWrap      = document.getElementById('searchWrap');
const btnToggleSearch = document.getElementById('btnToggleSearch');
const btnClear        = document.getElementById('btnClear');
const btnBack         = document.getElementById('btnBack');
const genreChips      = document.getElementById('genreChips');
const chipAll         = document.getElementById('chipAll');
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

/* ── Fetch (gviz JSON) ──────────────────────────────────────── */

function parseGviz(text) {
  const json = JSON.parse(text.replace(/^[^{]*/, '').replace(/\);\s*$/, ''));
  const cols = json.table.cols.map(c => c.label || c.id);
  return json.table.rows
    .filter(r => r && r.c)
    .map(r => {
      const row = {};
      r.c.forEach((cell, i) => {
        row[cols[i]] = cell ? (cell.v ?? '') : '';
      });
      return row;
    });
}

function mapGvizRow(row) {
  const g = k => {
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === k.toLowerCase()) return row[key] ?? '';
    }
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
  const text = await res.text();
  const rows = parseGviz(text);
  return rows.map(mapGvizRow).filter(isValid);
}

/* ── Filters ────────────────────────────────────────────────── */

function applyFilters() {
  const q = state.query.toLowerCase();
  const isAll = state.activeGenres.size === 0;

  const filtered = state.data.filter(it => {
    const genreOk = isAll || state.activeGenres.has(it.genre.trim());
    if (!genreOk) return false;
    if (!q) return true;
    return [it.album, it.artist, it.genre, ...it.tracks].join(' ').toLowerCase().includes(q);
  });

  state.filtered = (isAll && !q)
    ? sortRandom(filtered)
    : sortByArtist(filtered);

  state.limit = 40;
  renderGrid();
}

/* ── Genre chips ────────────────────────────────────────────── */

function buildGenreChips() {
  const genres = [...new Set(state.data.map(d => (d.genre || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ko', { sensitivity: 'base' }));

  genreChips.innerHTML = '';

  genres.forEach(g => {
    const btn = document.createElement('button');
    btn.className = 'genre-chip';
    btn.dataset.genre = g;
    btn.textContent = g;
    btn.addEventListener('click', () => toggleGenre(g));
    genreChips.appendChild(btn);
  });
}

function toggleGenre(genre) {
  if (state.activeGenres.has(genre)) {
    state.activeGenres.delete(genre);
  } else {
    state.activeGenres.add(genre);
  }
  updateChipUI();
  applyFilters();
}

function selectAll() {
  state.activeGenres.clear();
  updateChipUI();
  applyFilters();
}

function updateChipUI() {
  const isAll = state.activeGenres.size === 0;

  // ✅ chipAll 따로 처리
  chipAll.classList.toggle('active', isAll);

  // ✅ #genreChips 안의 칩만 선택 (chipAll 제외)
  genreChips.querySelectorAll('.genre-chip').forEach(c => {
    c.classList.toggle('active', state.activeGenres.has(c.dataset.genre));
  });
}

/* ── Render grid ────────────────────────────────────────────── */

function renderGrid() {
  const total = state.filtered.length;
  const shown = Math.min(state.limit, total);

  loadingEl.classList.add('hidden');
  countLabel.textContent = `${total} records`;

  if (total === 0) {
    emptyEl.classList.remove('hidden');
    grid.innerHTML = '';
    moreWrap.innerHTML = '';
    return;
  }
  emptyEl.classList.add('hidden');
  grid.innerHTML = '';

  const frag = document.createDocumentFragment();
  state.filtered.slice(0, shown).forEach(item => {
    const card = document.createElement('article');
    card.className = 'card';
    card.addEventListener('click', () => openDetail(item));

    const wrap = document.createElement('div');
    wrap.className = 'card-thumb-wrap';

    const img = document.createElement('img');
    img.className = 'card-thumb';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = item.cover ? thumb(item.cover) : COVER_PLACEHOLDER;
    img.onerror = () => { img.src = COVER_PLACEHOLDER; };
    img.alt = item.album || '';

    wrap.appendChild(img);

    const info = document.createElement('div');
    info.className = 'card-info';
    info.innerHTML = `
      <p class="card-album">${esc(item.album || '(제목 없음)')}</p>
      <p class="card-artist">${esc(item.artist || '')}</p>
    `;

    card.appendChild(wrap);
    card.appendChild(info);
    frag.appendChild(card);
  });
  grid.appendChild(frag);

  moreWrap.innerHTML = '';
  if (shown < total) {
    const sentinel = document.createElement('div');
    sentinel.id = 'sentinel';
    moreWrap.appendChild(sentinel);
    observeSentinel();
  }
}

/* ── Infinite scroll ────────────────────────────────────────── */

let observer = null;

function observeSentinel() {
  if (observer) observer.disconnect();
  const sentinel = document.getElementById('sentinel');
  if (!sentinel) return;
  observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      state.limit += 40;
      renderGrid();
    }
  }, { rootMargin: '200px' });
  observer.observe(sentinel);
}

/* ── Detail ─────────────────────────────────────────────────── */

function openDetail(item) {
  dCover.src = item.cover ? large(item.cover) : COVER_PLACEHOLDER;
  dCover.srcset = item.cover ? [
    proxify(item.cover, { w: 390, h: 390, fit: 'cover' }) + ' 390w',
    proxify(item.cover, { w: 750, h: 750, fit: 'cover' }) + ' 750w',
    proxify(item.cover, { w: 900, h: 900, fit: 'cover' }) + ' 900w',
  ].join(', ') : '';
  dCover.sizes = '100vw';
  dCover.onerror = () => { dCover.src = COVER_PLACEHOLDER; dCover.removeAttribute('srcset'); };

  dAlbum.textContent  = item.album  || '';
  dArtist.textContent = item.artist || '';

  dMeta.innerHTML = '';
  [item.year, item.genre].filter(Boolean).forEach(val => {
    const span = document.createElement('span');
    span.className = 'meta-tag';
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

searchInput.addEventListener('input', () => {
  state.query = searchInput.value.trim();
  btnClear.classList.toggle('visible', state.query.length > 0);
  applyFilters();
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); searchInput.blur(); }
  if (e.key === 'Escape') closeSearch();
});

btnClear.addEventListener('click', () => {
  searchInput.value = '';
  state.query = '';
  btnClear.classList.remove('visible');
  applyFilters();
  searchInput.focus();
});

// ✅ chipAll 이벤트 — 여기서 한 번만 등록
chipAll.addEventListener('click', () => selectAll());

btnBack.addEventListener('click', () => history.back());

window.addEventListener('popstate', () => {
  if (location.hash !== '#detail') closeDetail();
});

/* ── Init ───────────────────────────────────────────────────── */

async function init() {
  try {
    const data = await fetchData();
    state.data = data;
    state.filtered = sortRandom(data);
    buildGenreChips();
    updateChipUI();
    renderGrid();
  } catch (e) {
    loadingEl.innerHTML = `<p style="color:var(--sub);font-size:13px;text-align:center;padding:20px">불러오기 실패: ${e.message}</p>`;
  }
}

init();
