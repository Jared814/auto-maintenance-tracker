'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { Wrench } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/submit-button';
import { registerAccountAction } from '@/lib/actions/auth';
import type { ActionState } from '@/lib/actions/state';

export default function RegisterPage() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [state, formAction] = useActionState<ActionState, FormData>(registerAccountAction, null);

  useEffect(() => {
    if (state && 'success' in state) {
      signIn('credentials', {
        email: emailRef.current?.value,
        password: passwordRef.current?.value,
        redirect: false,
      }).then(() => router.push('/dashboard'));
    }
  }, [state, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="size-12 rounded-xl bg-primary flex items-center justify-center">
            <Wrench className="size-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Create account</h1>
          <p className="text-muted-foreground text-sm">Track maintenance for your family&apos;s vehicles</p>
        </div>

        <form action={formAction} className="space-y-4">
          {state && 'error' in state && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{state.error}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" type="text" placeholder="The Smith Family" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input ref={emailRef} id="email" name="email" type="email" placeholder="you@example.com" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input ref={passwordRef} id="password" name="password" type="password" placeholder="Minimum 8 characters" required />
          </div>

          <SubmitButton label="Create account" pendingLabel="Creating account…" className="w-full" />
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
