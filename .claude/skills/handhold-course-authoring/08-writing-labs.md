# Writing Labs

Labs are hands-on coding exercises. The learner writes code in a real editor, runs real tests, and interacts with real services. This guide covers how to design, scaffold, and configure labs.

## Lab Anatomy

A lab lives in a directory under the course's `labs/` folder:

```
labs/01-setup/
├── lab.yaml          # Configuration: services, tests, setup, open files
├── INSTRUCTIONS.md   # What the learner sees: tasks, hints, context
└── scaffold/         # Starting code: the files the learner will work in
    ├── package.json
    ├── src/
    │   └── index.js
    ├── seed.js
    └── test.js
```

### lab.yaml

The lab manifest. Every field maps to a behavior in the lab runtime.

```yaml
workspace: fresh          # "fresh" = clean start, "continue" = keep previous lab's files
test: node test.js        # Command to run when learner clicks "Run Tests"
services:                 # Docker containers to spin up
  - postgres              # Preset name (see service presets below)
setup:                    # Commands run after scaffold is copied
  - npm install
  - node seed.js
open:                     # Files to open in the editor on load
  - src/index.js
start:                    # Optional: commands to keep running (dev server, etc.)
  - npm run dev
```

### INSTRUCTIONS.md

What the learner sees in the instructions panel. Markdown format.

```markdown
# Lab Title

One sentence describing the goal.

## Tasks

- Task 1 (the first thing to implement)
- Task 2 (builds on task 1)
- Task 3 (final piece)

## Hints

Context the learner might need. Connection strings, API references, file locations.

Use `Run Tests` in the testing panel to check your progress.
```

### scaffold/

The starting code. Everything inside this directory is copied to the learner's workspace when the lab starts. This is what they'll edit.

## Designing Labs

### What to give vs. what to leave blank

The scaffold should be a **working skeleton** with holes. The learner fills the holes.

**Give them:**
- Project structure (package.json, directory layout)
- Boilerplate they shouldn't waste time on (imports, config, server setup)
- Utility functions not related to the teaching point
- Database schemas or seed scripts
- Test files (they don't write tests — they pass them)
- Comments or TODO markers where they need to write code

**Leave blank:**
- The core implementation (the thing the lesson just taught)
- Logic that requires understanding the concept
- Integration between components (if composition is the lesson)

### The 80/20 scaffold rule

The scaffold should be 80% complete. The learner writes the 20% that matters — the part that demonstrates understanding. If the scaffold is 50% complete, the learner is fighting boilerplate. If it's 95% complete, the lab is too easy and they learn nothing.

### Progressive labs

When labs build on each other, use `workspace: continue`:

```yaml
# Lab 1: Create the API
workspace: fresh
# ...

# Lab 2: Add authentication
workspace: continue
# ...
```

`continue` carries the learner's workspace from the previous lab. Their code persists. Lab 2 adds new tests that require new code, but the old code (and old tests) should still pass.

For standalone labs, use `workspace: fresh`. The scaffold is a clean start.

### Scaffolding patterns

**The TODO pattern:**
```javascript
function createUser(name, email) {
  // TODO: Insert into the users table and return the created row
  // Hint: Use pool.query with parameterized values ($1, $2)
}
```

**The stub pattern:**
```javascript
function createUser(name, email) {
  throw new Error("Not implemented");
}
```

**The partial pattern:**
```javascript
app.get("/users", async (req, res) => {
  // This endpoint is complete — use it as a reference
  const { rows } = await pool.query("SELECT * FROM users");
  res.json(rows);
});

app.post("/users", async (req, res) => {
  // TODO: Implement this endpoint
  res.status(501).json({ error: "Not implemented" });
});
```

Prefer the TODO pattern for beginners, the stub pattern for intermediate, and the partial pattern when you want them to mirror existing code.

## Service Configuration

### Presets

The lab system has built-in presets for common services. Just use the name:

```yaml
services:
  - postgres
```

This spins up `postgres:16-alpine` on port 5432 with default credentials.

**Available presets:**

| Preset | Image | Port | Default credentials |
|--------|-------|------|-------------------|
| `postgres` | postgres:16-alpine | 5432 | user: postgres, pass: postgres |
| `redis` | redis:7-alpine | 6379 | (none) |
| `mysql` | mysql:8-oracle | 3306 | root: root, db: lab |
| `mongo` | mongo:7 | 27017 | (none) |
| `rabbitmq` | rabbitmq:3-management-alpine | 5672 | guest / guest |
| `kafka` | confluentinc/cp-kafka:7.6.0 | 9092 | (requires zookeeper) |
| `zookeeper` | confluentinc/cp-zookeeper:7.6.0 | 2181 | (none) |
| `localstack` | localstack/localstack:latest | 4566 | s3, sqs, sns, dynamodb, lambda |
| `minio` | minio/minio:latest | 9000 | minioadmin / minioadmin |

### Custom services

Override preset defaults or define entirely custom services:

```yaml
services:
  - name: postgres
    hostPort: 5433        # Override the host port
    env:
      POSTGRES_DB: myapp  # Additional environment variable

  - name: custom-api
    image: myorg/api:v2
    port: 8080
    healthcheck: "curl -f http://localhost:8080/health"
    env:
      API_KEY: "test-key"
```

### When to use services

- **Database labs**: postgres, mysql, mongo
- **Caching labs**: redis
- **Message queue labs**: rabbitmq, kafka + zookeeper
- **AWS-like labs**: localstack (S3, SQS, DynamoDB, etc.)
- **File storage labs**: minio

If the lab doesn't need external services (pure frontend, algorithm exercises), omit the `services` field entirely. No containers, faster startup.

## Setup Commands

Setup commands run sequentially after the scaffold is copied and services are healthy:

```yaml
setup:
  - npm install
  - node seed.js
  - npx prisma migrate deploy
```

### Order matters

Commands run in order. Later commands can depend on earlier ones:
1. Install dependencies first
2. Run migrations/schema setup
3. Seed data
4. Any other initialization

### Idempotency

Setup commands should be idempotent — running them twice shouldn't break things. This matters for `workspace: continue` labs where setup runs again but the database might already have data.

```javascript
// Good: CREATE TABLE IF NOT EXISTS
await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
  )
`);

