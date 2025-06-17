import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { User, Calendar, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

interface CauseCardProps {
  cause: {
    id: number;
    title: string;
    description: string;
    targetAmount: number;
    currentAmount: number;
    urgency: string;
    deadline?: string;
    status: string;
  };
  champion?: {
    firstName: string;
    lastName: string;
  };
  onDonate?: () => void;
}

export default function CauseCard({ cause, champion, onDonate }: CauseCardProps) {
  const progressPercentage = (cause.currentAmount / cause.targetAmount) * 100;
  const remainingAmount = cause.targetAmount - cause.currentAmount;
  
  const formatDeadline = (deadline?: string) => {
    if (!deadline) return null;
    const date = new Date(deadline);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "Deadline passed";
    if (diffDays === 0) return "Last day";
    if (diffDays === 1) return "1 day left";
    return `${diffDays} days left`;
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return 'bg-red-100 text-red-800 hover:bg-red-100';
      case 'high':
        return 'bg-orange-100 text-orange-800 hover:bg-orange-100';
      case 'normal':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';
      case 'low':
        return 'bg-green-100 text-green-800 hover:bg-green-100';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    }
  };

  const getUrgencyLabel = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return 'Urgent';
      case 'high':
        return 'High Priority';
      case 'normal':
        return 'Normal';
      case 'low':
        return 'Low Priority';
      default:
        return urgency;
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h4 className="text-lg font-semibold text-gray-900">
                {cause.title}
              </h4>
              <Badge className={getUrgencyColor(cause.urgency)}>
                {getUrgencyLabel(cause.urgency)}
              </Badge>
            </div>
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
              {cause.description}
            </p>
            <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
              {champion && (
                <span className="flex items-center">
                  <User className="h-4 w-4 mr-1" />
                  Verified by Champion {champion.firstName} {champion.lastName[0]}.
                </span>
              )}
              {cause.deadline && (
                <span className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  {formatDeadline(cause.deadline)}
                </span>
              )}
            </div>
          </div>
          {cause.urgency === 'urgent' && (
            <div className="text-red-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>
              {cause.currentAmount.toLocaleString()} / {cause.targetAmount.toLocaleString()} tokens raised
            </span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
          {remainingAmount > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              {remainingAmount.toLocaleString()} tokens needed
            </div>
          )}
        </div>

        <div className="flex space-x-3">
          {cause.status === 'active' && onDonate && (
            <Button
              onClick={onDonate}
              className="flex-1 bg-cause-orange text-white hover:bg-orange-700 transition-colors"
            >
              Donate Tokens
            </Button>
          )}
          <Link href={`/causes/${cause.id}`}>
            <Button variant="outline" className={cause.status === 'active' && onDonate ? '' : 'flex-1'}>
              View Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
