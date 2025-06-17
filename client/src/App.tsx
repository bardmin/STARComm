import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
// import { initGA } from "./lib/analytics";
// import { useAnalytics } from "./hooks/use-analytics";

// Pages
import Home from "@/pages/home";
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import Services from "@/pages/services/services";
import ServiceDetails from "@/pages/services/service-details";
import Booking from "@/pages/booking/booking";
import Wallet from "@/pages/wallet/wallet";
import Community from "@/pages/community/community";
import ProjectDetails from "@/pages/community/project-details";
import CauseDetails from "@/pages/community/cause-details";
import Messages from "@/pages/messages/messages";
import Profile from "@/pages/profile/profile";
import Admin from "@/pages/admin/admin";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/services" component={Services} />
      <Route path="/services/:id" component={ServiceDetails} />
      <Route path="/booking/:serviceId" component={Booking} />
      <Route path="/wallet" component={Wallet} />
      <Route path="/community" component={Community} />
      <Route path="/projects/:id" component={ProjectDetails} />
      <Route path="/causes/:id" component={CauseDetails} />
      <Route path="/messages" component={Messages} />
      <Route path="/profile" component={Profile} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
