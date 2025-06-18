import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, Filter, MapPin, Star, Clock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Service {
  id: number;
  title: string;
  description: string;
  pricePerHour: number;
  location?: string;
  categoryId: number;
  providerId: number;
  isAvailable: boolean;
}

// Updated to match Firestore structure and server response
interface ServiceCategory {
  id: string; // Firestore document ID is a string
  name: string;
  description?: string;
  iconUrl?: string; // Changed from icon to iconUrl
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

interface ServiceProvider {
  id: number;
  firstName: string;
  lastName: string;
  profileImage?: string;
}

export default function Services() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["/api/services"],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/service-categories"],
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["/api/users/providers"],
  });

  // Filter and sort services
  const filteredServices = services.filter((service: Service) => {
    const matchesSearch = service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || service.categoryId.toString() === selectedCategory;
    return matchesSearch && matchesCategory && service.isAvailable;
  });

  const sortedServices = [...filteredServices].sort((a: Service, b: Service) => {
    switch (sortBy) {
      case "price-low":
        return a.pricePerHour - b.pricePerHour;
      case "price-high":
        return b.pricePerHour - a.pricePerHour;
      case "newest":
      default:
        return b.id - a.id;
    }
  });

  const getProvider = (providerId: number) => {
    return providers.find((p: ServiceProvider) => p.id === providerId);
  };

  const getCategory = (categoryId: number) => {
    return categories.find((c: ServiceCategory) => c.id === categoryId);
  };

  if (servicesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading services...</p>
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
            Local Services
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Discover and book services from trusted providers in your community
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category: ServiceCategory) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Services Grid */}
        {sortedServices.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Search className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No services found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Try adjusting your search criteria or browse all categories
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedServices.map((service: Service) => {
              const provider = getProvider(service.providerId);
              const category = getCategory(service.categoryId);
              
              return (
                <Card key={service.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {category?.name || 'Service'}
                      </Badge>
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <DollarSign className="h-4 w-4 mr-1" />
                        {service.pricePerHour} tokens/hr
                      </div>
                    </div>
                    <CardTitle className="text-lg">{service.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
                      {service.description}
                    </p>
                    
                    <div className="space-y-2">
                      {provider && (
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                          <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mr-2">
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                              {provider.firstName[0]}{provider.lastName[0]}
                            </span>
                          </div>
                          {provider.firstName} {provider.lastName}
                        </div>
                      )}
                      
                      {service.location && (
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                          <MapPin className="h-4 w-4 mr-2" />
                          {service.location}
                        </div>
                      )}
                      
                      <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                        <Clock className="h-4 w-4 mr-2" />
                        Available now
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Link href={`/services/${service.id}`} className="w-full">
                      <Button className="w-full">
                        View Details & Book
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {/* Results Summary */}
        {sortedServices.length > 0 && (
          <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            Showing {sortedServices.length} of {services.length} services
          </div>
        )}
      </div>
    </div>
  );
}