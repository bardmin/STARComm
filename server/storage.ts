import { 
  users, 
  services, 
  bookings, 
  wallets, 
  tokenTransactions, 
  starProjects, 
  starCauses, 
  reviews, 
  messages,
  serviceCategories,
  projectContributions,
  causeDonations,
  agentStats,
  type User, 
  type InsertUser,
  type Service,
  type InsertService,
  type Booking,
  type InsertBooking,
  type Wallet,
  type InsertWallet,
  type TokenTransaction,
  type InsertTokenTransaction,
  type StarProject,
  type InsertStarProject,
  type StarCause,
  type InsertStarCause,
  type Review,
  type InsertReview,
  type Message,
  type InsertMessage,
  type ServiceCategory
} from "@shared/schema";

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;

  // Service management
  getService(id: number): Promise<Service | undefined>;
  getServices(): Promise<Service[]>;
  getServicesByProvider(providerId: number): Promise<Service[]>;
  getServicesByCategory(categoryId: number): Promise<Service[]>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, updates: Partial<Service>): Promise<Service | undefined>;
  searchServices(query: string): Promise<Service[]>;

  // Service categories
  getServiceCategories(): Promise<ServiceCategory[]>;

  // Booking management
  getBooking(id: number): Promise<Booking | undefined>;
  getBookings(): Promise<Booking[]>;
  getBookingsByResident(residentId: number): Promise<Booking[]>;
  getBookingsByProvider(providerId: number): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: number, updates: Partial<Booking>): Promise<Booking | undefined>;

  // Wallet management
  getWallet(userId: number): Promise<Wallet | undefined>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  updateWallet(userId: number, updates: Partial<Wallet>): Promise<Wallet | undefined>;

  // Token transactions
  getTokenTransactions(userId: number): Promise<TokenTransaction[]>;
  createTokenTransaction(transaction: InsertTokenTransaction): Promise<TokenTransaction>;

  // STAR Projects
  getStarProject(id: number): Promise<StarProject | undefined>;
  getStarProjects(): Promise<StarProject[]>;
  createStarProject(project: InsertStarProject): Promise<StarProject>;
  updateStarProject(id: number, updates: Partial<StarProject>): Promise<StarProject | undefined>;

  // STAR Causes
  getStarCause(id: number): Promise<StarCause | undefined>;
  getStarCauses(): Promise<StarCause[]>;
  createStarCause(cause: InsertStarCause): Promise<StarCause>;
  updateStarCause(id: number, updates: Partial<StarCause>): Promise<StarCause | undefined>;

  // Reviews
  getReview(id: number): Promise<Review | undefined>;
  getReviewsByService(serviceId: number): Promise<Review[]>;
  getReviewsByProvider(providerId: number): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;

  // Messages
  getMessages(userId: number): Promise<Message[]>;
  getConversation(userId1: number, userId2: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(messageId: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private services: Map<number, Service> = new Map();
  private bookings: Map<number, Booking> = new Map();
  private wallets: Map<number, Wallet> = new Map();
  private tokenTransactions: Map<number, TokenTransaction> = new Map();
  private starProjects: Map<number, StarProject> = new Map();
  private starCauses: Map<number, StarCause> = new Map();
  private reviews: Map<number, Review> = new Map();
  private messages: Map<number, Message> = new Map();
  private serviceCategories: Map<number, ServiceCategory> = new Map();
  
  private currentUserId = 1;
  private currentServiceId = 1;
  private currentBookingId = 1;
  private currentWalletId = 1;
  private currentTransactionId = 1;
  private currentProjectId = 1;
  private currentCauseId = 1;
  private currentReviewId = 1;
  private currentMessageId = 1;
  private currentCategoryId = 1;

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Initialize service categories
    const categories = [
      { id: 1, name: "Home Services", description: "Cleaning, repairs, maintenance", icon: "fas fa-home", isActive: true },
      { id: 2, name: "Personal Care", description: "Beauty, wellness, health", icon: "fas fa-cut", isActive: true },
      { id: 3, name: "Professional Services", description: "Consulting, legal, financial", icon: "fas fa-briefcase", isActive: true },
      { id: 4, name: "Creative Services", description: "Design, photography, writing", icon: "fas fa-palette", isActive: true },
      { id: 5, name: "Fitness & Health", description: "Training, nutrition, therapy", icon: "fas fa-dumbbell", isActive: true },
      { id: 6, name: "Education", description: "Tutoring, courses, coaching", icon: "fas fa-graduation-cap", isActive: true },
    ];

    categories.forEach(category => {
      this.serviceCategories.set(category.id, category);
    });
    this.currentCategoryId = categories.length + 1;

    // Create sample users
    const sampleUsers = [
      {
        id: 1,
        email: "sarah.cleaning@example.com",
        password: "hashed_password",
        firstName: "Sarah",
        lastName: "Johnson",
        role: "service_provider",
        phoneNumber: "+1234567890",
        profileImage: null,
        isVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        email: "mike.handyman@example.com",
        password: "hashed_password",
        firstName: "Mike",
        lastName: "Wilson",
        role: "service_provider",
        phoneNumber: "+1234567891",
        profileImage: null,
        isVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        email: "lisa.tutor@example.com",
        password: "hashed_password",
        firstName: "Lisa",
        lastName: "Chen",
        role: "service_provider",
        phoneNumber: "+1234567892",
        profileImage: null,
        isVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 4,
        email: "david.chef@example.com",
        password: "hashed_password",
        firstName: "David",
        lastName: "Martinez",
        role: "service_provider",
        phoneNumber: "+1234567893",
        profileImage: null,
        isVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 5,
        email: "community.champion@example.com",
        password: "hashed_password",
        firstName: "Emma",
        lastName: "Thompson",
        role: "cause_champion",
        phoneNumber: "+1234567894",
        profileImage: null,
        isVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    sampleUsers.forEach(user => {
      this.users.set(user.id, user);
    });
    this.currentUserId = sampleUsers.length + 1;

    // Create sample services
    const sampleServices = [
      {
        id: 1,
        title: "Professional House Cleaning",
        description: "Deep cleaning service for homes. Includes kitchen, bathrooms, bedrooms, and living areas. Eco-friendly products available.",
        categoryId: 1,
        providerId: 1,
        pricePerHour: 25,
        location: "Downtown Area",
        images: null,
        requirements: "Please secure pets and valuables",
        isAvailable: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        title: "Home Repair & Maintenance",
        description: "General handyman services including plumbing, electrical basics, drywall repair, and furniture assembly.",
        categoryId: 1,
        providerId: 2,
        pricePerHour: 35,
        location: "City-wide",
        images: null,
        requirements: "Access to work area required",
        isAvailable: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        title: "Math & Science Tutoring",
        description: "Experienced tutor for high school and college level mathematics and science. Specializing in calculus, physics, and chemistry.",
        categoryId: 6,
        providerId: 3,
        pricePerHour: 40,
        location: "University District",
        images: null,
        requirements: "Study materials provided",
        isAvailable: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 4,
        title: "Personal Chef Services",
        description: "Custom meal preparation in your home. Specializing in healthy, organic cuisine. Menu planning and grocery shopping included.",
        categoryId: 1,
        providerId: 4,
        pricePerHour: 55,
        location: "Residential Areas",
        images: null,
        requirements: "Kitchen access and basic equipment",
        isAvailable: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 5,
        title: "Garden Design & Landscaping",
        description: "Professional garden design and landscaping services. From small urban gardens to large outdoor spaces.",
        categoryId: 1,
        providerId: 2,
        pricePerHour: 45,
        location: "Suburban Areas",
        images: null,
        requirements: "Site assessment required",
        isAvailable: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    sampleServices.forEach(service => {
      this.services.set(service.id, service);
    });
    this.currentServiceId = sampleServices.length + 1;

    // Create sample STAR Projects
    const sampleProjects = [
      {
        id: 1,
        title: "Community Garden Initiative",
        description: "Transform unused lot into a thriving community garden where residents can grow fresh produce together. Includes raised beds, irrigation system, and tool shed.",
        creatorId: 5,
        targetAmount: 5000,
        currentAmount: 1250,
        status: "active",
        location: "East Side Park",
        images: null,
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        title: "Senior Center Technology Classes",
        description: "Provide tablets and training to help seniors stay connected with family and access digital services. Includes weekly classes and ongoing support.",
        creatorId: 3,
        targetAmount: 3000,
        currentAmount: 2100,
        status: "active",
        location: "Community Center",
        images: null,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        title: "Youth Sports Equipment Fund",
        description: "Purchase new sports equipment for the local youth center. Basketball hoops, soccer goals, and safety gear for kids aged 5-16.",
        creatorId: 4,
        targetAmount: 2500,
        currentAmount: 800,
        status: "active",
        location: "Youth Recreation Center",
        images: null,
        deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    sampleProjects.forEach(project => {
      this.starProjects.set(project.id, project);
    });
    this.currentProjectId = sampleProjects.length + 1;

    // Create sample STAR Causes
    const sampleCauses = [
      {
        id: 1,
        title: "Emergency Food Bank Support",
        description: "Local food bank needs immediate support to serve 200 families affected by recent layoffs. Funds will purchase non-perishable food items and fresh produce.",
        championId: 5,
        targetAmount: 4000,
        currentAmount: 2400,
        urgency: "critical",
        status: "active",
        images: null,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        title: "Homeless Shelter Winter Supplies",
        description: "Help provide warm blankets, winter clothing, and heating supplies for the downtown homeless shelter during the cold season.",
        championId: 5,
        targetAmount: 3500,
        currentAmount: 1200,
        urgency: "high",
        status: "active",
        images: null,
        deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        title: "School Art Program Restoration",
        description: "Help restore the elementary school art program by funding art supplies, equipment, and part-time instructor wages after budget cuts.",
        championId: 3,
        targetAmount: 6000,
        currentAmount: 1800,
        urgency: "medium",
        status: "active",
        images: null,
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    sampleCauses.forEach(cause => {
      this.starCauses.set(cause.id, cause);
    });
    this.currentCauseId = sampleCauses.length + 1;

    // Create sample wallets for users
    sampleUsers.forEach(user => {
      const wallet = {
        id: user.id,
        userId: user.id,
        balance: user.role === 'service_provider' ? 150 : 500, // Give providers some initial earnings, residents more to spend
        escrowBalance: 0,
        totalEarned: user.role === 'service_provider' ? 350 : 0,
        totalSpent: user.role === 'resident' ? 200 : 0,
        updatedAt: new Date()
      };
      this.wallets.set(wallet.id, wallet);
    });
    this.currentWalletId = sampleUsers.length + 1;
  }

  // User management
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = {
      ...insertUser,
      id,
      isVerified: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);

    // Create wallet for new user
    await this.createWallet({ userId: id, balance: 0, escrowBalance: 0, totalEarned: 0, totalSpent: 0 });

    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.role === role);
  }

  // Service management
  async getService(id: number): Promise<Service | undefined> {
    return this.services.get(id);
  }

  async getServices(): Promise<Service[]> {
    return Array.from(this.services.values()).filter(service => service.isAvailable);
  }

  async getServicesByProvider(providerId: number): Promise<Service[]> {
    return Array.from(this.services.values()).filter(service => service.providerId === providerId);
  }

  async getServicesByCategory(categoryId: number): Promise<Service[]> {
    return Array.from(this.services.values()).filter(service => service.categoryId === categoryId && service.isAvailable);
  }

  async createService(insertService: InsertService): Promise<Service> {
    const id = this.currentServiceId++;
    const service: Service = {
      ...insertService,
      id,
      isAvailable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.services.set(id, service);
    return service;
  }

  async updateService(id: number, updates: Partial<Service>): Promise<Service | undefined> {
    const service = this.services.get(id);
    if (!service) return undefined;

    const updatedService = { ...service, ...updates, updatedAt: new Date() };
    this.services.set(id, updatedService);
    return updatedService;
  }

  async searchServices(query: string): Promise<Service[]> {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.services.values()).filter(service => 
      service.isAvailable && (
        service.title.toLowerCase().includes(lowercaseQuery) ||
        service.description.toLowerCase().includes(lowercaseQuery)
      )
    );
  }

  // Service categories
  async getServiceCategories(): Promise<ServiceCategory[]> {
    return Array.from(this.serviceCategories.values()).filter(category => category.isActive);
  }

  // Booking management
  async getBooking(id: number): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }

  async getBookings(): Promise<Booking[]> {
    return Array.from(this.bookings.values());
  }

  async getBookingsByResident(residentId: number): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(booking => booking.residentId === residentId);
  }

  async getBookingsByProvider(providerId: number): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(booking => booking.providerId === providerId);
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const id = this.currentBookingId++;
    const serviceId_SI = `SI-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`;
    
    const booking: Booking = {
      ...insertBooking,
      id,
      serviceId_SI,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    };
    this.bookings.set(id, booking);
    return booking;
  }

  async updateBooking(id: number, updates: Partial<Booking>): Promise<Booking | undefined> {
    const booking = this.bookings.get(id);
    if (!booking) return undefined;

    const updatedBooking = { ...booking, ...updates, updatedAt: new Date() };
    this.bookings.set(id, updatedBooking);
    return updatedBooking;
  }

  // Wallet management
  async getWallet(userId: number): Promise<Wallet | undefined> {
    return Array.from(this.wallets.values()).find(wallet => wallet.userId === userId);
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    const id = this.currentWalletId++;
    const wallet: Wallet = {
      ...insertWallet,
      id,
      updatedAt: new Date(),
    };
    this.wallets.set(id, wallet);
    return wallet;
  }

  async updateWallet(userId: number, updates: Partial<Wallet>): Promise<Wallet | undefined> {
    const wallet = Array.from(this.wallets.values()).find(w => w.userId === userId);
    if (!wallet) return undefined;

    const updatedWallet = { ...wallet, ...updates, updatedAt: new Date() };
    this.wallets.set(wallet.id, updatedWallet);
    return updatedWallet;
  }

  // Token transactions
  async getTokenTransactions(userId: number): Promise<TokenTransaction[]> {
    return Array.from(this.tokenTransactions.values())
      .filter(transaction => transaction.userId === userId)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async createTokenTransaction(insertTransaction: InsertTokenTransaction): Promise<TokenTransaction> {
    const id = this.currentTransactionId++;
    const transaction: TokenTransaction = {
      ...insertTransaction,
      id,
      status: insertTransaction.status || 'completed',
      createdAt: new Date(),
    };
    this.tokenTransactions.set(id, transaction);
    return transaction;
  }

  // STAR Projects
  async getStarProject(id: number): Promise<StarProject | undefined> {
    return this.starProjects.get(id);
  }

  async getStarProjects(): Promise<StarProject[]> {
    return Array.from(this.starProjects.values())
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async createStarProject(insertProject: InsertStarProject): Promise<StarProject> {
    const id = this.currentProjectId++;
    const project: StarProject = {
      ...insertProject,
      id,
      currentAmount: 0,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.starProjects.set(id, project);
    return project;
  }

  async updateStarProject(id: number, updates: Partial<StarProject>): Promise<StarProject | undefined> {
    const project = this.starProjects.get(id);
    if (!project) return undefined;

    const updatedProject = { ...project, ...updates, updatedAt: new Date() };
    this.starProjects.set(id, updatedProject);
    return updatedProject;
  }

  // STAR Causes
  async getStarCause(id: number): Promise<StarCause | undefined> {
    return this.starCauses.get(id);
  }

  async getStarCauses(): Promise<StarCause[]> {
    return Array.from(this.starCauses.values())
      .filter(cause => cause.status === 'active')
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async createStarCause(insertCause: InsertStarCause): Promise<StarCause> {
    const id = this.currentCauseId++;
    const cause: StarCause = {
      ...insertCause,
      id,
      currentAmount: 0,
      urgency: insertCause.urgency || 'normal',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.starCauses.set(id, cause);
    return cause;
  }

  async updateStarCause(id: number, updates: Partial<StarCause>): Promise<StarCause | undefined> {
    const cause = this.starCauses.get(id);
    if (!cause) return undefined;

    const updatedCause = { ...cause, ...updates, updatedAt: new Date() };
    this.starCauses.set(id, updatedCause);
    return updatedCause;
  }

  // Reviews
  async getReview(id: number): Promise<Review | undefined> {
    return this.reviews.get(id);
  }

  async getReviewsByService(serviceId: number): Promise<Review[]> {
    const bookings = Array.from(this.bookings.values()).filter(booking => booking.serviceId === serviceId);
    const bookingIds = bookings.map(booking => booking.id);
    return Array.from(this.reviews.values()).filter(review => bookingIds.includes(review.bookingId));
  }

  async getReviewsByProvider(providerId: number): Promise<Review[]> {
    return Array.from(this.reviews.values()).filter(review => review.revieweeId === providerId);
  }

  async createReview(insertReview: InsertReview): Promise<Review> {
    const id = this.currentReviewId++;
    const review: Review = {
      ...insertReview,
      id,
      createdAt: new Date(),
    };
    this.reviews.set(id, review);
    return review;
  }

  // Messages
  async getMessages(userId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.senderId === userId || message.receiverId === userId)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async getConversation(userId1: number, userId2: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => 
        (message.senderId === userId1 && message.receiverId === userId2) ||
        (message.senderId === userId2 && message.receiverId === userId1)
      )
      .sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const message: Message = {
      ...insertMessage,
      id,
      isRead: false,
      createdAt: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  async markMessageAsRead(messageId: number): Promise<void> {
    const message = this.messages.get(messageId);
    if (message) {
      this.messages.set(messageId, { ...message, isRead: true });
    }
  }
}

export const storage = new MemStorage();
