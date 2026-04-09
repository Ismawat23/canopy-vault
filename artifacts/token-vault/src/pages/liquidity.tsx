import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useListLiquidityLocks, useUnlockLiquidity, getListLiquidityLocksQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { CreateLiquidityDialog } from "@/components/create-liquidity-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Droplets, ExternalLink, Unlock, ShieldAlert } from "lucide-react";
import { formatDistanceToNow, isPast } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type LockStatus = "locked" | "unlocked" | "all";

export default function LiquidityLocks() {
  const [statusFilter, setStatusFilter] = useState<LockStatus>("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: locks, isLoading } = useListLiquidityLocks(
    statusFilter === "all" ? {} : { status: statusFilter }
  );

  const unlockMutation = useUnlockLiquidity({
    mutation: {
      onSuccess: () => {
        toast({ title: "Liquidity unlocked successfully" });
        queryClient.invalidateQueries({ queryKey: getListLiquidityLocksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      }
    }
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Liquidity Locks</h1>
            <p className="text-muted-foreground mt-1">Manage locked LP tokens across DEXs.</p>
          </div>
          <CreateLiquidityDialog />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as LockStatus)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locks</SelectItem>
              <SelectItem value="locked">Locked</SelectItem>
              <SelectItem value="unlocked">Unlocked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 pt-4 border-t border-border">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : locks && locks.length > 0 ? (
            locks.map((lock) => {
              const canUnlock = lock.status === 'locked' && isPast(new Date(lock.unlocksAt));
              
              return (
                <Card key={lock.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border
                          ${lock.status === 'locked' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground border-border'}
                        `}>
                          <Droplets className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{lock.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="bg-background text-xs">{lock.dex}</Badge>
                            <Badge variant="outline" className="bg-background text-xs text-muted-foreground">{lock.chain}</Badge>
                          </div>
                        </div>
                      </div>
                      <Badge variant={lock.status === 'locked' ? 'default' : 'secondary'}>
                        {lock.status}
                      </Badge>
                    </div>

                    <div className="bg-card border border-border rounded-md p-4 mb-4 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Token Pair</p>
                        <p className="font-medium">{lock.tokenPair}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">LP Amount</p>
                        <p className="font-medium">{lock.lpTokenAmount}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2 text-sm">
                        {lock.status === 'locked' ? (
                          <>
                            <ShieldAlert className="w-4 h-4 text-primary" />
                            <span>Unlocks {formatDistanceToNow(new Date(lock.unlocksAt), { addSuffix: true })}</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Unlocked</span>
                          </>
                        )}
                      </div>
                      
                      {canUnlock && (
                        <Button 
                          size="sm" 
                          onClick={() => unlockMutation.mutate({ id: lock.id })}
                          disabled={unlockMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Unlock Now
                        </Button>
                      )}
                      
                      {lock.contractAddress && (
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground gap-1">
                          Contract <ExternalLink className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="col-span-full text-center py-12 border border-dashed rounded-lg bg-card">
              <Droplets className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-1">No liquidity locks found</h3>
              <p className="text-muted-foreground text-sm">
                Create a new lock to secure your LP tokens.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
