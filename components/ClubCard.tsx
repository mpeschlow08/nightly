export default function ClubCard({ name, vibe }:{name:string,vibe?:string}){
  return (
    <article className="bg-zinc-900/60 border border-zinc-700 rounded-xl p-5 shadow-md hover:translate-y-[-4px] transition-transform">
      <div className="h-36 w-full rounded-md bg-gradient-to-r from-purple-800 to-blue-900 mb-4 flex items-end p-3 text-white">
        <div className="text-sm opacity-90">{vibe}</div>
      </div>
      <h3 className="text-lg font-semibold text-white">{name}</h3>
      <p className="mt-2 text-sm text-gray-300">Late-night parties · VIP tables · Signature cocktails</p>
      <div className="mt-4">
        <button className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm">Visit Club</button>
      </div>
    </article>
  )
}
