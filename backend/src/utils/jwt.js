import jwt from "jsonwebtoken";

const JWT_EXPIRES_IN = "8h";

export function signJwt(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing");
  }
  return jwt.sign(payload, secret, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyJwt(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing");
  }
  return jwt.verify(token, secret);
}

export function signChallengeToken() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing");
  }
  return jwt.sign({ type: "challenge", nonce: Math.random().toString(36).substring(2) }, secret, { expiresIn: "60s" });
}

export function verifyChallengeToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing");
  }
  const decoded = jwt.verify(token, secret);
  if (decoded.type !== "challenge") {
    throw new Error("Invalid token type");
  }
  return decoded;
}
