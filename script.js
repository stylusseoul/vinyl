const state = {
  data: [],
  filtered: [],
  filters: { genres: new Set() },
  limit: 50
};

const listPage   = document.getElementById('listPage');
const detailPage = document.getElementById('detailPage');
const toolbar    = document.getElementById('toolbar');
const detailHdr  = document.getElementById('detailHeader');

const listEl   = document.getElementById('list');
const inputEl  = document.getElementById('searchInput');
const btnSearch= document.getElementById('btnSearch');
const btnReset = document.getElementById('btnReset');
const genreChips = document.getElementById('genreChips');
const countEl  = document.getElementById('count');
const moreWrap = document.getElementById('moreWrap');

const dCover = document.getElementById('dCover');
const dAlbum = document.getElementById('dAlbum');
const dArtist= document.getElementById('dArtist');
const dTracks= document.getElementById('dTracks');
const btnBack= document.getElementById('btnBack');

function toArray(s){ 
  if(Array.isArray(s)) return s; 
  if(!s) return []; 
  return s.split(/\s*;\s*|\s*·\s*|\s*\|\s*|\s*,\s*/).filter(Boolean); 
}

function mapRow(row){
  const get = (k)=> row.hasOwnProperty(k) ? row[k] : (row[k.toLowerCase()] ?? row[k.toUpperCase()] ?? '');
  const artist = get('Artist');
  const album  = get('Album');
  const year   = String(get('Year')||'');
  const genre  = get('Genre');
  const cover  = get('Cover') || get('F') || get('cover') || get('COVER');
  const tracks = toArray(get('Tracks'));
  return { artist, album, year, genre, cover, tracks };
}

async function fetchCSV(){
  const url = SHEET_CSV_URL;
  return new Promise((resolve, reject)=>{
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: ({data})=> resolve(data.map(mapRow)),
      error: reject
    });
  });
}

function isValidItem(it){
  const hasAlbum  = (it.album || '').trim() !== '';
  const hasArtist = (it.artist || '').trim() !== '';
  const notStatus = !((it.album || '').trim().toUpperCase() === 'OK' || (it.artist || '').trim().toUpperCase() === 'OK');
  return (hasAlbum || hasArtist) && notStatus;
}

function defaultSortByArtist(arr){
  arr.sort((a,b)=>(a.artist||'').localeCompare(b.artist||'', 'ko', {sensitivity:'base'}));
}

function buildGenreChips(){
  const set = new Set(state.data.map(d=> (d.genre||'').trim()).filter(Boolean));
  const items = [...set].sort((a,b)=> a.localeCompare(b, 'ko', {sensitivity:'base'}));
  genreChips.innerHTML='';
  items.forEach(val=>{
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = val;
    btn.addEventListener('click', ()=>{
      if(state.filters.genres.has(val)){
        state.filters.genres.delete(val);
      }else{
        state.filters.genres.add(val);
      }
      btn.classList.toggle('active');
      applyFilters();
    });
    genreChips.appendChild(btn);
  });
}

