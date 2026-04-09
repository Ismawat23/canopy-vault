import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import Portfolio from "@/pages/portfolio";
import Vaults from "@/pages/vaults";
import VaultDetail from "@/pages/vault-detail";
import VestingSchedules from "@/pages/vesting";
import VestingDetail from "@/pages/vesting-detail";
import LiquidityLocks from "@/pages/liquidity";
import Wallets from "@/pages/wallets";
import Transactions from "@/pages/transactions";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/vaults" component={Vaults} />
      <Route path="/vaults/:id" component={VaultDetail} />
      <Route path="/vesting" component={VestingSchedules} />
      <Route path="/vesting/:id" component={VestingDetail} />
      <Route path="/liquidity" component={LiquidityLocks} />
      <Route path="/wallets" component={Wallets} />
      <Route path="/transactions" component={Transactions} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
