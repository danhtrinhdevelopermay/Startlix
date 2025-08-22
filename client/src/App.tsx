import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Home from "@/pages/home";
import Admin from "@/pages/admin";
import Login from "@/pages/login";
import Register from "@/pages/register";
import RewardVideos from "@/pages/reward-videos";
import GetCredit from "@/pages/get-credit";
import NotFound from "@/pages/not-found";
import GradientBackground from "@/components/GradientBackground";
import { MD3FullPageLoading } from "@/components/md3-loading-indicator";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <MD3FullPageLoading 
        label="Đang tải" 
        data-testid="loading-authentication"
      />
    );
  }

  return (
    <div className="min-h-screen relative z-10">
      <Switch>
        {isAuthenticated ? (
          // Authenticated routes
          <>
            <Route path="/" component={Home} />
            <Route path="/admin" component={Admin} />
            <Route path="/reward-videos" component={RewardVideos} />
            <Route path="/get-credit" component={GetCredit} />
            {/* Redirect to home if trying to access login/register while authenticated */}
            <Route path="/login" component={Home} />
            <Route path="/register" component={Home} />
          </>
        ) : (
          // Non-authenticated routes
          <>
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
            {/* Redirect to login for all other routes when not authenticated */}
            <Route path="/" component={Login} />
            <Route path="/admin" component={Login} />
            {/* Redirect all unmatched routes to login */}
            <Route component={Login} />
          </>
        )}
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="relative min-h-screen bg-[var(--fluent-neutral-background-canvas)] text-[var(--fluent-neutral-foreground-1)]">
          <GradientBackground />
          <Toaster />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
