import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table with role-based system
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull(), // 'resident', 'service_provider', 'agent', 'cause_champion', 'admin'
  phoneNumber: text("phone_number"),
  profileImage: text("profile_image"),
  isVerified: boolean("is_verified").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Service categories
export const serviceCategories = pgTable("service_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  isActive: boolean("is_active").default(true),
});

// Services offered by service providers
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => users.id).notNull(),
  categoryId: integer("category_id").references(() => serviceCategories.id).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  pricePerHour: integer("price_per_hour").notNull(), // in tokens
  isAvailable: boolean("is_available").default(true),
  location: text("location"),
  images: jsonb("images"), // array of image URLs
  requirements: text("requirements"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Token wallet for users
export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  balance: integer("balance").default(0), // in tokens
  escrowBalance: integer("escrow_balance").default(0), // tokens in escrow
  totalEarned: integer("total_earned").default(0),
  totalSpent: integer("total_spent").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Token transactions
export const tokenTransactions = pgTable("token_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // 'purchase', 'earn', 'spend', 'escrow_hold', 'escrow_release', 'redeem'
  amount: integer("amount").notNull(),
  description: text("description"),
  relatedId: integer("related_id"), // booking_id, project_id, etc.
  status: text("status").default('completed'), // 'pending', 'completed', 'failed'
  createdAt: timestamp("created_at").defaultNow(),
});

// Service bookings
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  residentId: integer("resident_id").references(() => users.id).notNull(),
  providerId: integer("provider_id").references(() => users.id).notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time").notNull(),
  duration: integer("duration").notNull(), // in hours
  totalTokens: integer("total_tokens").notNull(),
  serviceId_SI: text("service_id_si").notNull(), // Service ID for verification
  status: text("status").default('pending'), // 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'
  requirements: text("requirements"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reviews and ratings
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => bookings.id).notNull(),
  reviewerId: integer("reviewer_id").references(() => users.id).notNull(),
  revieweeId: integer("reviewee_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  images: jsonb("images"), // array of image URLs
  createdAt: timestamp("created_at").defaultNow(),
});

// STAR Projects (community initiatives)
export const starProjects = pgTable("star_projects", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  targetAmount: integer("target_amount").notNull(), // in tokens
  currentAmount: integer("current_amount").default(0),
  location: text("location"),
  images: jsonb("images"),
  status: text("status").default('active'), // 'active', 'completed', 'cancelled'
  deadline: timestamp("deadline"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Project contributions
export const projectContributions = pgTable("project_contributions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => starProjects.id).notNull(),
  contributorId: integer("contributor_id").references(() => users.id).notNull(),
  amount: integer("amount").notNull(), // in tokens
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// STAR Causes (charitable giving)
export const starCauses = pgTable("star_causes", {
  id: serial("id").primaryKey(),
  championId: integer("champion_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  targetAmount: integer("target_amount").notNull(), // in tokens
  currentAmount: integer("current_amount").default(0),
  urgency: text("urgency").default('normal'), // 'low', 'normal', 'high', 'urgent'
  status: text("status").default('active'), // 'pending', 'active', 'completed', 'rejected'
  images: jsonb("images"),
  deadline: timestamp("deadline"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Cause donations
export const causeDonations = pgTable("cause_donations", {
  id: serial("id").primaryKey(),
  causeId: integer("cause_id").references(() => starCauses.id).notNull(),
  donorId: integer("donor_id").references(() => users.id).notNull(),
  amount: integer("amount").notNull(), // in tokens
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Messages for in-app communication
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  receiverId: integer("receiver_id").references(() => users.id).notNull(),
  bookingId: integer("booking_id").references(() => bookings.id), // optional, for booking-related messages
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Agent performance tracking
export const agentStats = pgTable("agent_stats", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => users.id).notNull(),
  totalReferrals: integer("total_referrals").default(0),
  monthlyReferrals: integer("monthly_referrals").default(0),
  totalCommissions: integer("total_commissions").default(0), // in tokens
  monthlyCommissions: integer("monthly_commissions").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Create insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertServiceSchema = createInsertSchema(services).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertBookingSchema = createInsertSchema(bookings).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  serviceId_SI: true
});

export const insertWalletSchema = createInsertSchema(wallets).omit({ 
  id: true, 
  updatedAt: true 
});

export const insertTokenTransactionSchema = createInsertSchema(tokenTransactions).omit({ 
  id: true, 
  createdAt: true 
});

export const insertStarProjectSchema = createInsertSchema(starProjects).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertStarCauseSchema = createInsertSchema(starCauses).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertReviewSchema = createInsertSchema(reviews).omit({ 
  id: true, 
  createdAt: true 
});

export const insertMessageSchema = createInsertSchema(messages).omit({ 
  id: true, 
  createdAt: true 
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;

export type TokenTransaction = typeof tokenTransactions.$inferSelect;
export type InsertTokenTransaction = z.infer<typeof insertTokenTransactionSchema>;

export type StarProject = typeof starProjects.$inferSelect;
export type InsertStarProject = z.infer<typeof insertStarProjectSchema>;

export type StarCause = typeof starCauses.$inferSelect;
export type InsertStarCause = z.infer<typeof insertStarCauseSchema>;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type ProjectContribution = typeof projectContributions.$inferSelect;
export type CauseDonation = typeof causeDonations.$inferSelect;
export type AgentStats = typeof agentStats.$inferSelect;
