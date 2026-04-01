const test = require("node:test");
const assert = require("node:assert/strict");

const { createSessionValue, isValidSession, parseCookies } = require("../src/auth");
const { recommendRestaurants, summarizeVotes } = require("../src/recommendations");

test("signed session cookie is accepted", () => {
  const session = createSessionValue();
  assert.equal(isValidSession(session), true);
});

test("cookie parser reads multiple values", () => {
  const cookies = parseCookies("a=1; ideabank_session=token; theme=dark");
  assert.equal(cookies.a, "1");
  assert.equal(cookies.ideabank_session, "token");
  assert.equal(cookies.theme, "dark");
});

test("recommendations rank matching cuisine highly", () => {
  const recommendations = recommendRestaurants({
    cuisines: ["일식"],
    budget: "medium",
    distance: "near",
    vibe: "cozy",
    dietary: "vegetarian-option",
    spiceLevel: "mild",
    groupSize: "2"
  });

  assert.equal(recommendations[0].id, "mellow-ramen");
});

test("vote summary prioritizes strong yes votes", () => {
  const ranking = summarizeVotes({
    candidates: [
      { id: "a", name: "A" },
      { id: "b", name: "B" }
    ],
    votes: {
      a: [
        { participant: "Kim", choice: "yes" },
        { participant: "Lee", choice: "yes" }
      ],
      b: [
        { participant: "Park", choice: "maybe" },
        { participant: "Choi", choice: "no" }
      ]
    }
  });

  assert.equal(ranking[0].id, "a");
  assert.deepEqual(ranking[0].tallies, { yes: 2, maybe: 0, no: 0 });
});
