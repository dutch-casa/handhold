// Output of layout algorithms. Renderer consumes these — never raw DataState.

export type PositionedNode = {
  readonly id: string;
  readonly value: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly shape?: "rect" | "circle";
};

export type PositionedEdge = {
  readonly id: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly label?: string;
};

export type PositionedPointer = {
  readonly name: string;
  readonly x: number;
  readonly y: number;
};

export type Layout = {
  readonly nodes: readonly PositionedNode[];
  readonly edges: readonly PositionedEdge[];
  readonly pointers: readonly PositionedPointer[];
  readonly width: number;
  readonly height: number;
};
