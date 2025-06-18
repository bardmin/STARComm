import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Calendar, Users, Target, ArrowLeft, Heart } from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { authManager } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";

export default function ProjectDetails() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const [contributionAmount, setContributionAmount] = useState("");
  const { toast } = useToast();
  const projectId = parseInt(params.id || "0");

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["/api/star-projects", projectId],
    enabled: !!projectId,
  });

  const { data: creator, isLoading: creatorLoading } = useQuery({
    queryKey: ["/api/users", project?.creatorId],
    enabled: !!project?.creatorId,
  });

  const { data: wallet } = useQuery({
    queryKey: ["/api/wallet"],
    enabled: authManager.isAuthenticated(),
  });

  const contributeMutation = useMutation({
    mutationFn: async (amount: number) => {
      return apiRequest(`/api/star-projects/${projectId}/contribute`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/star-projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      toast({
        title: "Contribution Successful!",
        description: `You contributed ${contributionAmount} tokens to this project.`,
      });
      // Track Project Contribute event
      trackEvent("Contribute", "Project", `ProjectID_${projectId}, Amount${contributionAmount}`, parseInt(contributionAmount));
      setContributionAmount("");
    },
    onError: (error: Error) => {
      toast({
        title: "Contribution Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (projectLoading || creatorLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!project || !creator) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Project Not Found</h2>
          <p className="text-gray-600 mb-4">The project you're looking for doesn't exist.</p>
          <Button onClick={() => setLocation("/community")}>
            Back to Community
          </Button>
        </div>
      </div>
    );
  }

  const progressPercentage = Math.min((project.currentAmount / project.targetAmount) * 100, 100);
  const daysRemaining = project.deadline 
    ? Math.max(0, Math.ceil((new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const handleContribute = () => {
    const amount = parseInt(contributionAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid contribution amount.",
        variant: "destructive",
      });
      return;
    }

    if (!authManager.isAuthenticated()) {
      toast({
        title: "Authentication Required",
        description: "Please log in to contribute to projects.",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }

    if (!wallet || (wallet.balance || 0) < amount) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough tokens to make this contribution.",
        variant: "destructive",
      });
      return;
    }

    contributeMutation.mutate(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="max-w-6xl mx-auto p-4 pt-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => setLocation("/community")}
          className="mb-6 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Community Hub
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Header */}
            <Card>
              <CardContent className="p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900 mb-3">{project.title}</h1>
                    <div className="flex items-center space-x-4 text-gray-600 mb-4">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        <span className="text-sm">{project.location}</span>
                      </div>
                      {daysRemaining !== null && (
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          <span className="text-sm">{daysRemaining} days remaining</span>
                        </div>
                      )}
                      <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                        {project.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <p className="text-gray-600 leading-relaxed mb-6">{project.description}</p>

                {/* Progress Section */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Funding Progress</h3>
                    <span className="text-sm text-gray-600">
                      {progressPercentage.toFixed(1)}% funded
                    </span>
                  </div>
                  
                  <Progress value={progressPercentage} className="mb-4" />
                  
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center space-x-4">
                      <div>
                        <span className="font-semibold text-token-gold">{project.currentAmount}</span>
                        <span className="text-gray-600"> tokens raised</span>
                      </div>
                      <div>
                        <span className="text-gray-600">of </span>
                        <span className="font-semibold">{project.targetAmount} tokens goal</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Project Creator */}
            <Card>
              <CardHeader>
                <CardTitle>Project Creator</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-community-green text-white text-lg">
                      {creator.firstName.charAt(0)}{creator.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {creator.firstName} {creator.lastName}
                    </h3>
                    <p className="text-sm text-gray-600 capitalize">
                      {creator.role.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contribution Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Heart className="h-5 w-5 mr-2 text-red-500" />
                  Support This Project
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-token-gold mb-1">
                    {project.targetAmount - project.currentAmount} tokens needed
                  </div>
                  <div className="text-sm text-gray-500 mb-4">
                    to reach the goal
                  </div>
                </div>

                {authManager.isAuthenticated() ? (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="contribution" className="block text-sm font-medium text-gray-700 mb-1">
                        Contribution Amount (tokens)
                      </label>
                      <Input
                        id="contribution"
                        type="number"
                        placeholder="Enter amount"
                        value={contributionAmount}
                        onChange={(e) => setContributionAmount(e.target.value)}
                        min="1"
                      />
                    </div>
                    
                    {wallet && (
                      <div className="text-sm text-gray-600">
                        Your balance: <span className="font-medium text-token-gold">{wallet.balance || 0} tokens</span>
                      </div>
                    )}

                    <Button
                      onClick={handleContribute}
                      disabled={contributeMutation.isPending || !contributionAmount}
                      className="w-full bg-community-green text-white py-3 text-lg font-semibold hover:bg-green-700"
                    >
                      {contributeMutation.isPending ? 'Contributing...' : 'Contribute Now'}
                    </Button>
                  </div>
                ) : (
                  <div className="text-center space-y-3">
                    <p className="text-sm text-gray-600">
                      Sign in to support this project
                    </p>
                    <Button
                      onClick={() => setLocation("/login")}
                      className="w-full bg-primary-blue text-white"
                    >
                      Sign In to Contribute
                    </Button>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-center text-sm">
                    <div>
                      <div className="font-semibold text-gray-900">{project.currentAmount}</div>
                      <div className="text-gray-600">Raised</div>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{project.targetAmount}</div>
                      <div className="text-gray-600">Goal</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Project Stats</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status</span>
                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                      {project.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created</span>
                    <span className="font-medium">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {project.deadline && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Deadline</span>
                      <span className="font-medium">
                        {new Date(project.deadline).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium">{progressPercentage.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}