import { useNavigate } from 'wouter';
import ServiceForm, { ServiceFormData } from '@/components/services/service-form';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export default function CreateServicePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleCreateService = async (data: ServiceFormData) => {
    setIsLoading(true);
    try {
      // Transform data if needed to match backend expectations, e.g. ensuring numbers are numbers
      const payload = {
        ...data,
        basePrice: Number(data.basePrice),
        durationMinutes: data.durationMinutes ? Number(data.durationMinutes) : null,
        // Ensure location is structured as expected or null if empty
        location: data.location?.city || data.location?.addressLine1 ? {
            city: data.location.city || undefined,
            addressLine1: data.location.addressLine1 || undefined,
            // Add other location fields if your form collects them
        } : null,
      };

      const response = await apiRequest("POST", "/api/services", payload);
      const newService = await response.json();

      toast({
        title: "Service Created!",
        description: `Your new service "${newService.name}" has been listed.`,
        variant: "default",
      });
      // Invalidate queries to refetch service lists
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['provider-services'] }); // If a specific query for provider's services exists

      navigate(`/services/${newService.id}`); // Navigate to the new service's detail page
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || "Failed to create service.";
      toast({
        title: "Error Creating Service",
        description: errorMsg,
        variant: "destructive",
      });
      console.error("Service creation error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Create New Service</CardTitle>
            <CardDescription>Fill out the details below to offer your service to the community.</CardDescription>
          </CardHeader>
          <CardContent>
            <ServiceForm
              onSubmit={handleCreateService}
              isLoading={isLoading}
              submitButtonText="Create Service"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
