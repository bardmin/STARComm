import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, Filter, MapPin, Star, Clock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";

// Interface for provider info that might be embedded or fetched separately
export interface ServiceProviderInfo {
  id: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

// Updated Service interface to match Firestore data structure
export interface Service {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName?: string;
  serviceProviderId: string;
  basePrice: number;
  serviceType?: 'on_demand' | 'scheduled';
  location?: { 
    address?: string; 
    city?: string; 
    state?: string; 
    zip?: string; 
    country?: string; 
    lat?: number; 
    lng?: number; 
  };
  availability?: { 
    type?: 'days' | 'specific_dates'; 
    days?: string[]; 
    specificDates?: string[]; 
    startTime?: string; 
    endTime?: string; 
  };
  images?: string[];
  isActive: boolean;
  requirements?: string;
  averageRating?: number;
  reviewCount?: number;
  createdAt?: any;
  updatedAt?: any;
  providerInfo?: ServiceProviderInfo;
}

// Updated to match Firestore structure and server response
interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export default function ServicesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("createdAt_desc");

  const fetchServices = async ({ pageParam }: { pageParam?: string | null }) => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("categoryId", selectedCategory);
      if (searchTerm) params.append("search", searchTerm);

      // Sorting logic based on sortBy state
      if (sortBy === 'price_asc') {
        params.append('sortBy', 'basePrice');
        params.append('sortOrder', 'asc');
      } else if (sortBy === 'price_desc') {
        params.append('sortBy', 'basePrice');
        params.append('sortOrder', 'desc');
      } else if (sortBy === 'name_asc') {
        params.append('sortBy', 'name');
        params.append('sortOrder', 'asc');
      } else {
        params.append('sortBy', 'createdAt');
        params.append('sortOrder', 'desc');
      }
      params.append("limit", "9");
      if (pageParam) {
        params.append("lastVisible", pageParam);
      }

      const response = await apiRequest("GET", `/api/services?${params.toString()}`);
      
      // Check if response is ok
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Expected JSON but received:", text);
        throw new Error("Server responded with non-JSON content");
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error fetching services:", error);
      throw error;
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await apiRequest("GET", "/api/service-categories");
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Expected JSON but received:", text);
        throw new Error("Server responded with non-JSON content");
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error fetching categories:", error);
      throw error;
    }
  };

  // Using useQuery for services
  const {
    data: serviceData,
    isLoading: servicesLoading,
    error: servicesError,
  } = useQuery<{services: Service[], nextCursor: string | null}>({
    queryKey: ["services", selectedCategory, searchTerm, sortBy],
    queryFn: () => fetchServices({ pageParam: null }),
    retry: false, // Don't retry failed requests
  });

  const displayedServices = serviceData?.services || [];

  const { 
    data: categories = [], 
    isLoading: categoriesLoading,
    error: categoriesError 
  } = useQuery<ServiceCategory[]>({
    queryKey: ["service-categories"],
    queryFn: fetchCategories,
    retry: false, // Don't retry failed requests
  });

  const getCategoryName = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.name;
  };

  if (servicesLoading || categoriesLoading) {
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

  // Show error state if both services and categories failed to load
  if (servicesError && categoriesError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive" className="my-4">
            <AlertDescription>
              Unable to load services and categories. Please check your server connection and try again.
              <br />
              <small>Error details: {(servicesError as Error).message}</small>
            </AlertDescription>
          </Alert>
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
                <SelectItem value="createdAt_desc">Newest First</SelectItem>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
                <SelectItem value="name_asc">Name: A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Error Messages */}
        {servicesError && (
          <Alert variant="destructive" className="my-4">
            <AlertDescription>
              Error loading services: {(servicesError as Error).message}
              <br />
              <small>Please check that your API server is running and accessible.</small>
            </AlertDescription>
          </Alert>
        )}
        
        {categoriesError && (
          <Alert variant="destructive" className="my-4">
            <AlertDescription>
              Error loading categories: {(categoriesError as Error).message}
            </AlertDescription>
          </Alert>
        )}

        {/* Services Grid */}
        {(!servicesLoading && !servicesError && displayedServices.length === 0) ? (
          <div className="text-center py-12">
            <Search className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No services found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Try adjusting your search or filter criteria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedServices.map((service: Service) => {
              const categoryName = getCategoryName(service.categoryId) || service.categoryId;
              
              return (
                <Card key={service.id} className="hover:shadow-lg transition-shadow flex flex-col">
                  <CardHeader>
                    {service.images && service.images.length > 0 && (
                      <img 
                        src={service.images[0]} 
                        alt={service.name} 
                        className="w-full h-40 object-cover rounded-t-md mb-2"
                        onError={(e) => {
                          // Hide broken images
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex justify-between items-start mb-1">
                      <Badge variant="secondary" className="text-xs">
                        {categoryName}
                      </Badge>
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <DollarSign className="h-4 w-4 mr-1" />
                        {service.basePrice} tokens
                      </div>
                    </div>
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
                      {service.description}
                    </p>
                    <div className="space-y-1 text-xs text-gray-500">
                      {service.location?.city && (
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1.5" />
                          {service.location.city}{service.location.state ? `, ${service.location.state}` : ''}
                        </div>
                      )}
                      {service.isActive ? (
                        <div className="flex items-center text-green-600">
                          <Clock className="h-3 w-3 mr-1.5" />
                          Available
                        </div>
                      ) : (
                        <div className="flex items-center text-red-500">
                          <Clock className="h-3 w-3 mr-1.5" />
                          Unavailable
                        </div>
                      )}
                      <div className="flex items-center">
                        <Star className="h-3 w-3 mr-1.5 text-yellow-400" />
                        {service.averageRating?.toFixed(1) || 'New'} ({service.reviewCount || 0} reviews)
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
        {displayedServices.length > 0 && (
          <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            Showing {displayedServices.length} services
          </div>
        )}
      </div>
    </div>
  );
}