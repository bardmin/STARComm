import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, Filter, Heart, Users, Target, Calendar, MapPin, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StarProject {
  id: number;
  title: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  status: string;
  location?: string;
  deadline?: string;
  creatorId: number;
}

interface StarCause {
  id: number;
  title: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  urgency: string;
  status: string;
  deadline?: string;
  championId: number;
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  profileImage?: string;
}

export default function Community() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [activeTab, setActiveTab] = useState("projects");

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["/api/star-projects"],
  });

  const { data: causes = [], isLoading: causesLoading } = useQuery({
    queryKey: ["/api/star-causes"],
  });

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  // Filter and sort projects
  const filteredProjects = projects.filter((project: StarProject) => {
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && project.status === "active";
  });

  const sortedProjects = [...filteredProjects].sort((a: StarProject, b: StarProject) => {
    switch (sortBy) {
      case "progress":
        return (b.currentAmount / b.targetAmount) - (a.currentAmount / a.targetAmount);
      case "deadline":
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      case "newest":
      default:
        return b.id - a.id;
    }
  });

  // Filter and sort causes
  const filteredCauses = causes.filter((cause: StarCause) => {
    const matchesSearch = cause.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cause.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && cause.status === "active";
  });

  const sortedCauses = [...filteredCauses].sort((a: StarCause, b: StarCause) => {
    switch (sortBy) {
      case "urgency":
        const urgencyOrder = { "critical": 3, "high": 2, "medium": 1 };
        return (urgencyOrder[b.urgency as keyof typeof urgencyOrder] || 0) - 
               (urgencyOrder[a.urgency as keyof typeof urgencyOrder] || 0);
      case "progress":
        return (b.currentAmount / b.targetAmount) - (a.currentAmount / a.targetAmount);
      case "newest":
      default:
        return b.id - a.id;
    }
  });

  const getUser = (userId: number) => {
    return users.find((user: User) => user.id === userId);
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isLoading = projectsLoading || causesLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading community...</p>
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
            Community Hub
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Support collaborative projects and help causes in your community
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search projects and causes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="progress">Most Progress</SelectItem>
                <SelectItem value="deadline">Urgent Deadline</SelectItem>
                <SelectItem value="urgency">Highest Urgency</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="projects" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              STAR Projects ({projects.length})
            </TabsTrigger>
            <TabsTrigger value="causes" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              STAR Causes ({causes.length})
            </TabsTrigger>
          </TabsList>

          {/* Projects Tab */}
          <TabsContent value="projects">
            {sortedProjects.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No projects found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Try adjusting your search criteria or check back later for new projects.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedProjects.map((project: StarProject) => {
                  const creator = getUser(project.creatorId);
                  const progress = getProgressPercentage(project.currentAmount, project.targetAmount);
                  
                  return (
                    <Card key={project.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant="secondary" className="text-xs">
                            STAR Project
                          </Badge>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {Math.round(progress)}% funded
                          </div>
                        </div>
                        <CardTitle className="text-lg">{project.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
                          {project.description}
                        </p>
                        
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Progress</span>
                              <span>{project.currentAmount} / {project.targetAmount} tokens</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                          
                          <div className="space-y-2">
                            {creator && (
                              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                <div className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mr-2">
                                  <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                                    {creator.firstName[0]}{creator.lastName[0]}
                                  </span>
                                </div>
                                Created by {creator.firstName} {creator.lastName}
                              </div>
                            )}
                            
                            {project.location && (
                              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                <MapPin className="h-4 w-4 mr-2" />
                                {project.location}
                              </div>
                            )}
                            
                            {project.deadline && (
                              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                <Calendar className="h-4 w-4 mr-2" />
                                Deadline: {formatDate(project.deadline)}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Link href={`/projects/${project.id}`} className="w-full">
                          <Button className="w-full">
                            <Target className="h-4 w-4 mr-2" />
                            View & Contribute
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Causes Tab */}
          <TabsContent value="causes">
            {sortedCauses.length === 0 ? (
              <div className="text-center py-12">
                <Heart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No causes found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Try adjusting your search criteria or check back later for new causes.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedCauses.map((cause: StarCause) => {
                  const champion = getUser(cause.championId);
                  const progress = getProgressPercentage(cause.currentAmount, cause.targetAmount);
                  
                  return (
                    <Card key={cause.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              STAR Cause
                            </Badge>
                            <div className={`w-2 h-2 rounded-full ${getUrgencyColor(cause.urgency)}`} title={`${cause.urgency} urgency`} />
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {Math.round(progress)}% funded
                          </div>
                        </div>
                        <CardTitle className="text-lg">{cause.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
                          {cause.description}
                        </p>
                        
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Progress</span>
                              <span>{cause.currentAmount} / {cause.targetAmount} tokens</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                          
                          <div className="space-y-2">
                            {champion && (
                              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                <div className="w-6 h-6 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mr-2">
                                  <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                                    {champion.firstName[0]}{champion.lastName[0]}
                                  </span>
                                </div>
                                Championed by {champion.firstName} {champion.lastName}
                              </div>
                            )}
                            
                            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                              <TrendingUp className="h-4 w-4 mr-2" />
                              {cause.urgency.charAt(0).toUpperCase() + cause.urgency.slice(1)} urgency
                            </div>
                            
                            {cause.deadline && (
                              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                <Calendar className="h-4 w-4 mr-2" />
                                Deadline: {formatDate(cause.deadline)}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Link href={`/causes/${cause.id}`} className="w-full">
                          <Button className="w-full">
                            <Heart className="h-4 w-4 mr-2" />
                            View & Donate
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Results Summary */}
        {(sortedProjects.length > 0 || sortedCauses.length > 0) && (
          <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            {activeTab === "projects" 
              ? `Showing ${sortedProjects.length} of ${projects.length} projects`
              : `Showing ${sortedCauses.length} of ${causes.length} causes`
            }
          </div>
        )}
      </div>
    </div>
  );
}