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
import NotFound from "@/pages/not-found";
import GradientBackground from "@/components/GradientBackground";
import { Loader2 } from "lucide-react";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <GradientBackground />
        <div className="flex flex-col items-center space-y-4 relative z-10">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
          <p className="text-white">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Switch>
        {isAuthenticated ? (
          // Authenticated routes
          <>
            <Route path="/" component={Home} />
            <Route path="/admin" component={Admin} />
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
        <div className="relative min-h-screen">
          <GradientBackground />
          <Toaster />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
