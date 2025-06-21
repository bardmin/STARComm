import { useState, useEffect } from "react"; // Added useEffect
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Star, Bell, Menu, User, MessageSquare } from "lucide-react"; // Added MessageSquare
import { authManager, AuthState } from "@/lib/auth"; // Added AuthState type

export default function NavigationHeader() {
  const [location] = useLocation();
  // Use state to make component reactive to authManager changes
  const [authState, setAuthState] = useState<AuthState>(authManager.getAuthState());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = authManager.subscribe(() => {
      setAuthState(authManager.getAuthState());
    });
    return () => unsubscribe(); // Cleanup subscription
  }, []);

  const { isAuthenticated, user, hasUnreadMessages } = authState;

  const commonNavigation = [
    { name: "Services", href: "/services" },
    { name: "Community", href: "/community" },
  ];

  const authenticatedNavigation = [
    ...commonNavigation,
    { name: "Wallet", href: "/wallet" },
    {
      name: "Messages",
      href: "/messages",
      indicator: hasUnreadMessages ? <span className="ml-1 h-2 w-2 rounded-full bg-red-500 block" /> : null
    },
  ];

  const guestNavigation = commonNavigation; // Or a different set for guests if needed

  const navigation = isAuthenticated ? authenticatedNavigation : guestNavigation;


  const handleLogout = async () => { // Made async
    await authManager.logout();
    // authManager.logout(); // Removed duplicate call
    window.location.href = "/"; // Consider using wouter's navigate for SPA navigation
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
                className={`flex items-center font-medium transition-colors ${
                  location.startsWith(item.href)
                    ? "text-primary-blue"
                    : "text-gray-700 hover:text-primary-blue"
                }`}
              >
                {item.name}
                {item.indicator}
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
                  {navigation.map((item) => ( // Uses the correct navigation list now
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center font-medium py-2 px-4 rounded-lg transition-colors ${
                        location.startsWith(item.href)
                          ? "bg-primary-blue text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {item.name}
                      {item.indicator && <span className="ml-auto">{item.indicator}</span>}
                    </Link>
                  ))}
                  {isAuthenticated && ( // Specific authenticated links not in main nav list
                    <>
                       {/* Messages link is now part of authenticatedNavigation */}
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
