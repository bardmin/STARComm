import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { authManager, User } from "@/lib/auth"; // Assuming User interface is exported
import { apiRequest } from "@/lib/queryClient"; // For making API calls
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(authManager.getAuthState().user);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    phoneNumber: user?.phoneNumber || "",
    profileImageUrl: user?.profileImageUrl || "", // Changed from profileImage
    // Add other editable fields here if any, e.g., bio, location from Firestore schema
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Update component user state if authManager changes (e.g., after login via onAuthStateChanged)
    const currentAuthUser = authManager.getAuthState().user;
    setUser(currentAuthUser);
    if (currentAuthUser) {
      setFormData({
        firstName: currentAuthUser.firstName || "",
        lastName: currentAuthUser.lastName || "",
        phoneNumber: currentAuthUser.phoneNumber || "",
        profileImageUrl: currentAuthUser.profileImageUrl || "", // Changed
      });
    }
  }, [authManager.getAuthState().user]); // Dependency on user object itself


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Construct payload with only changed fields that are allowed
    const payload: Partial<User> = {};
    if (formData.firstName !== user?.firstName) payload.firstName = formData.firstName;
    if (formData.lastName !== user?.lastName) payload.lastName = formData.lastName;
    if (formData.phoneNumber !== user?.phoneNumber) payload.phoneNumber = formData.phoneNumber;
    if (formData.profileImageUrl !== user?.profileImageUrl) payload.profileImageUrl = formData.profileImageUrl; // Changed

    if (Object.keys(payload).length === 0) {
      toast({ title: "No changes to save.", variant: "default" });
      setIsEditing(false);
      setLoading(false);
      return;
    }

    try {
      // Assuming PUT /api/users/me is the endpoint for self-update
      const response = await apiRequest("PUT", "/api/users/me", payload);
      const updatedUser = await response.json();

      authManager.updateUser(updatedUser); // Update user in authManager
      setUser(updatedUser); // Update local component state
      toast({ title: "Profile updated successfully!", variant: "default" });
      setIsEditing(false);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "Failed to update profile.";
      setError(errorMessage);
      toast({ title: "Update Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p>Loading profile or not logged in...</p>
        {/* Optionally, redirect to login or show login button */}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Your Profile</CardTitle>
            <CardDescription>View and manage your account details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" name="firstName" value={formData.firstName} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" name="lastName" value={formData.lastName} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
                  <Input id="phoneNumber" name="phoneNumber" type="tel" value={formData.phoneNumber} onChange={handleInputChange} />
                </div>
                 <div>
                  <Label htmlFor="profileImageUrl">Profile Image URL (Optional)</Label>
                  <Input id="profileImageUrl" name="profileImageUrl" type="url" value={formData.profileImageUrl} onChange={handleInputChange} />
                </div>
                {/* Add other editable fields here */}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setIsEditing(false); setError(""); }}>Cancel</Button>
                  <Button type="submit" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                    <img
                        src={user.profileImageUrl || `https://avatar.vercel.sh/${user.email}.png?size=100`}
                        alt="Profile"
                        className="w-20 h-20 rounded-full object-cover"
                    />
                    <div>
                        <h2 className="text-xl font-semibold">{user.firstName} {user.lastName}</h2>
                        <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                </div>

                <p><strong>Role:</strong> {user.role}</p>
                <p><strong>Phone:</strong> {user.phoneNumber || 'Not provided'}</p>
                <p><strong>Email Verified:</strong> {user.isVerified ? 'Yes' : 'No'}</p>
                <p><strong>Account Active:</strong> {user.isActive ? 'Yes' : 'No'}</p>
                <p><strong>Joined:</strong> {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</p>

                {/* Display other non-editable fields if needed */}
                <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
              </div>
            )}
          </CardContent>
          { user.updatedAt &&
            <CardFooter className="text-xs text-gray-500">
                Last updated: {new Date(user.updatedAt).toLocaleString()}
            </CardFooter>
          }
        </Card>
      </div>
    </div>
  );
}