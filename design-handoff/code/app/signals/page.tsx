import { getAllSignals } from '@/lib/queries'
import SignalsFeed from './SignalsFeed'

export default async function SignalsPage() {
  const signals = await getAllSignals()
  return <SignalsFeed signals={signals} />
}
