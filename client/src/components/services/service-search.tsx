import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface ServiceSearchProps {
  onSearch: (query: string, category: number | null, distance: string) => void;
  categories: Array<{
    id: number;
    name: string;
  }>;
}

export default function ServiceSearch({ onSearch, categories }: ServiceSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedDistance, setSelectedDistance] = useState("any");

  const handleSearch = () => {
    onSearch(searchQuery, selectedCategory, selectedDistance);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="What service do you need?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-12 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-primary-blue focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value ? parseInt(e.target.value) : null)}
              className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-blue focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              value={selectedDistance}
              onChange={(e) => setSelectedDistance(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-blue focus:border-transparent"
            >
              <option value="any">Any Distance</option>
              <option value="5">Within 5km</option>
              <option value="10">Within 10km</option>
              <option value="25">Within 25km</option>
            </select>
            <Button
              onClick={handleSearch}
              className="bg-primary-blue text-white px-8 py-3 rounded-xl font-semibold hover:bg-primary-blue-dark transition-colors"
            >
              Search
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
