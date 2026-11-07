import { redirect } from 'next/navigation';

// The home page used to be a personal resume; go straight to the AGV dashboard.
export default function Home() {
  redirect('/dashboard');
}
