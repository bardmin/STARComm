import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Clock, Star, Shield, ArrowLeft } from "lucide-react";
import { useState } from "react";
import BookingForm from "@/components/booking/booking-form";
import { Service, ServiceProviderInfo } from "./services"; // Assuming types are exported from services.tsx or a shared types file
import { apiRequest } from "@/lib/queryClient"; // For direct API calls if useQuery isn't fully adapted yet

// Define Review type based on expected structure (align with backend)
interface Review {
  id: string;
  reviewerId: string;
  revieweeId: string;
  bookingId: string;
  rating: number;
  comment: string;
  createdAt: any; // Firestore timestamp or ISO string
  // Add reviewerName or other denormalized fields if backend provides them
  reviewerInfo?: { firstName?: string; lastName?: string; profileImageUrl?: string };
}

export default function ServiceDetailsPage() { // Renamed component
  const params = useParams();
  const [, setLocation] = useLocation();
  const [showBookingForm, setShowBookingForm] = useState(false);
  const serviceId = params.id || ""; // serviceId is now a string

  // Fetch single service details
  const { data: service, isLoading: serviceLoading, error: serviceError } = useQuery<Service>({
    queryKey: ["service", serviceId], // Use more specific queryKey
    queryFn: async () => {
      if (!serviceId) throw new Error("Service ID is required.");
      const response = await apiRequest("GET", `/api/services/${serviceId}`);
      return response.json();
    },
    enabled: !!serviceId,
  });

  // Reviews are fetched based on the serviceProviderId (revieweeId)
  const serviceProviderId = service?.serviceProviderId;
  const { data: reviewData, isLoading: reviewsLoading } = useQuery<{reviews: Review[], nextCursor: string | null}>({
    queryKey: ["reviews", "provider", serviceProviderId],
    queryFn: async () => {
      if (!serviceProviderId) return { reviews: [], nextCursor: null }; // Or throw error if providerId is essential
      const response = await apiRequest("GET", `/api/reviews?revieweeId=${serviceProviderId}&limit=5`); // Fetch first 5 reviews
      return response.json();
    },
    enabled: !!serviceProviderId,
  });
  const reviews = reviewData?.reviews || [];

  // Category data: Ideally, categoryName is part of 'service' object if denormalized by backend.
  // If not, and you have a global categories store/context from services.tsx, use that.
  // For simplicity, we'll assume categoryId is displayed or categoryName is part of service if needed.
  // const { data: category } = useQuery... (Removed separate category fetch if not essential for display here)

  const provider = service?.providerInfo; // Provider info is now embedded in service object

  if (serviceLoading || (serviceProviderId && reviewsLoading)) { // Adjusted loading check
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

  if (serviceError) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Alert variant="destructive">
          <AlertDescription>Error loading service: {(serviceError as Error).message}</AlertDescription>
        </Alert>
        <Button onClick={() => setLocation("/services")} className="mt-4">Back to Services</Button>
      </div>
    );
  }

  if (!service) { // service might be undefined if query is disabled or fails silently before error state
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Service Not Found</h2>
          <p className="text-gray-600 mb-4">The service you're looking for might not exist or failed to load.</p>
          <Button onClick={() => setLocation("/services")}>
            Back to Services
          </Button>
        </div>
      </div>
    );
  }

  // Use averageRating and reviewCount from service object (populated by backend)
  const averageRating = service.averageRating || 0;
  const reviewCount = service.reviewCount || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:bg-gray-900 dark:text-white">
      <div className="max-w-6xl mx-auto p-4 pt-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => setLocation("/services")}
          className="mb-6 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Services
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Header */}
            <Card>
              <CardContent className="p-8">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{service.name}</h1>
                    {service.categoryName && ( // Display categoryName if backend provides it
                      <Badge variant="secondary" className="mb-4 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        {service.categoryName}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-token-gold mb-1">
                      {service.basePrice} tokens {service.serviceType === 'on_demand' ? '/ task' : service.priceUnit || '/hr'}
                    </div>
                    {/* Optional: Display equivalent cash value if applicable */}
                  </div>
                </div>

                {/* Image Gallery/Carousel */}
                {service.images && service.images.length > 0 && (
                    <div className="mb-6">
                        <img src={service.images[0]} alt={service.name} className="w-full h-64 object-cover rounded-lg shadow-md"/>
                        {/* TODO: Implement a carousel if multiple images */}
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6">
                  {service.location?.city && (
                    <div className="flex items-center text-gray-600 dark:text-gray-300">
                      <MapPin className="h-4 w-4 mr-1" />
                      <span className="text-sm">{service.location.city}{service.location.state ? `, ${service.location.state}` : ''}</span>
                    </div>
                  )}
                  {service.isActive ? (
                     <div className="flex items-center text-green-600 dark:text-green-400">
                        <Clock className="h-4 w-4 mr-1" /> Available
                     </div>
                    ) : (
                     <div className="flex items-center text-red-500 dark:text-red-400">
                        <Clock className="h-4 w-4 mr-1" /> Unavailable
                     </div>
                  )}
                  {reviewCount > 0 && (
                    <div className="flex items-center text-gray-600 dark:text-gray-300">
                      <Star className="h-4 w-4 mr-1 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm">{averageRating.toFixed(1)} ({reviewCount} reviews)</span>
                    </div>
                  )}
                </div>

                <p className="text-gray-600 leading-relaxed">{service.description}</p>

                {service.requirements && (
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start">
                      <Shield className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-blue-900 mb-1">Requirements</h4>
                        <p className="text-blue-700 text-sm">{service.requirements}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reviews Section */}
            {reviews.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Reviews ({reviews.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {reviews.slice(0, 3).map((review: any) => (
                    <div key={review.id} className="border-b border-gray-200 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {review.reviewerName?.charAt(0) || 'R'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{review.reviewerName || 'Anonymous'}</span>
                        </div>
                        <div className="flex items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-gray-600 text-sm">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Provider Info */}
            <Card>
              <CardHeader>
                <CardTitle>Service Provider</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4 mb-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary-blue text-white text-lg">
                      {provider.firstName.charAt(0)}{provider.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {provider.firstName} {provider.lastName}
                    </h3>
                    <p className="text-sm text-gray-600 capitalize">{provider.role.replace('_', ' ')}</p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>Verified Provider</span>
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <Shield className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Phone</span>
                    <span>{provider.phoneNumber}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Booking Card */}
            <Card>
              <CardContent className="p-6">
                {!showBookingForm ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-token-gold mb-2">
                        {service.pricePerHour} tokens/hour
                      </div>
                      <div className="text-sm text-gray-500 mb-4">
                        Service available now
                      </div>
                    </div>
                    <Button
                      onClick={() => setShowBookingForm(true)}
                      className="w-full bg-primary-blue text-white py-3 text-lg font-semibold hover:bg-primary-blue-dark"
                    >
                      Book Now
                    </Button>
                    <p className="text-xs text-gray-500 text-center">
                      Tokens will be held in escrow until service completion
                    </p>
                  </div>
                ) : (
                  <BookingForm
                    service={service}
                    provider={provider}
                    onSuccess={() => {
                      setShowBookingForm(false);
                      setLocation("/bookings");
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}