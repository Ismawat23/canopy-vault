import { Layout } from "@/components/layout";
import { useGetPortfolioSummary, useGetPortfolioByChain, useGetPortfolioAllocations } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { PieChart as PieChartIcon, Activity, Layers, Link as LinkIcon, Wallet } from "lucide-react";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Portfolio() {
  const { data: summary, isLoading: isLoadingSummary } = useGetPortfolioSummary();
  const { data: byChain, isLoading: isLoadingChain } = useGetPortfolioByChain();
  const { data: allocations, isLoading: isLoadingAllocations } = useGetPortfolioAllocations();

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
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <PieChartIcon className="h-8 w-8 text-primary" />
            Portfolio Tracker
          </h1>
          <p className="text-muted-foreground mt-1">Comprehensive overview of your locked assets across all networks.</p>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card/50 backdrop-blur border-primary/20 shadow-lg shadow-primary/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <Skeleton className="h-8 w-[120px]" />
              ) : (
                <>
                  <div className="text-2xl font-bold tracking-tight">{formatCurrency(summary?.totalValue || 0)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    +{formatCurrency(summary?.totalRewards || 0)} rewards earned
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Asset Distribution</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <Skeleton className="h-8 w-[100px]" />
              ) : (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Vaults:</span>
                    <span className="font-medium">{formatCurrency(summary?.totalLocked || 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Vesting:</span>
                    <span className="font-medium">{formatCurrency(summary?.totalVesting || 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Liquidity:</span>
                    <span className="font-medium">{formatCurrency(summary?.totalLiquidity || 0)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Chains</CardTitle>
              <LinkIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <Skeleton className="h-8 w-[50px]" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{summary?.activeChains || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Connected networks
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connected Wallets</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <Skeleton className="h-8 w-[50px]" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{summary?.connectedWallets || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Managing {summary?.activePositions || 0} positions
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Chain Breakdown Chart */}
          <Card className="col-span-1 border-border/50">
            <CardHeader>
              <CardTitle>Value by Chain</CardTitle>
              <CardDescription>Total value locked distributed across networks</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingChain ? (
                <div className="h-[300px] w-full flex items-center justify-center">
                  <Skeleton className="h-[250px] w-full mx-4" />
                </div>
              ) : byChain && byChain.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byChain} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="chain" 
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
                      <RechartsTooltip 
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
                  No chain data available.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Token Allocation Pie Chart */}
          <Card className="col-span-1 border-border/50">
            <CardHeader>
              <CardTitle>Token Allocation</CardTitle>
              <CardDescription>Percentage breakdown of locked tokens</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAllocations ? (
                <div className="h-[300px] w-full flex items-center justify-center">
                  <Skeleton className="h-[250px] w-[250px] rounded-full mx-4" />
                </div>
              ) : allocations && allocations.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocations}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="percentage"
                        nameKey="tokenSymbol"
                      >
                        {allocations.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        formatter={(value: any, name: string, props: any) => [
                          `${value}% ($${props.payload.totalAmount})`, 
                          name
                        ]}
                      />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                  No allocation data available.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
