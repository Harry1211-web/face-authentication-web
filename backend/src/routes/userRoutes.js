import express from "express";
import bcrypt from "bcryptjs";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { getDb } from "../db.js";
import { validateStrongPassword } from "../utils/passwordPolicy.js";

const router = express.Router();

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      "SELECT id, full_name, email, phone, created_at FROM users WHERE id = $1",
      [req.user.sub]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      createdAt: user.created_at,
    });
  } catch (error) {
    console.log(error.message)
    return res.status(500).json({ message: error.message || "Server error" });
  }
});

router.patch("/me/password", authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Missing password fields" });
    }

    const passwordCheck = validateStrongPassword(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({ message: passwordCheck.message });
    }

    const db = getDb();
    const result = await db.query("SELECT * FROM users WHERE id = $1", [
      req.user.sub,
    ]);
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const valid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Old password is not correct" });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      newHash,
      user.id,
    ]);

    return res.json({ message: "Password changed successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
});

export default router;
