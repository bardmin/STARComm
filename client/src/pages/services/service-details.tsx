import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Clock, Star, Shield, ArrowLeft } from "lucide-react";
import { useState } from "react";
import BookingForm from "@/components/booking/booking-form";

export default function ServiceDetails() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const [showBookingForm, setShowBookingForm] = useState(false);
  const serviceId = parseInt(params.id || "0");

  const { data: service, isLoading: serviceLoading } = useQuery({
    queryKey: ["/api/services", serviceId],
    enabled: !!serviceId,
  });

  const { data: provider, isLoading: providerLoading } = useQuery({
    queryKey: ["/api/users", service?.providerId],
    enabled: !!service?.providerId,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["/api/reviews/service", serviceId],
    enabled: !!serviceId,
  });

  const { data: category } = useQuery({
    queryKey: ["/api/service-categories", service?.categoryId],
    enabled: !!service?.categoryId,
  });

  if (serviceLoading || providerLoading) {
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

  if (!service || !provider) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Service Not Found</h2>
          <p className="text-gray-600 mb-4">The service you're looking for doesn't exist.</p>
          <Button onClick={() => setLocation("/services")}>
            Back to Services
          </Button>
        </div>
      </div>
    );
  }

  const averageRating = reviews.length > 0 
    ? reviews.reduce((acc: number, review: any) => acc + review.rating, 0) / reviews.length
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
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
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{service.title}</h1>
                    {category && (
                      <Badge variant="secondary" className="mb-4">
                        {category.name}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-token-gold mb-1">
                      {service.pricePerHour} tokens/hour
                    </div>
                    <div className="text-sm text-gray-500">
                      ≈ ${(service.pricePerHour * 0.6).toFixed(2)}/hour
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4 mb-6">
                  <div className="flex items-center text-gray-600">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span className="text-sm">{service.location}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Clock className="h-4 w-4 mr-1" />
                    <span className="text-sm">Available Today</span>
                  </div>
                  {reviews.length > 0 && (
                    <div className="flex items-center text-gray-600">
                      <Star className="h-4 w-4 mr-1 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm">{averageRating.toFixed(1)} ({reviews.length} reviews)</span>
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