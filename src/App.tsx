import { useState } from 'react'

import './App.css'

type View = 'plan' | 'stats' | 'archive';

export default function App() {
  const [view, setView] = useState<View>('plan');
  return (
    <>
      <nav className="tabs">
        <button aria-current={view === 'plan' ? 'page' : undefined} onClick={() => setView('plan')}>plan</button>
        <button aria-current={view === 'stats' ? 'page' : undefined} onClick={() => setView('stats')}>stats</button>
        <button aria-current={view === 'archive' ? 'page' : undefined} onClick={() => setView('archive')}>archive</button>
      </nav>
      <main className="pane">
        {view === 'plan' && <div>plan pane</div>}
        {view === 'stats' && <div>stats pane</div>}
        {view === 'archive' && <div>archive pane</div>}
      </main>      
    </>
  );
}
