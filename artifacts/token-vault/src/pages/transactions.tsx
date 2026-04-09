import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListTransactions } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownRight, ArrowUpRight, Coins, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

type TxType = "deposit" | "withdrawal" | "reward" | "all";

export default function Transactions() {
  const [typeFilter, setTypeFilter] = useState<TxType>("all");

  const { data: transactions, isLoading } = useListTransactions(
    typeFilter === "all" ? {} : { type: typeFilter }
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground mt-1">History of all deposits, withdrawals, and rewards.</p>
          </div>
          
          <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val as TxType)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="deposit">Deposits</SelectItem>
              <SelectItem value="withdrawal">Withdrawals</SelectItem>
              <SelectItem value="reward">Rewards</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Vault</TableHead>
                  <TableHead className="text-right">Tx Hash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : transactions && transactions.length > 0 ? (
                  transactions.map((tx) => {
                    let Icon = ArrowDownRight;
                    let iconBg = "bg-primary/20 text-primary";
                    let sign = "+";
                    
                    if (tx.type === "withdrawal") {
                      Icon = ArrowUpRight;
                      iconBg = "bg-orange-500/20 text-orange-500";
                      sign = "-";
                    } else if (tx.type === "reward") {
                      Icon = Coins;
                      iconBg = "bg-green-500/20 text-green-500";
                      sign = "+";
                    }

                    return (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBg}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                        </TableCell>
                        <TableCell className="font-medium capitalize">
                          {tx.type}
                        </TableCell>
                        <TableCell className="font-medium">
                          {sign}{tx.amount} {tx.tokenSymbol}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(tx.createdAt), "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Link href={`/vaults/${tx.vaultId}`} className="text-primary hover:underline">
                            Vault #{tx.vaultId}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">
                          {tx.txHash ? (
                            <a 
                              href={`https://etherscan.io/tx/${tx.txHash}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors"
                            >
                              <span className="font-mono text-xs">{tx.txHash.substring(0, 6)}...{tx.txHash.substring(tx.txHash.length - 4)}</span>
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Internal</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No transactions found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
