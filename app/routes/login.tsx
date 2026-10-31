import { AppHeader } from "@/components/app-header";
import { SignInForm } from "@/components/sign-in-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Login() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <AppHeader />
      <Card className="bg-secondary-background">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            Browsing and searching are public — signing in is just for
            publishing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>
    </main>
  );
}
