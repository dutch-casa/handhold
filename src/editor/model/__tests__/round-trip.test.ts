import { describe, test, expect } from "bun:test";
import { parseLesson } from "@/parser/parse-lesson";
import { deserializeLesson } from "@/editor/model/deserialize";
import { serializeLesson, serializeLab, serializeCourse } from "@/editor/model/serialize";
import type { EditableLab, EditableCourse } from "@/editor/model/types";

// Round-trip: markdown → parseLesson → deserializeLesson → serializeLesson → markdown
// The serialized output should re-parse to an equivalent IR.

function roundTrip(markdown: string): string {
  const parsed = parseLesson(markdown);
  const steps = deserializeLesson(parsed);
  return serializeLesson(parsed.title, steps);
}

function parseRoundTripped(markdown: string) {
  const serialized = roundTrip(markdown);
  return parseLesson(serialized);
}

describe("round-trip: simple lesson", () => {
  const markdown = `---
title: Hash Tables
---

# How Hashing Works

{{show: hash-fn}} The hash function maps keys to bucket indices.

\`\`\`code:hash-fn lang=ts
function hash(key: string): number {
  return key.length % 8;
}
---
body: 1-3
\`\`\`
`;

  test("title survives round-trip", () => {
    const result = parseRoundTripped(markdown);
    expect(result.title).toBe("Hash Tables");
  });

  test("step title survives round-trip", () => {
    const result = parseRoundTripped(markdown);
    expect(result.steps.length).toBe(1);
    expect(result.steps[0]!.title).toBe("How Hashing Works");
  });

  test("narration text survives round-trip", () => {
    const result = parseRoundTripped(markdown);
    const narration = result.steps[0]!.narration[0]!;
    expect(narration.text).toBe("The hash function maps keys to bucket indices.");
  });

  test("trigger is preserved", () => {
    const result = parseRoundTripped(markdown);
    const triggers = result.steps[0]!.narration[0]!.triggers;
    const showTrigger = triggers.find((t) => t.action.verb === "show");
    expect(showTrigger).toBeDefined();
    if (showTrigger && showTrigger.action.verb === "show") {
      expect(showTrigger.action.target).toBe("hash-fn");
    }
  });

  test("code block content preserved", () => {
    const result = parseRoundTripped(markdown);
    const block = result.steps[0]!.blocks.get("hash-fn");
    expect(block).toBeDefined();
    if (block && block.kind === "code") {
      expect(block.lang).toBe("ts");
      expect(block.content).toContain("function hash");
    }
  });

  test("regions preserved", () => {
    const result = parseRoundTripped(markdown);
    const block = result.steps[0]!.blocks.get("hash-fn");
    expect(block).toBeDefined();
    if (block) {
      expect(block.regions.length).toBe(1);
      expect(block.regions[0]!.name).toBe("body");
      expect(block.regions[0]!.target).toBe("1-3");
    }
  });
});

describe("round-trip: multiple steps", () => {
  const markdown = `---
title: Sorting
---

# Bubble Sort

{{show: bubble-code}} Bubble sort repeatedly swaps adjacent elements.

\`\`\`code:bubble-code lang=ts
function bubbleSort(arr: number[]): void {
  // swap adjacent
}
\`\`\`

# Quick Sort

{{show: quick-code}} Quick sort uses a pivot to partition.

\`\`\`code:quick-code lang=ts
function quickSort(arr: number[]): void {
  // partition
}
\`\`\`
`;

  test("both steps survive", () => {
    const result = parseRoundTripped(markdown);
    expect(result.steps.length).toBe(2);
    expect(result.steps[0]!.title).toBe("Bubble Sort");
    expect(result.steps[1]!.title).toBe("Quick Sort");
  });

  test("each step has its own block", () => {
    const result = parseRoundTripped(markdown);
    expect(result.steps[0]!.blocks.has("bubble-code")).toBe(true);
    expect(result.steps[1]!.blocks.has("quick-code")).toBe(true);
  });
});

describe("round-trip: data block (array)", () => {
  const markdown = `---
title: Arrays
---

# Array Basics

{{show: buckets}} Here is our array with pointers.

\`\`\`data:buckets type=array
["a", "b", "c", "d"]
^i=0 ^j=3
---
first-half: 0-1
\`\`\`
`;

  test("array data survives round-trip", () => {
    const result = parseRoundTripped(markdown);
    const block = result.steps[0]!.blocks.get("buckets");
    expect(block).toBeDefined();
    if (block && block.kind === "data") {
      expect(block.data.type).toBe("array");
      if (block.data.type === "array") {
        expect(block.data.values.length).toBe(4);
        expect(block.data.pointers.length).toBe(2);
      }
    }
  });

  test("array regions survive", () => {
    const result = parseRoundTripped(markdown);
    const block = result.steps[0]!.blocks.get("buckets");
    if (block) {
      expect(block.regions.length).toBe(1);
      expect(block.regions[0]!.name).toBe("first-half");
    }
  });
});

