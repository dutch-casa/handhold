# Course Architecture

How to structure a course from the top level (lesson-lab rhythm) down to individual steps and blocks.

## The Lesson-Lab Rhythm

Courses alternate between teaching and doing. Every lesson is followed by a lab that makes the learner apply what they just learned.

```
lesson (concept A)  → lab (apply A)
lesson (concept B)  → lab (apply A + B)
lesson (concept C)  → lab (apply A + B + C, or standalone)
lesson (concept D)  → lab (capstone: everything together)
```

### Rules

- **Labs reinforce, they don't assess.** The learner should feel capable after a lab, not tested. The lab exists to build muscle memory, not to create anxiety.
- **Labs are shorter than the lesson they follow.** If the lab takes longer than the lesson, break it into smaller pieces.
- **Progressive labs build on each other.** Lab 2 should extend what Lab 1 built. By the final lab, the learner has constructed something real from accumulated pieces.
- **Orthogonal concepts get standalone labs.** If concept C doesn't depend on A or B (e.g., accessibility is orthogonal to state management), the lab can be self-contained.

### Manifest structure

Courses live in `~/.handhold/courses/<course-name>/`:

```yaml
# handhold.yaml
title: "Course Title: Subtitle"
description: "One sentence describing what the learner will build or understand"
tags:
  - topic1
  - topic2
steps:
  - kind: lesson
    title: "Lesson 1: The Component Model"
    path: steps/01-components/
  - kind: lab
    title: "Lab 1: Build a Button"
    path: steps/02-button-lab/
  - kind: lesson
    title: "Lesson 2: State and Interactivity"
    path: steps/03-state/
  - kind: lab
    title: "Lab 2: Interactive Counter"
    path: steps/04-counter-lab/
```

Each step path points to a directory of sorted `.md` files that are auto-concatenated:

```
steps/01-components/
├── 00-meta.md          # Frontmatter (title)
├── 01-the-problem.md   # First H1 section
├── 02-functions.md     # Second H1 section
└── 03-props.md         # Third H1 section
```

## Arc Design Patterns

Every course has a macro-level arc. Pick one.

### The Sandwich

**Problem → Mechanism → Application.**

Open with a concrete problem the audience can feel. Explain the mechanism that solves it. Apply the mechanism to the original problem and show it working.

Best for: Algorithms, data structures, design patterns. Any topic where "why does this exist?" has a clear answer.

Example (Dijkstra course):
1. The problem: finding shortest paths in a weighted graph
2. Why brute force fails
3. How the graph is stored
4. The algorithm
5. Walking through it step by step
6. The priority queue optimization
7. Real-world applications

### The Build-Up

**Simple → Complex, one layer at a time.**

Start with the simplest possible version. Add one layer of complexity per step. By the end, the learner has built the full concept incrementally.

Best for: Frameworks, languages, UI development. Topics where the final result is complex but each individual piece is simple.

Example (React course):
1. Components (functions that return UI)
2. State (making components interactive)
3. Composition (combining components)
4. Styling (making them look good)
5. Data fetching (connecting to servers)
6. Polish (design engineering)
7. Capstone (all of the above in one component)

### The Comparison

**Naive → Better, contrast drives understanding.**

Show the naive approach first. Establish its limitations concretely. Then show the better approach and let the contrast do the teaching.

Best for: Best practices, optimization, refactoring. Topics where "why not just do X?" is the natural first question.

### The Reveal

**Show the result → Derive why it works.**

Present something surprising or counterintuitive. Create mystery. Then work backward to explain the mechanism.

Best for: Math, cryptography, distributed systems. Topics with non-obvious emergent behavior.

## Step Planning

### How many steps?

**5-9 steps per lesson.** This is a cognitive load limit. Fewer than 5 means your steps are too dense. More than 9 means you're trying to cover too much — split into two lessons.

### Each step has one job

A step teaches exactly one core idea. It has:
- One primary visualization (the thing you're building or explaining)
- One aha moment (the insight that makes it click)
- A clear name that reads as part of a narrative

Good step names read as a story:
```
1. The problem
2. Why brute force fails
3. How the graph is stored
4. The algorithm
5. Walking through it
6. Making it faster
7. Where it's used
```

Bad step names are categories:
```
1. Introduction
2. Data structures
3. Implementation
4. Optimization
5. Conclusion
```

### Plan steps before writing

Write the step list first. Each step gets:
- A one-sentence summary of the core idea
- The primary visualization type (code, data, diagram, preview, split)
- The aha moment in one sentence

If you can't articulate the aha moment, the step isn't ready.

## Block Planning

### List blocks before writing narration

For each step, enumerate every visualization block you'll need:

```
Step: "The algorithm"
Blocks:
  - code:dijkstra lang=ts (39 lines, the full function)
  - Regions: init, clamp, pick, mark, relax, check, update, repeat
  - Inline annotations: "Greedy choice" on line 8, "Relaxation" on line 16
```

### Naming rules

- Semantic names that describe content: `hash-fn`, `city-map`, `notif-panel`
- Never use auto-generated names (`code-0`, `data-1`) in triggers
- Names should make sense when you read `{{show: hash-fn}}` without context
- Lowercase, hyphenated: `bad-button`, `effect-fetch`, `bool-explosion`

### Region planning

Regions map to the concepts in your narration. Define them AFTER you know what you'll explain, but BEFORE you write the narration.

The process:
1. Write the code block
2. Identify which lines you'll discuss
3. Group lines into semantic regions
4. Name each region after the concept it represents

Good regions:
```
signature: 1
init: 2-5
loop: 6-12
return-val: 14
```

Bad regions:
```
top: 1-3
middle: 4-8
bottom: 9-14
```

### Code block sizing

| Purpose | Target size | Notes |
|---------|-------------|-------|
| Problem example (mess) | 30-80 lines | Show scale of the problem |
| Solution code | 5-25 lines | Focused on the teaching point |
| Walkthrough trace | 6-10 lines | Short, step-by-step |
| Type definitions | 5-15 lines | Compact, scannable |
| Full implementation | 20-40 lines | Needs zoom choreography |

**The 15-line rule:** Any code block over 15 lines REQUIRES zoom choreography. At normal scale, the bottom of a 20+ line block may be below the viewport. Zoom in on focused regions so the learner can read the code.

### Preview block planning

Previews show what code produces. Plan them alongside code blocks:

```
Step: "Styling with Tailwind"
Blocks:
  - code:tailwind-button lang=tsx (13 lines)
  - preview:tw-button (HTML: styled button rendering)
  Layout: split (code left, preview right)
```

For interactive previews (React template):
- Plan the state and interactions
- Keep the preview code simple (no build tools, no imports)
- Use `React.createElement` or compiled JSX via SWC
- Prefer container queries over media queries for responsive behavior

## Concept Dependency Graph

Before finalizing step order, map dependencies:

```
A depends on nothing        → teach first
B depends on A              → teach after A
C depends on A and B        → teach after B
D depends on nothing        → can go anywhere (orthogonal)
E depends on A, B, C, D     → capstone, teach last
```

Steps that depend on nothing can be reordered freely. Steps with dependencies must follow their prerequisites. The capstone always goes last.

## Transitions Between Steps

Each step should end with a forward hook and begin with a backward connection:

**End of step 3:** "We know how the graph is stored. Now let's see the algorithm that traverses it."

**Start of step 4:** "Here's Dijkstra's algorithm in code."

The `{{clear: slide}}` trigger creates the visual break. The narration creates the narrative bridge.
