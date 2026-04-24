'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Test3Page() {
  const router = useRouter();
  const [clicked, setClicked] = useState(false);

  return (
    <div style={{ padding: 40, background: '#1A1A2E', color: 'white', minHeight: '100vh' }}>
      <h1>Router Test</h1>
      <p>Router loaded: yes</p>
      <p>Clicked: {clicked ? 'yes' : 'no'}</p>
      <button
        onClick={() => setClicked(true)}
        style={{ padding: '12px 24px', background: '#C4A35A', color: '#1A1A2E', border: 'none', borderRadius: 8, fontSize: 18, cursor: 'pointer', marginTop: 16 }}
      >
        Test Click
      </button>
      <button
        onClick={() => router.push('/test2')}
        style={{ padding: '12px 24px', background: '#666', color: 'white', border: 'none', borderRadius: 8, fontSize: 18, cursor: 'pointer', marginTop: 16, marginLeft: 12 }}
      >
        Navigate to test2
      </button>
    </div>
  );
}
