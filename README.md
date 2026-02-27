# 🎵 Stylus Vinyl

바이닐 컬렉션 검색 모바일 웹 앱 — **Minimal Dark UI**

## 기능

- 구글 스프레드시트(CSV)에서 실시간 데이터 로드
- 아티스트 / 앨범 / 트랙 통합 검색
- 장르 칩 필터
- 앨범 상세 페이지 (커버, 트랙리스트, Discogs 링크)
- 40개씩 페이징 (더보기)
- weserv.nl 이미지 프록시로 Discogs 이미지 표시

## 데이터 소스

`config.js` 의 `SHEET_CSV_URL` 변경으로 시트 교체 가능

## 컬럼 구조

| 컬럼 | 설명 |
|------|------|
| Artist | 아티스트명 |
| Album | 앨범명 |
| Year | 발매연도 |
| Genre | 장르 |
| cover | 앨범 커버 이미지 URL |
| Discogs URL | Discogs 링크 |
| Tracks | 트랙리스트 (`;` 구분) |
