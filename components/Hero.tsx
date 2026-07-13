"use client"
import SearchBar from './SearchBar'

export default function Hero(){
  return (
    <section className="relative h-screen flex items-center justify-center text-center bg-gradient-to-b from-black via-[#070707] to-black">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-purple-900/10 to-transparent pointer-events-none"></div>
      <div className="z-10 px-6">
        <h1 className="text-6xl sm:text-8xl font-extrabold tracking-tight text-white drop-shadow-lg neon-title">Nightly</h1>
        <p className="mt-4 text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">Discover the best nightlife around you.</p>

        <div className="mt-8">
          <SearchBar />
        </div>
      </div>
    </section>
  )
}
