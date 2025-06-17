import { Link } from "wouter";
import AuthForm from "@/components/auth/auth-form";

export default function Register() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Join STAR Community
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Create your account and start connecting
          </p>
        </div>
        
        <AuthForm mode="register" />
        
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}