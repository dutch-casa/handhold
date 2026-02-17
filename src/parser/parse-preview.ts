import type { PreviewState, PreviewTemplate } from "@/types/lesson";
import { splitContentAndRegions } from "./parse-regions";

export function parsePreview(
  text: string,
  name: string,
  template: PreviewTemplate,
): PreviewState {
  const { content, regions } = splitContentAndRegions(text);
  return { kind: "preview", name, source: content, regions, template };
}