describe("round-trip: diagram block", () => {
  const markdown = `---
title: System Design
---

# Architecture

{{show: system}} The system has a client, API, and database.

\`\`\`diagram:system
client [client]
api [service]
db [database]
client --> api
api --queries--> db
{Backend: api, db}
---
read-path: client->api->db
\`\`\`
`;

  test("diagram nodes survive", () => {
    const result = parseRoundTripped(markdown);
    const block = result.steps[0]!.blocks.get("system");
    expect(block).toBeDefined();
    if (block && block.kind === "diagram") {
      expect(block.nodes.length).toBe(3);
      const nodeIds = block.nodes.map((n) => n.id);
      expect(nodeIds).toContain("client");
      expect(nodeIds).toContain("api");
      expect(nodeIds).toContain("db");
    }
  });

  test("diagram edges survive", () => {
    const result = parseRoundTripped(markdown);
    const block = result.steps[0]!.blocks.get("system");
    if (block && block.kind === "diagram") {
      expect(block.edges.length).toBe(2);
      const labeledEdge = block.edges.find((e) => e.label.length > 0);
      expect(labeledEdge).toBeDefined();
      if (labeledEdge) {
        expect(labeledEdge.label).toBe("queries");
      }
    }
  });

  test("diagram groups survive", () => {
    const result = parseRoundTripped(markdown);
    const block = result.steps[0]!.blocks.get("system");
    if (block && block.kind === "diagram") {
      expect(block.groups.length).toBe(1);
      expect(block.groups[0]!.name).toBe("Backend");
      expect(block.groups[0]!.memberIds).toContain("api");
      expect(block.groups[0]!.memberIds).toContain("db");
    }
  });
});

describe("round-trip: split layout triggers", () => {
  const markdown = `---
title: Compare
---

# Side by Side

{{show: left}} {{split}} {{show: right}} Compare left and right implementations.

\`\`\`code:left lang=ts
const a = 1;
\`\`\`

\`\`\`code:right lang=ts
const b = 2;
\`\`\`
`;

  test("split trigger survives", () => {
    const result = parseRoundTripped(markdown);
    const triggers = result.steps[0]!.narration[0]!.triggers;
    const splitTrigger = triggers.find((t) => t.action.verb === "split");
    expect(splitTrigger).toBeDefined();
  });

  test("both blocks survive", () => {
    const result = parseRoundTripped(markdown);
    expect(result.steps[0]!.blocks.has("left")).toBe(true);
    expect(result.steps[0]!.blocks.has("right")).toBe(true);
  });
});

describe("round-trip: trigger verbs", () => {
  const markdown = `---
title: Triggers
---

# All Triggers

{{show: block-a slide 0.5s ease-out}} {{hide: block-a}} {{clear: slide}} {{focus: region-a}} {{annotate: region-a "Hello world"}} {{zoom: block-a 1.5x}} {{pulse: region-a}} {{unsplit}} Text here.

\`\`\`code:block-a lang=ts
const x = 1;
---
region-a: 1
\`\`\`
`;

  test("show with animation survives", () => {
    const result = parseRoundTripped(markdown);
    const triggers = result.steps[0]!.narration[0]!.triggers;
    const show = triggers.find((t) => t.action.verb === "show");
    expect(show).toBeDefined();
    if (show && show.action.verb === "show") {
      expect(show.action.target).toBe("block-a");
      expect(show.action.animation.kind).toBe("custom");
    }
  });

  test("hide survives", () => {
    const result = parseRoundTripped(markdown);
    const triggers = result.steps[0]!.narration[0]!.triggers;
    const hide = triggers.find((t) => t.action.verb === "hide");
    expect(hide).toBeDefined();
  });

  test("clear with transition survives", () => {
    const result = parseRoundTripped(markdown);
    const triggers = result.steps[0]!.narration[0]!.triggers;
    const clear = triggers.find((t) => t.action.verb === "clear");
    expect(clear).toBeDefined();
    if (clear && clear.action.verb === "clear") {
      expect(clear.action.transition).toBe("slide");
    }
  });

  test("focus survives", () => {
    const result = parseRoundTripped(markdown);
    const triggers = result.steps[0]!.narration[0]!.triggers;
    const focus = triggers.find((t) => t.action.verb === "focus");
    expect(focus).toBeDefined();
    if (focus && focus.action.verb === "focus") {
      expect(focus.action.target).toBe("region-a");
    }
  });

  test("annotate survives", () => {
    const result = parseRoundTripped(markdown);
    const triggers = result.steps[0]!.narration[0]!.triggers;
    const annotate = triggers.find((t) => t.action.verb === "annotate");
    expect(annotate).toBeDefined();
    if (annotate && annotate.action.verb === "annotate") {
      expect(annotate.action.target).toBe("region-a");
      expect(annotate.action.text).toBe("Hello world");
    }
  });

  test("zoom survives", () => {
    const result = parseRoundTripped(markdown);
    const triggers = result.steps[0]!.narration[0]!.triggers;
    const zoom = triggers.find((t) => t.action.verb === "zoom");
    expect(zoom).toBeDefined();
    if (zoom && zoom.action.verb === "zoom") {
      expect(zoom.action.target).toBe("block-a");
      expect(zoom.action.scale).toBe(1.5);
    }
  });

  test("unsplit survives", () => {
    const result = parseRoundTripped(markdown);
    const triggers = result.steps[0]!.narration[0]!.triggers;
    const unsplit = triggers.find((t) => t.action.verb === "unsplit");
    expect(unsplit).toBeDefined();
  });
});

