import "dotenv/config";
import express from "express";
import cors from "cors";
import { initDb } from "./db.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";

const app = express();
const port = Number(process.env.PORT || 5000);

const allowedOrigin = process.env.FRONTEND_ORIGIN;
app.use(
  cors(
    allowedOrigin
      ? {
          origin: allowedOrigin,
          credentials: true,
        }
      : undefined
  )
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

initDb()
  .then(() => {
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Backend running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start server:", error);
    process.exit(1);
  });
