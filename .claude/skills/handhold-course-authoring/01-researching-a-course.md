# Researching a Course

Before writing a single line of narration, you need source material worth teaching. This guide covers how to find it, evaluate it, modernize it, and synthesize it into a coherent course.

## Finding Source Material

### University courses (best for foundational topics)

The gold standard for algorithms, data structures, systems, math, and theory. These have been refined over decades of classroom feedback.

**Where to look:**
- MIT OpenCourseWare: `[topic] site:ocw.mit.edu`
- Stanford Online / CS courses: `[topic] site:web.stanford.edu/class`
- Harvard CS50 and extensions: `[topic] site:cs50.harvard.edu`
- Berkeley webcast archive: `[topic] site:archive.org/details/ucberkeley`
- Carnegie Mellon: `[topic] site:cs.cmu.edu`
- Coursera / edX for structured versions of the above

**What to grab:**
- Lecture notes (usually the densest, most distilled version)
- Lecture videos (for pacing and explanation style — how do great lecturers build intuition?)
- Problem sets (for lab design — what exercises do they assign after teaching X?)
- Syllabi (for concept ordering — what prerequisites do they assume?)

**Search patterns:**
```
"dijkstra" lecture notes pdf site:edu
"hash tables" course slides site:ocw.mit.edu
"react patterns" conference talk
"composition vs inheritance" technical blog
```

### Conference talks (best for modern practices)

Practitioners explaining real-world decisions. Less theoretical, more "here's what we actually do and why."

**Top venues:**
- Strange Loop (systems, languages, paradigm-bending)
- GOTO Conference (pragmatic engineering)
- NDC (broad .NET/web/systems)
- Deconstruct (deep, philosophical)
- React Conf, Next.js Conf (React ecosystem)
- RustConf, GopherCon (language-specific)

**What to extract:**
- The "aha moment" — the one insight that makes the whole talk click
- Real-world examples (not toy examples)
- Before/after comparisons
- The speaker's explanation order (often battle-tested)

### Practitioner writing (best for patterns and opinions)

Blog posts, technical books, documentation. More opinionated than academic sources but often more practical.

**High-signal sources:**
- Official documentation (React docs, Rust book, Go spec)
- Engineering blogs (Vercel, Stripe, Cloudflare, Netflix)
- Books by practitioners (Ousterhout, Pike, Hickey talks-as-text)
- GitHub repos with exemplary code

**Low-signal sources (use cautiously):**
- Tutorial aggregator sites (often superficial, cargo-culted)
- Medium/Dev.to posts without original insight
- AI-generated summaries of other people's work
- Stack Overflow answers (good for facts, bad for narrative)

### Primary vs. secondary sources

Always prefer the original. If you're teaching Dijkstra's algorithm, read Dijkstra's paper. If you're teaching React composition patterns, read the React team's blog posts, not a tutorial summarizing them.

Secondary sources are useful for:
- Finding which primary sources matter
- Understanding how others have taught the same topic
- Identifying common misconceptions (which you can address in your course)

Secondary sources are dangerous when:
- They introduce errors or oversimplifications you don't catch
- They impose someone else's narrative structure on your content
- They cite each other in a circle with no primary source anchor

## Evaluating Material

### The four-question test

For each source, ask:

**1. Currency — Is this still how practitioners do it?**
- React class components → hooks (outdated)
- jQuery DOM manipulation → modern framework reactivity (outdated)
- Dijkstra's algorithm → still Dijkstra's algorithm (timeless)
- REST API design → still valid, but GraphQL exists (partially outdated)

If the core mechanism is timeless but the syntax is dated, the source is still valuable — you'll modernize the examples.

**2. Depth — Does it explain WHY, not just HOW?**
- "Use `useEffect` for side effects" → shallow (HOW)
- "useEffect synchronizes React state with external systems. Fetch calls are not synchronization — they're async operations with their own lifecycle." → deep (WHY)

Shallow sources make bad courses. You can't narrate insight from a source that has none.

**3. Authority — Is the author a practitioner or a summarizer?**
- Dan Abramov writing about React internals → practitioner
- Random blog post paraphrasing Dan Abramov → summarizer
- Edsger Dijkstra writing about shortest paths → literally the inventor

Practitioner sources have earned opinions. Summarizer sources have borrowed ones.

**4. Audience fit — Right level for your learners?**
- Too academic: assumes mathematical maturity your audience doesn't have
- Too shallow: covers only the happy path, skips edge cases and trade-offs
- Right: builds from first principles but stays grounded in practical application

## Modernizing Older Courses

Some of the best pedagogical structures come from courses that are 10-20 years old. The teaching is excellent; the examples are dated.

### What to keep
- **The concept order** — if MIT teaches hash tables by starting with linear search, then showing the O(n) problem, then introducing hashing as the solution, that's a proven order. Keep it.
- **The motivating examples** — "you have a million names and need to find one" works regardless of the programming language.
- **The progressive disclosure structure** — if the course reveals concepts in a careful sequence, preserve that sequence.

### What to update
- **Syntax and libraries** — Python 2 → Python 3, jQuery → vanilla JS, callbacks → async/await
- **Tooling references** — replace mentions of specific IDEs, build systems, or frameworks with current equivalents
- **Cultural references** — "imagine your Rolodex" → something your audience actually uses

### What to add
- **Modern context** — "This algorithm runs every time you open Google Maps"
- **Current best practices** — immutability, type safety, composition patterns
- **Interactive elements** — old courses were slides or blackboard. You have live previews, animated data structures, interactive code.

### The integration rule

Never reference your sources directly in narration. The course should flow as one coherent narrative, not a patchwork of citations.

Bad: "As Dijkstra showed in his 1959 paper..."
Good: "The shortest path from A to F costs 9. Here's how we find it."

The learner doesn't care where you learned it. They care about understanding it.

## Synthesis

### Build a concept dependency graph

Before writing, map out which concepts depend on which:

```
components → props → state → derived state → events
                              ↓
                         composition → context → compound components
                              ↓
              styling → responsive → design tokens
                              ↓
                    data fetching → caching → loading states
                              ↓
              design engineering → animation → accessibility
                              ↓
                         capstone (all of the above)
```

This graph determines your step order. You can't teach composition before props. You can teach styling independently of state.

### Extract "aha moments"

From each source, identify the one insight that makes the audience go "oh." These become the emotional peaks of your course.

Examples:
- "Every hash map starts with a function that turns keys into numbers." (Dijkstra course)
- "Six booleans. Two to the sixth power. Sixty-four possible states." (React course)
- "The greedy approach fails." (Dijkstra course)

Each step should have exactly one aha moment. If a step has zero, it's boring. If it has three, split it.

### Cross-reference for accuracy

When multiple sources agree on a concept, you can teach it confidently. When they disagree, investigate:
- Is one source outdated?
- Is this a genuine trade-off with no single answer?
- Is the disagreement about mechanism (facts) or approach (opinion)?

For trade-offs, present both sides. For facts, go with the primary source.

### The concept triple

Every concept you teach must have three things:
1. **A motivating problem** — why the learner should care
2. **A mechanism** — how it works
3. **An application** — a concrete example of it in use

If you can't fill all three, the concept isn't ready to teach. Find better sources or rethink the scope.
