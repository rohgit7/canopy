import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <h1 className="text-5xl font-bold">🛡️ Canopy</h1>
      <p className="text-xl text-gray-400 text-center max-w-lg">
        Cloud Attack Graph Intelligence Engine.
        Find multi-hop attack paths through your AWS account before attackers do.
      </p>
      <Link
        href="/sign-up"
        className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg font-semibold text-lg transition"
      >
        Get Started
      </Link>
    </div>
  )
}