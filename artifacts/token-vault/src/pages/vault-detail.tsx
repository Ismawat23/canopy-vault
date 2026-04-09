import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useGetVault, useWithdrawVault, getGetVaultQueryKey, getListVaultsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, ShieldCheck, Download, AlertCircle, Coins, CalendarDays, Key } from "lucide-react";
import { format, differenceInSeconds } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function VaultDetail() {
  const { id } = useParams<{ id: string }>();
  const vaultId = parseInt(id || "0", 10);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: vault, isLoading, error } = useGetVault(vaultId, {
    query: {
      enabled: !!vaultId,
      queryKey: getGetVaultQueryKey(vaultId)
    }
  });

  const withdrawMutation = useWithdrawVault({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Withdrawal successful",
          description: "Your tokens and rewards have been returned to your wallet.",
        });
        queryClient.invalidateQueries({ queryKey: getGetVaultQueryKey(vaultId) });
        queryClient.invalidateQueries({ queryKey: getListVaultsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Withdrawal failed",
          description: "There was an error processing your withdrawal. Please try again.",
        });
      }
    }
  });

  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    if (!vault || vault.status === 'withdrawn') return;

    const start = new Date(vault.depositedAt).getTime();
    const end = new Date(vault.maturesAt).getTime();

    const updateProgress = () => {
      const now = new Date().getTime();
      
      if (now >= end) {
        setProgress(100);
        setTimeRemaining("Matured");
        return;
      }

      const total = end - start;
      const elapsed = now - start;
      setProgress(Math.max(0, Math.min(100, (elapsed / total) * 100)));

      // Calculate time remaining
      const diffSeconds = Math.max(0, differenceInSeconds(end, now));
      const days = Math.floor(diffSeconds / (3600 * 24));
      const hours = Math.floor((diffSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((diffSeconds % 3600) / 60);

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h remaining`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m remaining`);
      } else {
        setTimeRemaining(`${minutes}m remaining`);
      }
    };

    updateProgress();
    const interval = setInterval(updateProgress, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [vault]);

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-12 w-2/3" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-[300px]" />
            <Skeleton className="h-[300px]" />
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !vault) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Vault Not Found</h2>
          <p className="text-muted-foreground mt-2 mb-6">This vault may have been deleted or you don't have access.</p>
          <Button asChild>
            <Link href="/vaults">Back to Vaults</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <Link href="/vaults" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Vaults
          </Link>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{vault.name}</h1>
              <Badge variant={
                vault.status === 'active' ? 'default' : 
                vault.status === 'matured' ? 'success' : 'secondary'
              } className={vault.status === 'matured' ? 'bg-green-500/20 text-green-500' : ''}>
                {vault.status.toUpperCase()}
              </Badge>
            </div>
            
            {vault.status === 'matured' && (
              <Button 
                onClick={() => withdrawMutation.mutate({ id: vaultId })}
                disabled={withdrawMutation.isPending}
                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                <Download className="w-4 h-4" />
                {withdrawMutation.isPending ? "Processing..." : "Withdraw Funds"}
              </Button>
            )}
          </div>
        </div>

        {vault.status === 'active' && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Lock Progress</span>
                <span className="text-sm font-medium">{timeRemaining}</span>
              </div>
              <Progress value={progress} className="h-2 mb-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{format(new Date(vault.depositedAt), "MMM d, yyyy")}</span>
                <span>{format(new Date(vault.maturesAt), "MMM d, yyyy")}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {vault.status === 'matured' && (
          <Alert className="border-green-500/50 bg-green-500/10">
            <ShieldCheck className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-500">Vault Matured!</AlertTitle>
            <AlertDescription className="text-green-500/80">
              Your tokens have completed their lock period. You can now withdraw your principal and earned rewards.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                Deposit Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Principal Amount</p>
                  <p className="text-2xl font-bold">{vault.amount} {vault.tokenSymbol}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Earned Rewards</p>
                  <p className="text-2xl font-bold text-green-500">+{vault.earnedRewards} {vault.tokenSymbol}</p>
                </div>
              </div>
              
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground text-sm">Reward Rate (APY)</span>
                  <span className="font-medium">{vault.rewardRate}%</span>
                </div>
                <div className="flex justify-between items-center py-2 border-t border-border/50">
                  <span className="text-muted-foreground text-sm">Network</span>
                  <span className="font-medium">{vault.chain}</span>
                </div>
                {vault.contractAddress && (
                  <div className="flex justify-between items-center py-2 border-t border-border/50">
                    <span className="text-muted-foreground text-sm">Contract</span>
                    <span className="font-mono text-sm">{vault.contractAddress.slice(0, 6)}...{vault.contractAddress.slice(-4)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 border-t border-border/50">
                  <span className="text-muted-foreground text-sm">Total Value</span>
                  <span className="font-medium">
                    {(parseFloat(vault.amount) + parseFloat(vault.earnedRewards)).toFixed(2)} {vault.tokenSymbol}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                
                {/* Deposit Event */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-card shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                    <ArrowLeft className="w-4 h-4 text-primary rotate-45" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-sm">Deposited</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(vault.depositedAt), "MMM d, yyyy")}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">Tokens locked for {vault.lockDays} days</div>
                  </div>
                </div>

                {/* Maturity Event */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border border-border shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow
                    ${vault.status === 'matured' || vault.status === 'withdrawn' ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'bg-card text-muted-foreground'}
                  `}>
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-sm">Maturity</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(vault.maturesAt), "MMM d, yyyy")}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">Rewards fully realized</div>
                  </div>
                </div>

                {/* Withdraw Event (if applicable) */}
                {vault.status === 'withdrawn' && vault.withdrawnAt && (
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-card text-muted-foreground shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                      <Download className="w-4 h-4" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-border bg-card shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-sm">Withdrawn</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(vault.withdrawnAt), "MMM d, yyyy")}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">Tokens transferred to wallet</div>
                    </div>
                  </div>
                )}

              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
