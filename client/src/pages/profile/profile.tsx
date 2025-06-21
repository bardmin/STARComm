import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Added for bio
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { authManager, User } from "@/lib/auth";
// import { apiRequest } from "@/lib/queryClient"; // No longer used for profile update
import { useToast } from "@/hooks/use-toast";
import { auth as firebaseClientAuth, firestore } from "@/firebase"; // Firebase services
import { doc, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable, HttpsCallableError } from "firebase/functions";

export default function ProfilePage() {
  const { toast } = useToast();
  // User state will now be primarily driven by the Firestore listener via authManager
  const [currentUserFromAuthManager, setCurrentUserFromAuthManager] = useState(authManager.getAuthState().user);
  const [profileDataLoading, setProfileDataLoading] = useState(true); // For listener loading state

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>({}); // Initialize with partial User type

  const [formSubmitLoading, setFormSubmitLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Effect to listen to authManager state changes (e.g. after login)
  useEffect(() => {
    const handleAuthChange = () => {
        const authState = authManager.getAuthState();
        setCurrentUserFromAuthManager(authState.user);
        if (authState.user) {
            // Initialize form data when user data becomes available or changes
            setFormData({
                firstName: authState.user.firstName || "",
                lastName: authState.user.lastName || "",
                phoneNumber: authState.user.phoneNumber || "",
                profileImageUrl: authState.user.profileImageUrl || "",
                bio: authState.user.bio || "",
                address: authState.user.address || "", // Simple string address for this form
                // location, areaId, preferences would need more complex form fields
            });
        }
    };
    // Subscribe to authManager changes (conceptual, depends on authManager being an event emitter or having a subscribe method)
    // For simplicity, if authManager doesn't have a direct subscribe, this effect relies on App.tsx's onAuthStateChanged
    // to update authManager, which then causes this component to re-render if currentUserFromAuthManager is used as a dependency elsewhere.
    // A more robust way is to make authManager an observable or use a global state management that components subscribe to.
    // For now, we'll re-initialize form data if currentUserFromAuthManager changes.
    handleAuthChange(); // Initial call

    // This is a simplified subscription. In a real app, authManager would be a state store.
    // For now, we'll assume App.tsx's onAuthStateChanged updates authManager, and this component re-renders.
    // A better approach is to have a useAuth hook that provides the user and updates when authManager changes.
  }, [authManager.getAuthState().user]);


  // Effect for Firestore listener
  useEffect(() => {
    if (firebaseClientAuth.currentUser) {
      setProfileDataLoading(true);
      const userDocRef = doc(firestore, "users", firebaseClientAuth.currentUser.uid);
      const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const firestoreProfileData = docSnap.data() as User;
          // Decrypt phone number if it's encrypted and needs display (server sends decrypted for /me)
          // For direct Firestore listener, if phone is encrypted, it remains so.
          // The callable function returns decrypted phone, so authManager might already have it.
          // Let's assume for this view, if we get it from Firestore directly, we might need a client-side decrypt if it was stored encrypted.
          // However, the `updateUserProfile` callable returns decrypted phone, so that's what authManager should store.

          authManager.setDetailedUserProfile(firestoreProfileData); // Update authManager with full profile
          setCurrentUserFromAuthManager(authManager.getAuthState().user); // Refresh local state from authManager
          setFormData({ // Re-initialize form with potentially updated data from listener
              firstName: firestoreProfileData.firstName || "",
              lastName: firestoreProfileData.lastName || "",
              // Use decrypted phone from authManager if it's already there, otherwise from snapshot if needed
              phoneNumber: authManager.getAuthState().user?.phoneNumber || firestoreProfileData.phoneNumber || "",
              profileImageUrl: firestoreProfileData.profileImageUrl || "",
              bio: firestoreProfileData.bio || "",
              address: firestoreProfileData.address || "",
          });
        } else {
          console.error("User profile document does not exist in Firestore.");
          // This case should ideally not happen if onUserCreate function works correctly.
        }
        setProfileDataLoading(false);
      }, (error) => {
        console.error("Error listening to user profile:", error);
        toast({ title: "Error", description: "Could not load profile data in real-time.", variant: "destructive"});
        setProfileDataLoading(false);
      });

      return () => unsubscribe(); // Cleanup listener
    } else {
      // No Firebase user, clear local profile data or redirect
      setCurrentUserFromAuthManager(null);
      setProfileDataLoading(false);
    }
  }, [firebaseClientAuth.currentUser?.uid]); // Re-run if Firebase UID changes

  const user = currentUserFromAuthManager; // Use user state derived from authManager/listener

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitLoading(true);
    setFormError("");

    // Construct payload with only the fields present in formData that are editable
    // The callable function will also perform its own validation and field filtering.
    const updatePayload: any = {};
    if (formData.firstName !== user?.firstName) updatePayload.firstName = formData.firstName;
    if (formData.lastName !== user?.lastName) updatePayload.lastName = formData.lastName;
    if (formData.phoneNumber !== user?.phoneNumber) updatePayload.phoneNumber = formData.phoneNumber;
    if (formData.profileImageUrl !== user?.profileImageUrl) updatePayload.profileImageUrl = formData.profileImageUrl;
    if (formData.bio !== user?.bio) updatePayload.bio = formData.bio;
    if (formData.address !== user?.address) updatePayload.address = formData.address;
    // Add other fields like location, areaId, preferences if they are in the form

    if (Object.keys(updatePayload).length === 0) {
      toast({ title: "No changes to save.", variant: "default" });
      setIsEditing(false);
      setFormSubmitLoading(false);
      return;
    }

    const functions = getFunctions();
    const updateUserProfileCallable = httpsCallable(functions, 'updateUserProfile');

    try {
      const result = await updateUserProfileCallable(updatePayload);
      const resultData = result.data as { status: string; message: string; user?: User };

      if (resultData.status === "success" && resultData.user) {
        // Firestore listener should ideally update the state.
        // Optionally, update authManager here for immediate UI feedback if listener has lag.
        // authManager.setDetailedUserProfile(resultData.user); // This might cause a race if listener is also quick
        toast({ title: "Profile Updated!", description: resultData.message, variant: "default" });
        setIsEditing(false);
      } else {
        throw new Error(resultData.message || "Unknown error from callable function.");
      }
    } catch (error: any) {
      let message = "Failed to update profile.";
      if (error instanceof HttpsCallableError) {
        message = error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      setFormError(message);
      toast({ title: "Update Failed", description: message, variant: "destructive" });
      console.error("Callable function error:", error);
    } finally {
      setFormSubmitLoading(false);
    }
  };

  if (profileDataLoading && !user) { // Show loading only if no user data is available yet
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p>Loading profile...</p>
      </div>
    );
  }

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
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" name="firstName" value={formData.firstName || ""} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" name="lastName" value={formData.lastName || ""} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
                  <Input id="phoneNumber" name="phoneNumber" type="tel" value={formData.phoneNumber || ""} onChange={handleInputChange} />
                </div>
                 <div>
                  <Label htmlFor="profileImageUrl">Profile Image URL (Optional)</Label>
                  <Input id="profileImageUrl" name="profileImageUrl" type="url" value={formData.profileImageUrl || ""} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="bio">Bio (Optional)</Label>
                  <Textarea id="bio" name="bio" value={formData.bio || ""} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="address">Address (Optional)</Label>
                  <Input id="address" name="address" value={formData.address || ""} onChange={handleInputChange} />
                </div>
                {/* Add more complex fields like location object, preferences object as needed */}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setIsEditing(false); setFormError(""); }}>Cancel</Button>
                  <Button type="submit" disabled={formSubmitLoading}>
                    {formSubmitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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