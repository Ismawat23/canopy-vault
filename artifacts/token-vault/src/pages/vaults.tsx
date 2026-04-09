import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useListVaults } from "@workspace/api-client-react";
import { CreateVaultDialog } from "@/components/create-vault-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronRight, Lock, ShieldCheck, Unlock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type VaultStatus = "active" | "matured" | "withdrawn" | "all";

export default function Vaults() {
  const [statusFilter, setStatusFilter] = useState<VaultStatus>("all");
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: vaults, isLoading } = useListVaults({
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(chainFilter !== "all" ? { chain: chainFilter } : {})
  });

  const filteredVaults = vaults?.filter(vault => 
    vault.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vault.tokenSymbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Vaults</h1>
            <p className="text-muted-foreground mt-1">Manage your active and matured token locks.</p>
          </div>
          <CreateVaultDialog />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search vaults..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as VaultStatus)}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="matured">Matured</SelectItem>
              <SelectItem value="withdrawn">Withdrawn</SelectItem>
            </SelectContent>
          </Select>
          <Select value={chainFilter} onValueChange={setChainFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Filter by network" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Networks</SelectItem>
              <SelectItem value="Ethereum">Ethereum</SelectItem>
              <SelectItem value="BSC">BSC</SelectItem>
              <SelectItem value="Polygon">Polygon</SelectItem>
              <SelectItem value="Arbitrum">Arbitrum</SelectItem>
              <SelectItem value="Optimism">Optimism</SelectItem>
              <SelectItem value="Avalanche">Avalanche</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-1/4" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredVaults && filteredVaults.length > 0 ? (
            filteredVaults.map((vault) => (
              <Link key={vault.id} href={`/vaults/${vault.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                  <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border
                        ${vault.status === 'active' ? 'bg-primary/10 text-primary border-primary/20' : ''}
                        ${vault.status === 'matured' ? 'bg-green-500/10 text-green-500 border-green-500/20' : ''}
                        ${vault.status === 'withdrawn' ? 'bg-muted text-muted-foreground border-border' : ''}
                      `}>
                        {vault.status === 'active' && <Lock className="w-5 h-5" />}
                        {vault.status === 'matured' && <ShieldCheck className="w-5 h-5" />}
                        {vault.status === 'withdrawn' && <Unlock className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{vault.name}</h3>
                          <Badge variant={
                            vault.status === 'active' ? 'default' : 
                            vault.status === 'matured' ? 'success' : 'secondary'
                          } className={vault.status === 'matured' ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' : ''}>
                            {vault.status}
                          </Badge>
                          <Badge variant="outline" className="bg-background text-xs text-muted-foreground shrink-0">{vault.chain}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Locked {formatDistanceToNow(new Date(vault.depositedAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap md:flex-nowrap gap-8 w-full md:w-auto">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Deposit</p>
                        <p className="font-medium">{vault.amount} {vault.tokenSymbol}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Earned</p>
                        <p className="font-medium text-green-500">+{vault.earnedRewards} {vault.tokenSymbol}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Lock Period</p>
                        <p className="font-medium">{vault.lockDays} Days</p>
                      </div>
                      <div className="flex items-center text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-auto">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <div className="text-center py-12 border border-dashed rounded-lg bg-card">
              <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-1">No vaults found</h3>
              <p className="text-muted-foreground text-sm">
                {searchQuery || statusFilter !== 'all' 
                  ? "Try adjusting your filters" 
                  : "Create a new vault to start earning rewards"}
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
