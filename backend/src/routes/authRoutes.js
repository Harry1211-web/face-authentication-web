import express from "express";
import bcrypt from "bcryptjs";
import { getDb } from "../db.js";
import { analyzeFrame, verifyLivenessVariance, euclideanDistance } from "../services/aiService.js";
import { signJwt, signChallengeToken, verifyChallengeToken } from "../utils/jwt.js";
import { validateStrongPassword } from "../utils/passwordPolicy.js";

const router = express.Router();

router.get("/challenge", (req, res) => {
  try {
    const token = signChallengeToken();
    return res.json({ sessionToken: token });
  } catch (error) {
    return res.status(500).json({ message: "Failed to generate challenge" });
  }
});

router.post("/check-status", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Thiếu email" });

    const db = getDb();
    const normalizedEmail = String(email).trim().toLowerCase();
    const result = await db.query("SELECT lock_until FROM users WHERE lower(email) = $1", [
      normalizedEmail,
    ]);
    const user = result.rows[0];

    if (!user || !user.lock_until) {
      return res.json({ locked: false });
    }

    if (new Date(user.lock_until) > new Date()) {
      const waitMinutes = Math.ceil((new Date(user.lock_until) - new Date()) / 60000);
      return res.json({ locked: true, waitMinutes });
    }

    return res.json({ locked: false });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { fullName, email, phone, password, sessionToken, proofs } = req.body;

    if (!fullName || !email || !password || !sessionToken || !proofs || !proofs.length) {
      return res.status(400).json({ message: "Thiếu trường dữ liệu bắt buộc" });
    }

    try {
      verifyChallengeToken(sessionToken);
    } catch (err) {
      return res.status(401).json({ message: "Session Token không hợp lệ hoặc đã hết hạn (60s)." });
    }

    const passwordCheck = validateStrongPassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ message: passwordCheck.message });
    }

    // Verify Liveness Proofs
    const varianceResult = await verifyLivenessVariance(proofs);
    if (!varianceResult.passed) {
      return res.status(400).json({ message: varianceResult.failReason });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPhone = String(phone || "").trim();
    const db = getDb();
    const passwordHash = await bcrypt.hash(password, 10);

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
        JSON.stringify(varianceResult.descriptor),
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

router.post("/login", async (req, res) => {
  try {
    const { email, password, sessionToken, proofs } = req.body;
    
    if (!email || !password || !sessionToken || !proofs || !proofs.length) {
      return res.status(400).json({ message: "Thiếu thông tin đăng nhập hoặc Liveness Proofs" });
    }

    try {
      verifyChallengeToken(sessionToken);
    } catch (err) {
      return res.status(401).json({ message: "Session Token không hợp lệ hoặc đã hết hạn (60s)." });
    }

    const db = getDb();
    const normalizedEmail = String(email).trim().toLowerCase();
    const result = await db.query("SELECT * FROM users WHERE lower(email) = $1", [
      normalizedEmail,
    ]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: "Tài khoản hoặc mật khẩu không chính xác" });
    }

    // Check if account is locked
    if (user.lock_until && new Date(user.lock_until) > new Date()) {
      const waitMinutes = Math.ceil((new Date(user.lock_until) - new Date()) / 60000);
      return res.status(403).json({ message: `Tài khoản đã bị khóa. Vui lòng thử lại sau ${waitMinutes} phút.` });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    // Evaluate proofs on backend
    const varianceResult = await verifyLivenessVariance(proofs);

    let match = false;
    let distance = 1.0;
    if (varianceResult.passed) {
      const storedDescriptor = JSON.parse(user.face_descriptor);
      distance = euclideanDistance(storedDescriptor, varianceResult.descriptor);
      console.log(`[FaceMatch] User: ${user.email}, Distance: ${distance}`);
      match = distance <= 0.6; // Threshold increased to 0.6 to reduce false negatives
    }

    await db.query(
      `
        INSERT INTO liveness_logs (user_id, active_score, passive_score, result)
        VALUES ($1, $2, $3, $4)
      `,
      [user.id, varianceResult.passed ? 1.0 : 0.0, 1.0, match]
    );

    if (!validPassword || !match || !varianceResult.passed) {
      // Increment failed attempts
      const newAttempts = (user.failed_attempts || 0) + 1;
      let lockQuery = "UPDATE users SET failed_attempts = $1 WHERE id = $2";
      let lockParams = [newAttempts, user.id];
      
      let errorMsg = "Thông tin đăng nhập hoặc khuôn mặt không hợp lệ.";
      if (!varianceResult.passed) {
        errorMsg = varianceResult.failReason || "Liveness không đạt yêu cầu.";
      }

      if (newAttempts >= 5) {
        lockQuery = "UPDATE users SET failed_attempts = $1, lock_until = NOW() + INTERVAL '15 minutes' WHERE id = $2";
        errorMsg = "Tài khoản đã bị khóa 15 phút do nhập sai quá nhiều lần.";
      }
      
      await db.query(lockQuery, lockParams);

      return res.status(401).json({
        message: errorMsg,
        distance
      });
    }

    // Success - reset attempts
    if (user.failed_attempts > 0 || user.lock_until) {
       await db.query("UPDATE users SET failed_attempts = 0, lock_until = NULL WHERE id = $1", [user.id]);
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
