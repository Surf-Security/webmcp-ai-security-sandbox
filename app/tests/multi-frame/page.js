'use client';
import { useEffect, useState } from 'react';
import TestHeader from '../TestHeader';
import { useWebMcpTools, callRealTool } from '../webmcpTestUtils';

const TOOLS = [
  { name: 'top_frame_tool', description: 'Registered by the top-level page', execute: () => 'called on the top frame' },
];

export default function MultiFrameTest() {
  const { ready } = useWebMcpTools(TOOLS);
  const [result, setResult] = useState(null);
  const [iframeSrc, setIframeSrc] = useState(null);

  useEffect(() => {
    // localhost and 127.0.0.1 are different origins even on the same port, which gets us a
    // genuinely cross-origin iframe without standing up a second server.
    const { protocol, hostname, port } = window.location;
    const otherHost = hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    setIframeSrc(`${protocol}//${otherHost}:${port}/tests/multi-frame/frame`);
  }, []);

  const call = async () => {
    const res = await callRealTool('top_frame_tool', {});
    setResult(res);
  };

  return (
    <div className="wrap">
      <TestHeader
        title="Cross-origin frame detection"
        description="This page registers a tool in the top frame; the box below embeds a genuinely cross-origin iframe (127.0.0.1 vs localhost) that registers its own. Rescan from the extension's Inspector tab and both should show up as separate frame groups with distinct origins."
      />

      {!ready && <div className="card">Registering tools…</div>}

      {ready && (
        <div className="card">
          <h3>top_frame_tool</h3>
          <button onClick={call}>Call top_frame_tool</button>
          {result && <pre style={{ marginTop: 12 }}>{JSON.stringify(result, null, 2)}</pre>}
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Embedded cross-origin frame</h3>
        {iframeSrc ? (
          <iframe src={iframeSrc} title="cross-origin test frame" style={{ width: '100%', height: 220, border: '1px solid var(--line)', borderRadius: 10 }} />
        ) : (
          <div>Resolving frame origin…</div>
        )}
      </div>
    </div>
  );
}
