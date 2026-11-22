import { redirect } from 'next/navigation'

export default function Home() {
  redirect(process.env.VERCEL_ENV === 'preview' ? '/discover' : '/login')
}
