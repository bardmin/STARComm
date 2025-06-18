import type { Request } from 'express';

// Placeholder for Audit Logging
// In a real system, this would integrate with a robust logging service or database.
export interface AuditEventDetails {
  targetType?: string;    // e.g., 'user', 'booking', 'project'
  targetId?: string | number; // ID of the entity being acted upon
  changedFields?: { field: string; oldValue: any; newValue: any }[]; // For updates
  [key: string]: any;   // Allow other relevant details
}

export const logAuditEvent = (
  action: string,          // e.g., 'USER_LOGIN', 'PROJECT_CREATE', 'USER_ROLE_CHANGE'
  req: Request,            // Express request object to get IP, user agent, etc.
  userId: string | number | null | undefined, // ID of the user performing the action (if available)
  details?: AuditEventDetails
): void => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.socket?.remoteAddress;
  const userAgent = req.get('User-Agent');

  // Construct a detailed log message/object
  const logEntry = {
    timestamp,
    action,
    userId: userId || 'anonymous/system',
    ip,
    userAgent,
    details: details || {},
  };

  // In a real system, send this to a dedicated logging system/database
  // For this placeholder, we'll just console.log it.
  console.log("AUDIT_LOG:", JSON.stringify(logEntry, null, 2));
};
