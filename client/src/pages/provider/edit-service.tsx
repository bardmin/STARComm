import { useParams, useNavigate } from 'wouter';
import ServiceForm, { ServiceFormData } from '@/components/services/service-form';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Service } from '@/pages/services/services'; // Adjust import path
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { authManager } from '@/lib/auth';

export default function EditServicePage() {
  const params = useParams();
  const serviceId = params.serviceId;
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false); // For form submission
  const currentUser = authManager.getAuthState().user;

  const { data: service, isLoading: serviceLoading, error: serviceError } = useQuery<Service>({
    queryKey: ['service', serviceId],
    queryFn: async () => {
      if (!serviceId) throw new Error("Service ID is required.");
      const response = await apiRequest("GET", `/api/services/${serviceId}`);
      return response.json();
    },
    enabled: !!serviceId,
  });

  const editMutation = useMutation({
    mutationFn: (payload: Partial<ServiceFormData>) => apiRequest("PUT", `/api/services/${serviceId}`, payload),
    onSuccess: (data) => {
      toast({
        title: "Service Updated!",
        description: `Service "${data.name || service?.name}" has been updated.`,
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['provider-services', currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['service', serviceId]});
      navigate(`/provider/my-services`);
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.message || error.message || "Failed to update service.";
      toast({
        title: "Error Updating Service",
        description: errorMsg,
        variant: "destructive",
      });
      console.error("Service update error:", error);
    },
    onSettled: () => {
      setIsLoading(false);
    }
  });

  const handleEditService = async (data: ServiceFormData) => {
    setIsLoading(true);
    // Ensure only changed fields are sent, or send all if backend handles partial updates well
    const payload = {
        ...data,
        basePrice: Number(data.basePrice),
        durationMinutes: data.durationMinutes ? Number(data.durationMinutes) : null,
        location: data.location?.city || data.location?.addressLine1 ? {
            city: data.location.city || undefined,
            addressLine1: data.location.addressLine1 || undefined,
        } : null,
      };
    editMutation.mutate(payload);
  };

  if (serviceLoading) return <div className="container mx-auto px-4 py-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /><p>Loading service details...</p></div>;
  if (serviceError) return <div className="container mx-auto px-4 py-8 text-red-500">Error loading service: {(serviceError as Error).message}</div>;
  if (!service) return <div className="container mx-auto px-4 py-8 text-center">Service not found.</div>;

  // Check if the current user is the provider of this service
  if (currentUser?.id !== service.serviceProviderId) {
    toast({ title: "Unauthorized", description: "You are not authorized to edit this service.", variant: "destructive" });
    navigate("/services"); // Redirect if not owner
    return null;
  }

  // Prepare defaultValues for the form, mapping from Service to ServiceFormData
  const defaultFormValues: Partial<ServiceFormData> = {
    name: service.name,
    description: service.description,
    categoryId: service.categoryId,
    basePrice: service.basePrice,
    serviceType: service.serviceType || 'on_demand',
    priceUnit: service.priceUnit || 'token_fixed',
    durationMinutes: service.durationMinutes || undefined,
    location: {
        city: service.location?.city || undefined,
        addressLine1: service.location?.addressLine1 || undefined,
    },
    images: service.images || [],
    requirements: service.requirements || undefined,
    isActive: service.isActive,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Edit Service</CardTitle>
            <CardDescription>Update the details of your service.</CardDescription>
          </CardHeader>
          <CardContent>
            <ServiceForm
              onSubmit={handleEditService}
              defaultValues={defaultFormValues}
              isLoading={isLoading || editMutation.isPending}
              submitButtonText="Save Changes"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
