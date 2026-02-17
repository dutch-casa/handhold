import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { PreviewTemplate } from "@/types/lesson";

export function useCompilePreview(source: string, template: PreviewTemplate) {
  return useQuery({
    queryKey: ["compile-preview", source],
    queryFn: () => invoke<string>("compile_jsx", { source }),
    staleTime: Infinity,
    enabled: template === "react" && source.length > 0,
  });
}
