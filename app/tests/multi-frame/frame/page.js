'use client';
import { useState } from 'react';
import { useWebMcpTools, callRealTool } from '../../webmcpTestUtils';

const TOOLS = [
  { name: 'frame_tool', description: 'Registered inside a cross-origin iframe', execute: () => 'called inside the cross-origin frame' },
];

export default function CrossOriginFrame() {
  const { ready } = useWebMcpTools(TOOLS);
  const [result, setResult] = useState(null);

  const call = async () => {
    setResult(await callRealTool('frame_tool', {}));
  };

  return (
    <div style={{ padding: 12, fontFamily: 'sans-serif', fontSize: 13 }}>
      <div>Cross-origin frame — origin: {typeof window !== 'undefined' ? window.location.origin : ''}</div>
      {ready ? (
        <>
          <button onClick={call} style={{ marginTop: 8 }}>Call frame_tool</button>
          {result && <pre style={{ marginTop: 8 }}>{JSON.stringify(result, null, 2)}</pre>}
        </>
      ) : (
        <div>Registering…</div>
      )}
    </div>
  );
}
