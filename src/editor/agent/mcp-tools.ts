// MCP tool definitions for course authoring.
// One array, one lookup map. The agent calls these to manipulate course structure.

type JsonSchemaType = "string" | "number" | "boolean" | "object" | "array";

export type ToolParameter = {
  readonly name: string;
  readonly type: JsonSchemaType;
  readonly description: string;
  readonly required: boolean;
};

export type ToolDefinition = {
  readonly name: string;
  readonly description: string;
  readonly parameters: readonly ToolParameter[];
};

// Helper to cut repetition without shallow wrappers
function param(
  name: string,
  type: JsonSchemaType,
  description: string,
  required = true,
): ToolParameter {
  return { name, type, description, required };
}

const stepId = (desc = "Target step ID") => param("stepId", "string", desc);
const lessonTitle = () => param("title", "string", "Lesson title");
const blockName = (desc = "Block name") => param("blockName", "string", desc);

// --- Tool catalog ---

export const COURSE_TOOLS: readonly ToolDefinition[] = [
  // ---- Structural ----
  {
    name: "course.addLesson",
    description:
      "Add a new lesson to the course. Lessons are presentation-style content with narration, code, data structures, and diagrams.",
    parameters: [
      lessonTitle(),
      param("afterStepIndex", "number", "Insert after this index (-1 for end)", false),
    ],
  },
  {
    name: "course.addLab",
    description:
      "Add a new lab to the course. Labs are hands-on coding exercises with test-driven validation.",
    parameters: [
      param("title", "string", "Lab title"),
      param("afterStepIndex", "number", "Insert after this index (-1 for end)", false),
    ],
  },
  {
    name: "course.addStep",
    description:
      "Add a step (H1 section) to a lesson. Each step is a self-contained scene sequence with its own narration and visualization blocks.",
    parameters: [
      param("lessonIndex", "number", "Index of the lesson in the course"),
      param("title", "string", "Step title (becomes the H1 heading)"),
      param("afterStepIndex", "number", "Insert after this step index within the lesson (-1 for end)", false),
    ],
  },

  // ---- Content ----
  {
    name: "step.setNarration",
    description:
      "Set narration text for a paragraph within a step. The narration is what gets spoken aloud via TTS and drives the scene timeline.",
    parameters: [
      stepId(),
      param("paragraphIndex", "number", "Paragraph index (0-based)"),
      param("text", "string", "Narration text content"),
    ],
  },
  {
    name: "step.addBlock",
    description:
      "Add a visualization block (code, data structure, diagram, math, chart, or preview) to a step. Blocks are the visual slots that appear alongside narration.",
    parameters: [
      stepId(),
      param("name", "string", "Unique block name within the step"),
      param(
        "kind",
        "string",
        "Block kind: code | data | diagram | math | chart | preview",
      ),
      param("content", "object", "Block content matching the kind's schema"),
    ],
  },
  {
    name: "step.addTrigger",
    description:
      "Add a trigger verb to narration. Triggers are words/phrases in the narration text that cause visualization state changes (show, hide, transform, etc.) when spoken.",
    parameters: [
      stepId(),
      param("paragraphIndex", "number", "Paragraph index (0-based)"),
      param("wordIndex", "number", "Word index within the paragraph where the trigger fires"),
      param("text", "string", "The trigger word/phrase as it appears in narration"),
      param("action", "object", "TriggerVerb object specifying the visualization change"),
    ],
  },
  {
    name: "step.addRegion",
    description:
      "Add a named region to a block. Regions are sub-element addresses (e.g., a line range in code, a node in a data structure) that triggers can reference.",
    parameters: [
      stepId(),
      blockName(),
      param("regionName", "string", "Region identifier (referenced by triggers)"),
      param("target", "string", "Target expression within the block (e.g., line range, node id)"),
    ],
  },
  {
    name: "step.updateBlock",
    description:
      "Update an existing block's content. Replaces the block content while preserving the block's name and kind.",
    parameters: [
      stepId(),
      blockName("Name of the block to update"),
      param("content", "object", "Updated block content matching the kind's schema"),
    ],
  },

  // ---- Validation ----
  {
    name: "course.validate",
    description:
      "Parse and validate the current course. Returns an array of diagnostics (warnings and errors) with locations pointing to the problematic step, paragraph, or trigger.",
    parameters: [],
  },
  {
    name: "course.previewStep",
    description:
      "Get the computed scene sequence for a step. Returns the resolved SceneState array showing exactly what each frame of the presentation looks like.",
    parameters: [stepId("Step to preview")],
  },

  // ---- Lab ----
  {
    name: "lab.setInstructions",
    description:
      "Set the instructions markdown for a lab. This is the prose the student reads describing what to build.",
    parameters: [
      param("labIndex", "number", "Index of the lab in the course"),
      param("markdown", "string", "Instructions content as markdown"),
    ],
  },
  {
    name: "lab.setConfig",
    description:
      "Update lab configuration fields: test command, workspace mode, open files, services, setup scripts.",
    parameters: [
      param("labIndex", "number", "Index of the lab in the course"),
      param("config", "object", "Partial lab config fields to merge"),
    ],
  },

  // ---- Read (context gathering) ----
  {
    name: "course.getStructure",
    description:
      "Get the full course outline: title, and for each step its index, kind (lesson/lab), title, and step count. Use this to orient before making edits.",
    parameters: [],
  },
  {
    name: "step.getContent",
    description:
      "Get detailed content for a specific step: narration paragraphs with trigger counts, block names and kinds, region names, scene count, and any diagnostics.",
    parameters: [stepId("Step to inspect")],
  },
] as const;

// Lookup by tool name -- O(1) dispatch in the tool handler
export const TOOL_BY_NAME: ReadonlyMap<string, ToolDefinition> = new Map(
  COURSE_TOOLS.map((t) => [t.name, t]),
);
