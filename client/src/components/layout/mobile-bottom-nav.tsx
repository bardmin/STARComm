import { Link, useLocation } from "wouter";
import { Home, Search, Users, Wallet, User } from "lucide-react";
import { authManager } from "@/lib/auth";

export default function MobileBottomNav() {
  const [location] = useLocation();
  const { isAuthenticated } = authManager.getAuthState();

  if (!isAuthenticated) return null;

  const navItems = [
    { icon: Home, label: "Home", href: "/", key: "/" },
    { icon: Search, label: "Services", href: "/services", key: "/services" },
    { icon: Users, label: "Community", href: "/community", key: "/community" },
    { icon: Wallet, label: "Wallet", href: "/wallet", key: "/wallet" },
    { icon: User, label: "Profile", href: "/profile", key: "/profile" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50">
      <div className="grid grid-cols-5 h-20">
        {navItems.map(({ icon: Icon, label, href, key }) => {
          const isActive = location === key || (key !== "/" && location.startsWith(key));
          
          return (
            <Link
              key={key}
              href={href}
              className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
                isActive ? "text-primary-blue" : "text-gray-500"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
