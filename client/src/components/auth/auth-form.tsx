import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { authManager } from "@/lib/auth"; // establishServerSession will be removed from here
// import { apiRequest } from "@/lib/queryClient"; // No longer used for register/login direct calls
import { auth as firebaseClientAuth } from "@/firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile as updateFirebaseProfile } from "firebase/auth";
import { getFunctions, httpsCallable, HttpsCallableError } from 'firebase/functions';

interface AuthFormProps {
  mode: "login" | "register";
  onSuccess?: () => void;
}

export default function AuthForm({ mode, onSuccess }: AuthFormProps) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "resident",
    phoneNumber: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (mode === 'login') {
      try {
        // Firebase client SDK handles login
        await signInWithEmailAndPassword(firebaseClientAuth, formData.email, formData.password);
        // onAuthStateChanged in App.tsx will handle setting authManager state and navigation
        // No custom JWT / sessionLogin needed here anymore.
        onSuccess?.(); // This should typically redirect to dashboard or home
      } catch (firebaseError: any) {
        console.error("Firebase login error:", firebaseError);
        if (firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/invalid-credential') {
          setError("Invalid email or password.");
        } else {
          setError(firebaseError.message || "Failed to login with Firebase.");
        }
      } finally {
        setLoading(false);
      }
    } else { // Register mode
      try {
        const userCredential = await createUserWithEmailAndPassword(firebaseClientAuth, formData.email, formData.password);

        // Set display name in Firebase Auth
        await updateFirebaseProfile(userCredential.user, {
          displayName: `${formData.firstName} ${formData.lastName}`
        });
        console.info("Firebase Auth user created and display name set client-side."); // Changed to console.info

        // Call the new callable function to set initial role, phone, etc. in Firestore
        const functionsInstance = getFunctions();
        const setUserInitialDataCallable = httpsCallable(functionsInstance, 'setUserInitialProfileData');
        await setUserInitialDataCallable({
          role: formData.role,
          phoneNumber: formData.phoneNumber || null, // Send null if empty
          firstName: formData.firstName,
          lastName: formData.lastName
        });
        console.info("setUserInitialProfileData callable function call succeeded client-side."); // Changed to console.info

        // onAuthStateChanged in App.tsx will pick up the new user.
        // Registration success handling (e.g., redirect to login or show message) is done by onSuccess prop
        onSuccess?.();

      } catch (error: any) {
        console.error("Registration error:", error);
        if (error instanceof HttpsCallableError) {
          setError(error.message || "Failed to set initial profile data.");
        } else if (error.code === 'auth/email-already-in-use') {
          setError("This email address is already in use.");
        } else {
          setError(error.message || "An error occurred during registration.");
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          {mode === "login" ? "Welcome Back" : "Join STAR Community"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="role">I want to join as</Label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                  required
                >
                  <option value="resident">Resident</option>
                  <option value="service_provider">Service Provider</option>
                  <option value="agent">Community Agent</option>
                  <option value="cause_champion">Cause Champion</option>
                </select>
              </div>

              <div>
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-primary-blue hover:bg-primary-blue-dark text-white"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
