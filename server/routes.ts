import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { insertUserSchema, insertServiceSchema, insertBookingSchema, insertStarProjectSchema, insertStarCauseSchema, insertReviewSchema, insertMessageSchema } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Middleware for authentication
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      // Generate JWT token
      const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

      res.status(201).json({ user: userWithoutPassword, token });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: "Account is deactivated" });
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      
      // Generate JWT token
      const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

      res.json({ user: userWithoutPassword, token });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User management routes
  app.get("/api/users", authenticateToken, async (req, res) => {
    try {
      const { role } = req.query;
      let users;
      
      if (role) {
        users = await storage.getUsersByRole(role as string);
      } else {
        users = await storage.getUsers();
      }

      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/users/:id", authenticateToken, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const updates = req.body;

      // Users can only update their own profile, or admins can update any
      if (req.user.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }

      const user = await storage.updateUser(userId, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Service routes
  app.get("/api/services", async (req, res) => {
    try {
      const { category, search, provider } = req.query;
      let services;

      if (search) {
        services = await storage.searchServices(search as string);
      } else if (category) {
        services = await storage.getServicesByCategory(parseInt(category as string));
      } else if (provider) {
        services = await storage.getServicesByProvider(parseInt(provider as string));
      } else {
        services = await storage.getServices();
      }

      res.json(services);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/services/:id", async (req, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      const service = await storage.getService(serviceId);
      
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      res.json(service);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/services", authenticateToken, async (req, res) => {
    try {
      // Only service providers can create services
      if (req.user.role !== 'service_provider') {
        return res.status(403).json({ message: "Only service providers can create services" });
      }

      const serviceData = insertServiceSchema.parse({
        ...req.body,
        providerId: req.user.userId,
      });

      const service = await storage.createService(serviceData);
      res.status(201).json(service);
    } catch (error) {
      console.error("Service creation error:", error);
      res.status(400).json({ message: "Invalid service data" });
    }
  });

  app.put("/api/services/:id", authenticateToken, async (req, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      const service = await storage.getService(serviceId);

      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      // Only the service provider can update their service
      if (service.providerId !== req.user.userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updatedService = await storage.updateService(serviceId, req.body);
      res.json(updatedService);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Service categories
  app.get("/api/service-categories", async (req, res) => {
    try {
      const categories = await storage.getServiceCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Booking routes
  app.get("/api/bookings", authenticateToken, async (req, res) => {
    try {
      const { type } = req.query;
      let bookings;

      if (type === 'resident') {
        bookings = await storage.getBookingsByResident(req.user.userId);
      } else if (type === 'provider') {
        bookings = await storage.getBookingsByProvider(req.user.userId);
      } else {
        bookings = await storage.getBookings();
      }

      res.json(bookings);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/bookings", authenticateToken, async (req, res) => {
    try {
      const bookingData = insertBookingSchema.parse({
        ...req.body,
        residentId: req.user.userId,
      });

      // Check if user has sufficient token balance
      const wallet = await storage.getWallet(req.user.userId);
      if (!wallet || wallet.balance < bookingData.totalTokens) {
        return res.status(400).json({ message: "Insufficient token balance" });
      }

      // Create booking
      const booking = await storage.createBooking(bookingData);

      // Move tokens to escrow
      await storage.updateWallet(req.user.userId, {
        balance: wallet.balance - bookingData.totalTokens,
        escrowBalance: wallet.escrowBalance + bookingData.totalTokens,
      });

      // Create transaction record
      await storage.createTokenTransaction({
        userId: req.user.userId,
        type: 'escrow_hold',
        amount: -bookingData.totalTokens,
        description: `Booking: ${booking.serviceId_SI}`,
        relatedId: booking.id,
      });

      res.status(201).json(booking);
    } catch (error) {
      console.error("Booking creation error:", error);
      res.status(400).json({ message: "Invalid booking data" });
    }
  });

  app.put("/api/bookings/:id", authenticateToken, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Only relevant parties can update booking
      if (booking.residentId !== req.user.userId && booking.providerId !== req.user.userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updatedBooking = await storage.updateBooking(bookingId, req.body);

      // If booking is completed, release escrow
      if (req.body.status === 'completed' && booking.status !== 'completed') {
        const residentWallet = await storage.getWallet(booking.residentId);
        const providerWallet = await storage.getWallet(booking.providerId);

        if (residentWallet && providerWallet) {
          // Release tokens from escrow to provider
          await storage.updateWallet(booking.residentId, {
            escrowBalance: residentWallet.escrowBalance - booking.totalTokens,
            totalSpent: residentWallet.totalSpent + booking.totalTokens,
          });

          await storage.updateWallet(booking.providerId, {
            balance: providerWallet.balance + booking.totalTokens,
            totalEarned: providerWallet.totalEarned + booking.totalTokens,
          });

          // Create transaction records
          await storage.createTokenTransaction({
            userId: booking.residentId,
            type: 'escrow_release',
            amount: -booking.totalTokens,
            description: `Service completed: ${booking.serviceId_SI}`,
            relatedId: booking.id,
          });

          await storage.createTokenTransaction({
            userId: booking.providerId,
            type: 'earn',
            amount: booking.totalTokens,
            description: `Service payment: ${booking.serviceId_SI}`,
            relatedId: booking.id,
          });
        }
      }

      res.json(updatedBooking);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Wallet routes
  app.get("/api/wallet", authenticateToken, async (req, res) => {
    try {
      const wallet = await storage.getWallet(req.user.userId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }

      res.json(wallet);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/transactions", authenticateToken, async (req, res) => {
    try {
      const transactions = await storage.getTokenTransactions(req.user.userId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/wallet/transactions", authenticateToken, async (req, res) => {
    try {
      const transactions = await storage.getTokenTransactions(req.user.userId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/transactions/purchase", authenticateToken, async (req, res) => {
    try {
      const { amount } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid token amount" });
      }

      const wallet = await storage.getWallet(req.user.userId);
      if (!wallet) {
        // Create wallet if it doesn't exist
        const newWallet = await storage.createWallet({
          userId: req.user.userId,
          balance: amount,
          escrowBalance: 0,
          totalEarned: 0,
          totalSpent: 0,
        });

        // Create transaction record
        await storage.createTokenTransaction({
          userId: req.user.userId,
          type: 'purchase',
          amount: amount,
          description: `Token purchase: ${amount} tokens`,
          status: 'completed',
        });

        return res.json(newWallet);
      }

      // Update wallet balance
      const updatedWallet = await storage.updateWallet(req.user.userId, {
        balance: (wallet.balance || 0) + amount,
      });

      // Create transaction record
      await storage.createTokenTransaction({
        userId: req.user.userId,
        type: 'purchase',
        amount: amount,
        description: `Token purchase: ${amount} tokens`,
        status: 'completed',
      });

      res.json(updatedWallet);
    } catch (error) {
      console.error("Token purchase error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/transactions/redeem", authenticateToken, async (req, res) => {
    try {
      const { amount } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid token amount" });
      }

      const wallet = await storage.getWallet(req.user.userId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }

      if ((wallet.balance || 0) < amount) {
        return res.status(400).json({ message: "Insufficient token balance" });
      }

      // Calculate redemption amount (60% rate)
      const redemptionValue = amount * 0.6;

      // Update wallet balance
      const updatedWallet = await storage.updateWallet(req.user.userId, {
        balance: (wallet.balance || 0) - amount,
      });

      // Create transaction record
      await storage.createTokenTransaction({
        userId: req.user.userId,
        type: 'redeem',
        amount: -amount,
        description: `Token redemption: ${amount} tokens = $${redemptionValue.toFixed(2)}`,
        status: 'completed',
      });

      res.json(updatedWallet);
    } catch (error) {
      console.error("Token redemption error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/wallet/purchase", authenticateToken, async (req, res) => {
    try {
      const { amount } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid token amount" });
      }

      const wallet = await storage.getWallet(req.user.userId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }

      // Update wallet balance
      const updatedWallet = await storage.updateWallet(req.user.userId, {
        balance: wallet.balance + amount,
      });

      // Create transaction record
      await storage.createTokenTransaction({
        userId: req.user.userId,
        type: 'purchase',
        amount: amount,
        description: `Token purchase: ${amount} tokens`,
      });

      res.json(updatedWallet);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // STAR Projects routes
  app.get("/api/star-projects", async (req, res) => {
    try {
      const projects = await storage.getStarProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/star-projects/:id", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getStarProject(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/star-projects", authenticateToken, async (req, res) => {
    try {
      const projectData = insertStarProjectSchema.parse({
        ...req.body,
        creatorId: req.user.userId,
      });

      const project = await storage.createStarProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      console.error("Project creation error:", error);
      res.status(400).json({ message: "Invalid project data" });
    }
  });

  app.post("/api/star-projects/:id/contribute", authenticateToken, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid contribution amount" });
      }

      const project = await storage.getStarProject(projectId);
      if (!project || project.status !== 'active') {
        return res.status(404).json({ message: "Project not found or inactive" });
      }

      const wallet = await storage.getWallet(req.user.userId);
      if (!wallet || wallet.balance < amount) {
        return res.status(400).json({ message: "Insufficient token balance" });
      }

      // Update project amount
      await storage.updateStarProject(projectId, {
        currentAmount: project.currentAmount + amount,
      });

      // Update contributor's wallet
      await storage.updateWallet(req.user.userId, {
        balance: wallet.balance - amount,
        totalSpent: wallet.totalSpent + amount,
      });

      // Create transaction record
      await storage.createTokenTransaction({
        userId: req.user.userId,
        type: 'spend',
        amount: -amount,
        description: `Contribution to: ${project.title}`,
        relatedId: projectId,
      });

      res.json({ message: "Contribution successful" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // STAR Causes routes
  app.get("/api/star-causes", async (req, res) => {
    try {
      const causes = await storage.getStarCauses();
      res.json(causes);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/star-causes/:id", async (req, res) => {
    try {
      const causeId = parseInt(req.params.id);
      const cause = await storage.getStarCause(causeId);
      
      if (!cause) {
        return res.status(404).json({ message: "Cause not found" });
      }

      res.json(cause);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/star-causes", authenticateToken, async (req, res) => {
    try {
      const causeData = insertStarCauseSchema.parse({
        ...req.body,
        championId: req.user.userId,
      });

      const cause = await storage.createStarCause(causeData);
      res.status(201).json(cause);
    } catch (error) {
      console.error("Cause creation error:", error);
      res.status(400).json({ message: "Invalid cause data" });
    }
  });

  app.post("/api/star-causes/:id/donate", authenticateToken, async (req, res) => {
    try {
      const causeId = parseInt(req.params.id);
      const { amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid donation amount" });
      }

      const cause = await storage.getStarCause(causeId);
      if (!cause || cause.status !== 'active') {
        return res.status(404).json({ message: "Cause not found or inactive" });
      }

      const wallet = await storage.getWallet(req.user.userId);
      if (!wallet || wallet.balance < amount) {
        return res.status(400).json({ message: "Insufficient token balance" });
      }

      // Update cause amount
      await storage.updateStarCause(causeId, {
        currentAmount: cause.currentAmount + amount,
      });

      // Update donor's wallet
      await storage.updateWallet(req.user.userId, {
        balance: wallet.balance - amount,
        totalSpent: wallet.totalSpent + amount,
      });

      // Create transaction record
      await storage.createTokenTransaction({
        userId: req.user.userId,
        type: 'spend',
        amount: -amount,
        description: `Donation to: ${cause.title}`,
        relatedId: causeId,
      });

      res.json({ message: "Donation successful" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Review routes
  app.get("/api/reviews", async (req, res) => {
    try {
      const { service, provider } = req.query;
      let reviews;

      if (service) {
        reviews = await storage.getReviewsByService(parseInt(service as string));
      } else if (provider) {
        reviews = await storage.getReviewsByProvider(parseInt(provider as string));
      } else {
        reviews = [];
      }

      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/reviews", authenticateToken, async (req, res) => {
    try {
      const reviewData = insertReviewSchema.parse({
        ...req.body,
        reviewerId: req.user.userId,
      });

      const review = await storage.createReview(reviewData);
      res.status(201).json(review);
    } catch (error) {
      console.error("Review creation error:", error);
      res.status(400).json({ message: "Invalid review data" });
    }
  });

  // Message routes
  app.get("/api/messages", authenticateToken, async (req, res) => {
    try {
      const messages = await storage.getMessages(req.user.userId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/messages/conversation/:userId", authenticateToken, async (req, res) => {
    try {
      const otherUserId = parseInt(req.params.userId);
      const messages = await storage.getConversation(req.user.userId, otherUserId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/messages", authenticateToken, async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse({
        ...req.body,
        senderId: req.user.userId,
      });

      const message = await storage.createMessage(messageData);
      res.status(201).json(message);
    } catch (error) {
      console.error("Message creation error:", error);
      res.status(400).json({ message: "Invalid message data" });
    }
  });

  app.put("/api/messages/:id/read", authenticateToken, async (req, res) => {
    try {
      const messageId = parseInt(req.params.id);
      await storage.markMessageAsRead(messageId);
      res.json({ message: "Message marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin routes
  app.get("/api/admin/stats", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const users = await storage.getUsers();
      const services = await storage.getServices();
      const bookings = await storage.getBookings();
      const projects = await storage.getStarProjects();
      const causes = await storage.getStarCauses();

      const stats = {
        totalUsers: users.length,
        activeServices: services.filter(s => s.isAvailable).length,
        totalBookings: bookings.length,
        activeProjects: projects.filter(p => p.status === 'active').length,
        activeCauses: causes.filter(c => c.status === 'active').length,
        completedBookings: bookings.filter(b => b.status === 'completed').length,
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
