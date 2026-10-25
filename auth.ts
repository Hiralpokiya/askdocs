import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  callbacks: {
    jwt({ token, account, profile }) {
      // On sign-in, store the stable GitHub account id (never changes)
      if (account?.providerAccountId) token.uid = account.providerAccountId;
      if (profile) token.username = (profile as { login?: string }).login;
      return token;
    },
    session({ session, token }) {
      const uid = (token.uid as string | undefined) ?? token.sub;
      if (uid) session.user.id = uid;
      if (token.username) {
        (session.user as { username?: string }).username = token.username as string;
      }
      return session;
    },
  },
});
