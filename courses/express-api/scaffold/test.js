const { pool } = require("./src/db");

async function test() {
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  PASS: ${name}`);
      passed++;
    } else {
      console.log(`  FAIL: ${name}`);
      failed++;
    }
  }

  console.log("\nRunning tests...\n");

  // Test: users table exists
  const tableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables WHERE table_name = 'users'
    )
  `);
  assert(tableCheck.rows[0].exists, "users table exists");

  // Test: seeded data present
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM users");
  assert(rows[0].count >= 3, "at least 3 seeded users exist");

  // Test: insert works
  const insert = await pool.query(
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
    ["Test User", `test-${Date.now()}@example.com`],
  );
  assert(insert.rows.length === 1, "insert returns created row");
  assert(insert.rows[0].name === "Test User", "inserted name matches");

  // Test: select by id works
  const select = await pool.query("SELECT * FROM users WHERE id = $1", [
    insert.rows[0].id,
  ]);
  assert(select.rows.length === 1, "select by id returns one row");

  // Test: delete works
  const del = await pool.query("DELETE FROM users WHERE id = $1", [
    insert.rows[0].id,
  ]);
  assert(del.rowCount === 1, "delete removes one row");

  // Cleanup
  await pool.end();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

test().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
