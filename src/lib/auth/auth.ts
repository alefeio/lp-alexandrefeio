import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { siteConfig } from "@/data/site-config";
import { getPrisma } from "@/lib/db/prisma";
import { passwordResetEmail, sendAuthEmail, verificationEmail } from "@/lib/email/auth-mail";

export const USER_ROLES = {
  user: "USER",
  admin: "ADMIN",
} as const;

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
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      const message = passwordResetEmail(url);
      await sendAuthEmail({ to: user.email, ...message });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => {
      const message = verificationEmail(url);
      await sendAuthEmail({ to: user.email, ...message });
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
          return { data: { ...user, role: USER_ROLES.user } };
        },
      },
    },
  },
  plugins: [nextCookies()],
});
