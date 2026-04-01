import express from "express";
import bcrypt from "bcryptjs";
import { getDb } from "../db.js";
import { parseDescriptor, compareFace } from "../services/faceService.js";
import { signJwt } from "../utils/jwt.js";
import { validateStrongPassword } from "../utils/passwordPolicy.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { fullName, email, phone, password, faceDescriptor } = req.body;

    if (!fullName || !email || !password || !faceDescriptor) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPhone = String(phone || "").trim();

    const passwordCheck = validateStrongPassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ message: passwordCheck.message });
    }

    const db = getDb();

    const passwordHash = await bcrypt.hash(password, 10);
    const normalizedDescriptor = parseDescriptor(faceDescriptor);

    const result = await db.query(
      `
        INSERT INTO users (full_name, email, phone, password_hash, face_descriptor)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [
        fullName,
        normalizedEmail,
        normalizedPhone || null,
        passwordHash,
        JSON.stringify(normalizedDescriptor),
      ]
    );

    return res.status(201).json({
      message: "Register success",
      userId: Number(result.rows[0].id),
    });
  } catch (error) {
    if (error?.code === "23505") {
      const constraint = error.constraint || "";
      if (constraint.includes("idx_users_email_ci_unique")) {
        return res.status(409).json({ message: "Email already exists" });
      }
      if (constraint.includes("idx_users_phone_unique_not_empty")) {
        return res.status(409).json({ message: "Phone already exists" });
      }
      return res.status(409).json({ message: "Duplicate value" });
    }
    return res.status(500).json({ message: error.message || "Server error" });
  }
});

router.post("/login/password", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Missing email or password" });
    }

    const db = getDb();
    const normalizedEmail = String(email).trim().toLowerCase();
    const result = await db.query("SELECT * FROM users WHERE lower(email) = $1", [
      normalizedEmail,
    ]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return res.json({
      message: "Password verified",
      userId: user.id,
      fullName: user.full_name,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
});

router.post("/login/face", async (req, res) => {
  try {
    const { userId, faceDescriptor, activeLivenessScore, passiveLivenessScore } =
      req.body;

    if (!userId || !faceDescriptor) {
      return res.status(400).json({ message: "Missing userId or faceDescriptor" });
    }

    const db = getDb();
    const userResult = await db.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);
    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const incomingDescriptor = parseDescriptor(faceDescriptor);
    const storedDescriptor = JSON.parse(user.face_descriptor);
    const { distance, match } = compareFace(storedDescriptor, incomingDescriptor);

    const active = Number(activeLivenessScore || 0);
    const passive = Number(passiveLivenessScore || 0);
    const livenessOk = active >= 1.0 && passive >= 0.45;

    await db.query(
      `
        INSERT INTO liveness_logs (user_id, active_score, passive_score, result)
        VALUES ($1, $2, $3, $4)
      `,
      [user.id, active, passive, match && livenessOk]
    );

    if (!match) {
      return res.status(401).json({
        message: "Face not matched",
        distance,
      });
    }

    if (!livenessOk) {
      return res.status(401).json({
        message: "Liveness check failed",
        activeLivenessScore: active,
        passiveLivenessScore: passive,
      });
    }

    const token = signJwt({
      sub: user.id,
      email: user.email,
      fullName: user.full_name,
    });

    return res.json({
      message: "Login success",
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
});

export default router;
