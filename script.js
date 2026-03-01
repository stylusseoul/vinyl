/* ============================================================
   STYLUS VINYL — script.js
============================================================ */

const state = {
  data: [],
  filtered: [],
  activeGenre: 'all',
  query: '',
  limit: 40,
};

/* ── DOM ────────────────────────────────────────────────────── */
const listView = document.getElementById('listView');
const detailView = document.getElementById('detailView');
const searchInput = document.getElementById('searchInput');
const searchWrap = document.getElementById('searchWrap');
const btnToggleSearch = document.getElementById('btnToggleSearch');
const btnClear = document.getElementById('btnClear');
const btnBack = document.getElementById('btnBack');
const genreChips = document.getElementById('genreChips');
const countLabel = document.getElementById('countLabel');
const grid = document.getElementById('grid');
const moreWrap = document.getElementById('moreWrap');
const loadingEl = document.getElementById('loading');
const emptyEl = document.getElementById('emptyState');
const dCover = document.getElementById('dCover');
const dAlbum = document.getElementById('dAlbum');
const dArtist = document.getElementById('dArtist');
const dMeta = document.getElementById('dMeta');
const dTracks = document.getElementById('dTracks');
const dTrackCount = document.getElementById('dTrackCount');

/* ── Utils ──────────────────────────────────────────────────── */
function toTracks(s) {
  if (Array.isArray(s)) return s;
  if (!s) return [];
  return s.split(/\s*;\s*|\s*·\s*|\s*\|\s*/).map(function(t) { return t.trim(); }).filter(Boolean);
}

function isValid(it) {
  const a = (it.album || '').trim();
  const b = (it.artist || '').trim();
  return (a || b) && a.toLowerCase() !== 'ok' && b.toLowerCase() !== 'ok';
}

function sortByArtist(arr) {
  return [].concat(arr).sort(function(a, b) {
    return (a.artist || '').localeCompare(b.artist || '', 'ko', { sensitivity: 'base' });
  });
}

function sortRandom(arr) {
  return [].concat(arr).sort(function() { return Math.random() - 0.5; });
}

function debounce(fn, ms) {
  let t;
  return function() {
    const args = arguments;
    clearTimeout(t);
    t = setTimeout(function() { fn.apply(null, args); }, ms);
  };
}

