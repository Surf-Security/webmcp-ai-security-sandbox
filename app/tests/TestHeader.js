'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { pingSurfExtension } from '../surfClient';

export default function TestHeader({ title, description }) {
  const [extStatus, setExtStatus] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    pingSurfExtension().then(({ installed }) => {
      if (!cancelled) setExtStatus(installed ? 'installed' : 'not-installed');
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <div className="brand-header">
        <img src="/surf-mark.svg" alt="Surf" />
        <div>
          <div className="brand-name">Surf</div>
          <div className="brand-product">WebMCP test sites</div>
        </div>
      </div>
      <p className="sub" style={{ marginTop: -10 }}>
        <Link href="/tests">All test sites</Link> · <Link href="/">Main sandbox</Link>
        {' · '}
        <span className={'tag ' + (extStatus === 'installed' ? 't-ok' : extStatus === 'checking' ? 't-hold' : 't-bad')}>
          extension: {extStatus === 'installed' ? 'connected' : extStatus === 'checking' ? 'checking' : 'not installed'}
        </span>
      </p>
      <h1>{title}</h1>
      {description && <p className="sub">{description}</p>}
    </>
  );
}
