import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, AlertCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { authManager } from "@/lib/auth";

interface BookingFormProps {
  service: {
    id: number;
    title: string;
    pricePerHour: number;
    providerId: number;
  };
  provider: {
    firstName: string;
    lastName: string;
  };
  onSuccess: () => void;
}

export default function BookingForm({ service, provider, onSuccess }: BookingFormProps) {
  const [formData, setFormData] = useState({
    scheduledDate: '',
    scheduledTime: '',
    duration: 2,
    requirements: '',
  });
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const response = await apiRequest("POST", "/api/bookings", {
        ...bookingData,
        serviceId: service.id,
        providerId: service.providerId,
        totalTokens: bookingData.duration * service.pricePerHour,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet'] });
      onSuccess();
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!formData.scheduledDate || !formData.scheduledTime) {
      setError("Please select a date and time for your booking");
      return;
    }

    mutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'duration' ? parseInt(value) || 1 : value
    }));
  };

  const totalCost = formData.duration * service.pricePerHour;
  const equivalentCash = totalCost * 0.6;

  // Generate time slots
  const timeSlots = [];
  for (let hour = 8; hour <= 18; hour++) {
    timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    if (hour < 18) {
      timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
  }

  return (
    <div className="bg-gray-50 rounded-3xl p-8">
      <Card className="max-w-sm mx-auto shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-blue to-community-green rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {provider.firstName[0]}{provider.lastName[0]}
              </span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">
                {provider.firstName} {provider.lastName}
              </h4>
              <p className="text-sm text-gray-600">{service.title}</p>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="scheduledDate" className="text-sm font-medium text-gray-700 mb-2">
                Select Date
              </Label>
              <Input
                id="scheduledDate"
                name="scheduledDate"
                type="date"
                value={formData.scheduledDate}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                required
                className="w-full"
              />
            </div>

            <div>
              <Label htmlFor="scheduledTime" className="text-sm font-medium text-gray-700 mb-2">
                Select Time
              </Label>
              <select
                id="scheduledTime"
                name="scheduledTime"
                value={formData.scheduledTime}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent"
              >
                <option value="">Choose a time</option>
                {timeSlots.map(time => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="duration" className="text-sm font-medium text-gray-700 mb-2">
                Duration (hours)
              </Label>
              <select
                id="duration"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(hours => (
                  <option key={hours} value={hours}>
                    {hours} hour{hours > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="requirements" className="text-sm font-medium text-gray-700 mb-2">
                Special Requirements
              </Label>
              <Textarea
                id="requirements"
                name="requirements"
                value={formData.requirements}
                onChange={handleChange}
                placeholder="Any special instructions..."
                rows={3}
                className="w-full"
              />
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Service Cost:</span>
                <span className="font-semibold text-token-gold">{totalCost} tokens</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Escrow Fee:</span>
                <span className="font-semibold text-gray-900">Free</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Total:</span>
                  <span className="font-bold text-xl text-token-gold">{totalCost} tokens</span>
                </div>
                <div className="text-right text-sm text-gray-500">
                  R{equivalentCash.toFixed(2)} equivalent
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-primary-blue text-white py-3 rounded-xl font-semibold hover:bg-primary-blue-dark transition-colors"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Booking
            </Button>
            
            <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
              <Shield className="h-4 w-4" />
              <span>Tokens will be held in escrow until service completion</span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
