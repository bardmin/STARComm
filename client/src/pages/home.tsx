import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import NavigationHeader from "@/components/layout/navigation-header";
import MobileBottomNav from "@/components/layout/mobile-bottom-nav";
import { Star, Search, UserPlus, Users, Heart, Coins, ArrowUp, MapPinIcon, Clock, StarIcon, Wrench, Home as HomeIcon, Handshake } from "lucide-react";
import { authManager } from "@/lib/auth";

export default function Home() {
  const { isAuthenticated } = authManager.getAuthState();
  const [stats, setStats] = useState({
    totalTokens: 127000,
    activeProjects: 23,
    supportedCauses: 8,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div>
                <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">
                  Connect with Local Services.<br/>
                  <span className="text-yellow-300">Build Your Community.</span>
                </h1>
                <p className="text-xl text-blue-100 mb-8 leading-relaxed">
                  Discover trusted local service providers, participate in community projects, and make a difference through our token-powered economy.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/services">
                  <Button className="bg-white text-primary-blue px-8 py-4 rounded-xl font-semibold hover:bg-gray-50 transition-colors shadow-lg">
                    <Search className="mr-2 h-5 w-5" />
                    Find Services
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="outline" className="border-2 border-white text-white px-8 py-4 rounded-xl font-semibold hover:bg-white hover:text-primary-blue transition-colors">
                    <UserPlus className="mr-2 h-5 w-5" />
                    Become a Provider
                  </Button>
                </Link>
              </div>

              {/* Token Economy Preview */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Community Token Economy</h3>
                  <Coins className="text-yellow-300 h-8 w-8" />
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-yellow-300">{stats.totalTokens.toLocaleString()}</div>
                    <div className="text-sm text-blue-200">Tokens Circulating</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-300">{stats.activeProjects}</div>
                    <div className="text-sm text-blue-200">Active Projects</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-300">{stats.supportedCauses}</div>
                    <div className="text-sm text-blue-200">Causes Supported</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              {/* Community illustration with floating cards */}
              <div className="relative bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20">
                {/* Service Provider Card Preview */}
                <Card className="mb-4 transform rotate-2">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-community-green to-primary-blue rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold">SM</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Sarah M.</h4>
                        <div className="flex items-center space-x-1">
                          <div className="flex text-yellow-400">
                            {[...Array(5)].map((_, i) => (
                              <StarIcon key={i} className="h-3 w-3 fill-current" />
                            ))}
                          </div>
                          <span className="text-sm text-gray-600">5.0 • 47 reviews</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Professional house cleaning • Available today</p>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-token-gold">45 tokens/hour</span>
                      <Link href="/services">
                        <Button size="sm" className="bg-primary-blue text-white">
                          Book Now
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                {/* Community Project Card Preview */}
                <Card className="transform -rotate-1">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <Badge className="bg-community-green/10 text-community-green">
                        STAR Project
                      </Badge>
                      <span className="text-sm text-gray-500">3 days left</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2">Community Garden Setup</h4>
                    <div className="mb-3">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress: 1,200/2,000 tokens</span>
                        <span>60%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-community-green h-2 rounded-full" style={{ width: '60%' }}></div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">18 contributors</span>
                      <Button size="sm" className="bg-community-green text-white">
                        Contribute
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Role Selector Section */}
      {!isAuthenticated && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Join Our Community</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Choose your role and start building stronger local connections today
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Resident Role */}
              <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-primary-blue">
                <CardContent className="p-8 text-center bg-gradient-to-br from-blue-50 to-blue-100">
                  <div className="w-16 h-16 bg-primary-blue rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <HomeIcon className="text-white h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Resident</h3>
                  <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                    Find trusted local services, participate in community projects, and support causes
                  </p>
                  <Link href="/register">
                    <Button className="w-full bg-primary-blue text-white py-3 rounded-xl font-semibold hover:bg-primary-blue-dark transition-colors">
                      Join as Resident
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Service Provider Role */}
              <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-community-green">
                <CardContent className="p-8 text-center bg-gradient-to-br from-green-50 to-green-100">
                  <div className="w-16 h-16 bg-community-green rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Wrench className="text-white h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Service Provider</h3>
                  <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                    Showcase your skills, grow your business, and serve your community
                  </p>
                  <Link href="/register">
                    <Button className="w-full bg-community-green text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors">
                      Become Provider
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Agent Role */}
              <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-purple-600">
                <CardContent className="p-8 text-center bg-gradient-to-br from-purple-50 to-purple-100">
                  <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Handshake className="text-white h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Community Agent</h3>
                  <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                    Help others join, earn commissions, and strengthen community bonds
                  </p>
                  <Link href="/register">
                    <Button className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition-colors">
                      Become Agent
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Cause Champion Role */}
              <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-cause-orange">
                <CardContent className="p-8 text-center bg-gradient-to-br from-orange-50 to-orange-100">
                  <div className="w-16 h-16 bg-cause-orange rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Heart className="text-white h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Cause Champion</h3>
                  <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                    Lead charitable initiatives and create positive community impact
                  </p>
                  <Link href="/register">
                    <Button className="w-full bg-cause-orange text-white py-3 rounded-xl font-semibold hover:bg-orange-700 transition-colors">
                      Become Champion
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div className="lg:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <Star className="text-yellow-400 h-8 w-8" />
                <span className="text-xl font-bold">STAR Community</span>
              </div>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Empowering local communities through secure service connections, collaborative projects, and charitable giving. Building stronger neighborhoods, one service at a time.
              </p>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-gray-300">
                <li><Link href="/services" className="hover:text-white transition-colors">Find Services</Link></li>
                <li><Link href="/register" className="hover:text-white transition-colors">Become Provider</Link></li>
                <li><Link href="/community" className="hover:text-white transition-colors">STAR Projects</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-300">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Safety</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Community Guidelines</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="text-gray-400 text-sm mb-4 md:mb-0">
                © 2024 STAR Community. All rights reserved.
              </div>
              <div className="flex space-x-6 text-sm text-gray-400">
                <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <MobileBottomNav />
    </div>
  );
}
