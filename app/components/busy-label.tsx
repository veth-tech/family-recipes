import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/** Live "still working" label: spinner + elapsed seconds. Mounts fresh on each busy run. */
export function BusyLabel({ past }: { past: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {past}
      <span className="opacity-70">· {secs}s</span>
    </span>
  );
}
