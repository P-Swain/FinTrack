import "dotenv/config";
import app from "./app.js";
import pool from "./config/db.js";

const PORT = process.env.PORT || 5001;

async function startServer() {
  try {
    // Verify the database connection before accepting traffic
    const result = await pool.query("SELECT NOW()");
    console.log(`✅  Database connected successfully — server time: ${result.rows[0].now}`);

    app.listen(PORT, () => {
      console.log(`🚀  Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌  Failed to connect to the database:", error.message);
    process.exit(1); // Exit so the process manager / container can restart cleanly
  }
}

startServer();
