import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  callbacks: {
    // put the GitHub user id on the session so routes can use it
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});