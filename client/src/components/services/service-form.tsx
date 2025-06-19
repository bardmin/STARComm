import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Service } from '@/pages/services/services'; // Adjust import path if Service type is centralized
import { ServiceCategory } from '@/pages/services/services'; // Adjust import path
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

// Define Zod schema for service form validation
const serviceFormSchema = z.object({
  name: z.string().min(3, "Service name must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  categoryId: z.string().min(1, "Category is required"),
  basePrice: z.coerce.number().positive("Price must be a positive number"),
  serviceType: z.enum(['on_demand', 'scheduled', 'package']).default('on_demand'),
  priceUnit: z.enum(['token_per_hour', 'token_fixed']).default('token_fixed'),
  durationMinutes: z.coerce.number().optional().nullable(),
  location: z.object({
    city: z.string().optional().nullable(),
    addressLine1: z.string().optional().nullable(), // Simplified for now
  }).optional().nullable(),
  images: z.array(z.string().url("Must be a valid URL")).max(5, "Maximum 5 images").optional().default([]),
  requirements: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type ServiceFormData = z.infer<typeof serviceFormSchema>;

interface ServiceFormProps {
  onSubmit: SubmitHandler<ServiceFormData>;
  defaultValues?: Partial<ServiceFormData>;
  isLoading?: boolean;
  submitButtonText?: string;
}

export default function ServiceForm({ onSubmit, defaultValues, isLoading, submitButtonText = "Submit Service" }: ServiceFormProps) {
  const { register, handleSubmit, control, formState: { errors }, watch, setValue } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: defaultValues || { isActive: true, images: [], serviceType: 'on_demand', priceUnit: 'token_fixed' },
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<ServiceCategory[]>({
    queryKey: ["service-categories"],
    queryFn: async () => apiRequest("GET", "/api/service-categories").then(res => res.json()),
  });

  // Image URL input handling
  const [imageUrl, setImageUrl] = useState("");
  const images = watch("images", []);

  const addImageUrl = () => {
    if (imageUrl && images.length < 5) {
      setValue("images", [...images, imageUrl], { shouldValidate: true });
      setImageUrl("");
    }
  };

  const removeImageUrl = (index: number) => {
    setValue("images", images.filter((_, i) => i !== index), { shouldValidate: true });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <Label htmlFor="name">Service Name</Label>
        <Input id="name" {...register("name")} />
        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" {...register("description")} />
        {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="categoryId">Category</Label>
          <Controller
            name="categoryId"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={categoriesLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
          {errors.categoryId && <p className="text-red-500 text-sm mt-1">{errors.categoryId.message}</p>}
        </div>
        <div>
          <Label htmlFor="basePrice">Base Price (Tokens)</Label>
          <Input id="basePrice" type="number" step="0.01" {...register("basePrice")} />
          {errors.basePrice && <p className="text-red-500 text-sm mt-1">{errors.basePrice.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="serviceType">Service Type</Label>
           <Controller
            name="serviceType"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_demand">On Demand / Fixed</SelectItem>
                  <SelectItem value="scheduled">Scheduled (per hour/session)</SelectItem>
                  <SelectItem value="package">Package</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.serviceType && <p className="text-red-500 text-sm mt-1">{errors.serviceType.message}</p>}
        </div>
        <div>
          <Label htmlFor="priceUnit">Price Unit</Label>
           <Controller
            name="priceUnit"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="token_fixed">Tokens (Fixed Total)</SelectItem>
                  <SelectItem value="token_per_hour">Tokens / Hour</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.priceUnit && <p className="text-red-500 text-sm mt-1">{errors.priceUnit.message}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="durationMinutes">Duration (Minutes, if applicable)</Label>
        <Input id="durationMinutes" type="number" {...register("durationMinutes")} />
        {errors.durationMinutes && <p className="text-red-500 text-sm mt-1">{errors.durationMinutes.message}</p>}
      </div>

      <div>
        <Label htmlFor="location.city">Location (City - Optional)</Label>
        <Input id="location.city" {...register("location.city")} />
        {errors.location?.city && <p className="text-red-500 text-sm mt-1">{errors.location.city.message}</p>}
      </div>

      <div>
        <Label>Image URLs (Max 5)</Label>
        <div className="flex gap-2 mb-2">
          <Input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.png"
          />
          <Button type="button" onClick={addImageUrl} disabled={images.length >= 5 || !imageUrl}>Add</Button>
        </div>
        <div className="space-y-1">
          {images.map((url, index) => (
            <div key={index} className="flex items-center justify-between text-xs">
              <span>{url.substring(0,50)}...</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => removeImageUrl(index)}>Remove</Button>
            </div>
          ))}
        </div>
        {errors.images && <p className="text-red-500 text-sm mt-1">{errors.images.message}</p>}
      </div>

      <div>
        <Label htmlFor="requirements">Requirements (Optional)</Label>
        <Textarea id="requirements" {...register("requirements")} />
        {errors.requirements && <p className="text-red-500 text-sm mt-1">{errors.requirements.message}</p>}
      </div>

      <div className="flex items-center space-x-2">
        <Controller
            name="isActive"
            control={control}
            render={({ field }) => (
                 <Checkbox id="isActive" checked={field.value} onCheckedChange={field.onChange} />
            )}
        />
        <Label htmlFor="isActive" className="font-normal">Service is Active and Available</Label>
        {errors.isActive && <p className="text-red-500 text-sm mt-1">{errors.isActive.message}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitButtonText}
      </Button>
    </form>
  );
}
