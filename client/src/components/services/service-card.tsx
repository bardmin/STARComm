import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Clock, MessageCircle, Heart } from "lucide-react";
import { authManager } from "@/lib/auth";

interface ServiceCardProps {
  service: {
    id: number;
    title: string;
    description: string;
    pricePerHour: number;
    providerId: number;
    location?: string;
    isAvailable: boolean;
  };
  provider: {
    firstName: string;
    lastName: string;
    profileImage?: string;
  };
  rating?: number;
  reviewCount?: number;
}

export default function ServiceCard({ service, provider, rating = 5.0, reviewCount = 12 }: ServiceCardProps) {
  const { isAuthenticated } = authManager.getAuthState();

  const getProviderInitials = () => {
    return `${provider.firstName[0]}${provider.lastName[0]}`;
  };

  const getProviderName = () => {
    return `${provider.firstName} ${provider.lastName}`;
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-blue to-community-green rounded-full flex items-center justify-center flex-shrink-0">
            {provider.profileImage ? (
              <img
                src={provider.profileImage}
                alt={getProviderName()}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <span className="text-white font-semibold text-lg">
                {getProviderInitials()}
              </span>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{getProviderName()}</h3>
            <p className="text-sm text-gray-600">{service.title}</p>
            <div className="flex items-center space-x-2 mt-1">
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${i < Math.floor(rating) ? 'fill-current' : ''}`}
                  />
                ))}
              </div>
              <span className="text-sm text-gray-500">
                {rating.toFixed(1)} ({reviewCount} reviews)
              </span>
            </div>
          </div>
          <div className="text-right">
            <Badge
              className={
                service.isAvailable
                  ? "bg-green-100 text-green-800 hover:bg-green-100"
                  : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
              }
            >
              {service.isAvailable ? "Available" : "Busy"}
            </Badge>
          </div>
        </div>
        
        <div className="space-y-3 mb-4">
          <p className="text-gray-600 text-sm line-clamp-2">
            {service.description}
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 flex items-center">
              <MapPin className="h-4 w-4 mr-1" />
              {service.location || "Location not specified"}
            </span>
            <span className="text-gray-500 flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              Usually responds within 1 hour
            </span>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl font-bold text-token-gold">
              {service.pricePerHour} tokens/hour
            </span>
            <span className="text-sm text-gray-500">
              R{(service.pricePerHour * 0.6).toFixed(2)}/hour equivalent
            </span>
          </div>
          <div className="flex space-x-3">
            {isAuthenticated ? (
              <Link href={`/booking/${service.id}`} className="flex-1">
                <Button className="w-full bg-primary-blue text-white hover:bg-primary-blue-dark">
                  Book Now
                </Button>
              </Link>
            ) : (
              <Link href="/login" className="flex-1">
                <Button className="w-full bg-primary-blue text-white hover:bg-primary-blue-dark">
                  Login to Book
                </Button>
              </Link>
            )}
            <Button variant="outline" size="icon">
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon">
              <Heart className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
