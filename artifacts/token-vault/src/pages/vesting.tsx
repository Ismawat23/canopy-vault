import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useListVestingSchedules } from "@workspace/api-client-react";
import { CreateVestingDialog } from "@/components/create-vesting-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Timer, ChevronRight, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

type VestingStatus = "active" | "completed" | "all";

export default function VestingSchedules() {
  const [statusFilter, setStatusFilter] = useState<VestingStatus>("all");

  const { data: schedules, isLoading } = useListVestingSchedules(
    statusFilter === "all" ? {} : { status: statusFilter }
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Vesting Schedules</h1>
            <p className="text-muted-foreground mt-1">Manage linear token release schedules.</p>
          </div>
          <CreateVestingDialog />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as VestingStatus)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schedules</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
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
          ) : schedules && schedules.length > 0 ? (
            schedules.map((schedule) => {
              const releasedPercent = (parseFloat(schedule.releasedAmount) / parseFloat(schedule.totalAmount)) * 100;
              
              return (
                <Link key={schedule.id} href={`/vesting/${schedule.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                    <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                      <div className="flex items-center gap-4 w-full md:w-1/3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border
                          ${schedule.status === 'active' ? 'bg-primary/10 text-primary border-primary/20' : ''}
                          ${schedule.status === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/20' : ''}
                        `}>
                          {schedule.status === 'active' ? <Timer className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg truncate">{schedule.name}</h3>
                            <Badge variant={schedule.status === 'active' ? 'default' : 'success'} className="shrink-0">
                              {schedule.status}
                            </Badge>
                            <Badge variant="outline" className="shrink-0 bg-background text-xs text-muted-foreground">{schedule.chain}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            To: {schedule.beneficiary.slice(0, 6)}...{schedule.beneficiary.slice(-4)}
                          </p>
                        </div>
                      </div>

                      <div className="w-full md:w-1/3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{releasedPercent.toFixed(1)}%</span>
                        </div>
                        <Progress value={releasedPercent} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{format(new Date(schedule.startDate), "MMM d, yyyy")}</span>
                          <span>{format(new Date(schedule.endDate), "MMM d, yyyy")}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between w-full md:w-auto gap-8">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground mb-1">Total</p>
                          <p className="font-medium">{schedule.totalAmount} {schedule.tokenSymbol}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground mb-1">Claimable</p>
                          <p className="font-medium text-green-500">{schedule.claimableAmount} {schedule.tokenSymbol}</p>
                        </div>
                        <div className="flex items-center text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-auto">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          ) : (
            <div className="text-center py-12 border border-dashed rounded-lg bg-card">
              <Timer className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-1">No vesting schedules found</h3>
              <p className="text-muted-foreground text-sm">
                Create a new vesting schedule to start distributing tokens.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
