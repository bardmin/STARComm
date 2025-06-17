import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Calendar, MapPin } from "lucide-react";
import { Link } from "wouter";

interface ProjectCardProps {
  project: {
    id: number;
    title: string;
    description: string;
    targetAmount: number;
    currentAmount: number;
    location?: string;
    deadline?: string;
    status: string;
  };
  contributorCount?: number;
  onContribute?: () => void;
}

export default function ProjectCard({ project, contributorCount = 0, onContribute }: ProjectCardProps) {
  const progressPercentage = (project.currentAmount / project.targetAmount) * 100;
  const remainingAmount = project.targetAmount - project.currentAmount;
  
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-community-green/10 text-community-green hover:bg-community-green/10';
      case 'completed':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'cancelled':
        return 'bg-red-100 text-red-800 hover:bg-red-100';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              {project.title}
            </h4>
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
              {project.description}
            </p>
            <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
              <span className="flex items-center">
                <Users className="h-4 w-4 mr-1" />
                {contributorCount} contributors
              </span>
              {project.deadline && (
                <span className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  {formatDeadline(project.deadline)}
                </span>
              )}
              {project.location && (
                <span className="flex items-center">
                  <MapPin className="h-4 w-4 mr-1" />
                  {project.location}
                </span>
              )}
            </div>
          </div>
          <Badge className={getStatusColor(project.status)}>
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </Badge>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>
              {project.currentAmount.toLocaleString()} / {project.targetAmount.toLocaleString()} tokens raised
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
          {project.status === 'active' && onContribute && (
            <Button
              onClick={onContribute}
              className="flex-1 bg-community-green text-white hover:bg-green-700 transition-colors"
            >
              Contribute Tokens
            </Button>
          )}
          <Link href={`/projects/${project.id}`}>
            <Button variant="outline" className={project.status === 'active' && onContribute ? '' : 'flex-1'}>
              View Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