function proxify(url, options) {
  if (!url) return '';
  options = options || {};
  let w = options.w;
  let h = options.h;
  let fit = options.fit || 'cover';

  let s = String(url).trim()
    .replace(/&amp;/g, '&')
    .replace(/^\/\//, 'https://')
    .replace(/^http:\/\//, 'https://');
  
  const core = s.replace(/^https?:\/\//, '');
  let q = 'https://images.weserv.nl/?url=' + encodeURIComponent(core);
  if (w) q += '&w=' + w;
  if (h) q += '&h=' + h;
  q += '&fit=' + fit;
  return q;
}

const thumb = function(url) { return proxify(url, { w: 400, h: 400, fit: 'cover' }); };
const large = function(url) { return proxify(url, { w: 900, h: 900, fit: 'contain' }); };

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Fetch ──────────────────────────────────────────────────── */
function parseGviz(text) {
  const json = JSON.parse(text.replace(/^[^{]*/, '').replace(/\);\s*$/, ''));
  const cols = json.table.cols.map(function(c) { return c.label || c.id; });
  return json.table.rows
    .filter(function(r) { return r && r.c; })
    .map(function(r) {
      const row = {};
      r.c.forEach(function(cell, i) {
        row[cols[i]] = cell ? (cell.v !== null && cell.v !== undefined ? cell.v : '') : '';
      });
      return row;
    });
}

function mapGvizRow(row) {
  const g = function(k) {
    for (const key in row) {
      if (key.toLowerCase() === k.toLowerCase()) return row[key] !== null && row[key] !== undefined ? row[key] : '';
    }
    return '';
  };
  return {
    artist: String(g('Artist') || ''),
    album: String(g('Album') || ''),
    year: String(g('Year') || '').replace(/\.0$/, ''),
    genre: String(g('Genre') || ''),
    cover: String(g('cover') || g('Cover') || ''),
    discogs: String(g('Discogs URL') || g('Discogs') || ''),
    tracks: toTracks(g('Tracks')),
  };
}

async function fetchData() {
  const res = await fetch(SHEET_GVIZ_URL);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const text = await res.text();
  const rows = parseGviz(text);
  return rows.map(mapGvizRow).filter(isValid);
}

/* ── Filters ────────────────────────────────────────────────── */
function applyFilters() {
  const q = state.query.toLowerCase();
  const filtered = state.data.filter(function(it) {
    const genreOk = state.activeGenre === 'all' || it.genre.trim() === state.activeGenre;
    if (!genreOk) return false;
    if (!q) return true;
    
    let trackStr = '';
    if(it.tracks && it.tracks.length > 0) trackStr = it.tracks.join(' ');
    return [it.album, it.artist, it.genre, trackStr].join(' ').toLowerCase().includes(q);
  });
  state.filtered = (state.activeGenre === 'all' && !q) ? sortRandom(filtered) : sortByArtist(filtered);
  window.scrollTo(0, 0);
  resetGrid();
}

/* ── Genre chips ────────────────────────────────────────────── */
function buildGenreChips() {
  const genreList = [];
  state.data.forEach(function(d) {
    let g = (d.genre || '').trim();
    if(g && genreList.indexOf(g) === -1) genreList.push(g);
  });

  const genres = genreList.sort(function(a, b) {
    return a.localeCompare(b, 'ko', { sensitivity: 'base' });
  });
  
  genreChips.innerHTML = '';
  genres.forEach(function(g) {
    const btn = document.createElement('button');
    btn.className = 'genre-chip';
    btn.dataset.genre = g;
    btn.textContent = g;
    btn.addEventListener('click', function() { selectGenre(g); });
    genreChips.appendChild(btn);
  });
  document.getElementById('chipAll').addEventListener('click', function() { selectGenre('all'); });
}

function selectGenre(genre) {
  state.activeGenre = genre;
  document.querySelectorAll('.genre-chip').forEach(function(c) {
    if(c.dataset.genre === genre) c.classList.add('active');
    else c.classList.remove('active');
  });
  applyFilters();
}

/* ── 카드 생성 ───────────────────────────────────────────────── */
function createCard(item) {
  const card = document.createElement('article');
  card.className = 'card';
  card.addEventListener('click', function() { openDetail(item); });
  
  const wrap = document.createElement('div');
  wrap.className = 'card-thumb-wrap';
  
  const img = document.createElement('img');
  img.className = 'card-thumb';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = item.cover ? thumb(item.cover) : 'https://stylusseoul.github.io/vinyl/images/prepare.jpg';
  img.onerror = function() { img.src = 'https://stylusseoul.github.io/vinyl/images/prepare.jpg'; };
  img.alt = item.album || '';
  
  wrap.appendChild(img);
  
  const info = document.createElement('div');
  info.className = 'card-info';
  
  let albumName = item.album ? item.album : '(제목 없음)';
  let artistName = item.artist ? item.artist : '';
  
  info.innerHTML = '<p class="card-album">' + esc(albumName) + '</p>' +
                   '<p class="card-artist">' + esc(artistName) + '</p>';
  
  card.appendChild(wrap);
  card.appendChild(info);
  return card;
}

/* ── Render ─────────────────────────────────────────────────── */
let renderedCount = 0;
let observer = null;

function resetGrid() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  grid.innerHTML = '';
  moreWrap.innerHTML = '';
  renderedCount = 0;
  state.limit = 40;
  
  const total = state.filtered.length;
  loadingEl.classList.add('hidden');
  countLabel.textContent = total + ' records';
  
  if (total === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  appendCards();
}

function appendCards() {
  const total = state.filtered.length;
  const shown = Math.min(state.limit, total);
  if (renderedCount < shown) {
    const frag = document.createDocumentFragment();
    state.filtered.slice(renderedCount, shown).forEach(function(item) {
      frag.appendChild(createCard(item));
    });
    grid.appendChild(frag);
    renderedCount = shown;
  }
  
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
  
  observer = new IntersectionObserver(function(entries) {
    if (!entries[0].isIntersecting) return;
    observer.disconnect();
    state.limit += 40;
    appendCards();
  }, { rootMargin: '300px', threshold: 0 });
  
  observer.observe(sentinel);
}

/* ── Detail ─────────────────────────────────────────────────── */
function openDetail(item) {
  dCover.src = item.cover ? large(item.cover) : 'https://stylusseoul.github.io/vinyl/images/prepare.jpg';
  
  if(item.cover) {
    dCover.srcset = proxify(item.cover, { w: 390, h: 390, fit: 'cover' }) + ' 390w, ' +
                    proxify(item.cover, { w: 750, h: 750, fit: 'cover' }) + ' 750w, ' +
                    proxify(item.cover, { w: 900, h: 900, fit: 'cover' }) + ' 900w';
  } else {
    dCover.srcset = '';
  }
  dCover.sizes = '100vw';
  
  dCover.onerror = function() {
    dCover.src = 'https://stylusseoul.github.io/vinyl/images/prepare.jpg';
    dCover.removeAttribute('srcset');
  };
  
  dAlbum.textContent = item.album || '';
  dArtist.textContent = item.artist || '';
  dMeta.innerHTML = '';
  
  let metaItems = [];
  if(item.year) metaItems.push(item.year);
  if(item.genre) metaItems.push(item.genre);
  
  metaItems.forEach(function(val) {
    const span = document.createElement('span');
    span.className = 'meta-tag';
    span.textContent = val;
    dMeta.appendChild(span);
  });
  
  const tracks = item.tracks || [];
  dTrackCount.textContent = tracks.length + '곡';
  dTracks.innerHTML = '';
  
  tracks.forEach(function(t, i) {
    const li = document.createElement('li');
    li.className = 'track-item';
    li.innerHTML = '<span class="track-num">' + (i + 1) + '</span><span class="track-name">' + esc(t) + '</span>';
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
  requestAnimationFrame(function() { searchInput.focus(); });
}

function closeSearch() {
  searchWrap.classList.remove('open');
  btnToggleSearch.classList.remove('active');
  searchInput.value = '';
  state.query = '';
  btnClear.classList.remove('visible');
  applyFilters();
}

btnToggleSearch.addEventListener('click', function() {
  searchWrap.classList.contains('open') ? closeSearch() : openSearch();
});

/* ── Events ─────────────────────────────────────────────────── */
const handleSearch = debounce(function() {
  state.query = searchInput.value.trim();
  if(state.query.length > 0) btnClear.classList.add('visible');
  else btnClear.classList.remove('visible');
  applyFilters();
}, 300);

searchInput.addEventListener('input', handleSearch);
searchInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    searchInput.blur();
  }
  if (e.key === 'Escape') closeSearch();
});

btnClear.addEventListener('click', function() {
  searchInput.value = '';
  state.query = '';
  btnClear.classList.remove('visible');
  applyFilters();
  searchInput.focus();
});

btnBack.addEventListener('click', function() { history.back(); });
window.addEventListener('popstate', function() {
  if (location.hash !== '#detail') closeDetail();
});

/* ── Init ───────────────────────────────────────────────────── */
async function init() {
  try {
    const data = await fetchData();
    state.data = data;
    state.filtered = sortRandom(data);
    buildGenreChips();
    resetGrid();
  } catch (e) {
    loadingEl.innerHTML = '<p style="color:var(--sub);font-size:13px;text-align:center;padding:20px">불러오기 실패: ' + e.message + '</p>';
  }
}

init();
