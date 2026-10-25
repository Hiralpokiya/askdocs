import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  callbacks: {
    // On sign-in, keep the GitHub username (login) in the token
    jwt({ token, profile }) {
      if (profile) token.username = (profile as { login?: string }).login;
      return token;
    },
    // Expose the user id and username to the app
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.username) {
        (session.user as { username?: string }).username = token.username as string;
      }
      return session;
    },
  },
});
