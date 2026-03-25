import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[70vh] px-4">
      <SignUp />
    </div>
  );
}
