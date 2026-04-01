const { restaurants } = require("./data");

const distanceWeight = { near: 3, mid: 2, far: 1 };
const budgetWeight = { low: 1, medium: 2, high: 3 };

function normalizePreferences(input = {}) {
  return {
    cuisines: Array.isArray(input.cuisines) ? input.cuisines.filter(Boolean) : [],
    budget: input.budget || "medium",
    vibe: input.vibe || "casual",
    distance: input.distance || "near",
    dietary: input.dietary || "none",
    spiceLevel: input.spiceLevel || "medium",
    groupSize: Number.parseInt(input.groupSize || "4", 10)
  };
}

function scoreRestaurant(restaurant, preferences) {
  let score = 0;

  if (preferences.cuisines.includes(restaurant.cuisine)) {
    score += 30;
  }

  score += 12 - Math.abs(budgetWeight[preferences.budget] - budgetWeight[restaurant.budget]) * 4;
  score += 10 - Math.abs(distanceWeight[preferences.distance] - distanceWeight[restaurant.distance]) * 3;

  if (restaurant.vibe === preferences.vibe) {
    score += 16;
  }

  if (restaurant.spiceLevel === preferences.spiceLevel) {
    score += 8;
  }

  if (preferences.groupSize >= 5 && restaurant.bestFor.includes("group")) {
    score += 10;
  }

  if (preferences.groupSize <= 3 && restaurant.bestFor.includes("small-group")) {
    score += 10;
  }

  if (preferences.dietary !== "none" && restaurant.dietary.includes(preferences.dietary)) {
    score += 18;
  }

  if (preferences.dietary === "none") {
    score += 6;
  }

  return score;
}

function buildReason(restaurant, preferences) {
  const reasons = [];

  if (preferences.cuisines.includes(restaurant.cuisine)) {
    reasons.push(`${restaurant.cuisine} 선호 반영`);
  }

  if (restaurant.vibe === preferences.vibe) {
    reasons.push(`${labelVibe(restaurant.vibe)} 분위기`);
  }

  if (restaurant.distance === preferences.distance) {
    reasons.push(`${labelDistance(restaurant.distance)} 거리`);
  }

  if (preferences.dietary !== "none" && restaurant.dietary.includes(preferences.dietary)) {
    reasons.push(`${labelDietary(preferences.dietary)} 옵션`);
  }

  if (preferences.groupSize >= 5 && restaurant.bestFor.includes("group")) {
    reasons.push("단체 모임 적합");
  }

  return reasons.slice(0, 3);
}

function recommendRestaurants(input) {
  const preferences = normalizePreferences(input);

  return restaurants
    .map((restaurant) => {
      const score = scoreRestaurant(restaurant, preferences);
      return {
        ...restaurant,
        score,
        reasons: buildReason(restaurant, preferences)
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
}

function summarizeVotes(room) {
  return room.candidates
    .map((candidate) => {
      const votes = room.votes[candidate.id] || [];
      const tallies = votes.reduce(
        (acc, vote) => {
          acc[vote.choice] += 1;
          return acc;
        },
        { yes: 0, maybe: 0, no: 0 }
      );

      const score = tallies.yes * 3 + tallies.maybe - tallies.no * 2;

      return {
        ...candidate,
        tallies,
        score
      };
    })
    .sort((left, right) => right.score - left.score);
}

function labelDistance(distance) {
  return {
    near: "가까운",
    mid: "적당한",
    far: "조금 이동하는"
  }[distance] || "무난한";
}

function labelVibe(vibe) {
  return {
    casual: "편한",
    cozy: "아늑한",
    calm: "차분한",
    lively: "활기찬",
    romantic: "분위기 있는"
  }[vibe] || "무난한";
}

function labelDietary(dietary) {
  return {
    vegetarian: "채식",
    "vegetarian-option": "채식 선택",
    "gluten-free": "글루텐 프리",
    "meat-friendly": "육류 중심"
  }[dietary] || "일반";
}

module.exports = {
  normalizePreferences,
  recommendRestaurants,
  summarizeVotes
};