// Proxy helpers
function proxify(rawUrl, { w=null, h=null, fit='cover' } = {}) {
  if (!rawUrl) return '';
  let s = String(rawUrl).trim().replace(/&amp;/g, '&');
  if (s.startsWith('//')) s = 'https:' + s;
  if (s.startsWith('http://img.discogs.com') || s.startsWith('http://i.discogs.com')) {
    s = s.replace('http://', 'https://');
  }
  const core = s.replace(/^https?:\/\//, '');
  let q = `https://images.weserv.nl/?url=${encodeURIComponent(core)}`;
  if (w) q += `&w=${w}`;
  if (h) q += `&h=${h}`;
  q += `&fit=${fit}`;
  return q;
}
function coverThumb(rawUrl){ return proxify(rawUrl, { w:150, h:150, fit:'cover' }); }
function coverLarge(rawUrl){ return proxify(rawUrl, { w:900, h:900, fit:'contain' }); }

function matchesQuery(item, q){
  if(!q) return true;
  const hay = [(item.album||''), (item.artist||''), (item.tracks||[]).join(' '), (item.genre||'')]
                .join(' ').toLowerCase();
  return hay.includes(q);
}

function matchesFilters(item){
  const gs = state.filters.genres;
  const okGenre = gs.size ? gs.has((item.genre||'').trim()) : true;
  return okGenre;
}

function applyFilters(){
  const q = (inputEl.value||'').trim().toLowerCase();
  state.filtered = state.data
    .filter(isValidItem)
    .filter(it => matchesQuery(it, q) && matchesFilters(it));
  defaultSortByArtist(state.filtered);
  state.limit = 50;
  renderList();
}

function clearAll(){
  inputEl.value = '';
  state.filters.genres.clear();
  Array.from(genreChips.children).forEach(c=> c.classList.remove('active'));
  applyFilters();
  inputEl.focus();
}

function renderList(){
  const total = state.filtered.length;
  const shown = Math.min(state.limit, total);
  countEl.textContent = `${total}개 앨범 중 ${shown}개 표시`;

  listEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  state.filtered.slice(0, shown).forEach((item) => {
    const row = document.createElement('article'); row.className = 'row'; row.tabIndex = 0;
    row.addEventListener('click', ()=> openDetail(item));
    row.addEventListener('keydown', (e)=>{ if(e.key==='Enter') openDetail(item); });

    const img = document.createElement('img'); img.className='thumb'; img.loading='lazy';
    img.src = coverThumb(item.cover) || COVER_PLACEHOLDER;
    img.onerror = () => { img.src = COVER_PLACEHOLDER; };

    const info = document.createElement('div'); info.className='info';
    const album = document.createElement('p'); album.className='album'; album.textContent = item.album || '(제목 없음)';
    const artist = document.createElement('p'); artist.className='artist'; artist.textContent = item.artist || '';
    const meta = document.createElement('p'); meta.className='meta'; meta.textContent = [item.year, item.genre].filter(Boolean).join(' · ');
    const tracks = document.createElement('p'); tracks.className='tracks'; tracks.textContent = (item.tracks||[]).join(' · ');

    info.appendChild(album); 
    info.appendChild(artist);
    info.appendChild(meta); 
    info.appendChild(tracks);
    row.appendChild(img); 
    row.appendChild(info); 
    frag.appendChild(row);
  });
  listEl.appendChild(frag);

  // load more
  moreWrap.innerHTML = '';
  if (shown < total){
    const more = document.createElement('button');
    more.id = 'btnLoadMore';
    more.className = 'btn primary';
    more.textContent = '더보기';
    more.addEventListener('click', ()=>{
      state.limit += 50;
      renderList();
    });
    moreWrap.appendChild(more);
  }
}

function openDetail(item){
  // large + responsive set
  const base = item.cover || '';
  dCover.loading = 'lazy';
  dCover.src = coverLarge(base) || COVER_PLACEHOLDER;
  dCover.srcset = [
    proxify(base, { w: 320,  h: 320,  fit: 'contain' }) + ' 320w',
    proxify(base, { w: 640,  h: 640,  fit: 'contain' }) + ' 640w',
    proxify(base, { w: 900,  h: 900,  fit: 'contain' }) + ' 900w',
    proxify(base, { w: 1200, h: 1200, fit: 'contain' }) + ' 1200w'
  ].join(', ');
  dCover.sizes = '(max-width: 420px) 90vw, 560px';
  dCover.onerror = () => { dCover.src = COVER_PLACEHOLDER; dCover.removeAttribute('srcset'); };

  dAlbum.textContent = item.album || '';
  dArtist.textContent = item.artist || '';
  dTracks.innerHTML = '';
  (item.tracks||[]).forEach(t => {
    const li = document.createElement('li');
    li.textContent = t;
    dTracks.appendChild(li);
  });

  listPage.classList.add('hidden');
  toolbar.classList.add('hidden');
  detailHdr.classList.remove('hidden');
  detailPage.classList.remove('hidden');
  document.body.classList.add('detail-mode');
  location.hash = '#detail';
}

function backToList(){
  detailPage.classList.add('hidden');
  detailHdr.classList.add('hidden');
  listPage.classList.remove('hidden');
  toolbar.classList.remove('hidden');
  document.body.classList.remove('detail-mode');
  location.hash = '#list';
}

async function load(){
  try{
    countEl.textContent = '불러오는 중…';
    const data = await fetchCSV();
    state.data = data.filter(isValidItem);
    defaultSortByArtist(state.data);
    state.filtered = state.data.slice();
    buildGenreChips();
    renderList();
  }catch(e){
    document.body.insertAdjacentHTML('beforeend', `<div style="color:#300;padding:10px;background:#fff8;border-top:1px solid #900">불러오기 실패: ${e.message}</div>`);
  }
}

btnSearch.addEventListener('click', applyFilters);
inputEl.addEventListener('input', applyFilters);
inputEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter') applyFilters(); });
btnReset.addEventListener('click', clearAll);
document.getElementById('btnBack').addEventListener('click', backToList);
window.addEventListener('hashchange', ()=>{ if(location.hash !== '#detail') backToList(); });

load();
