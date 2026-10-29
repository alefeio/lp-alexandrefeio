import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { siteConfig } from "@/data/site-config";
import { getPrisma } from "@/lib/db/prisma";
import { passwordResetEmail, sendAuthEmail, verificationEmail } from "@/lib/email/auth-mail";
import {
  RESET_TOKEN_EXPIRES_IN_SECONDS,
  roleForNewUser,
  secureSessionCookies,
  SESSION_COOKIE_ATTRIBUTES,
  SESSION_EXPIRES_IN_SECONDS,
  USER_ROLES,
} from "@/lib/auth/policy";

export { USER_ROLES };

export function getAuthBaseURL(env: Record<string, string | undefined> = process.env): string {
  const configured = env.BETTER_AUTH_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (env.VERCEL_ENV === "production") return siteConfig.url;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function getAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return "build-only-placeholder-not-for-runtime-use";
  }
  throw new Error("BETTER_AUTH_SECRET is not set");
}

function trustedOrigins(): string[] {
  const origins = new Set<string>([getAuthBaseURL(), siteConfig.url]);
  if (process.env.VERCEL_URL) origins.add(`https://${process.env.VERCEL_URL}`);
  return [...origins];
}

async function deliverAuthEmail(to: string, message: { subject: string; html: string; text: string }): Promise<void> {
  try {
    await sendAuthEmail({ to, ...message });
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    console.error("auth email failed", { name });
  }
}

export const auth = betterAuth({
  database: prismaAdapter(getPrisma(), { provider: "postgresql" }),
  secret: getAuthSecret(),
  baseURL: getAuthBaseURL(),
  trustedOrigins: trustedOrigins(),
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
  },
  session: {
    expiresIn: SESSION_EXPIRES_IN_SECONDS,
  },
  advanced: {
    useSecureCookies: secureSessionCookies(getAuthBaseURL()),
    defaultCookieAttributes: SESSION_COOKIE_ATTRIBUTES,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: RESET_TOKEN_EXPIRES_IN_SECONDS,
    revokeSessionsOnPasswordReset: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      await deliverAuthEmail(user.email, passwordResetEmail(url));
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => {
      await deliverAuthEmail(user.email, verificationEmail(url));
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: USER_ROLES.user,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          return { data: { ...user, role: roleForNewUser(user.role) } };
        },
      },
    },
  },
  plugins: [nextCookies()],
});
