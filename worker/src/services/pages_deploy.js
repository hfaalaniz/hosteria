// Crea y deploya proyectos Pages (admin + web) para un nuevo tenant
// usando Cloudflare Pages Direct Upload API

const ADMIN_SOURCE = 'hosteria-admin';
const WEB_SOURCE   = 'hosteria-web';

export async function crearYDeployarPages(env, slug) {
  const accountId = env.CF_ACCOUNT_ID;
  const apiToken  = env.CF_API_TOKEN;
  const workerUrl = `https://${env.WORKER_HOSTNAME || 'hosteria-api.soportetecnicoaf1.workers.dev'}`;
  const base      = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
  const hdrs      = { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' };

  const adminProject = slug.replace(/[^a-z0-9-]/g, '-').substring(0, 28);
  const webProject   = ('web-' + slug.replace(/[^a-z0-9-]/g, '-')).substring(0, 28);

  const [adminAssets, webAssets] = await Promise.all([
    listarAssets(ADMIN_SOURCE),
    listarAssets(WEB_SOURCE),
  ]);

  const [adminResult, webResult] = await Promise.allSettled([
    deployarProyecto(base, hdrs, adminProject, adminAssets, ADMIN_SOURCE, {
      VITE_API_URL: { value: workerUrl },
    }),
    deployarProyecto(base, hdrs, webProject, webAssets, WEB_SOURCE, {
      VITE_API_URL:     { value: workerUrl },
      VITE_TENANT_SLUG: { value: slug },
    }),
  ]);

  return {
    admin: adminResult.status === 'fulfilled' ? adminResult.value : { error: adminResult.reason?.message },
    web:   webResult.status   === 'fulfilled' ? webResult.value   : { error: webResult.reason?.message  },
  };
}

async function listarAssets(projectName) {
  const baseUrl = `https://${projectName}.pages.dev`;
  const html = await fetch(`${baseUrl}/index.html`).then(r => r.text()).catch(() => '');
  const assets = new Set(['/index.html', '/_redirects', '/favicon.svg', '/icons.svg']);
  // Extraer rutas de assets del HTML usando split en lugar de regex
  const parts = html.split(/(?:href|src)=/);
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const quote = part[0];
    if (quote !== '"' && quote !== "'") continue;
    const end = part.indexOf(quote, 1);
    if (end < 0) continue;
    const path = part.slice(1, end);
    if (path.includes('/assets/') || path.endsWith('.js') || path.endsWith('.css')) {
      assets.add(path.startsWith('/') ? path : '/' + path);
    }
  }
  return [...assets];
}

async function deployarProyecto(base, hdrs, projectName, filePaths, sourceProject, envVars) {
  const sourceBase = `https://${sourceProject}.pages.dev`;

  // 1. Crear proyecto si no existe
  const check = await fetch(`${base}/pages/projects/${projectName}`, { headers: hdrs });
  if (!check.ok) {
    const cr = await fetch(`${base}/pages/projects`, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({ name: projectName, production_branch: 'main' }),
    });
    if (!cr.ok) {
      const e = await cr.json();
      throw new Error(`Crear proyecto '${projectName}': ${JSON.stringify(e.errors)}`);
    }
  }

  // 2. Configurar env vars
  await fetch(`${base}/pages/projects/${projectName}`, {
    method: 'PATCH',
    headers: hdrs,
    body: JSON.stringify({ deployment_configs: { production: { env_vars: envVars } } }),
  });

  // 3. Descargar archivos del proyecto fuente y calcular hashes
  const fileMap = {};
  await Promise.all(filePaths.map(async (path) => {
    try {
      const resp = await fetch(`${sourceBase}${path}`);
      if (!resp.ok) return;
      const buf  = await resp.arrayBuffer();
      const hash = await sha256hex(buf);
      fileMap[path] = { content: new Uint8Array(buf), hash };
    } catch {}
  }));

  if (Object.keys(fileMap).length === 0) {
    return { projectName, url: `https://${projectName}.pages.dev`, deployed: false, reason: 'no files fetched' };
  }

  // 4. Verificar cuales archivos faltan en el destino
  const manifest = Object.fromEntries(Object.entries(fileMap).map(([p, f]) => [p, f.hash]));
  const checkResp = await fetch(`${base}/pages/projects/${projectName}/deployments/upload-check`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify({ manifest }),
  });
  let needUpload = Object.keys(fileMap);
  if (checkResp.ok) {
    const checkData = await checkResp.json();
    needUpload = checkData.result?.missing || needUpload;
  }

  // 5. Subir archivos faltantes en lotes de 50
  const BATCH = 50;
  for (let i = 0; i < needUpload.length; i += BATCH) {
    const batch = needUpload.slice(i, i + BATCH);
    const form = new FormData();
    for (const path of batch) {
      if (!fileMap[path]) continue;
      const { content, hash } = fileMap[path];
      form.append(hash, new Blob([content], { type: guessMime(path) }), hash);
    }
    await fetch(`${base}/pages/projects/${projectName}/deployments/upload-asset`, {
      method: 'POST',
      headers: { Authorization: hdrs.Authorization },
      body: form,
    });
  }

  // 6. Crear el deployment con el manifest
  const deployForm = new FormData();
  deployForm.append('manifest', JSON.stringify(manifest));
  deployForm.append('branch', 'main');
  const deployResp = await fetch(`${base}/pages/projects/${projectName}/deployments`, {
    method: 'POST',
    headers: { Authorization: hdrs.Authorization },
    body: deployForm,
  });
  const deployData = await deployResp.json();

  return {
    projectName,
    url: `https://${projectName}.pages.dev`,
    deployed: deployResp.ok,
    deployId: deployData.result?.id,
    error: deployResp.ok ? undefined : JSON.stringify(deployData.errors),
  };
}

async function sha256hex(buffer) {
  const hashBuf = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function guessMime(path) {
  if (path.endsWith('.html')) return 'text/html';
  if (path.endsWith('.css'))  return 'text/css';
  if (path.endsWith('.js'))   return 'application/javascript';
  if (path.endsWith('.svg'))  return 'image/svg+xml';
  if (path.endsWith('.png'))  return 'image/png';
  if (path.endsWith('.ico'))  return 'image/x-icon';
  return 'application/octet-stream';
}