// Bad: CREATE TABLE (fails if already exists)
await pool.query(`CREATE TABLE users (...)`);
```

## Start Commands

Optional long-running processes:

```yaml
start:
  - npm run dev
```

Start commands run after setup completes. They keep running in the background. Use for dev servers, file watchers, or any process the learner needs running.

## Open Files

```yaml
open:
  - src/index.js
  - src/db.js
```

Files listed here open in the editor when the lab starts. Open the files the learner needs to edit first, then reference files they might want to read.

### Opening strategy

- First file: the main file they'll edit
- Second file: a reference or helper they might need
- Don't open test files (they can find them, but editing tests isn't the point)
- Don't open config files (boring, not the teaching point)

## Instructions Design

### Structure

```markdown
# Short, active title

One sentence: what you're building.

## Tasks

- [ ] Concrete task 1 (verb first: "Create...", "Implement...", "Connect...")
- [ ] Concrete task 2
- [ ] Concrete task 3

## Hints

Helpful context. Not the answer.
```

### Task writing

Tasks should be:
- **Concrete**: "Implement the POST /users endpoint" not "Add user creation"
- **Ordered**: Task 2 builds on Task 1
- **Testable**: Each task maps to one or more test assertions
- **Verb-first**: "Create," "Implement," "Connect," "Add," "Fix"

### Hint writing

Hints help without solving. They point to files, mention useful APIs, or clarify requirements:

```markdown
## Hints

The database connection pool is exported from `src/db.js`. Use `pool.query()` with
parameterized queries: `$1`, `$2`, etc.

The seed script in `seed.js` expects the `users` table to exist before running.

Run `Run Tests` in the testing panel to check your progress.
```

Never put the full solution in hints. The learner should still have to think.

### Difficulty calibration

A lab should take 5-15 minutes. More than 15 minutes means too many tasks or tasks that are too complex. Less than 5 minutes means the lab is trivial.

Target: the learner struggles briefly, figures it out, and feels the satisfaction of passing tests. Not frustrated, not bored.

## Lab Lifecycle

Understanding the lifecycle helps you design labs that work reliably.

```
1. uninitialized  — lab selected, nothing started
2. provisioning   — scaffold copied, services starting, setup running
3. ready          — everything healthy, editor open, learner works
4. (learner runs tests) — test command executes, TAP output parsed
5. tearing-down   — services stopping, cleanup
```

Key implications:
- Services must be healthy BEFORE setup runs (setup may need the database)
- Setup commands run AFTER scaffold is copied (npm install needs package.json)
- Test command runs in the workspace directory (paths are relative to scaffold root)
- Workspace persists between test runs (the learner's edits are preserved)
