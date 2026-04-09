import { useListWallets, useDeleteWallet, getListWalletsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { CreateWalletDialog } from "@/components/create-wallet-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, Copy, Check, Trash2, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

export default function Wallets() {
  const { data: wallets, isLoading } = useListWallets();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteWallet = useDeleteWallet({
    mutation: {
      onSuccess: () => {
        toast({ title: "Wallet removed" });
        queryClient.invalidateQueries({ queryKey: getListWalletsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
    },
  });

  const copyToClipboard = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Address copied to clipboard", duration: 2000 });
  };

  const shortenAddress = (address: string) => {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatCurrency = (val: string | number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(Number(val));
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Wallets</h1>
            <p className="text-muted-foreground mt-1">Manage connected wallets and track balances across chains.</p>
          </div>
          <CreateWalletDialog />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-full mt-4" />
                </CardContent>
              </Card>
            ))
          ) : wallets && wallets.length > 0 ? (
            wallets.map((wallet) => (
              <Card key={wallet.id} className="hover:border-primary/50 transition-colors group">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{wallet.label}</h3>
                        <Badge variant="outline" className="mt-1 bg-background text-xs">
                          {wallet.chain}
                        </Badge>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteWallet.mutate({ id: wallet.id })}
                      disabled={deleteWallet.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="bg-muted/50 rounded-md p-3 flex items-center justify-between mt-4">
                    <span className="font-mono text-sm">{shortenAddress(wallet.address)}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6" 
                      onClick={() => copyToClipboard(wallet.id, wallet.address)}
                    >
                      {copiedId === wallet.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                    </Button>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="font-bold">{formatCurrency(wallet.balance)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Added</p>
                      <p className="text-sm">{formatDistanceToNow(new Date(wallet.createdAt))} ago</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-12 border border-dashed rounded-lg bg-card">
              <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-1">No wallets connected</h3>
              <p className="text-muted-foreground text-sm">
                Connect a wallet to start tracking balances.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
