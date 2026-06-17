// 🟩 Worker 独立计算平面，绝不侵占和卡顿 UI 渲染线程
addEventListener('message', (event: MessageEvent) => {
  const files: Map<string, string> = event.data;
  const nodes: any[] = [];
  const edges: any[] = [];

  const resourceRegex = /resource\s+([a-zA-Z0-9_]+)\s+'([^@]+)@/g;
  const moduleRegex = /module\s+([a-zA-Z0-9_]+)\s+'([^']+)'/g;

  let index = 0;
  for (const [filePath, content] of files.entries()) {
    let match;

    while ((match = resourceRegex.exec(content)) !== null) {
      nodes.push({
        id: match[1],
        type: 'default',
        data: { label: `📦 [Resource]\n${match[1]}\n(${match[2]})` },
        position: { x: 150 + (index * 220), y: 100 + (Math.random() * 150) },
        style: { background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'pre-wrap', width: 200 }
      });
    }

    while ((match = moduleRegex.exec(content)) !== null) {
      edges.push({
        id: `e-${match[1]}`,
        source: filePath,
        target: match[1],
        animated: true,
        style: { stroke: '#00f2fe', strokeWidth: 1.5 }
      });
    }
    index++;
  }

  postMessage({ nodes, edges });
});