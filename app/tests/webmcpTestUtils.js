'use client';
import { useEffect, useRef, useState } from 'react';

function getModelContext() {
  return (typeof navigator !== 'undefined' && navigator.modelContext) ||
         (typeof document !== 'undefined' && document.modelContext) ||
         null;
}

/**
 * Registers a static list of WebMCP tools once. Unlike the main sandbox demo, calls made
 * against these tools always go through the real `modelContext.executeTool()` — there is no
 * in-page fake "Surf mode" layer here, so whatever happens is entirely down to whether the
 * real Surf extension is installed and how its policy is configured.
 */
export function useWebMcpTools(defs) {
  const [ready, setReady] = useState(false);
  const registeredRef = useRef(false);

  useEffect(() => {
    if (registeredRef.current) return;
    const mc = getModelContext();
    if (!mc) return;
    registeredRef.current = true;

    for (const def of defs) {
      mc.registerTool({
        name: def.name,
        description: def.description,
        inputSchema: def.inputSchema || { type: 'object', properties: {} },
        annotations: def.annotations || {},
        execute: def.execute,
      });
    }
    setReady(true);
    // defs is a static, module-level array in every caller — intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ready, modelContextPresent: !!getModelContext() };
}

/** Calls a registered tool the way a real agent would: getTools() then executeTool(). */
export async function callRealTool(name, args, caller = 'test-agent (manual click)') {
  const mc = getModelContext();
  if (!mc) return { ok: false, error: 'modelContext is not available on this page.' };

  const tools = await mc.getTools();
  const tool = tools.find((t) => t.name === name);
  if (!tool) return { ok: false, error: `Tool "${name}" was not found.` };

  try {
    const result = await mc.executeTool(tool, args, { caller });
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}
