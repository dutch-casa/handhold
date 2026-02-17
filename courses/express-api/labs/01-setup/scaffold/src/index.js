const express = require("express");
const { pool } = require("./db");

const app = express();
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// List all users
app.get("/users", async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM users ORDER BY id");
  res.json(rows);
});

// Get user by id
app.get("/users/:id", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [
    req.params.id,
  ]);
  if (rows.length === 0) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

// Create user
app.post("/users", async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: "name and email required" });
  }
  const { rows } = await pool.query(
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
    [name, email],
  );
  res.status(201).json(rows[0]);
});

// Delete user
app.delete("/users/:id", async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM users WHERE id = $1", [
    req.params.id,
  ]);
  if (rowCount === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
