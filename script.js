/* ============================================================
   STYLUS VINYL — script.js (최종 안정화 버전)
============================================================ */

const state = {
  data: [],
  filtered: [],
  activeGenre: 'all',
  query: '',
  limit: 40,
  isRequestEnabled: true, // 기본값 ON
};

let selectedTrackData = null;
let reqSubmitSuccess = false;

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

const reqSheet = document.getElementById('requestFormArea');
const reqTrackName = document.getElementById('selectedTrackName');
const reqName = document.getElementById('reqName');
const reqNote = document.getElementById('reqNote');
const btnSubmitRequest = document.getElementById('btnSubmitRequest');
const floatingBtn = document.querySelector('.floating-requests-btn');

/* ── Utils ──────────────────────────────────────────────────── */
function toTracks(s) {
  if (Array.isArray(s)) return s;
  if (!s) return [];
  return s.split(/\s*;\s*|\s*·\s*|\s*\|\s*/).map(t => t.trim()).filter(Boolean);
}

function isValid(it) {
  const a = (it.album || '').trim();
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
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
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
      r.c.forEach((cell, i) => {
        row[cols[i]] = cell ? (cell.v ?? '') : '';
      });
      return row;
    });
}

function mapGvizRow(row) {
  const g = k => {
    const searchKey = k.replace(/\s+/g, '').toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.replace(/\s+/g, '').toLowerCase() === searchKey) return row[key] ?? '';
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
    tracks: toTracks(g('Tracks'))
  };
}

async function fetchData() {
  const cacheBuster = `&_=${new Date().getTime()}`;
  // 메인 바이닐 목록 가져오기 (gid=0)
  const res = await fetch(SHEET_GVIZ_URL + cacheBuster);
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
  
  state.filtered = (state.activeGenre === 'all' && !q) ? sortRandom(filtered) : sortByArtist(filtered);
  window.scrollTo(0, 0);
  resetGrid();
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
  img.className = 'card-thumb';
  img.loading = 'lazy';
  img.decoding = 'async';
  
  img.src = item.cover ? thumb(item.cover) : 'https://stylusseoul.github.io/vinyl/images/prepare.jpg';
  img.onerror = () => { img.src = 'https://stylusseoul.github.io/vinyl/images/prepare.jpg'; };
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
  return card;
}

/* ── Render ─────────────────────────────────────────────────── */
let renderedCount = 0;
let observer = null;

function resetGrid() {
  if (observer) { observer.disconnect(); observer = null; }
  grid.innerHTML = ''; moreWrap.innerHTML = '';
  renderedCount = 0; state.limit = 40;
  
  const total = state.filtered.length;
  loadingEl.classList.add('hidden');
  countLabel.textContent = `${total} records`;
  
  if (total === 0) { emptyEl.classList.remove('hidden'); return; }
  emptyEl.classList.add('hidden');
  appendCards();
}

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
    observer.disconnect();
    state.limit += 40;
    appendCards();
  }, { rootMargin: '300px', threshold: 0 });
  
  observer.observe(sentinel);
}

