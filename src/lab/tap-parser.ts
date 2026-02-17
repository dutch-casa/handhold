// TAP (Test Anything Protocol) parser — pure function.
// Extracts structured assertions from raw test output.

import type { TestAssertion } from "@/types/lab";

const TAP_OK = /^ok\s+(\d+)\s*-?\s*(.*)/;
const TAP_NOT_OK = /^not ok\s+(\d+)\s*-?\s*(.*)/;

export function parseTap(output: string): readonly TestAssertion[] {
  const assertions: TestAssertion[] = [];

  for (const line of output.split("\n")) {
    const ok = TAP_OK.exec(line);
    if (ok !== null) {
      assertions.push({ index: Number(ok[1]), description: ok[2]?.trim() ?? "", passed: true });
      continue;
    }
    const fail = TAP_NOT_OK.exec(line);
    if (fail !== null) {
      assertions.push({ index: Number(fail[1]), description: fail[2]?.trim() ?? "", passed: false });
    }
  }

  return assertions;
}
