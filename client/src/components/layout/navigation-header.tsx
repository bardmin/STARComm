import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Star, Bell, Menu, User } from "lucide-react";
import { authManager } from "@/lib/auth";

export default function NavigationHeader() {
  const [location] = useLocation();
  const { isAuthenticated, user } = authManager.getAuthState();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: "Services", href: "/services" },
    { name: "Community", href: "/community" },
    { name: "Wallet", href: "/wallet" },
  ];

  const handleLogout = () => {
    authManager.logout();
    window.location.href = "/";
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <Star className="h-8 w-8 text-token-gold" />
              <span className="text-xl font-bold text-gray-900">STAR Community</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`font-medium transition-colors ${
                  location.startsWith(item.href)
                    ? "text-primary-blue"
                    : "text-gray-700 hover:text-primary-blue"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Button variant="ghost" size="sm" className="relative">
                  <Bell className="h-5 w-5" />
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs"
                  >
                    3
                  </Badge>
                </Button>
                <div className="flex items-center space-x-2">
                  <Link href="/profile">
                    <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                      <User className="h-4 w-4" />
                      <span className="hidden sm:inline">{user?.firstName}</span>
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    Logout
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/login">
                  <Button variant="outline" size="sm">
                    Login
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="bg-primary-blue hover:bg-primary-blue-dark text-white" size="sm">
                    Join Community
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <div className="flex flex-col space-y-4 mt-8">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`font-medium py-2 px-4 rounded-lg transition-colors ${
                        location.startsWith(item.href)
                          ? "bg-primary-blue text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {item.name}
                    </Link>
                  ))}
                  {isAuthenticated && (
                    <>
                      <Link
                        href="/messages"
                        onClick={() => setMobileMenuOpen(false)}
                        className="font-medium py-2 px-4 rounded-lg text-gray-700 hover:bg-gray-100"
                      >
                        Messages
                      </Link>
                      <Link
                        href="/profile"
                        onClick={() => setMobileMenuOpen(false)}
                        className="font-medium py-2 px-4 rounded-lg text-gray-700 hover:bg-gray-100"
                      >
                        Profile
                      </Link>
                      {authManager.isRole("admin") && (
                        <Link
                          href="/admin"
                          onClick={() => setMobileMenuOpen(false)}
                          className="font-medium py-2 px-4 rounded-lg text-gray-700 hover:bg-gray-100"
                        >
                          Admin
                        </Link>
                      )}
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
