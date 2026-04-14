/** Must match markers written by benchmark CLI when using `--pipe-results`. */
export const CSE_ZIP_B64_START = "\n__CSE_RESULTS_ZIP_B64_START__\n";
export const CSE_ZIP_B64_END = "\n__CSE_RESULTS_ZIP_B64_END__\n";

/**
 * Streams CLI stdout to the user while hiding the final piped zip (base64) block.
 * Handles markers split across TCP chunks.
 */
export function createPipeResultsZipStdoutFilter() {
  let pending = "";
  let phase: "before" | "inB64" | "after" = "before";

  return (chunk: string): string => {
    pending += chunk;
    if (phase === "after") {
      const out = pending;
      pending = "";
      return out;
    }
    if (phase === "before") {
      const i = pending.indexOf(CSE_ZIP_B64_START);
      if (i === -1) {
        const tailKeep = Math.max(0, pending.length - (CSE_ZIP_B64_START.length - 1));
        const emit = pending.slice(0, tailKeep);
        pending = pending.slice(tailKeep);
        return emit;
      }
      const emit = pending.slice(0, i);
      pending = pending.slice(i + CSE_ZIP_B64_START.length);
      phase = "inB64";
      return emit + drainB64();
    }
    return drainB64();

    function drainB64(): string {
      const j = pending.indexOf(CSE_ZIP_B64_END);
      if (j === -1) {
        return "";
      }
      pending = pending.slice(j + CSE_ZIP_B64_END.length);
      phase = "after";
      const rest = pending;
      pending = "";
      return rest;
    }
  };
}

export function extractZipBase64FromStdout(fullStdout: string): string | null {
  const s = fullStdout.indexOf(CSE_ZIP_B64_START);
  if (s === -1) return null;
  const e = fullStdout.indexOf(CSE_ZIP_B64_END, s + CSE_ZIP_B64_START.length);
  if (e === -1) return null;
  return fullStdout.slice(s + CSE_ZIP_B64_START.length, e).replace(/\r?\n/g, "");
}
