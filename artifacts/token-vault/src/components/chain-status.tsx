import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

interface ChainStatusData {
  online: boolean;
  height: number | null;
  rpcUrl: string;
  message: string;
}

export function ChainStatus() {
  const [status, setStatus] = useState<ChainStatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/canopy/status`);
        if (!res.ok) throw new Error("status error");
        const data = (await res.json()) as ChainStatusData;
        if (!cancelled) {
          setStatus(data);
        }
      } catch {
        if (!cancelled) {
          setStatus({
            online: false,
            height: null,
            rpcUrl: "localhost:50002",
            message: "Canopy chain not reachable — running in local-database mode.",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Connecting to chain...</span>
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="flex items-center gap-1.5" title={status.message}>
      {status.online ? (
        <>
          <Badge variant="outline" className="gap-1 px-1.5 py-0.5 text-xs font-normal border-emerald-500/50 text-emerald-500">
            <Wifi className="h-2.5 w-2.5" />
            On-chain
          </Badge>
          <span className="text-xs text-muted-foreground">
            Block {status.height?.toLocaleString()}
          </span>
        </>
      ) : (
        <Badge variant="outline" className="gap-1 px-1.5 py-0.5 text-xs font-normal border-amber-500/50 text-amber-500">
          <WifiOff className="h-2.5 w-2.5" />
          Local DB
        </Badge>
      )}
    </div>
  );
}
