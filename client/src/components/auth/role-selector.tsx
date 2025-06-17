import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Bolt, Handshake, Heart, Check } from "lucide-react";

interface RoleSelectorProps {
  onRoleSelect: (role: string) => void;
}

const roles = [
  {
    id: "resident",
    title: "Resident",
    description: "Find trusted local services, participate in community projects, and support causes",
    icon: Home,
    color: "bg-primary-blue",
    features: ["Book local services", "Join STAR Projects", "Support causes", "Rate & review"],
  },
  {
    id: "service_provider",
    title: "Service Provider",
    description: "Showcase your skills, grow your business, and serve your community",
    icon: Bolt,
    color: "bg-community-green",
    features: ["Create service listings", "Manage bookings", "Earn tokens", "Build reputation"],
  },
  {
    id: "agent",
    title: "Community Agent",
    description: "Help others join, earn commissions, and strengthen community bonds",
    icon: Handshake,
    color: "bg-purple-600",
    features: ["Onboard new users", "Earn commissions", "Track performance", "Access marketing tools"],
  },
  {
    id: "cause_champion",
    title: "Cause Champion",
    description: "Lead charitable initiatives and create positive community impact",
    icon: Heart,
    color: "bg-cause-orange",
    features: ["Manage STAR Causes", "Review applications", "Track donations", "Report impact"],
  },
];

export default function RoleSelector({ onRoleSelect }: RoleSelectorProps) {
  return (
    <div className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Join Our Community</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose your role and start building stronger local connections today
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <Card
                key={role.id}
                className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-primary-blue group"
              >
                <CardContent className="p-8 text-center">
                  <div className={`w-16 h-16 ${role.color} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                    <Icon className="text-white text-2xl h-8 w-8" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{role.title}</h3>
                  
                  <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                    {role.description}
                  </p>
                  
                  <ul className="text-left text-sm text-gray-600 space-y-2 mb-6">
                    {role.features.map((feature, index) => (
                      <li key={index} className="flex items-center">
                        <Check className={`mr-2 h-4 w-4 ${role.color.replace('bg-', 'text-')}`} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  <Button
                    onClick={() => onRoleSelect(role.id)}
                    className={`w-full ${role.color} text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity`}
                  >
                    Join as {role.title}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
