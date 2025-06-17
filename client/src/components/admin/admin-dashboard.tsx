import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Bolt, Coins, Heart, ArrowUp, Check, X, UserCheck, BarChart3, Settings, Mail } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface AdminStats {
  totalUsers: number;
  activeServices: number;
  totalBookings: number;
  activeProjects: number;
  activeCauses: number;
  completedBookings: number;
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
  });

  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
  });

  // Mock data for pending approvals and recent activity
  const pendingApprovals = [
    { id: 1, type: 'user', name: 'John Doe', role: 'Service Provider' },
    { id: 2, type: 'cause', name: 'Help Family Williams', role: 'STAR Cause' },
  ];

  const recentActivity = [
    { id: 1, type: 'user', description: 'New user registration: Sarah M.', time: '2 minutes ago' },
    { id: 2, type: 'booking', description: 'Service completed: House cleaning', time: '15 minutes ago' },
    { id: 3, type: 'token', description: 'Token purchase: 500 tokens', time: '1 hour ago' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-8 bg-gray-200 rounded mb-4"></div>
                <div className="h-12 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <Users className="h-4 w-4 text-primary-blue" />;
      case 'booking':
        return <Check className="h-4 w-4 text-community-green" />;
      case 'token':
        return <Coins className="h-4 w-4 text-token-gold" />;
      default:
        return <Users className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-primary-blue to-primary-blue-dark text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Total Users</h3>
              <Users className="h-8 w-8 text-blue-200" />
            </div>
            <div className="text-3xl font-bold mb-2">
              {stats?.totalUsers.toLocaleString() || '0'}
            </div>
            <div className="text-sm text-blue-200 flex items-center">
              <ArrowUp className="h-4 w-4 mr-1" />
              12% this month
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-community-green to-green-700 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Active Services</h3>
              <Bolt className="h-8 w-8 text-green-200" />
            </div>
            <div className="text-3xl font-bold mb-2">
              {stats?.activeServices.toLocaleString() || '0'}
            </div>
            <div className="text-sm text-green-200 flex items-center">
              <ArrowUp className="h-4 w-4 mr-1" />
              8% this month
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-token-gold to-yellow-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Total Bookings</h3>
              <Coins className="h-8 w-8 text-yellow-200" />
            </div>
            <div className="text-3xl font-bold mb-2">
              {stats?.totalBookings.toLocaleString() || '0'}
            </div>
            <div className="text-sm text-yellow-200 flex items-center">
              <ArrowUp className="h-4 w-4 mr-1" />
              23% this month
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cause-orange to-red-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Community Impact</h3>
              <Heart className="h-8 w-8 text-orange-200" />
            </div>
            <div className="text-3xl font-bold mb-2">
              {((stats?.activeProjects || 0) + (stats?.activeCauses || 0)).toString()}
            </div>
            <div className="text-sm text-orange-200 flex items-center">
              <ArrowUp className="h-4 w-4 mr-1" />
              Projects & Causes
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Pending Approvals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {pendingApprovals.length === 0 ? (
                <div className="text-center py-8">
                  <Check className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">All caught up!</p>
                </div>
              ) : (
                pendingApprovals.map((approval) => (
                  <div key={approval.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        approval.type === 'cause' ? 'bg-cause-orange' : 'bg-primary-blue'
                      }`}>
                        {approval.type === 'cause' ? (
                          <Heart className="h-4 w-4 text-white" />
                        ) : (
                          <Users className="h-4 w-4 text-white" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{approval.name}</h4>
                        <p className="text-sm text-gray-600">{approval.role}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="ghost" className="text-community-green hover:bg-green-50">
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-between"
              >
                <div className="flex items-center space-x-3">
                  <UserCheck className="h-4 w-4 text-primary-blue" />
                  <span>Verify Users</span>
                </div>
                <span className="text-gray-400">→</span>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between"
              >
                <div className="flex items-center space-x-3">
                  <BarChart3 className="h-4 w-4 text-community-green" />
                  <span>View Reports</span>
                </div>
                <span className="text-gray-400">→</span>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between"
              >
                <div className="flex items-center space-x-3">
                  <Settings className="h-4 w-4 text-token-gold" />
                  <span>Platform Settings</span>
                </div>
                <span className="text-gray-400">→</span>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between"
              >
                <div className="flex items-center space-x-3">
                  <Mail className="h-4 w-4 text-cause-orange" />
                  <span>Send Notifications</span>
                </div>
                <span className="text-gray-400">→</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            Recent Users
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(0, 5).map((user: any) => (
                  <tr key={user.id} className="border-b">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary-blue to-community-green rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-semibold">
                            {user.firstName[0]}{user.lastName[0]}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">
                        {user.role.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={user.isVerified ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'}>
                        {user.isVerified ? 'Verified' : 'Pending'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
