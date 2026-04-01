const crypto = require("node:crypto");
const { summarizeVotes } = require("./recommendations");

const rooms = new Map();

function createRoom({ hostName, title, candidates }) {
  const roomId = crypto.randomBytes(4).toString("hex");
  const room = {
    id: roomId,
    title: title || "오늘 저녁 뭐 먹지?",
    hostName: hostName || "호스트",
    createdAt: new Date().toISOString(),
    candidates,
    votes: {}
  };

  rooms.set(roomId, room);
  return room;
}

function getRoom(roomId) {
  const room = rooms.get(roomId);

  if (!room) {
    return null;
  }

  return {
    ...room,
    ranking: summarizeVotes(room)
  };
}

function castVote({ roomId, candidateId, participant, choice }) {
  const room = rooms.get(roomId);

  if (!room) {
    return null;
  }

  if (!room.votes[candidateId]) {
    room.votes[candidateId] = [];
  }

  room.votes[candidateId] = room.votes[candidateId].filter((vote) => vote.participant !== participant);
  room.votes[candidateId].push({
    participant,
    choice
  });

  return getRoom(roomId);
}

module.exports = {
  createRoom,
  getRoom,
  castVote
};
