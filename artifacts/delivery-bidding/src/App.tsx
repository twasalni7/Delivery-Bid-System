import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
// We will create these pages next
import ClientDashboard from "@/pages/client/ClientDashboard";
import CreateRequest from "@/pages/client/CreateRequest";
import RequestDetails from "@/pages/client/RequestDetails";
import DriverLogin from "@/pages/driver/DriverLogin";
import DriverDashboard from "@/pages/driver/DriverDashboard";
import SubmitOffer from "@/pages/driver/SubmitOffer";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminRequests from "@/pages/admin/AdminRequests";
import AdminDrivers from "@/pages/admin/AdminDrivers";
import AdminOffers from "@/pages/admin/AdminOffers";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      
      <Route path="/client" component={ClientDashboard} />
      <Route path="/client/request/new" component={CreateRequest} />
      <Route path="/client/request/:id" component={RequestDetails} />
      
      <Route path="/driver" component={DriverLogin} />
      <Route path="/driver/dashboard" component={DriverDashboard} />
      <Route path="/driver/request/:id" component={SubmitOffer} />
      
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/requests" component={AdminRequests} />
      <Route path="/admin/drivers" component={AdminDrivers} />
      <Route path="/admin/offers" component={AdminOffers} />
      
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