describe("round-trip: code block with annotations", () => {
  const markdown = `---
title: Annotations
---

# Annotated Code

{{show: annotated}} Check out the annotations.

\`\`\`code:annotated lang=ts
function add(a: number, b: number): number { // ! Takes two numbers
  return a + b; // ! Returns the sum
}
\`\`\`
`;

  test("annotations survive round-trip", () => {
    const result = parseRoundTripped(markdown);
    const block = result.steps[0]!.blocks.get("annotated");
    expect(block).toBeDefined();
    if (block && block.kind === "code") {
      expect(block.annotations.length).toBe(2);
      expect(block.annotations[0]!.text).toBe("Takes two numbers");
      expect(block.annotations[1]!.text).toBe("Returns the sum");
    }
  });
});

describe("round-trip: math block", () => {
  const markdown = `---
title: Math
---

# Quadratic Formula

{{show: quad}} The quadratic formula.

\`\`\`math:quad
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}

\\Delta = b^2 - 4ac
---
formula: expr-0
\`\`\`
`;

  test("math expressions survive", () => {
    const result = parseRoundTripped(markdown);
    const block = result.steps[0]!.blocks.get("quad");
    expect(block).toBeDefined();
    if (block && block.kind === "math") {
      expect(block.expressions.length).toBe(2);
      expect(block.expressions[0]!.latex).toContain("frac");
      expect(block.expressions[1]!.latex).toContain("Delta");
    }
  });
});

describe("round-trip: chart block", () => {
  const markdown = `---
title: Charts
---

# Quarterly Revenue

{{show: revenue}} Revenue by quarter.

\`\`\`chart:revenue type=bar
Q1: 100
Q2: 150
Q3: 200
Q4: 250
---
growth: Q1-Q4
\`\`\`
`;

  test("chart data survives", () => {
    const result = parseRoundTripped(markdown);
    const block = result.steps[0]!.blocks.get("revenue");
    expect(block).toBeDefined();
    if (block && block.kind === "chart") {
      expect(block.chartKind).toBe("bar");
      expect(block.series.length).toBe(1);
      expect(block.series[0]!.data.length).toBe(4);
    }
  });
});

describe("round-trip: preview block", () => {
  const markdown = `---
title: Preview
---

# Button Component

{{show: btn}} Here is a button.

\`\`\`preview:btn template=react
export default function Button() {
  return <button>Click me</button>;
}
\`\`\`
`;

  test("preview source and template survive", () => {
    const result = parseRoundTripped(markdown);
    const block = result.steps[0]!.blocks.get("btn");
    expect(block).toBeDefined();
    if (block && block.kind === "preview") {
      expect(block.template).toBe("react");
      expect(block.source).toContain("Click me");
    }
  });
});

describe("round-trip: graph data block", () => {
  const markdown = `---
title: Graphs
---

# Graph Example

{{show: net}} A directed graph.

\`\`\`data:net type=graph layout=force
A -> B: 5
A -> C
B -> C: 3
---
path: A->B->C
\`\`\`
`;

  test("graph edges survive with weights", () => {
    const result = parseRoundTripped(markdown);
    const block = result.steps[0]!.blocks.get("net");
    expect(block).toBeDefined();
    if (block && block.kind === "data" && block.data.type === "graph") {
      expect(block.data.edges.length).toBe(3);
      const weighted = block.data.edges.find((e) => e.weight === "5");
      expect(weighted).toBeDefined();
      expect(block.data.layout).toBe("force");
    }
  });
});

