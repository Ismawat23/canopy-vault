import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateVault, getListVaultsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  tokenSymbol: z.string().min(1, "Please select a token."),
  amount: z.string().min(1, "Amount is required.").refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Must be a valid positive number"),
  lockDays: z.coerce.number().min(1, "Lock period must be at least 1 day."),
});

export function CreateVaultDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createVault = useCreateVault();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      tokenSymbol: "USDC",
      amount: "",
      lockDays: 30,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createVault.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({
            title: "Vault created successfully",
            description: `Successfully locked ${values.amount} ${values.tokenSymbol} for ${values.lockDays} days.`,
          });
          setOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListVaultsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Failed to create vault",
            description: "There was an error creating your vault. Please try again.",
          });
        }
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Create Vault
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Vault</DialogTitle>
          <DialogDescription>
            Lock your tokens to earn rewards. Tokens cannot be withdrawn until the lock period expires.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vault Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Q3 Savings" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tokenSymbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a token" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USDC">USDC</SelectItem>
                        <SelectItem value="ETH">ETH</SelectItem>
                        <SelectItem value="WBTC">WBTC</SelectItem>
                        <SelectItem value="DAI">DAI</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" placeholder="0.00" {...field} />
                    </FormControl>
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
                  <FormLabel>Lock Period (Days)</FormLabel>
                  <Select onValueChange={(val) => field.onChange(parseInt(val, 10))} defaultValue={field.value.toString()}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select lock period" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="30">30 Days (5% APY)</SelectItem>
                      <SelectItem value="90">90 Days (8% APY)</SelectItem>
                      <SelectItem value="180">180 Days (12% APY)</SelectItem>
                      <SelectItem value="365">365 Days (20% APY)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Longer locks yield higher reward rates.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createVault.isPending}>
                {createVault.isPending ? "Creating..." : "Create Vault"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
