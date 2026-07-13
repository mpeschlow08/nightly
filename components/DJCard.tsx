export default function DJCard({ name, genre }:{name:string,genre?:string}){
  return (
    <article className="bg-zinc-900/60 border border-zinc-700 rounded-xl p-5 shadow-md hover:scale-[1.02] transition-transform">
      <div className="h-36 w-full rounded-md bg-gradient-to-r from-blue-900 to-purple-700 mb-4 flex items-end p-3 text-white">
        <div className="text-sm opacity-90">{genre}</div>
      </div>
      <h3 className="text-lg font-semibold text-white">{name}</h3>
      <p className="mt-2 text-sm text-gray-300">International headliner · Live sets weekly</p>
      <div className="mt-4">
        <button className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm">View Profile</button>
      </div>
    </article>
  )
}
