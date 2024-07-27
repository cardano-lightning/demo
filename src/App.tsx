import { useState } from 'react'
import reactLogo from './assets/react.svg'
import appLogo from '/favicon.svg'
import PWABadge from './PWABadge.tsx'
import { Button } from '@/components/ui/button'

/* Old school styling
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.react:hover {
  filter: drop-shadow(0 0 2em #61dafbaa);
}
@keyframes logo-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: no-preference) {
  a:nth-of-type(2) .logo {
    animation: logo-spin infinite 20s linear;
  }
}

.card {
  padding: 2em;
}
.read-the-docs {
  color: #888;
}
<div>
  <a href="https://vitejs.dev" target="_blank">
    <img src={appLogo} className="h-24 p-6 filter drop-shadow-2xl" alt="cardano-lightning-demo logo" />
  </a>
  <a href="https://react.dev" target="_blank">
    <img src={reactLogo} className="logo react" alt="React logo" />
  </a>
</div>
*/

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="max-w-screen-xl m-0 p-2 text-center">
      <h1>cardano-lightning-demo</h1>
      <div className="card">
        <Button onClick={() => setCount((count) => count + 1)}>
          Test count is {count}
        </Button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      <PWABadge />
    </div>
  )
}

export default App
