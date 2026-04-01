const crypto = require("node:crypto");

const SESSION_COOKIE = "ideabank_session";

function getPassword() {
  return process.env.ACCESS_PASSWORD || "ideabank2026";
}

function createSignature(value) {
  return crypto.createHmac("sha256", getPassword()).update(value).digest("hex");
}

function createSessionValue() {
  const value = "authenticated";
  return `${value}.${createSignature(value)}`;
}

function isValidSession(cookieValue) {
  if (!cookieValue || !cookieValue.includes(".")) {
    return false;
  }

  const [value, signature] = cookieValue.split(".");
  const expected = createSignature(value);
  if (!signature || signature.length !== expected.length) {
    return false;
  }

  return value === "authenticated" && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) {
      return acc;
    }
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

module.exports = {
  SESSION_COOKIE,
  createSessionValue,
  getPassword,
  isValidSession,
  parseCookies
};
