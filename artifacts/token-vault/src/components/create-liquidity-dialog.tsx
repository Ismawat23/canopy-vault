import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateLiquidityLock, getListLiquidityLocksQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Droplets, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  tokenPair: z.string().min(1, "Token pair is required"),
  dex: z.string().min(1, "DEX name is required"),
  chain: z.string().min(1, "Chain is required"),
  lpTokenAmount: z.string().min(1, "LP Token Amount is required"),
  lockDays: z.coerce.number().min(1, "Lock days must be at least 1"),
  contractAddress: z.string().optional(),
});

export function CreateLiquidityDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      tokenPair: "",
      dex: "Uniswap",
      chain: "Ethereum",
      lpTokenAmount: "",
      lockDays: 180,
      contractAddress: "",
    },
  });

  const createLock = useCreateLiquidityLock({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Liquidity Locked",
          description: "Your LP tokens have been locked successfully.",
        });
        setOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListLiquidityLocksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to lock liquidity. Please try again.",
        });
      },
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createLock.mutate({ data: values });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Lock Liquidity
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-primary" />
            Lock LP Tokens
          </DialogTitle>
          <DialogDescription>
            Secure your project's liquidity by locking LP tokens for a specified duration.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lock Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Initial Liquidity Lock" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tokenPair"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token Pair</FormLabel>
                    <FormControl>
                      <Input placeholder="ETH/USDT" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lpTokenAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LP Amount</FormLabel>
                    <FormControl>
                      <Input placeholder="100.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DEX</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select DEX" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Uniswap">Uniswap</SelectItem>
                        <SelectItem value="SushiSwap">SushiSwap</SelectItem>
                        <SelectItem value="PancakeSwap">PancakeSwap</SelectItem>
                        <SelectItem value="Curve">Curve</SelectItem>
                        <SelectItem value="Balancer">Balancer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="chain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Network</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select network" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Ethereum">Ethereum</SelectItem>
                        <SelectItem value="BSC">BSC</SelectItem>
                        <SelectItem value="Polygon">Polygon</SelectItem>
                        <SelectItem value="Arbitrum">Arbitrum</SelectItem>
                        <SelectItem value="Optimism">Optimism</SelectItem>
                        <SelectItem value="Avalanche">Avalanche</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="lockDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lock Duration (Days)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-4 flex justify-end space-x-2">
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createLock.isPending}>
                {createLock.isPending ? "Locking..." : "Lock Liquidity"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
