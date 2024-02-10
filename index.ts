import { Router, IRequest } from "itty-router";

// Constants
const API_ENDPOINT = "https://api.mailchannels.net/tx/v1/send";
const CONTENT_TYPE_JSON = "application/json";

// Helper function to create a response
const createResponse = (body: any, status: number) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": CONTENT_TYPE_JSON },
    status,
  });

// Curry function for handling errors
const handleError = (status: number) => (message: string, request: IRequest) =>
  createResponse({ error: message }, status);

// Middleware for authentication
const authMiddleware = (token: string | null) => (request: IRequest) => {
  const requestToken = request.headers.get("Authorization");

  const unauthorizedError = handleError(401)("Unauthorized", request);
  const missingTokenError = handleError(401)(
    "You must set the TOKEN environment variable.",
    request
  );

  return token
    ? requestToken === token
      ? null
      : unauthorizedError
    : missingTokenError;
};

// Service function to send email
const sendEmail = async (email: any) => {
  const resp = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": CONTENT_TYPE_JSON,
    },
    body: JSON.stringify(email),
  });

  if (!resp.ok) {
    const errorMessage = `Error sending email: ${resp.status} ${resp.statusText}`;
    throw new Error(`${errorMessage}\n${await resp.text()}`);
  }
};

// Log batch of emails
const logBatch = async (emails: any[], env: Env) => {
  if (emails.length > 0) {
    await Promise.all(
      emails.map((email) => env.log.put(`${Date.now()}`, JSON.stringify(email)))
    );
  }
};

// Route handler for sending email
const sendEmailHandler = async (request: IRequest, env: Env) => {
  try {
    const authError = authMiddleware(env.TOKEN)(request);
    if (authError) return authError;

    const email = await request.json();
    await sendEmail(email);

    logBatch([email], env);

    return createResponse(
      {
        status: "SUCCESS",
        statusCode: 1000,
        message: "NA",
      },
      200
    );
  } catch (error) {
    console.error(`Error processing request: ${error}`);
    return handleError(500)("Internal Server Error", request);
  }
};

// Create router
const router = Router();

// Define routes
router.post("/api/email", sendEmailHandler);
router.all("*", (request: IRequest) => handleError(404)("Not Found", request));

// Export the router handler
export default {
  fetch: router.handle,
};
