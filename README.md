# IdeaBank IDE-14

친구들과 함께 저녁 메뉴를 빠르게 정하기 위한 추천 및 투표 웹사이트입니다.

## 기능

- 비밀번호 게이트 기반 접근 제어
- 취향, 예산, 거리, 분위기, 식단 선호를 반영한 메뉴 추천
- 추천 결과를 기반으로 한 그룹 투표방 생성
- 후보별 찬성/보류/반대 집계와 최종 우선순위 표시

## 실행

### 로컬

```bash
PORT=3200 ACCESS_PASSWORD=ideabank2026 npm start
```

### 개발 모드

```bash
npm run dev
```

### 테스트

```bash
npm test
```

### Docker

```bash
docker compose up --build
```

## 환경 변수

- `PORT`: 서버 포트, 기본값 `3200`
- `ACCESS_PASSWORD`: 접근 비밀번호, 기본값 `ideabank2026`

## 라우트

- `/`: 비밀번호 입력 페이지
- `/app`: 추천/투표 대시보드
- `/api/recommendations`: 추천 API
- `/api/rooms`: 투표방 생성 API
- `/api/rooms/:roomId`: 투표방 조회 API
- `/api/rooms/:roomId/votes`: 투표 등록 API
