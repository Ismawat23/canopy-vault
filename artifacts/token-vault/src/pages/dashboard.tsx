import { Layout } from "@/components/layout";
import { 
  useGetDashboardSummary, 
  useGetVaultDistribution, 
  useGetRecentActivity 
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Lock, Award, ShieldCheck, ArrowUpRight, ArrowDownRight, RefreshCcw, Coins, Activity, Link, Wallet } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function Dashboard() {
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: distribution, isLoading: isDistLoading } = useGetVaultDistribution();
  const { data: activity, isLoading: isActivityLoading } = useGetRecentActivity({ limit: 5 });

  const formatCurrency = (val: string | number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(val));
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your vault assets and rewards.</p>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value Locked</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isSummaryLoading ? (
                <Skeleton className="h-8 w-[100px]" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{formatCurrency(summary?.totalValueLocked || 0)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Across {summary?.totalDeposits || 0} deposits
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Vaults</CardTitle>
              <Lock className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isSummaryLoading ? (
                <Skeleton className="h-8 w-[50px]" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{summary?.activeVaults || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Link className="h-3 w-3" /> {summary?.totalChains || 0} networks
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rewards Earned</CardTitle>
              <Award className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isSummaryLoading ? (
                <Skeleton className="h-8 w-[100px]" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-500">{formatCurrency(summary?.totalRewardsEarned || 0)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Realized & unrealized
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Matured Vaults</CardTitle>
              <ShieldCheck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isSummaryLoading ? (
                <Skeleton className="h-8 w-[50px]" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{summary?.maturedVaults || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Wallet className="h-3 w-3" /> {summary?.totalWallets || 0} wallets
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-7">
          {/* Chart */}
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Vault Distribution by Lock Period</CardTitle>
              <CardDescription>Value locked across different maturity profiles</CardDescription>
            </CardHeader>
            <CardContent className="pl-0">
              {isDistLoading ? (
                <div className="h-[300px] w-full flex items-center justify-center">
                  <Skeleton className="h-full w-full mx-4" />
                </div>
              ) : distribution && distribution.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distribution} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="lockPeriod" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip 
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value: any) => [`$${value}`, "Total Value"]}
                      />
                      <Bar dataKey="totalValue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                  No distribution data available.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest transactions across all vaults</CardDescription>
            </CardHeader>
            <CardContent>
              {isActivityLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activity && activity.length > 0 ? (
                <div className="space-y-6">
                  {activity.map((item) => {
                    let Icon = Activity;
                    let iconBg = "bg-muted text-muted-foreground";
                    
                    if (item.type === "deposit") {
                      Icon = ArrowDownRight;
                      iconBg = "bg-primary/20 text-primary";
                    } else if (item.type === "withdrawal") {
                      Icon = ArrowUpRight;
                      iconBg = "bg-orange-500/20 text-orange-500";
                    } else if (item.type === "reward") {
                      Icon = Coins;
                      iconBg = "bg-green-500/20 text-green-500";
                    } else if (item.type === "matured") {
                      Icon = ShieldCheck;
                      iconBg = "bg-blue-500/20 text-blue-500";
                    }

                    return (
                      <div key={item.id} className="flex items-start gap-4">
                        <div className={`mt-0.5 p-2 rounded-full ${iconBg}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {item.type === 'deposit' && 'Deposited'}
                            {item.type === 'withdrawal' && 'Withdrew'}
                            {item.type === 'reward' && 'Earned Reward'}
                            {item.type === 'matured' && 'Vault Matured'}
                            {" "}
                            {item.amount} {item.tokenSymbol}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.vaultName}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  No recent activity found.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
