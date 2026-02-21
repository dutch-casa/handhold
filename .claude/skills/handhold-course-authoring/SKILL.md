---
name: handhold-course-authoring
description: >
  Complete guide for researching, writing, and polishing Handhold courses.
  Covers the full authoring DSL (triggers, visualization blocks, regions, animations),
  narration craft for TTS, animation choreography, presentation design, course
  architecture, and material research. Use when creating courses, writing lessons,
  debugging presentation issues, or reviewing course content. Triggers on: handhold,
  course, lesson, authoring, presentation, narration, animation, choreography,
  triggers, DSL, visualization, TTS, teaching, lecture, step, scene, focus, zoom,
  annotate, split, typewriter, preview, code block, data structure, diagram,
  tree, binary tree, BST, AVL, red-black, heap, splay, treap, segment tree,
  interval tree, fenwick, merkle, k-d tree, rope, stack, queue, deque,
  ring buffer, linked list, doubly linked list, skip list, hash map, hash set,
  bloom filter, cuckoo filter, count-min sketch, hyperloglog, b-tree, b-plus tree,
  trie, radix tree, suffix tree, bit array, matrix, adjacency matrix, sparse table,
  graph, DAG, union-find, disjoint set, LSM tree, fibonacci heap, LRU cache,
  transform, flow, pulse, trace, draw, pan, seq block, algorithm animation.
---

# Handhold Course Authoring

Write narrated, animated technical courses. This skill covers everything from finding source material to publishing a polished course. Each sub-file goes deep on one topic.

## Quick Reference

| Task | File |
|------|------|
| Find and evaluate source material | [01-researching-a-course.md](01-researching-a-course.md) |
| Design course structure and arc | [02-course-architecture.md](02-course-architecture.md) |
| DSL syntax: triggers, blocks, regions | [03-the-dsl.md](03-the-dsl.md) |
| Write narration that sounds great spoken aloud | [04-narration-craft.md](04-narration-craft.md) |
| Choreograph animations for maximum impact | [05-animation-choreography.md](05-animation-choreography.md) |
| Design visual layouts and scene flow | [06-presentation-design.md](06-presentation-design.md) |
| Validate, QA, and avoid common mistakes | [07-verification.md](07-verification.md) |
| Design and scaffold hands-on labs | [08-writing-labs.md](08-writing-labs.md) |
| Write TAP tests for lab validation | [09-testing-courses.md](09-testing-courses.md) |
| See annotated examples from real courses | [examples/](examples/) |

## Core Principles

1. **The Mirror Principle.** What is spoken is what is shown. Always. The screen reflects the narration at word-level granularity. If you mention "the loop," the loop is already focused. No exceptions.

2. **Problem First.** Every lesson opens with a problem the learner can feel. Not a definition. A situation where the gap in knowledge creates tension.

3. **One Change Per Beat.** Each trigger changes one thing on screen. Each paragraph advances one idea. Compound changes are multiple triggers, not one overloaded trigger.

4. **Dense Choreography.** Every sentence has at least one trigger. Many have two or three. The screen is never static while narration plays. A paragraph with no triggers is a bug.

5. **Lesson-Lab Rhythm.** Courses alternate: bite-sized lesson, small reinforcing lab, lesson, lab. Labs build on each other toward a capstone.

## Workflow

```
1. Research       → Find 3-5 sources, extract "aha moments", build concept graph
2. Architecture   → Plan lesson-lab rhythm, step names, arc pattern
3. Block Planning → List every visualization block per step, name them, define regions
4. Storyboard     → Sketch the scene sequence before writing a word
5. Narration      → Write for TTS, place triggers at exact word positions
6. Polish         → Read aloud, verify mirror principle, check density
7. Verify         → Parse validation, QA checklist, common mistakes scan
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Paragraph with no triggers | Add focus, annotate, or zoom. Every sentence needs a visual beat. |
| Long code block (15+ lines), no zoom | Zoom is mandatory. Pattern: 1x overview, 1.2x on focus, 1x reset, repeat. |
| Talking about something not on screen | Show it first, or move the narration to after the show trigger. |
| Annotation text is a full sentence | Keep to 2-5 words. Intent labels: "The invariant", "Greedy choice". |
| Region named `line-3` | Use semantic names: `loop-body`, `return-val`, `hash-step`. |
| Split with 3+ panels | Max 2. Left=code, Right=visual. |
| Typewriter on a re-shown block | Typewriter is for first reveals only. Use slide or fade for re-shows. |
| `clear` in the middle of a section | Use show/hide/focus within sections. Clear is for hard scene breaks. |
| Preview uses @media queries | Prefer @container queries. Preview iframe width varies with layout. |
| Dead narration (no visual change for 10+ seconds) | Break up with focus shifts, zoom, or annotations. |

## File Index

- [01-researching-a-course.md](01-researching-a-course.md) - Finding, evaluating, and synthesizing source material
- [02-course-architecture.md](02-course-architecture.md) - Lesson-lab rhythm, arc patterns, step and block planning
- [03-the-dsl.md](03-the-dsl.md) - Complete trigger, block, region, and animation reference
- [04-narration-craft.md](04-narration-craft.md) - Voice, rhythm, TTS word choice, the mirror principle
- [05-animation-choreography.md](05-animation-choreography.md) - Density rules, timing tables, choreography patterns
- [06-presentation-design.md](06-presentation-design.md) - Layouts, code sizing, previews, diagrams, scene flow
- [07-verification.md](07-verification.md) - QA checklist, parser validation, common mistakes
- [08-writing-labs.md](08-writing-labs.md) - Lab design, scaffolding, services, setup, instructions
- [09-testing-courses.md](09-testing-courses.md) - TAP protocol, test harness, assertion design
- [examples/dijkstra-excerpt.md](examples/dijkstra-excerpt.md) - Annotated excerpt from the Dijkstra course
- [examples/react-excerpt.md](examples/react-excerpt.md) - Annotated excerpt from the Modern React course
