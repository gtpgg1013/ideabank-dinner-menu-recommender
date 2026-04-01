const http = require("node:http");
const { URL } = require("node:url");
const { SESSION_COOKIE, createSessionValue, getPassword, isValidSession, parseCookies } = require("./src/auth");
const { recommendRestaurants } = require("./src/recommendations");
const { createRoom, getRoom, castVote } = require("./src/rooms");

const port = Number.parseInt(process.env.PORT || "3200", 10);

function sendHtml(response, statusCode, html, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    ...headers
  });
  response.end(html);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function redirect(response, location, headers = {}) {
  response.writeHead(302, {
    Location: location,
    ...headers
  });
  response.end();
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString();
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function isAuthenticated(request) {
  const cookies = parseCookies(request.headers.cookie);
  return isValidSession(cookies[SESSION_COOKIE]);
}

function loginPage(errorMessage = "") {
  return renderDocument(`
    <section class="gate">
      <div class="brand">DINNER SIGNAL</div>
      <h1>친구들과 저녁 메뉴를 3분 안에 정하세요.</h1>
      <p class="intro">취향, 예산, 거리, 분위기를 받아 후보를 추리고 바로 투표방을 만들 수 있습니다.</p>
      <form class="password-form" method="post" action="/login">
        <label for="password">입장 비밀번호</label>
        <input id="password" name="password" type="password" placeholder="ACCESS_PASSWORD 입력" required />
        <button type="submit">입장하기</button>
        ${errorMessage ? `<p class="error">${escapeHtml(errorMessage)}</p>` : ""}
      </form>
      <div class="hint">기본 비밀번호는 환경 변수 <code>ACCESS_PASSWORD</code>로 변경할 수 있습니다.</div>
    </section>
  `);
}

function dashboardPage() {
  return renderDocument(`
    <main class="app-shell">
      <section class="hero-card">
        <div>
          <div class="eyebrow">Tonight Coordination</div>
          <h1>친구들과 함께 저녁 메뉴를 고르는 가장 빠른 보드</h1>
          <p>설문으로 후보를 추리고, 상위 메뉴를 바로 투표방으로 전환하세요.</p>
        </div>
        <div class="hero-stats">
          <div><strong>4개</strong><span>추천 후보</span></div>
          <div><strong>1분</strong><span>투표방 생성</span></div>
          <div><strong>실시간</strong><span>득표 집계</span></div>
        </div>
      </section>

      <section class="panel-grid">
        <section class="panel">
          <div class="panel-title">
            <h2>1. 취향 입력</h2>
            <p>여러 명의 취향을 대변할 수 있게 핵심 기준만 받습니다.</p>
          </div>
          <form id="preferences-form" class="stack">
            <div class="field">
              <label>선호 음식</label>
              <div class="chip-grid">
                ${["한식", "일식", "중식", "양식", "멕시칸", "샐러드", "주점", "인도"]
                  .map(
                    (cuisine) => `
                      <label class="chip-option">
                        <input type="checkbox" name="cuisines" value="${cuisine}" />
                        <span>${cuisine}</span>
                      </label>
                    `
                  )
                  .join("")}
              </div>
            </div>
            <div class="field">
              <label for="budget">예산</label>
              <select id="budget" name="budget">
                <option value="low">가볍게</option>
                <option value="medium" selected>적당히</option>
                <option value="high">조금 쓰기</option>
              </select>
            </div>
            <div class="field">
              <label for="distance">이동 거리</label>
              <select id="distance" name="distance">
                <option value="near" selected>가까운 곳</option>
                <option value="mid">적당히 이동</option>
                <option value="far">멀어도 괜찮음</option>
              </select>
            </div>
            <div class="field">
              <label for="vibe">분위기</label>
              <select id="vibe" name="vibe">
                <option value="casual" selected>편한</option>
                <option value="cozy">아늑한</option>
                <option value="calm">차분한</option>
                <option value="lively">활기찬</option>
                <option value="romantic">분위기 있는</option>
              </select>
            </div>
            <div class="field">
              <label for="dietary">식단 선호</label>
              <select id="dietary" name="dietary">
                <option value="none" selected>상관없음</option>
                <option value="vegetarian">채식 위주</option>
                <option value="vegetarian-option">채식 선택지 필요</option>
                <option value="gluten-free">글루텐 프리</option>
                <option value="meat-friendly">고기 위주</option>
              </select>
            </div>
            <div class="field">
              <label for="spiceLevel">매운맛</label>
              <select id="spiceLevel" name="spiceLevel">
                <option value="mild">순한맛</option>
                <option value="medium" selected>보통</option>
                <option value="hot">매운맛</option>
              </select>
            </div>
            <div class="field">
              <label for="groupSize">인원 수</label>
              <input id="groupSize" name="groupSize" type="number" min="2" max="12" value="4" />
            </div>
            <button type="submit">추천 받기</button>
          </form>
        </section>

        <section class="panel">
          <div class="panel-title">
            <h2>2. 추천 결과</h2>
            <p>점수 높은 후보를 중심으로 추천 이유를 함께 보여줍니다.</p>
          </div>
          <div id="recommendations" class="recommendations empty">
            설문을 제출하면 추천 후보가 여기에 표시됩니다.
          </div>
        </section>
      </section>

      <section class="panel-grid">
        <section class="panel">
          <div class="panel-title">
            <h2>3. 투표방 만들기</h2>
            <p>상위 후보를 방으로 묶어 친구들과 링크로 공유하세요.</p>
          </div>
          <form id="room-form" class="stack">
            <div class="field">
              <label for="hostName">호스트 이름</label>
              <input id="hostName" name="hostName" type="text" placeholder="예: 지민" required />
            </div>
            <div class="field">
              <label for="roomTitle">방 제목</label>
              <input id="roomTitle" name="roomTitle" type="text" placeholder="예: 금요일 저녁 메뉴" />
            </div>
            <button type="submit">투표방 생성</button>
          </form>
        </section>

        <section class="panel">
          <div class="panel-title">
            <h2>4. 실시간 득표 현황</h2>
            <p>입장 후 이름을 적고 후보별 찬성/보류/반대를 남길 수 있습니다.</p>
          </div>
          <div id="room-section" class="room-shell empty">
            추천 결과로 투표방을 만들면 여기에 방 정보가 표시됩니다.
          </div>
        </section>
      </section>
    </main>
    <script>
      let latestRecommendations = [];
      let currentRoom = null;

      document.getElementById("preferences-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const payload = {
          cuisines: formData.getAll("cuisines"),
          budget: formData.get("budget"),
          distance: formData.get("distance"),
          vibe: formData.get("vibe"),
          dietary: formData.get("dietary"),
          spiceLevel: formData.get("spiceLevel"),
          groupSize: formData.get("groupSize")
        };

        const response = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        latestRecommendations = data.recommendations;
        renderRecommendations(data.recommendations);
      });

      document.getElementById("room-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        if (latestRecommendations.length === 0) {
          alert("먼저 추천 결과를 만들어 주세요.");
          return;
        }

        const formData = new FormData(event.currentTarget);
        const payload = {
          hostName: formData.get("hostName"),
          title: formData.get("roomTitle"),
          candidates: latestRecommendations
        };

        const response = await fetch("/api/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        currentRoom = data.room;
        renderRoom(data.room);
      });

      async function submitVote(roomId, candidateId, choice) {
        const participant = prompt("투표자 이름을 입력하세요.");
        if (!participant) {
          return;
        }

        const response = await fetch("/api/rooms/" + roomId + "/votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId, participant, choice })
        });
        const data = await response.json();
        currentRoom = data.room;
        renderRoom(data.room);
      }

      function renderRecommendations(recommendations) {
        const container = document.getElementById("recommendations");
        container.classList.remove("empty");
        container.innerHTML = recommendations.map((item) => \`
          <article class="recommendation-card">
            <div class="row spread">
              <div>
                <div class="meta">\${item.cuisine} · \${item.area}</div>
                <h3>\${item.name}</h3>
              </div>
              <div class="score">\${item.score}점</div>
            </div>
            <p class="price">\${item.priceLabel}</p>
            <div class="tags">\${item.reasons.map((reason) => \`<span>\${reason}</span>\`).join("")}</div>
          </article>
        \`).join("");
      }

      function renderRoom(room) {
        const container = document.getElementById("room-section");
        container.classList.remove("empty");
        const shareUrl = window.location.origin + "/app?room=" + room.id;
        container.innerHTML = \`
          <div class="room-header">
            <div>
              <div class="meta">Room \${room.id}</div>
              <h3>\${room.title}</h3>
              <p>호스트: \${room.hostName}</p>
            </div>
            <button class="ghost-button" type="button" onclick="navigator.clipboard.writeText('\${shareUrl}')">링크 복사</button>
          </div>
          <div class="ranking-list">
            \${room.ranking.map((candidate) => \`
              <article class="vote-card">
                <div class="row spread">
                  <div>
                    <div class="meta">\${candidate.cuisine} · \${candidate.area}</div>
                    <h4>\${candidate.name}</h4>
                  </div>
                  <div class="score">\${candidate.score}</div>
                </div>
                <div class="vote-stats">
                  <span>찬성 \${candidate.tallies.yes}</span>
                  <span>보류 \${candidate.tallies.maybe}</span>
                  <span>반대 \${candidate.tallies.no}</span>
                </div>
                <div class="vote-actions">
                  <button type="button" onclick="submitVote('\${room.id}', '\${candidate.id}', 'yes')">찬성</button>
                  <button type="button" class="secondary" onclick="submitVote('\${room.id}', '\${candidate.id}', 'maybe')">보류</button>
                  <button type="button" class="danger" onclick="submitVote('\${room.id}', '\${candidate.id}', 'no')">반대</button>
                </div>
              </article>
            \`).join("")}
          </div>
        \`;
      }

      const existingRoom = new URLSearchParams(window.location.search).get("room");
      if (existingRoom) {
        fetch("/api/rooms/" + existingRoom)
          .then((response) => response.ok ? response.json() : null)
          .then((data) => {
            if (data && data.room) {
              currentRoom = data.room;
              renderRoom(data.room);
            }
          });
      }
    </script>
  `);
}

function renderDocument(body) {
  return `<!DOCTYPE html>
  <html lang="ko">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Dinner Signal</title>
      <style>
        :root {
          --bg: #f2ede4;
          --paper: rgba(255, 252, 246, 0.88);
          --ink: #1f1a17;
          --accent: #d34c24;
          --accent-dark: #9f2d0d;
          --line: rgba(31, 26, 23, 0.12);
          --muted: #6d655e;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: "Avenir Next", "Pretendard", sans-serif;
          color: var(--ink);
          background:
            radial-gradient(circle at top left, rgba(211, 76, 36, 0.18), transparent 28%),
            radial-gradient(circle at bottom right, rgba(57, 109, 83, 0.18), transparent 26%),
            linear-gradient(135deg, #efe2cf 0%, var(--bg) 52%, #ebe3d6 100%);
          min-height: 100vh;
        }
        .gate,
        .app-shell {
          width: min(1120px, calc(100% - 32px));
          margin: 0 auto;
        }
        .gate {
          min-height: 100vh;
          display: grid;
          place-content: center;
          gap: 18px;
          padding: 48px 0;
        }
        .gate > * {
          max-width: 540px;
        }
        .brand, .eyebrow, .meta {
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-size: 12px;
          color: var(--accent-dark);
        }
        h1, h2, h3, h4, p {
          margin: 0;
        }
        h1 {
          font-size: clamp(2.4rem, 6vw, 4.8rem);
          line-height: 0.95;
        }
        .intro {
          font-size: 1.05rem;
          line-height: 1.6;
          color: var(--muted);
        }
        .password-form, .panel {
          background: var(--paper);
          backdrop-filter: blur(18px);
          border: 1px solid var(--line);
          box-shadow: 0 22px 80px rgba(68, 46, 27, 0.08);
        }
        .password-form {
          display: grid;
          gap: 12px;
          padding: 24px;
          border-radius: 28px;
        }
        .hint, .error {
          font-size: 0.92rem;
        }
        .error { color: #b12929; }
        input, select, button {
          font: inherit;
        }
        input, select {
          width: 100%;
          border-radius: 16px;
          border: 1px solid rgba(31, 26, 23, 0.15);
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.9);
        }
        button {
          border: 0;
          border-radius: 999px;
          padding: 14px 20px;
          background: var(--accent);
          color: white;
          cursor: pointer;
          transition: transform 160ms ease, background 160ms ease;
        }
        button:hover {
          transform: translateY(-1px);
          background: var(--accent-dark);
        }
        .ghost-button, .secondary {
          background: #efe4d7;
          color: var(--ink);
        }
        .danger {
          background: #a83c2d;
        }
        .app-shell {
          padding: 40px 0 64px;
          display: grid;
          gap: 20px;
        }
        .hero-card {
          display: grid;
          grid-template-columns: 1.8fr 1fr;
          gap: 16px;
          padding: 28px;
          border-radius: 32px;
          background: linear-gradient(135deg, rgba(255, 250, 243, 0.92), rgba(255, 241, 228, 0.72));
          border: 1px solid var(--line);
          box-shadow: 0 20px 70px rgba(94, 55, 33, 0.08);
        }
        .hero-card p {
          margin-top: 12px;
          max-width: 640px;
          color: var(--muted);
          line-height: 1.6;
        }
        .hero-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          align-items: end;
        }
        .hero-stats div {
          padding: 18px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.6);
          border: 1px solid rgba(31, 26, 23, 0.08);
        }
        .hero-stats strong {
          display: block;
          font-size: 1.4rem;
        }
        .hero-stats span {
          color: var(--muted);
          font-size: 0.92rem;
        }
        .panel-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
        }
        .panel {
          border-radius: 28px;
          padding: 24px;
        }
        .panel-title {
          display: grid;
          gap: 6px;
          margin-bottom: 18px;
        }
        .panel-title p {
          color: var(--muted);
          line-height: 1.5;
        }
        .stack, .field {
          display: grid;
          gap: 12px;
        }
        .field {
          margin-bottom: 14px;
        }
        .chip-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .chip-option {
          position: relative;
        }
        .chip-option input {
          position: absolute;
          inset: 0;
          opacity: 0;
        }
        .chip-option span {
          display: inline-flex;
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(211, 76, 36, 0.08);
          border: 1px solid transparent;
        }
        .chip-option input:checked + span {
          background: rgba(211, 76, 36, 0.18);
          border-color: rgba(211, 76, 36, 0.5);
        }
        .recommendations, .room-shell {
          display: grid;
          gap: 14px;
          min-height: 220px;
        }
        .recommendations.empty, .room-shell.empty {
          place-items: center;
          color: var(--muted);
          text-align: center;
          border: 1px dashed rgba(31, 26, 23, 0.2);
          border-radius: 24px;
          padding: 24px;
        }
        .recommendation-card, .vote-card {
          padding: 18px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.78);
          border: 1px solid rgba(31, 26, 23, 0.08);
        }
        .row {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .spread {
          justify-content: space-between;
        }
        .score {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 58px;
          height: 58px;
          border-radius: 18px;
          background: #202018;
          color: #fff8ec;
          font-weight: 700;
        }
        .price {
          margin-top: 10px;
          color: var(--muted);
        }
        .tags, .vote-stats, .vote-actions, .ranking-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .tags span, .vote-stats span {
          display: inline-flex;
          padding: 8px 10px;
          border-radius: 999px;
          background: rgba(32, 32, 24, 0.08);
          font-size: 0.92rem;
        }
        .room-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }
        .ranking-list {
          display: grid;
          margin-top: 14px;
        }
        .vote-actions {
          margin-top: 12px;
        }
        @media (max-width: 860px) {
          .hero-card,
          .panel-grid {
            grid-template-columns: 1fr;
          }
          .hero-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .hero-stats {
            grid-template-columns: 1fr;
          }
          h1 {
            line-height: 1;
          }
          .room-header, .row.spread {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      </style>
    </head>
    <body>${body}</body>
  </html>`;
}

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function handleLogin(request, response) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString();
  const params = new URLSearchParams(body);
  const password = params.get("password");

  if (password !== getPassword()) {
    sendHtml(response, 401, loginPage("비밀번호가 올바르지 않습니다."));
    return;
  }

  redirect(response, "/app", {
    "Set-Cookie": `${SESSION_COOKIE}=${createSessionValue()}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`
  });
}

