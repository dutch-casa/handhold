// Output of layout algorithms. Renderer consumes these — never raw DataState.

export type NodeShape = "rect" | "circle" | "wide-rect" | "diamond" | "grid-cell";

export type NodeMarker =
  | "terminal"
  | "active-bit"
  | "inactive-bit"
  | "bucket-header"
  | "red"
  | "black"
  | "marked";

export type EdgeStyle = "solid" | "dashed" | "double";

export type PositionedNode = {
  readonly id: string;
  readonly value: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly shape?: NodeShape | undefined;
  readonly marker?: NodeMarker | undefined;
  readonly secondaryValue?: string | undefined;
};

export type PositionedEdge = {
  readonly id: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly label?: string | undefined;
  readonly style?: EdgeStyle | undefined;
  readonly bidirectional?: true | undefined;
};

export type PositionedPointer = {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly angle?: number | undefined;
};

export type Layout = {
  readonly nodes: readonly PositionedNode[];
  readonly edges: readonly PositionedEdge[];
  readonly pointers: readonly PositionedPointer[];
  readonly width: number;
  readonly height: number;
};
