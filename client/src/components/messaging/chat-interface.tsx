import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Info, Paperclip, Send } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { authManager } from "@/lib/auth";

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface ChatInterfaceProps {
  otherUserId: number;
  otherUser: {
    firstName: string;
    lastName: string;
    profileImage?: string;
  };
}

export default function ChatInterface({ otherUserId, otherUser }: ChatInterfaceProps) {
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { user } = authManager.getAuthState();

  const { data: messages = [] } = useQuery({
    queryKey: ['/api/messages/conversation', otherUserId],
    refetchInterval: 3000, // Poll for new messages every 3 seconds
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", "/api/messages", {
        receiverId: otherUserId,
        content: content.trim(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/conversation', otherUserId] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      setNewMessage("");
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      sendMessageMutation.mutate(newMessage);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = () => {
    return `${otherUser.firstName[0]}${otherUser.lastName[0]}`;
  };

  return (
    <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm flex flex-col h-96">
      {/* Chat Header */}
      <div className="flex items-center space-x-3 p-6 border-b">
        <div className="w-10 h-10 bg-gradient-to-br from-primary-blue to-community-green rounded-full flex items-center justify-center">
          {otherUser.profileImage ? (
            <img
              src={otherUser.profileImage}
              alt={`${otherUser.firstName} ${otherUser.lastName}`}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <span className="text-white font-semibold text-sm">
              {getInitials()}
            </span>
          )}
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">
            {otherUser.firstName} {otherUser.lastName}
          </h4>
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            Online now
          </Badge>
        </div>
        <div className="ml-auto flex items-center space-x-2">
          <Button variant="ghost" size="sm">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message: Message) => {
              const isOwnMessage = message.senderId === user?.id;
              return (
                <div
                  key={message.id}
                  className={`flex items-start space-x-3 ${
                    isOwnMessage ? "justify-end" : ""
                  }`}
                >
                  {!isOwnMessage && (
                    <div className="w-8 h-8 bg-gradient-to-br from-primary-blue to-community-green rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold text-xs">
                        {getInitials()}
                      </span>
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2 max-w-xs ${
                      isOwnMessage
                        ? "bg-primary-blue text-white rounded-tr-sm"
                        : "bg-gray-100 text-gray-900 rounded-tl-sm"
                    }`}
                  >
                    <p>{message.content}</p>
                    <span
                      className={`text-xs ${
                        isOwnMessage ? "text-blue-200" : "text-gray-500"
                      }`}
                    >
                      {formatTime(message.createdAt)}
                    </span>
                  </div>
                  {isOwnMessage && (
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-600 font-semibold text-xs">
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="p-6 border-t">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
          <Input
            type="text"
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1"
            disabled={sendMessageMutation.isPending}
          />
          <Button variant="ghost" size="sm" type="button">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            type="submit"
            size="sm"
            className="bg-primary-blue text-white hover:bg-primary-blue-dark"
            disabled={sendMessageMutation.isPending || !newMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
