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
import { useInfiniteQuery } from "@tanstack/react-query"; // For pagination

// Updated Wallet interface
export interface Wallet {
  id: string; // User's Firebase UID (doc ID)
  userId: string;
  balance: number;
  escrowBalance: number;
  totalEarned?: number;
  totalSpent?: number;
  totalPurchased?: number; // Added
  createdAt: any; // Firestore Timestamp or ISO string from server
  updatedAt: any; // Firestore Timestamp or ISO string from server
  lastTransactionAt?: any; // Firestore Timestamp or ISO string from server
}

// Updated TokenTransaction interface
export interface TokenTransaction {
  id: string; // Firestore Document ID
  userId: string;
  transactionType: string;
  amount: number; // Absolute amount value of the transaction leg
  currency?: string;
  description: string;
  referenceId?: string | null;
  status?: string;
  metadata?: {
    balanceImpact?: number;  // Actual change to main balance (+/-)
    escrowImpact?: number;   // Actual change to escrow balance (+/-)
    initiator?: string;
  };
  createdAt: any; // Firestore Timestamp or ISO string from server
  processedAt?: any; // Firestore Timestamp or ISO string from server
  balanceBefore?: number;
  balanceAfter?: number;
  escrowBalanceBefore?: number;
  escrowBalanceAfter?: number;
}


export default function WalletPage() { // Renamed component
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const user = authManager.getAuthState().user;

  const { data: wallet, isLoading: walletLoading, error: walletError } = useQuery<Wallet>({
    queryKey: ["wallet", user?.id], // Use a more specific query key
    queryFn: async () => apiRequest("GET", "/api/wallet").then(res => res.json()),
    enabled: !!user,
  });

  const {
    data: transactionPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: transactionsLoading,
    error: transactionsError
  } = useInfiniteQuery<{ transactions: TokenTransaction[], nextCursor: string | null }>({
    queryKey: ['wallet-transactions', user?.id],
    queryFn: async ({ pageParam = null }) => {
      let url = "/api/wallet/transactions?limit=10";
      if (pageParam) {
        url += `&lastVisible=${pageParam}`;
      }
      const res = await apiRequest("GET", url);
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    initialPageParam: null, // Explicitly set initialPageParam
    enabled: !!user,
  });

  const allTransactions = transactionPages?.pages.flatMap(page => page.transactions) || [];

  const purchaseTokensMutation = useMutation({
    mutationFn: async (amount: number) => {
      return apiRequest("/api/transactions/purchase", {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet", user?.id] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions', user?.id] });
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
      queryClient.invalidateQueries({ queryKey: ["wallet", user?.id] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions', user?.id] });
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

  const getTransactionIcon = (transactionType: string) => {
    switch (transactionType) {
      case 'purchase':
      case 'admin_credit':
      case 'bonus':
        return <Plus className="h-4 w-4 text-green-500" />;
      case 'earn_service_fee':
      case 'escrow_release': // When released to this user (provider)
      case 'refund_escrow': // When refunded to this user (resident)
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case 'spend_service_fee': // Initial spend to escrow
      case 'escrow_hold':
      case 'spend_project_contribution':
      case 'spend_cause_donation':
      case 'fee_platform':
      case 'admin_debit':
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case 'payout_redeem':
        return <DollarSign className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTransactionAmountAndColor = (transaction: TokenTransaction) => {
    const balanceImpact = transaction.metadata?.balanceImpact || 0;
    // Escrow impact display might need more context or be shown differently
    // For simplicity, focusing on balanceImpact for +/- display color

    if (balanceImpact > 0) {
      return { text: `+${balanceImpact}`, color: 'text-green-500' };
    } else if (balanceImpact < 0) {
      return { text: `${balanceImpact}`, color: 'text-red-500' };
    } else if (transaction.metadata?.escrowImpact && transaction.metadata.escrowImpact !== 0) {
        // If only escrow changed, show the escrow impact amount
        const impact = transaction.metadata.escrowImpact;
        return { text: `${impact > 0 ? '+' : ''}${impact} (escrow)`, color: 'text-orange-500' };
    }
    return { text: `${transaction.amount}`, color: 'text-gray-500' }; // Fallback using raw amount if no impact
  };

  const formatDate = (timestamp: any) => { // Can be Firestore Timestamp or ISO string
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
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
              <Loader2 className="h-12 w-12 animate-spin text-primary-blue mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading wallet...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (walletError) {
    return (
         <div className="container mx-auto px-4 py-8 text-center">
            <Alert variant="destructive">
                <AlertDescription>Error loading wallet: {(walletError as Error).message}</AlertDescription>
            </Alert>
         </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">My Wallet</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your STAR tokens and view transaction history</p>
        </div>

        {/* Wallet Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
              <WalletIcon className="h-5 w-5 text-green-100" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{wallet?.balance || 0}</div>
              <p className="text-xs text-green-100">tokens ready to use</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-amber-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Escrow Balance</CardTitle>
              <Shield className="h-5 w-5 text-orange-100" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{wallet?.escrowBalance || 0}</div>
              <p className="text-xs text-orange-100">tokens held for active bookings</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-500 to-sky-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
              <TrendingUp className="h-5 w-5 text-blue-100" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{wallet?.totalEarned || 0}</div>
              <p className="text-xs text-blue-100">tokens earned lifetime</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-violet-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Purchased</CardTitle> {/* Changed from Total Spent */}
              <Plus className="h-5 w-5 text-purple-100" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{wallet?.totalPurchased || 0}</div> {/* Using totalPurchased */}
              <p className="text-xs text-purple-100">tokens purchased lifetime</p>
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
            {transactionsLoading && !isFetchingNextPage && <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary-blue mx-auto" /> <p>Loading transactions...</p></div>}
            {transactionsError && <Alert variant="destructive"><AlertDescription>Error loading transactions: {(transactionsError as Error).message}</AlertDescription></Alert>}

            {(!transactionsLoading || allTransactions.length > 0) && allTransactions.length === 0 && (
              <div className="text-center py-8">
                <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No transactions yet</h3>
                <p className="text-gray-600 dark:text-gray-400">Your transaction history will appear here.</p>
              </div>
            )}

            {allTransactions.length > 0 && (
              <div className="space-y-3">
                {allTransactions.map((transaction: TokenTransaction) => {
                  const amountDisplay = getTransactionAmountAndColor(transaction);
                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                           {getTransactionIcon(transaction.transactionType)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{transaction.description}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(transaction.createdAt)}
                            {transaction.referenceId && <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(Ref: {transaction.referenceId.substring(0,8)}...)</span>}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${amountDisplay.color}`}>
                          {amountDisplay.text} tokens
                        </p>
                        <Badge variant={transaction.status === "completed" ? "default" : "secondary"} className="text-xs capitalize bg-opacity-80">
                          {transaction.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {hasNextPage && (
              <Button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                variant="outline"
                className="w-full mt-6"
              >
                {isFetchingNextPage ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading more...</> : 'Load More Transactions'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}