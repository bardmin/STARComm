import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'wouter';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Edit, Eye, Loader2, PlusCircle, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { authManager } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { Service } from '@/pages/services/services'; // Adjust import path
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useState }
from 'react';

export default function MyServicesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = authManager.getAuthState().user;

  // For confirmation dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<(() => void) | null>(null);
  const [dialogContent, setDialogContent] = useState({title: "", description: ""});


  const { data: serviceData, isLoading, error } = useQuery<{ services: Service[], nextCursor: string | null }>({
    queryKey: ['provider-services', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      const response = await apiRequest("GET", `/api/services?serviceProviderId=${user.id}&limit=50`); // Fetch all for now, or implement pagination
      return response.json();
    },
    enabled: !!user?.id,
  });
  const providerServices = serviceData?.services || [];

  const toggleServiceStatusMutation = useMutation({
    mutationFn: async ({ serviceId, isActive }: { serviceId: string, isActive: boolean }) => {
      // For deactivation (soft delete)
      if (!isActive) {
        return apiRequest("DELETE", `/api/services/${serviceId}`);
      }
      // For activation
      return apiRequest("PUT", `/api/services/${serviceId}`, { isActive: true });
    },
    onSuccess: (data, variables) => {
      toast({
        title: `Service ${variables.isActive ? 'Activated' : 'Deactivated'}`,
        description: `Service has been successfully ${variables.isActive ? 'activated' : 'deactivated'}.`,
        variant: "default"
      });
      queryClient.invalidateQueries({ queryKey: ['provider-services', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['services'] }); // Invalidate general services list too
    },
    onError: (error: any) => {
      toast({
        title: "Error updating service status",
        description: error.message || "Could not update service status.",
        variant: "destructive"
      });
    }
  });

  const handleToggleServiceStatus = (serviceId: string, currentIsActive: boolean) => {
    const action = () => toggleServiceStatusMutation.mutate({ serviceId, isActive: !currentIsActive });
    setDialogContent({
        title: `Confirm ${currentIsActive ? 'Deactivation' : 'Activation'}`,
        description: `Are you sure you want to ${currentIsActive ? 'deactivate' : 'activate'} this service?`
    });
    setActionToConfirm(() => action); // Store the action
    setDialogOpen(true);
  };

  const confirmAndExecuteAction = () => {
    if (actionToConfirm) {
      actionToConfirm();
    }
    setDialogOpen(false);
    setActionToConfirm(null);
  };


  if (!user || user.role !== 'service_provider') {
    // This check could also be part of a route guard
    navigate("/"); // Redirect if not a service provider
    return null;
  }

  if (isLoading) return <div className="container mx-auto px-4 py-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /> <p>Loading your services...</p></div>;
  if (error) return <div className="container mx-auto px-4 py-8 text-red-500">Error loading services: {(error as Error).message}</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">My Services</h1>
          <Button onClick={() => navigate('/provider/services/create')}>
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Service
          </Button>
        </div>

        {providerServices.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Services Yet</CardTitle>
              <CardDescription>You haven't created any services. Get started by adding your first one!</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/provider/services/create')} className="w-full md:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Service
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {providerServices.map((service) => (
              <Card key={service.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle>{service.name}</CardTitle>
                  <Badge variant={service.isActive ? "default" : "outline"} className={service.isActive ? "bg-green-500 text-white" : "border-red-500 text-red-500"}>
                    {service.isActive ? <CheckCircle className="mr-1 h-3 w-3"/> : <AlertCircle className="mr-1 h-3 w-3"/>}
                    {service.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">{service.description}</p>
                  <p className="text-lg font-semibold mt-2 text-token-gold">{service.basePrice} tokens {service.priceUnit === 'token_per_hour' ? '/hr' : ''}</p>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row justify-between gap-2 pt-4">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/services/${service.id}`)}>
                    <Eye className="mr-1 h-4 w-4" /> View
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/provider/services/edit/${service.id}`)}>
                     <Edit className="mr-1 h-4 w-4" /> Edit
                  </Button>
                  <Button
                    variant={service.isActive ? "destructive" : "default"}
                    size="sm"
                    onClick={() => handleToggleServiceStatus(service.id, service.isActive)}
                    disabled={toggleServiceStatusMutation.isPending && toggleServiceStatusMutation.variables?.serviceId === service.id}
                  >
                    {toggleServiceStatusMutation.isPending && toggleServiceStatusMutation.variables?.serviceId === service.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : service.isActive
                        ? <><ToggleLeft className="mr-1 h-4 w-4" /> Deactivate</>
                        : <><ToggleRight className="mr-1 h-4 w-4" /> Activate</>
                    }
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialogContent.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setActionToConfirm(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndExecuteAction}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
