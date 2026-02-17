const { pool } = require("./src/db");

async function test() {
  let count = 0;
  const results = [];

  function check(condition, description) {
    count++;
    results.push({ ok: condition, index: count, description });
  }

  // Test: users table exists
  const tableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables WHERE table_name = 'users'
    )
  `);
  check(tableCheck.rows[0].exists, "users table exists");

  // Test: seeded data present
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM users");
  check(rows[0].count >= 3, "at least 3 seeded users exist");

  // Test: insert works
  const insert = await pool.query(
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
    ["Test User", `test-${Date.now()}@example.com`],
  );
  check(insert.rows.length === 1, "insert returns created row");
  check(insert.rows[0].name === "Test User", "inserted name matches");

  // Test: select by id works
  const select = await pool.query("SELECT * FROM users WHERE id = $1", [
    insert.rows[0].id,
  ]);
  check(select.rows.length === 1, "select by id returns one row");

  // Test: delete works
  const del = await pool.query("DELETE FROM users WHERE id = $1", [
    insert.rows[0].id,
  ]);
  check(del.rowCount === 1, "delete removes one row");

  await pool.end();

  // TAP output
  console.log(`1..${count}`);
  for (const r of results) {
    const status = r.ok ? "ok" : "not ok";
    console.log(`${status} ${r.index} - ${r.description}`);
  }

  const failed = results.filter((r) => !r.ok).length;
  process.exit(failed > 0 ? 1 : 0);
}

test().catch((err) => {
  console.error("Bail out!", err.message);
  process.exit(1);
});