async function handleApi(request, response, pathname) {
  if (pathname === "/api/recommendations" && request.method === "POST") {
    const payload = await readBody(request);
    sendJson(response, 200, { recommendations: recommendRestaurants(payload) });
    return;
  }

  if (pathname === "/api/rooms" && request.method === "POST") {
    const payload = await readBody(request);
    const room = createRoom(payload);
    sendJson(response, 201, { room: getRoom(room.id) });
    return;
  }

  const roomMatch = pathname.match(/^\/api\/rooms\/([a-f0-9]+)$/);
  if (roomMatch && request.method === "GET") {
    const room = getRoom(roomMatch[1]);
    if (!room) {
      sendJson(response, 404, { error: "Room not found" });
      return;
    }
    sendJson(response, 200, { room });
    return;
  }

  const voteMatch = pathname.match(/^\/api\/rooms\/([a-f0-9]+)\/votes$/);
  if (voteMatch && request.method === "POST") {
    const payload = await readBody(request);
    const room = castVote({
      roomId: voteMatch[1],
      candidateId: payload.candidateId,
      participant: payload.participant,
      choice: payload.choice
    });

    if (!room) {
      sendJson(response, 404, { error: "Room not found" });
      return;
    }

    sendJson(response, 200, { room });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname;
  const authenticated = isAuthenticated(request);

  if (pathname === "/" && request.method === "GET") {
    if (authenticated) {
      redirect(response, "/app");
      return;
    }
    sendHtml(response, 200, loginPage());
    return;
  }

  if (pathname === "/login" && request.method === "POST") {
    await handleLogin(request, response);
    return;
  }

  if (!authenticated) {
    redirect(response, "/");
    return;
  }

  if (pathname === "/app" && request.method === "GET") {
    sendHtml(response, 200, dashboardPage());
    return;
  }

  if (pathname.startsWith("/api/")) {
    try {
      await handleApi(request, response, pathname);
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return;
  }

  sendHtml(response, 404, renderDocument("<section class='gate'><h1>404</h1><p>페이지를 찾을 수 없습니다.</p></section>"));
});

server.listen(port, () => {
  console.log(`Dinner Signal listening on http://localhost:${port}`);
});
