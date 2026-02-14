import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo Section */}
          <div className="flex justify-center gap-8 mb-12">
            <a href="https://vite.dev" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity hover:drop-shadow-lg hover:drop-shadow-red-500">
              <img src={viteLogo} className="h-24 w-24" alt="Vite logo" />
            </a>
            <a href="https://react.dev" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity hover:drop-shadow-lg hover:drop-shadow-red-500">
              <img src={reactLogo} className="h-24 w-24" alt="React logo" />
            </a>
          </div>

          {/* Title */}}
        <h1 className="text-5xl font-bold text-center text-white mb-12">
          Vite + React
        </h1>

        {/* Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 mb-8">
          <button
            onClick={() => setCount((count) => count + 1)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors mb-6"
          >
            count is {count}
          </button>
          <p className="text-slate-300 text-center">
            Edit <code className="bg-slate-900 px-2 py-1 rounded text-blue-400">src/App.jsx</code> and save to test HMR
          </p>
        </div>

        {/* Footer Text */}
        <p className="text-center text-slate-400 text-sm">
          Click on the Vite and React logos to learn more
        </p>
      </div>
    </div>
  )
}

export default App