describe("serializeLab", () => {
  test("lab yaml and instructions are produced", () => {
    const lab: EditableLab = {
      title: "Build a REST API",
      instructions: "# Step 1\n\nCreate the server.",
      workspace: "fresh",
      testCommand: "bun test",
      openFiles: ["src/server.ts", "src/routes.ts"],
      services: [
        {
          name: "postgres",
          image: "postgres:16",
          port: 5432,
          hostPort: 5432,
          env: { POSTGRES_PASSWORD: "secret" },
          healthcheck: "pg_isready",
        },
      ],
      setup: ["bun install"],
      start: ["bun run dev"],
      scaffoldPath: "files/",
    };

    const result = serializeLab(lab);

    expect(result.yaml).toContain("workspace: fresh");
    expect(result.yaml).toContain("test: bun test");
    expect(result.yaml).toContain("postgres");
    expect(result.yaml).toContain("image: postgres:16");
    expect(result.yaml).toContain("POSTGRES_PASSWORD: secret");
    expect(result.yaml).toContain("setup:");
    expect(result.yaml).toContain("  - bun install");
    expect(result.yaml).toContain("open:");
    expect(result.yaml).toContain("  - src/server.ts");
    expect(result.yaml).toContain("start:");
    expect(result.yaml).toContain("  - bun run dev");
    expect(result.instructions).toBe("# Step 1\n\nCreate the server.");
  });
});

describe("serializeCourse", () => {
  test("course manifest is produced", () => {
    const course: EditableCourse = {
      title: "Full Stack Development",
      steps: [
        {
          kind: "lesson",
          id: "lesson-0",
          title: "HTTP Basics",
          steps: [],
        },
        {
          kind: "lab",
          id: "lab-0",
          title: "Build a Server",
          lab: {
            title: "Build a Server",
            instructions: "",
            workspace: "fresh",
            testCommand: "",
            openFiles: [],
            services: [],
            setup: [],
            start: [],
            scaffoldPath: "",
          },
        },
      ],
    };

    const result = serializeCourse(course);
    expect(result).toContain("title: Full Stack Development");
    expect(result).toContain("kind: lesson");
    expect(result).toContain("kind: lab");
    expect(result).toContain("HTTP Basics");
    expect(result).toContain("Build a Server");
  });
});

describe("round-trip: linked-list data block", () => {
  const markdown = `---
title: Linked Lists
---

# Linked List

{{show: chain}} A linked list.

\`\`\`data:chain type=linked-list
(a 10) -> (b 20) -> (c 30) -> null
\`\`\`
`;

  test("linked list nodes survive", () => {
    const result = parseRoundTripped(markdown);
    const block = result.steps[0]!.blocks.get("chain");
    expect(block).toBeDefined();
    if (block && block.kind === "data" && block.data.type === "linked-list") {
      expect(block.data.nodes.length).toBe(3);
      expect(block.data.hasNull).toBe(true);
      expect(block.data.edges.length).toBe(2);
    }
  });
});

describe("round-trip: stack data block", () => {
  const markdown = `---
title: Stacks
---

# Call Stack

{{show: stack}} A stack.

\`\`\`data:stack type=stack
[main, foo, bar, baz]
\`\`\`
`;

  test("stack values survive", () => {
    const result = parseRoundTripped(markdown);
    const block = result.steps[0]!.blocks.get("stack");
    expect(block).toBeDefined();
    if (block && block.kind === "data" && block.data.type === "stack") {
      expect(block.data.values.length).toBe(4);
      expect(block.data.values[0]).toBe("main");
    }
  });
});

describe("round-trip: hash-map data block", () => {
  const markdown = `---
title: Hash Maps
---

# Hash Map

{{show: hm}} A hash map with chains.

\`\`\`data:hm type=hash-map
0: (alice 555-1234) -> (bob 555-5678)
1: (carol 555-9012)
\`\`\`
`;

  test("hash map buckets survive", () => {
    const result = parseRoundTripped(markdown);
    const block = result.steps[0]!.blocks.get("hm");
    expect(block).toBeDefined();
    if (block && block.kind === "data" && block.data.type === "hash-map") {
      expect(block.data.buckets.length).toBe(2);
      expect(block.data.buckets[0]!.chain.length).toBe(2);
      expect(block.data.buckets[1]!.chain.length).toBe(1);
    }
  });
});
