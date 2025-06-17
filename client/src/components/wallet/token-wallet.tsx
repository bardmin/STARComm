import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, ArrowUp, ArrowDown, Plus, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { authManager } from "@/lib/auth";

interface TokenTransaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
  status: string;
}

interface TokenWalletProps {
  onPurchase: () => void;
  onRedeem: () => void;
}

export default function TokenWallet({ onPurchase, onRedeem }: TokenWalletProps) {
  const { data: wallet } = useQuery({
    queryKey: ['/api/wallet'],
    enabled: authManager.getAuthState().isAuthenticated,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['/api/wallet/transactions'],
    enabled: authManager.getAuthState().isAuthenticated,
  });

  if (!wallet) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">Loading wallet...</p>
        </CardContent>
      </Card>
    );
  }

  const redemptionValue = wallet.balance * 0.6;

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
      case 'earn':
      case 'escrow_release':
        return <ArrowUp className="h-4 w-4 text-community-green" />;
      case 'spend':
      case 'escrow_hold':
      case 'redeem':
        return <ArrowDown className="h-4 w-4 text-cause-orange" />;
      default:
        return <Coins className="h-4 w-4 text-token-gold" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'purchase':
      case 'earn':
      case 'escrow_release':
        return 'text-community-green';
      case 'spend':
      case 'escrow_hold':
      case 'redeem':
        return 'text-cause-orange';
      default:
        return 'text-gray-600';
    }
  };

  const formatAmount = (amount: number, type: string) => {
    const sign = amount > 0 ? '+' : '';
    return `${sign}${amount} tokens`;
  };

  return (
    <div className="space-y-6">
      {/* Main Wallet Card */}
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Your Token Wallet</h3>
            <div className="flex items-center space-x-2">
              <Coins className="text-token-gold h-6 w-6" />
              <Badge className="bg-white/20 text-white hover:bg-white/20">
                Verified
              </Badge>
            </div>
          </div>

          <div className="mb-8">
            <div className="text-sm text-gray-300 mb-2">Available Balance</div>
            <div className="text-4xl font-bold text-token-gold mb-2">
              {wallet.balance.toLocaleString()}
            </div>
            <div className="text-sm text-gray-300">
              tokens (~R{redemptionValue.toFixed(2)} redemption value)
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white/10 rounded-xl p-4">
              <div className="text-sm text-gray-300 mb-1">Total Earned</div>
              <div className="text-xl font-bold text-community-green">
                {wallet.totalEarned.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">tokens earned</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <div className="text-sm text-gray-300 mb-1">In Escrow</div>
              <div className="text-xl font-bold text-yellow-400">
                {wallet.escrowBalance.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">tokens pending</div>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={onPurchase}
              className="w-full bg-token-gold text-white py-3 rounded-xl font-semibold hover:bg-yellow-600 transition-colors"
            >
              <Plus className="mr-2 h-5 w-5" />
              Purchase Tokens
            </Button>
            <Button
              onClick={onRedeem}
              variant="outline"
              className="w-full border-white/30 text-white py-3 rounded-xl font-semibold hover:bg-white/10 transition-colors"
            >
              <TrendingUp className="mr-2 h-5 w-5" />
              Redeem to Cash
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Token Packages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Token Packages</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { tokens: 100, price: 72, bonus: 0 },
              { tokens: 500, price: 350, bonus: 5 },
              { tokens: 1000, price: 680, bonus: 8 },
              { tokens: 2500, price: 1650, bonus: 12 },
            ].map((pkg) => (
              <Card
                key={pkg.tokens}
                className="hover:shadow-md transition-shadow cursor-pointer border-2 border-transparent hover:border-token-gold"
              >
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-token-gold mb-1">
                    {pkg.tokens.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 mb-2">tokens</div>
                  <div className="text-lg font-semibold text-gray-900 mb-1">
                    R{pkg.price.toFixed(2)}
                  </div>
                  {pkg.bonus > 0 && (
                    <div className="text-xs text-community-green font-medium">
                      {pkg.bonus}% bonus
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <Coins className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No transactions yet</h3>
              <p className="text-gray-600">Your transaction history will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 10).map((transaction: TokenTransaction) => (
                <div key={transaction.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full">
                      {getTransactionIcon(transaction.type)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {transaction.description}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${getTransactionColor(transaction.type)}`}>
                      {formatAmount(transaction.amount, transaction.type)}
                    </div>
                    <Badge
                      variant={transaction.status === 'completed' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
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
  );
}
