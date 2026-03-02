import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Identity Intelligence Access",
      credentials: {
        username: { label: "Officer ID", type: "text", placeholder: "ADMIN-01" },
        password: { label: "Access Token", type: "password" }
      },
      async authorize(credentials) {
        // This is a demo implementation. In production, use database verification.
        if (credentials?.username === "admin" && credentials?.password === "idsecure2026") {
          return { id: "1", name: "Lead Analyst", email: "analyst@idsecure.gov" };
        }
        return null;
      }
    })
  ],
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = "admin";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    }
  }
});

export { handler as GET, handler as POST };
