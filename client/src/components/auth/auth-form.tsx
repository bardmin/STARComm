import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { authManager, establishServerSession } from "@/lib/auth"; // Import establishServerSession
import { apiRequest } from "@/lib/queryClient"; // This might be replaced by establishServerSession for login
import { auth as firebaseClientAuth } from "@/firebase"; // Import Firebase client auth instance
import { signInWithEmailAndPassword } from "firebase/auth";

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
        const userCredential = await signInWithEmailAndPassword(firebaseClientAuth, formData.email, formData.password);
        const idToken = await userCredential.user.getIdToken();

        // Call establishServerSession which handles backend call and authManager.setAuth
        await establishServerSession(idToken);
        onSuccess?.();
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
    } else { // Register mode (keeps existing logic for now, but server endpoint is refactored)
      try {
        const endpoint = "/api/auth/register"; // Register still goes to our backend
        const payload = formData;

        const response = await apiRequest("POST", endpoint, payload); // Using existing apiRequest

        // The response from POST /api/auth/register does not include a token anymore.
        // It includes { message, userId, email, role }.
        // After successful registration, user should be redirected to login.
        // For now, we can show a success message and let onSuccess handle redirection to login.
        // authManager.setAuth(data.user, data.token); // This line is removed as no token is returned
        console.log("Registration successful via server, user data:", await response.json());
        // onSuccess should ideally redirect to login page or show a "Please login" message.
        onSuccess?.(); // This might need adjustment in the parent component using AuthForm
      } catch (error) {
        setError(error instanceof Error ? error.message : "An error occurred during registration");
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
