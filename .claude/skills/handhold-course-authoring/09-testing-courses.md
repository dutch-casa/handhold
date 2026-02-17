# Testing Courses

How to write lab tests that validate the learner's work. Tests use the TAP (Test Anything Protocol) format and run via a configurable test command.

## TAP Protocol

Handhold parses test output using TAP — a simple line-based protocol. Your test script must produce TAP output to stdout.

### Format

```
1..N                          # Plan: how many tests total
ok 1 - description            # Passing assertion
not ok 2 - description        # Failing assertion
ok 3 - description            # Passing assertion
```

### Parsing rules

The parser extracts lines matching:
- `ok N - description` → passed assertion
- `not ok N - description` → failed assertion

Everything else (logs, errors, blank lines) is captured as raw output but not parsed as assertions. This means your test can print debug info freely — only `ok`/`not ok` lines count.

### Exit code

- Exit `0` if all tests pass
- Exit `1` (or any non-zero) if any test fails
- If the test process crashes before producing any TAP output, the UI shows the raw error

## Writing Test Scripts

### The test harness pattern

Every test script follows the same structure. No test framework needed — plain JavaScript (or Python, Bash, whatever the lab uses).

```javascript
async function test() {
  let count = 0;
  const results = [];

  function check(condition, description) {
    count++;
    results.push({ ok: condition, index: count, description });
  }

  // --- Assertions ---

  check(typeof add === "function", "add function exists");
  check(add(2, 3) === 5, "add(2, 3) returns 5");

  // --- TAP output ---

  console.log(`1..${count}`);
  for (const r of results) {
    console.log(`${r.ok ? "ok" : "not ok"} ${r.index} - ${r.description}`);
  }

  process.exit(results.some(r => !r.ok) ? 1 : 0);
}

test().catch(err => {
  console.error("Bail out!", err.message);
  process.exit(1);
});
```

This pattern:
1. Collects all assertions first (even if some fail, later ones still run)
2. Prints TAP at the end (clean output, not interleaved with other logs)
3. Exits with appropriate code

### The check function

The `check(condition, description)` function is the core primitive:

```javascript
function check(condition, description) {
  count++;
  results.push({ ok: condition, index: count, description });
}
```

- **condition**: Boolean. True = pass, false = fail.
- **description**: Human-readable string shown in the test panel.

Keep descriptions specific:
- Good: `"users table exists"`, `"POST /users returns 201"`, `"inserted name matches"`
- Bad: `"test 1"`, `"works"`, `"should be correct"`

### Async tests

For database queries, HTTP requests, or any async operation:

```javascript
async function test() {
  // ...

  const res = await fetch("http://localhost:3000/users");
  check(res.status === 200, "GET /users returns 200");

  const body = await res.json();
  check(Array.isArray(body), "response is an array");
  check(body.length >= 3, "at least 3 users returned");

  // ...
}

test().catch(err => {
  console.error("Bail out!", err.message);
  process.exit(1);
});
```

The `catch` handler ensures that even if the test crashes (e.g., connection refused), the process exits cleanly with an error message instead of hanging.

### Database tests

```javascript
const { pool } = require("./src/db");

async function test() {
  let count = 0;
  const results = [];
  function check(ok, desc) { count++; results.push({ ok, index: count, description: desc }); }

  // Table exists
  const tableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables WHERE table_name = 'users'
    )
  `);
  check(tableCheck.rows[0].exists, "users table exists");

  // Seeded data
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM users");
  check(rows[0].count >= 3, "at least 3 seeded users exist");

  // CRUD operations
  const insert = await pool.query(
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
    ["Test User", `test-${Date.now()}@example.com`]
  );
  check(insert.rows.length === 1, "insert returns created row");

  const select = await pool.query(
    "SELECT * FROM users WHERE id = $1", [insert.rows[0].id]
  );
  check(select.rows.length === 1, "select by id returns one row");

  const del = await pool.query(
    "DELETE FROM users WHERE id = $1", [insert.rows[0].id]
  );
  check(del.rowCount === 1, "delete removes one row");

  await pool.end();

  // TAP
  console.log(`1..${count}`);
  for (const r of results) {
    console.log(`${r.ok ? "ok" : "not ok"} ${r.index} - ${r.description}`);
  }
  process.exit(results.some(r => !r.ok) ? 1 : 0);
}

test().catch(err => {
  console.error("Bail out!", err.message);
  process.exit(1);
});
```

### HTTP endpoint tests

```javascript
const BASE = "http://localhost:3000";

async function test() {
  let count = 0;
  const results = [];
  function check(ok, desc) { count++; results.push({ ok, index: count, description: desc }); }

  // GET /users
  const list = await fetch(`${BASE}/users`);
  check(list.status === 200, "GET /users returns 200");

  // POST /users
  const create = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test", email: `t-${Date.now()}@test.com` }),
  });
  check(create.status === 201, "POST /users returns 201");

  const user = await create.json();
  check(user.name === "Test", "created user has correct name");

  // GET /users/:id
  const single = await fetch(`${BASE}/users/${user.id}`);
  check(single.status === 200, "GET /users/:id returns 200");

  // DELETE /users/:id
  const del = await fetch(`${BASE}/users/${user.id}`, { method: "DELETE" });
  check(del.status === 204, "DELETE /users/:id returns 204");

  // TAP
  console.log(`1..${count}`);
  for (const r of results) {
    console.log(`${r.ok ? "ok" : "not ok"} ${r.index} - ${r.description}`);
  }
  process.exit(results.some(r => !r.ok) ? 1 : 0);
}

