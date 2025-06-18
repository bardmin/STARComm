import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, AlertTriangle, Heart, ArrowLeft, Target } from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { authManager } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";

export default function CauseDetails() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const [donationAmount, setDonationAmount] = useState("");
  const { toast } = useToast();
  const causeId = parseInt(params.id || "0");

  const { data: cause, isLoading: causeLoading } = useQuery({
    queryKey: ["/api/star-causes", causeId],
    enabled: !!causeId,
  });

  const { data: champion, isLoading: championLoading } = useQuery({
    queryKey: ["/api/users", cause?.championId],
    enabled: !!cause?.championId,
  });

  const { data: wallet } = useQuery({
    queryKey: ["/api/wallet"],
    enabled: authManager.isAuthenticated(),
  });

  const donateMutation = useMutation({
    mutationFn: async (amount: number) => {
      return apiRequest(`/api/star-causes/${causeId}/donate`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/star-causes", causeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      toast({
        title: "Donation Successful!",
        description: `You donated ${donationAmount} tokens to this cause.`,
      });
      // Track Cause Donate event
      trackEvent("Donate", "Cause", `CauseID_${causeId}, Amount${donationAmount}`, parseInt(donationAmount));
      setDonationAmount("");
    },
    onError: (error: Error) => {
      toast({
        title: "Donation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (causeLoading || championLoading) {
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

  if (!cause || !champion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Cause Not Found</h2>
          <p className="text-gray-600 mb-4">The cause you're looking for doesn't exist.</p>
          <Button onClick={() => setLocation("/community")}>
            Back to Community
          </Button>
        </div>
      </div>
    );
  }

  const progressPercentage = Math.min((cause.currentAmount / cause.targetAmount) * 100, 100);
  const daysRemaining = cause.deadline 
    ? Math.max(0, Math.ceil((new Date(cause.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const getUrgencyColor = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case 'critical': return <AlertTriangle className="h-4 w-4 mr-1" />;
      case 'high': return <Clock className="h-4 w-4 mr-1" />;
      default: return <Target className="h-4 w-4 mr-1" />;
    }
  };

  const handleDonate = () => {
    const amount = parseInt(donationAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid donation amount.",
        variant: "destructive",
      });
      return;
    }

    if (!authManager.isAuthenticated()) {
      toast({
        title: "Authentication Required",
        description: "Please log in to donate to causes.",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }

    if (!wallet || (wallet.balance || 0) < amount) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough tokens to make this donation.",
        variant: "destructive",
      });
      return;
    }

    donateMutation.mutate(amount);
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
            {/* Cause Header */}
            <Card>
              <CardContent className="p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900 mb-3">{cause.title}</h1>
                    <div className="flex items-center space-x-4 mb-4">
                      <Badge className={getUrgencyColor(cause.urgency)} variant="outline">
                        {getUrgencyIcon(cause.urgency)}
                        {cause.urgency} urgency
                      </Badge>
                      {daysRemaining !== null && (
                        <div className="flex items-center text-gray-600">
                          <Clock className="h-4 w-4 mr-1" />
                          <span className="text-sm">{daysRemaining} days remaining</span>
                        </div>
                      )}
                      <Badge variant={cause.status === 'active' ? 'default' : 'secondary'}>
                        {cause.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <p className="text-gray-600 leading-relaxed mb-6">{cause.description}</p>

                {/* Progress Section */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Donation Progress</h3>
                    <span className="text-sm text-gray-600">
                      {progressPercentage.toFixed(1)}% of goal reached
                    </span>
                  </div>
                  
                  <Progress value={progressPercentage} className="mb-4" />
                  
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center space-x-4">
                      <div>
                        <span className="font-semibold text-token-gold">{cause.currentAmount}</span>
                        <span className="text-gray-600"> tokens raised</span>
                      </div>
                      <div>
                        <span className="text-gray-600">of </span>
                        <span className="font-semibold">{cause.targetAmount} tokens needed</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Urgency Notice */}
                {cause.urgency === 'critical' && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-red-900 mb-1">Critical Need</h4>
                        <p className="text-red-700 text-sm">
                          This cause requires immediate attention. Your donation can make an urgent difference.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cause Champion */}
            <Card>
              <CardHeader>
                <CardTitle>Cause Champion</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-purple-600 text-white text-lg">
                      {champion.firstName.charAt(0)}{champion.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {champion.firstName} {champion.lastName}
                    </h3>
                    <p className="text-sm text-gray-600 capitalize">
                      {champion.role.replace('_', ' ')}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Leading this cause to help our community
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Donation Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Heart className="h-5 w-5 mr-2 text-red-500" />
                  Support This Cause
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-token-gold mb-1">
                    {cause.targetAmount - cause.currentAmount} tokens needed
                  </div>
                  <div className="text-sm text-gray-500 mb-4">
                    to reach the goal
                  </div>
                </div>

                {authManager.isAuthenticated() ? (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="donation" className="block text-sm font-medium text-gray-700 mb-1">
                        Donation Amount (tokens)
                      </label>
                      <Input
                        id="donation"
                        type="number"
                        placeholder="Enter amount"
                        value={donationAmount}
                        onChange={(e) => setDonationAmount(e.target.value)}
                        min="1"
                      />
                    </div>
                    
                    {wallet && (
                      <div className="text-sm text-gray-600">
                        Your balance: <span className="font-medium text-token-gold">{wallet.balance || 0} tokens</span>
                      </div>
                    )}

                    <Button
                      onClick={handleDonate}
                      disabled={donateMutation.isPending || !donationAmount}
                      className="w-full bg-red-600 text-white py-3 text-lg font-semibold hover:bg-red-700"
                    >
                      {donateMutation.isPending ? 'Donating...' : 'Donate Now'}
                    </Button>

                    <div className="text-xs text-gray-500 text-center">
                      100% of your donation goes directly to the cause
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-3">
                    <p className="text-sm text-gray-600">
                      Sign in to support this cause
                    </p>
                    <Button
                      onClick={() => setLocation("/login")}
                      className="w-full bg-primary-blue text-white"
                    >
                      Sign In to Donate
                    </Button>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-center text-sm">
                    <div>
                      <div className="font-semibold text-gray-900">{cause.currentAmount}</div>
                      <div className="text-gray-600">Donated</div>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{cause.targetAmount}</div>
                      <div className="text-gray-600">Goal</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Cause Details</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Urgency</span>
                    <Badge className={getUrgencyColor(cause.urgency)} variant="outline">
                      {cause.urgency}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status</span>
                    <Badge variant={cause.status === 'active' ? 'default' : 'secondary'}>
                      {cause.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created</span>
                    <span className="font-medium">
                      {new Date(cause.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {cause.deadline && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Deadline</span>
                      <span className="font-medium">
                        {new Date(cause.deadline).toLocaleDateString()}
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

            {/* Impact Information */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Your Impact</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>Every token donated makes a real difference:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• Direct support to those in need</li>
                    <li>• Transparent fund allocation</li>
                    <li>• Regular progress updates</li>
                    <li>• Community-verified impact</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}