/* ── Detail & Track Selection ───────────────────────────────── */
function openDetail(item) {
  dCover.src = item.cover ? large(item.cover) : 'https://stylusseoul.github.io/vinyl/images/prepare.jpg';
  dCover.srcset = item.cover ? [
    proxify(item.cover, { w: 390, h: 390, fit: 'cover' }) + ' 390w',
    proxify(item.cover, { w: 750, h: 750, fit: 'cover' }) + ' 750w',
    proxify(item.cover, { w: 900, h: 900, fit: 'cover' }) + ' 900w',
  ].join(', ') : '';
  dCover.sizes = '100vw';
  dCover.onerror = () => { dCover.src = 'https://stylusseoul.github.io/vinyl/images/prepare.jpg'; dCover.removeAttribute('srcset'); };
  
  dAlbum.textContent = item.album || '';
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
  
  selectedTrackData = null;
  reqSheet.classList.add('hidden');
  
  if (floatingBtn) floatingBtn.classList.add('hidden');
  
  tracks.forEach((t, i) => {
    const li = document.createElement('li');
    
    // ON 상태일 때만 selectable (선택 가능한 라디오 버튼 스타일)
    if (state.isRequestEnabled) {
      li.className = 'track-item selectable';
      li.innerHTML = `
        <span class="track-num">${i + 1}</span>
        <span class="track-name">${esc(t)}</span>
        <div class="track-check-circle"></div> 
      `;
      
      li.addEventListener('click', () => {
        if (li.classList.contains('selected')) {
          li.classList.remove('selected');
          selectedTrackData = null;
          reqSheet.classList.add('hidden');
        } else {
          document.querySelectorAll('.track-item.selected').forEach(el => el.classList.remove('selected'));
          li.classList.add('selected');
          
          selectedTrackData = { album: item.album || '', artist: item.artist || '', track: t };
          reqTrackName.textContent = t;
          reqSheet.classList.remove('hidden');
          
          reqName.classList.remove('input-error');
          btnSubmitRequest.disabled = false;
          btnSubmitRequest.textContent = '신청하기';
          btnSubmitRequest.style.background = 'var(--accent)';
          reqSubmitSuccess = false;
        }
      });
    } else {
      // OFF 상태면 그냥 터치 안되는 리스트
      li.className = 'track-item';
      li.innerHTML = `
        <span class="track-num">${i + 1}</span>
        <span class="track-name">${esc(t)}</span>
      `;
    }
    
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
  reqSheet.classList.add('hidden');
  if (state.isRequestEnabled && floatingBtn) floatingBtn.classList.remove('hidden');
}

/* ── 곡 신청 폼 제출 로직 (Bottom Sheet) ────────────────────── */
btnSubmitRequest.addEventListener('click', async () => {
  if (!selectedTrackData || reqSubmitSuccess) return;

  const userName = reqName.value.trim();
  if (!userName) {
    reqName.classList.add('input-error');
    reqName.focus();
    setTimeout(() => reqName.classList.remove('input-error'), 400);
    return;
  }

  const userNote = reqNote.value.trim();

  btnSubmitRequest.disabled = true;
  btnSubmitRequest.textContent = '신청 중...';

  try {
    if (typeof REQUEST_API_URL !== 'undefined') {
      const payload = {
        artist: selectedTrackData.artist,
        album: selectedTrackData.album,
        track: selectedTrackData.track,
        requester: userName,
        memo: userNote
      };

      // ★ [중요] 구글 Apps Script 연동 시 CORS 에러를 피하면서 JSON을 안전하게 보내는 방법
      // mode: 'no-cors' 와 content-type: 'text/plain' 의 조합이 핵심입니다!
      await fetch(REQUEST_API_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: {
          'Content-Type': 'text/plain;charset=utf-8' 
        },
        body: JSON.stringify(payload)
      });
    }

    reqSubmitSuccess = true;
    btnSubmitRequest.textContent = '✔ 신청이 완료되었습니다';
    btnSubmitRequest.style.background = '#1DB954'; 

    setTimeout(() => {
      reqSheet.classList.add('hidden');
      document.querySelectorAll('.track-item.selected').forEach(el => el.classList.remove('selected'));
      selectedTrackData = null;
      reqName.value = '';
      reqNote.value = '';
    }, 1500);
    
  } catch (error) {
    console.error('Submit Error:', error);
    btnSubmitRequest.disabled = false;
    btnSubmitRequest.textContent = '❌ 통신 오류 (다시 시도)';
  }
});

/* ── Search toggle ──────────────────────────────────────────── */
function openSearch() { searchWrap.classList.add('open'); btnToggleSearch.classList.add('active'); requestAnimationFrame(() => searchInput.focus()); }
function closeSearch() { searchWrap.classList.remove('open'); btnToggleSearch.classList.remove('active'); searchInput.value = ''; state.query = ''; btnClear.classList.remove('visible'); applyFilters(); }
btnToggleSearch.addEventListener('click', () => { searchWrap.classList.contains('open') ? closeSearch() : openSearch(); });

/* ── Events ─────────────────────────────────────────────────── */
const handleSearch = debounce(() => {
  state.query = searchInput.value.trim();
  btnClear.classList.toggle('visible', state.query.length > 0);
  applyFilters();
}, 300);

searchInput.addEventListener('input', handleSearch);
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchInput.blur(); } if (e.key === 'Escape') closeSearch(); });
btnClear.addEventListener('click', () => { searchInput.value = ''; state.query = ''; btnClear.classList.remove('visible'); applyFilters(); searchInput.focus(); });
btnBack.addEventListener('click', () => history.back());
window.addEventListener('popstate', () => { if (location.hash !== '#detail') closeDetail(); });

/* ── Init ───────────────────────────────────────────────────── */
async function init() {
  try {
    // 1. 구글 Apps Script의 doGet()을 호출하여 현재 스위치 상태를 가져옵니다.
    // 무한 로딩을 방지하기 위해 이 부분에서 에러가 나면 무조건 ON으로 간주하고 넘어갑니다.
    if (typeof REQUEST_API_URL !== 'undefined') {
      try {
        const cacheBuster = `?_=${new Date().getTime()}`;
        const statusRes = await fetch(REQUEST_API_URL + cacheBuster);
        if (statusRes.ok) {
          const statusJson = await statusRes.json();
          // GAS의 doGet에서 응답하는 { enabled: true/false } 구조를 읽습니다.
          if (statusJson && statusJson.enabled === false) {
            state.isRequestEnabled = false;
          }
        }
      } catch (err) {
        console.warn("스위치 상태를 불러오지 못했습니다. 기본값(ON)으로 설정합니다.");
      }
    }

    // OFF 상태일 때 플로팅 버튼 제거
    if (!state.isRequestEnabled && floatingBtn) {
      floatingBtn.style.display = 'none';
      floatingBtn.classList.add('hidden');
    }

    // 2. 바이닐 목록 가져오기
    const data = await fetchData();
    state.data = data;
    state.filtered = sortRandom(data);
    
    buildGenreChips();
    resetGrid();
    
  } catch (e) {
    loadingEl.innerHTML = `<p style="color:var(--sub);font-size:13px;text-align:center;padding:20px">불러오기 실패: ${e.message}</p>`;
  }
}

init();
