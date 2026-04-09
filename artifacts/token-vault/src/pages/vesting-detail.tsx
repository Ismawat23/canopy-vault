import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useGetVestingSchedule, useClaimVesting, getGetVestingScheduleQueryKey, getListVestingSchedulesQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Timer, Download, AlertCircle, CalendarDays, ExternalLink, Hash, User } from "lucide-react";
import { format, differenceInSeconds } from "date-fns";

export default function VestingDetail() {
  const { id } = useParams<{ id: string }>();
  const scheduleId = parseInt(id || "0", 10);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: schedule, isLoading, error } = useGetVestingSchedule(scheduleId, {
    query: {
      enabled: !!scheduleId,
      queryKey: getGetVestingScheduleQueryKey(scheduleId)
    }
  });

  const claimMutation = useClaimVesting({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Tokens Claimed",
          description: "Your available tokens have been successfully claimed.",
        });
        queryClient.invalidateQueries({ queryKey: getGetVestingScheduleQueryKey(scheduleId) });
        queryClient.invalidateQueries({ queryKey: getListVestingSchedulesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Claim failed",
          description: "There was an error processing your claim. Please try again.",
        });
      }
    }
  });

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

  if (error || !schedule) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Schedule Not Found</h2>
          <p className="text-muted-foreground mt-2 mb-6">This schedule may have been deleted or you don't have access.</p>
          <Button asChild>
            <Link href="/vesting">Back to Vesting Schedules</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const releasedPercent = (parseFloat(schedule.releasedAmount) / parseFloat(schedule.totalAmount)) * 100;
  const isCliffPassed = new Date() >= new Date(schedule.cliffDate);
  const canClaim = parseFloat(schedule.claimableAmount) > 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <Link href="/vesting" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Vesting
          </Link>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{schedule.name}</h1>
              <Badge variant={schedule.status === 'active' ? 'default' : 'success'}>
                {schedule.status.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="bg-card text-muted-foreground">{schedule.chain}</Badge>
            </div>
            
            {canClaim && (
              <Button 
                onClick={() => claimMutation.mutate({ id: scheduleId })}
                disabled={claimMutation.isPending}
                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                <Download className="w-4 h-4" />
                {claimMutation.isPending ? "Claiming..." : `Claim ${schedule.claimableAmount} ${schedule.tokenSymbol}`}
              </Button>
            )}
          </div>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Total Vesting Progress</span>
              <span className="text-sm font-medium">{releasedPercent.toFixed(2)}%</span>
            </div>
            <Progress value={releasedPercent} className="h-2 mb-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{format(new Date(schedule.startDate), "MMM d, yyyy")}</span>
              <span>{format(new Date(schedule.endDate), "MMM d, yyyy")}</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-primary" />
                Schedule Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                  <p className="text-2xl font-bold">{schedule.totalAmount} <span className="text-sm font-normal text-muted-foreground">{schedule.tokenSymbol}</span></p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Released Amount</p>
                  <p className="text-2xl font-bold text-primary">{schedule.releasedAmount} <span className="text-sm font-normal text-muted-foreground">{schedule.tokenSymbol}</span></p>
                </div>
              </div>
              
              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm flex items-center gap-2"><User className="w-4 h-4" /> Beneficiary</span>
                  <span className="font-mono text-sm">{schedule.beneficiary.slice(0, 8)}...{schedule.beneficiary.slice(-6)}</span>
                </div>
                {schedule.contractAddress && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm flex items-center gap-2"><ExternalLink className="w-4 h-4" /> Contract</span>
                    <span className="font-mono text-sm">{schedule.contractAddress.slice(0, 8)}...{schedule.contractAddress.slice(-6)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Vesting Period</span>
                  <span className="font-medium">{schedule.vestingDays} Days</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Cliff Period</span>
                  <span className="font-medium">{schedule.cliffDays} Days</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                Milestones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary/50 before:via-border before:to-transparent">
                
                {/* Start Event */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-primary bg-primary/20 text-primary shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                    <Timer className="w-4 h-4" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-sm">Vesting Started</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(schedule.startDate), "MMM d, yyyy")}</div>
                    </div>
                  </div>
                </div>

                {/* Cliff Event */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow
                    ${isCliffPassed ? 'border-primary bg-primary/20 text-primary' : 'border-border bg-card text-muted-foreground'}
                  `}>
                    <Timer className="w-4 h-4" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-sm">Cliff End</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(schedule.cliffDate), "MMM d, yyyy")}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">Linear unlocking begins</div>
                  </div>
                </div>

                {/* End Event */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow
                    ${schedule.status === 'completed' ? 'border-green-500 bg-green-500/20 text-green-500' : 'border-border bg-card text-muted-foreground'}
                  `}>
                    <Timer className="w-4 h-4" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-sm">Fully Vested</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(schedule.endDate), "MMM d, yyyy")}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">100% tokens released</div>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
