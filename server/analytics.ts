import { v4 as uuidv4 } from 'uuid';

const GA_MEASUREMENT_ID = process.env.VITE_GA_MEASUREMENT_ID;
const GA_API_SECRET = process.env.GA_API_SECRET;

interface EventParams {
  // Standard GA4 event parameters - add more as needed
  currency?: string;
  value?: number;
  [key: string]: any; // For custom parameters
}

export const trackServerEvent = async (
  eventName: string,
  eventParams: EventParams,
  clientId?: string // Optional: if not provided, a new UUID will be generated
): Promise<void> => {
  if (!GA_MEASUREMENT_ID || !GA_API_SECRET) {
    console.warn(
      "Google Analytics Measurement ID or API Secret is not configured for server-side tracking. Skipping event:",
      eventName
    );
    return;
  }

  const finalClientId = clientId || uuidv4();

  const payload: any = { // Use 'any' for flexibility with debug_mode
    client_id: finalClientId,
    events: [
      {
        name: eventName,
        params: eventParams,
      },
    ],
  };

  // Add debug_mode if in development
  if (process.env.NODE_ENV === 'development') {
    payload.debug_mode = true;
    // Note: GA4 DebugView typically relies on client-side GA debugger activation or specific device registration.
    // Sending debug_mode=true with MP hits can help, but GA's DebugView might still primarily show client-side initiated debug sessions.
    // An alternative or complementary approach for server hits is to send a specific user property for debugging.
    console.log(`GA Server Event (Debug Mode): ${eventName}`, payload);
  }

  try {
    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (response.ok) {
      console.log(`GA Server Event sent: ${eventName}`, eventParams);
      // For more detailed debugging, you can check response.status and response.statusText
      // If response.status is 204, it's typically a success for Measurement Protocol
    } else {
      const responseBody = await response.text();
      console.error(
        `Error sending GA Server Event ${eventName}: ${response.status} ${response.statusText}`,
        {
          payloadSent: payload,
          responseBody: responseBody,
        }
      );
    }
  } catch (error) {
    console.error(`Failed to send GA Server Event ${eventName}:`, error, { payloadSent: payload });
  }
};

// Example of how client_id could be fetched (conceptual)
// This would typically be part of the request object if passed from client
export const getClientIdFromRequest = (req: any): string | undefined => {
  // Example: client sends it as a header 'X-Client-ID'
  // Or in the body for POST requests
  return req.headers?.['x-client-id'] || req.body?.ga_client_id;
};
