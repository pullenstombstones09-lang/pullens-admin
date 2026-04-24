'use client';

import { useState } from 'react';

export default function Test2Page() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: 40, background: '#1A1A2E', color: 'white', minHeight: '100vh' }}>
      <h1>Client Component Test</h1>
      <p>Count: {count}</p>
      <button
        onClick={() => setCount(c => c + 1)}
        style={{ padding: '12px 24px', background: '#C4A35A', color: '#1A1A2E', border: 'none', borderRadius: 8, fontSize: 18, cursor: 'pointer', marginTop: 16 }}
      >
        Click me
      </button>
    </div>
  );
}
