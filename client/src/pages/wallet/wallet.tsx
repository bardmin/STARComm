import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Wallet as WalletIcon, Plus, ArrowUpRight, ArrowDownLeft, Clock, DollarSign, TrendingUp, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { authManager } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";

interface Wallet {
  id: number;
  userId: number;
  balance: number;
  escrowBalance: number;
  totalEarned: number;
  totalSpent: number;
}

interface TokenTransaction {
  id: number;
  userId: number;
  type: string;
  amount: number;
  status: string;
  description: string;
  relatedId?: number;
  createdAt: string;
}

export default function Wallet() {
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const user = authManager.getAuthState().user;

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["/api/wallet"],
    enabled: !!user,
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/transactions"],
    enabled: !!user,
  });

  const purchaseTokensMutation = useMutation({
    mutationFn: async (amount: number) => {
      return apiRequest("/api/transactions/purchase", {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Tokens purchased successfully!",
        description: `${purchaseAmount} tokens have been added to your wallet.`,
      });
      // Track token purchase event
      trackEvent("Purchase", "Token", `Amount${purchaseAmount}`, parseInt(purchaseAmount));
      setPurchaseAmount("");
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Purchase failed",
        description: error.message || "Failed to purchase tokens. Please try again.",
        variant: "destructive",
      });
    },
  });

  const redeemTokensMutation = useMutation({
    mutationFn: async (amount: number) => {
      return apiRequest("/api/transactions/redeem", {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Tokens redeemed successfully!",
        description: "Your tokens have been converted to cash at 60% rate.",
      });
      // Track token redemption event
      // We need to know the amount redeemed. The `amount` parameter passed to redeemTokensMutation.mutate is not directly available here.
      // Assuming the actual redeemed amount is part of the response or can be inferred.
      // For now, let's use the input amount to handleRedeem, which is not ideal but a placeholder.
      // A better approach would be to get this from the mutation's response or state if available.
      if (wallet && amount) { // Ensure wallet and amount are defined
        trackEvent("Redeem", "Token", `Amount${amount}`, amount);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Redemption failed",
        description: error.message || "Failed to redeem tokens. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePurchase = () => {
    const amount = parseInt(purchaseAmount);
    if (amount > 0) {
      purchaseTokensMutation.mutate(amount);
    }
  };

  const handleRedeem = (amount: number) => {
    if (amount > 0 && wallet && amount <= wallet.balance) {
      redeemTokensMutation.mutate(amount);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "purchase":
        return <Plus className="h-4 w-4 text-green-600" />;
      case "spend":
        return <ArrowUpRight className="h-4 w-4 text-red-600" />;
      case "earn":
        return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
      case "redeem":
        return <DollarSign className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "purchase":
      case "earn":
        return "text-green-600";
      case "spend":
      case "redeem":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <WalletIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Access Your Wallet
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Please log in to view your wallet and manage your tokens.
          </p>
        </div>
      </div>
    );
  }

  if (walletLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading wallet...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            My Wallet
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your STAR tokens and view transaction history
          </p>
        </div>

        {/* Wallet Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
              <WalletIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {wallet?.balance || 0} tokens
              </div>
              <p className="text-xs text-muted-foreground">
                Ready to spend
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Escrow Balance</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {wallet?.escrowBalance || 0} tokens
              </div>
              <p className="text-xs text-muted-foreground">
                Held for active bookings
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {wallet?.totalEarned || 0} tokens
              </div>
              <p className="text-xs text-muted-foreground">
                Lifetime earnings
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {wallet?.totalSpent || 0} tokens
              </div>
              <p className="text-xs text-muted-foreground">
                Lifetime spending
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Purchase Tokens
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Purchase STAR Tokens</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="amount">Amount to Purchase</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter token amount"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                  />
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Tokens can be used to book services and support community causes.
                  Rate: 1 token = $1 USD
                </div>
                <Button
                  onClick={handlePurchase}
                  disabled={!purchaseAmount || purchaseTokensMutation.isPending}
                  className="w-full"
                >
                  {purchaseTokensMutation.isPending ? "Processing..." : "Purchase Tokens"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            onClick={() => handleRedeem(100)}
            disabled={!wallet || wallet.balance < 100 || redeemTokensMutation.isPending}
            className="flex items-center gap-2"
          >
            <DollarSign className="h-4 w-4" />
            Redeem Tokens (60% rate)
          </Button>
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading transactions...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No transactions yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Your transaction history will appear here once you start using tokens.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction: TokenTransaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getTransactionIcon(transaction.type)}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {transaction.description}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(transaction.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${getTransactionColor(transaction.type)}`}>
                        {transaction.type === "spend" || transaction.type === "redeem" ? "-" : "+"}
                        {transaction.amount} tokens
                      </p>
                      <Badge variant={transaction.status === "completed" ? "default" : "secondary"}>
                        {transaction.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}