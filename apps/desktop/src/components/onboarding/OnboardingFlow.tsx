import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { cn } from "@/utils/tailwind";
import { trpc } from "@/lib/trpc";
import type { AppServer } from "@/hooks/useAppsFilter";
import iconImage from "@/assets/images/icon.png";

type OnboardingStep = 1 | 2 | 3;

export function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const handleComplete = () => {
    localStorage.setItem("hasSeenOnboarding", "true");
    navigate({ to: "/" });
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as OnboardingStep);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as OnboardingStep);
    }
  };

  const handleAppToggle = (appId: string) => {
    setSelectedApps((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        next.add(appId);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto px-6 relative">
      {/* Skip button - bottom right */}
      {currentStep === 2 && (
        <Button
          variant="outline"
          onClick={handleSkip}
          className="absolute bottom-4 right-6 rounded-md"
        >
          Skip
        </Button>
      )}
      
      {/* Main content - centered */}
      <div className="flex-1 flex items-center justify-center">
        {/* Step 1: Welcome */}
        {currentStep === 1 && (
          <div
            className={cn(
              "flex flex-col items-center justify-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700"
            )}
          >
            <div className="relative">
              <img 
                src={iconImage} 
                alt="Cortex" 
                className="h-24 w-24 rounded-lg object-contain animate-in zoom-in duration-500 delay-300" 
              />
            </div>
            <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
              <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Cortex
              </h1>
              <p className="text-xl text-muted-foreground max-w-md">
                Your whole life in one app
              </p>
            </div>
            <Button
              onClick={handleNext}
              size="lg"
              className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-700"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Connect Apps */}
        {currentStep === 2 && (
          <div
            className={cn(
              "flex flex-col items-center justify-center space-y-8 w-full animate-in fade-in slide-in-from-right-4 duration-500"
            )}
          >
            <div className="text-center space-y-2">
              <h2 className="text-4xl font-bold">Connect Your Apps</h2>
              <p className="text-lg text-muted-foreground">
                Link your favorite apps to see everything in one place
              </p>
            </div>
            <div className="w-full max-w-2xl">
              <ConnectAppsStep 
                selectedApps={selectedApps}
                onAppToggle={handleAppToggle}
              />
            </div>
            <div className="flex justify-center items-center gap-3">
              <Button
                variant="outline"
                onClick={handleBack}
                className="rounded-md"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button 
                onClick={handleNext}
                disabled={selectedApps.size === 0}
                className="rounded-md"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {currentStep === 3 && (
          <div
            className={cn(
              "flex flex-col items-center justify-center space-y-8 animate-in fade-in slide-in-from-right-4 duration-500"
            )}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full" />
              <div className="relative bg-green-500/10 p-8 rounded-3xl border border-green-500/20">
                <CheckCircle2 className="h-24 w-24 text-green-500 animate-in zoom-in duration-500" />
              </div>
            </div>
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-bold">You're All Set!</h2>
              <p className="text-lg text-muted-foreground max-w-md">
                Start exploring your unified timeline and connect more apps anytime from Settings.
              </p>
            </div>
            <Button onClick={handleComplete} size="lg" className="mt-4">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Step Indicators - fixed at bottom */}
      <div className="flex justify-center gap-2 pb-4">
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className={cn(
              "h-2 w-2 rounded-full transition-all duration-300",
              currentStep === step
                ? "bg-primary w-8"
                : "bg-muted-foreground/30"
            )}
          />
        ))}
      </div>
    </div>
  );
}

function ConnectAppsStep({ 
  selectedApps, 
  onAppToggle 
}: { 
  selectedApps: Set<string>; 
  onAppToggle: (appId: string) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading } = (trpc as any).apps.getAvailableServers.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const apps = data?.servers || [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-24 rounded-lg border bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {apps.slice(0, 6).map((app: AppServer) => {
        const isSelected = selectedApps.has(app.id);
        return (
          <button
            key={app.id}
            type="button"
            onClick={() => onAppToggle(app.id)}
            className={cn(
              "group relative flex flex-col items-center justify-center p-6 rounded-xl border transition-all duration-200 cursor-pointer",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/20"
            )}
          >
            {app.iconUrl && (
              <img
                src={app.iconUrl}
                alt={app.name}
                className="h-12 w-12 rounded-lg object-contain mb-3"
              />
            )}
            <p className="text-sm font-medium text-center">{app.name}</p>
            {isSelected && (
              <div className="absolute top-2 right-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
              </div>
            )}
            {app.connection?.status === "connected" && !isSelected && (
              <div className="absolute top-2 right-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
              </div>
            )}
          </button>
        );
      })}
      {apps.length === 0 && (
        <div className="col-span-full p-8 rounded-lg border bg-card text-center">
          <p className="text-sm text-muted-foreground">No apps available</p>
        </div>
      )}
    </div>
  );
}

