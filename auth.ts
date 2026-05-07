import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

// In-memory rate limiting — resets on server restart
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

function pruneAttempts() {
  const now = Date.now();
  for (const [ip, data] of loginAttempts.entries()) {
    if (now - data.lastAttempt > LOCKOUT_TIME) {
      loginAttempts.delete(ip);
    }
  }
}
setInterval(pruneAttempts, LOCKOUT_TIME);

export const authConfig: NextAuthConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 }, // 7 days

  providers: [
    Credentials({
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials, request) {
        pruneAttempts();
        const ip = request.headers?.get('x-forwarded-for') ?? 'anonymous';
        const now = Date.now();

        // Rate limiting
        const attempts = loginAttempts.get(ip);
        if (
          attempts &&
          attempts.count >= MAX_ATTEMPTS &&
          now - attempts.lastAttempt < LOCKOUT_TIME
        ) {
          return null;
        }

        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        // Dynamic import avoids circular deps at module init time
        const { getAccountByEmail } = await import('./lib/db');
        const account = await getAccountByEmail(email);

        if (!account) {
          const current = loginAttempts.get(ip) ?? { count: 0, lastAttempt: 0 };
          loginAttempts.set(ip, { count: current.count + 1, lastAttempt: now });
          return null;
        }

        const valid = await bcrypt.compare(password, account.password_hash);
        if (!valid) {
          const current = loginAttempts.get(ip) ?? { count: 0, lastAttempt: 0 };
          loginAttempts.set(ip, { count: current.count + 1, lastAttempt: now });
          return null;
        }

        loginAttempts.delete(ip);
        return { id: account.id, name: account.name, email: account.email };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accountId = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.accountId) session.user.id = token.accountId as string;
      return session;
    },
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