test().catch(err => {
  console.error("Bail out!", err.message);
  process.exit(1);
});
```

## Test Design Principles

### Test what the lesson taught

Tests should validate the concepts from the preceding lesson. If the lesson taught CRUD operations, test CRUD. If it taught composition patterns, test that the component renders correctly.

Don't test tangential concerns. If the lesson is about routing, don't test CSS styling.

### Progressive difficulty within a lab

Order tests from easiest to hardest:

```
1. Structure exists (table, file, function)
2. Basic operation works (insert, render, connect)
3. Edge case handled (empty input, duplicate, error)
4. Integration works (full flow from request to response)
```

Early tests passing gives the learner confidence. Later tests challenge them.

### Each task = at least one test

Every task in INSTRUCTIONS.md should map to one or more test assertions:

```markdown
## Tasks
- Create the users table         → "users table exists"
- Implement the seed script      → "at least 3 seeded users exist"
- Add the POST /users endpoint   → "POST /users returns 201", "created user has correct name"
```

If a task has no test, the learner can't verify they did it right. If a test has no matching task, it's testing something they weren't asked to do.

### Don't test implementation details

Test behavior, not implementation. The learner should be free to solve the problem their way.

```javascript
// Good: tests behavior
check(res.status === 200, "GET /users returns 200");
check(body.length >= 3, "at least 3 users returned");

// Bad: tests implementation
check(typeof db.query === "function", "uses pool.query");
check(code.includes("SELECT"), "uses SELECT statement");
```

### Clean up after yourself

Tests that create data should clean it up. Use unique values (timestamps) to avoid collisions with seeded data:

```javascript
const email = `test-${Date.now()}@example.com`;
const insert = await pool.query(
  "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
  ["Test User", email]
);
// ... test assertions ...
await pool.query("DELETE FROM users WHERE id = $1", [insert.rows[0].id]);
```

This ensures tests are idempotent — running them multiple times doesn't accumulate garbage data.

### Handle connection failures gracefully

The test script starts before the learner has necessarily written their code. If their server isn't running, `fetch` will throw. The `catch` handler at the bottom must handle this:

```javascript
test().catch(err => {
  console.error("Bail out!", err.message);
  process.exit(1);
});
```

`Bail out!` is TAP syntax for "the test suite itself failed." The UI displays the error message clearly.

## Test Count and Scope

### How many tests per lab?

| Lab type | Tests | Reasoning |
|----------|-------|-----------|
| Simple (single concept) | 3-5 | Quick feedback loop |
| Medium (multi-step) | 5-10 | One per task, some edge cases |
| Complex (capstone) | 8-15 | Comprehensive validation |

More than 15 tests means the lab is too large. Split it.

### What to test

- **Existence**: Does the thing exist? (table, endpoint, function, file)
- **Happy path**: Does it work with valid input?
- **Output shape**: Is the response/return value the right type and structure?
- **Integration**: Do the pieces work together?

### What NOT to test

- **Exact error messages**: Too brittle. Test status codes instead.
- **Internal variable names**: The learner's naming is their business.
- **Specific SQL syntax**: Test that the query works, not how it's written.
- **Timing**: Don't test "response under 100ms." Environments vary.
- **Style**: Don't test indentation, naming conventions, or code structure.

## Python Tests

Same TAP protocol, different language:

```python
import sys

results = []
count = 0

def check(condition, description):
    global count
    count += 1
    results.append({"ok": condition, "index": count, "description": description})

# Assertions
check(callable(add), "add function exists")
check(add(2, 3) == 5, "add(2, 3) returns 5")

# TAP output
print(f"1..{count}")
for r in results:
    status = "ok" if r["ok"] else "not ok"
    print(f"{status} {r['index']} - {r['description']}")

sys.exit(0 if all(r["ok"] for r in results) else 1)
```

## Bash Tests

For infrastructure or CLI labs:

```bash
#!/bin/bash
count=0
fail=0

check() {
  count=$((count + 1))
  if [ "$1" = "true" ]; then
    echo "ok $count - $2"
  else
    echo "not ok $count - $2"
    fail=$((fail + 1))
  fi
}

# Assertions
check "$(test -f src/index.js && echo true)" "src/index.js exists"
check "$(curl -s -o /dev/null -w '%{http_code}' localhost:3000/health | grep -c 200 | grep -c 1 && echo true)" "health endpoint returns 200"

echo "1..$count"
exit $fail
```

## The Test-First Approach

When designing a lab:

1. **Write the tests first** — they define what "done" means
2. **Write the scaffold** — working skeleton that fails the tests
3. **Verify the solution** — make sure the tests pass when the lab is completed correctly
4. **Write the instructions** — tasks derived directly from what the tests check

This ensures tests are correct, the scaffold is solvable, and the instructions match reality.
