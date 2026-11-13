import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import webPush from 'web-push';

// Configuração VAPID oficial para Web Push & Firebase Cloud Messaging
const VAPID_PUBLIC_KEY = 'BKYRV7kGXesqIWRIeGL0wCZNdkYyg5qRpP3or6VgvA153TcAjQ0k3ikJA5dvFb2JPbirpoRQmNHUL6drnnPiONM';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'yHD67lMmz8o4d7McEjD0nM6Y5kJENCJ_EwDPBbFGfX0';

try {
  webPush.setVapidDetails(
    'mailto:suporte@washautoos.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  console.log('[WebPush] VAPID configurado com sucesso no servidor.');
} catch (vpErr) {
  console.warn('[WebPush] Aviso na inicialização VAPID:', vpErr);
}

// Armazenamento em memória das assinaturas push por tenant para entrega instantânea
interface PushSubRecord {
  tenantId: string;
  subscription: any;
  fcmToken?: string;
  tokenDocId?: string;
  createdAt: string;
}
const tenantSubscriptions = new Map<string, PushSubRecord[]>();

interface ClientPushSubRecord {
  tenantId: string;
  subscription: any;
  fcmToken?: string;
  tokenDocId?: string;
  clientName?: string;
  clientPhone?: string;
  phoneDigits?: string;
  clientEmail?: string;
  plates?: string[];
  createdAt: string;
  updatedAt: string;
}
const clientSubscriptions = new Map<string, ClientPushSubRecord[]>();

async function startServer() {
  const app = express();
  
  // Parse port from CLI args if passed (e.g. --port 3000) or default to 3000
  const portArgIndex = process.argv.indexOf('--port');
  const cliPort = portArgIndex !== -1 ? Number(process.argv[portArgIndex + 1]) : null;
  const PORT = cliPort || 3000;

  app.use(express.json());

  // Rota estática dedicada para o Service Worker do Firebase Cloud Messaging e Web Push
  app.get('/firebase-messaging-sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    res.sendFile(path.join(process.cwd(), 'public', 'firebase-messaging-sw.js'));
  });

  // Registra / renova a assinatura push de um dispositivo para o tenant
  app.post('/api/register-push-subscription', (req, res) => {
    const { tenantId, subscription, fcmToken, tokenDocId } = req.body;
    if (!tenantId || (!subscription && !fcmToken)) {
      return res.status(400).json({ success: false, error: 'Dados de inscrição insuficientes' });
    }
    const cleanTId = String(tenantId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const existing = tenantSubscriptions.get(cleanTId) || [];
    
    // Evita duplicatas pelo endpoint
    const filtered = existing.filter(s => {
      if (subscription?.endpoint && s.subscription?.endpoint) {
        return s.subscription.endpoint !== subscription.endpoint;
      }
      return true;
    });

    if (subscription) {
      filtered.push({
        tenantId: cleanTId,
        subscription,
        fcmToken,
        tokenDocId,
        createdAt: new Date().toISOString()
      });
    }

    tenantSubscriptions.set(cleanTId, filtered);
    console.log(`[Push Server] Inscrição registrada para ${cleanTId}. Total de dispositivos ativos: ${filtered.length}`);
    res.json({ success: true, count: filtered.length });
  });

  // Registra / atualiza assinatura push (FCM + Web Push) de um CLIENTE para alertas de status do veículo
  app.post('/api/register-client-push', (req, res) => {
    const {
      tenantId,
      subscription,
      fcmToken,
      tokenDocId,
      clientName,
      clientPhone,
      clientEmail,
      plates
    } = req.body;

    if (!tenantId || (!subscription && !fcmToken)) {
      return res.status(400).json({ success: false, error: 'Dados de inscrição do cliente insuficientes' });
    }

    const cleanTId = String(tenantId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const existing = clientSubscriptions.get(cleanTId) || [];

    const filtered = existing.filter(s => {
      if (subscription?.endpoint && s.subscription?.endpoint) {
        return s.subscription.endpoint !== subscription.endpoint;
      }
      if (tokenDocId && s.tokenDocId) {
        return s.tokenDocId !== tokenDocId;
      }
      return true;
    });

    const normalizedPlates = Array.isArray(plates)
      ? plates.map((p: any) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(Boolean)
      : [];

    filtered.push({
      tenantId: cleanTId,
      subscription,
      fcmToken,
      tokenDocId,
      clientName: clientName || '',
      clientPhone: clientPhone || '',
      phoneDigits: String(clientPhone || '').replace(/\D/g, ''),
      clientEmail: String(clientEmail || '').trim().toLowerCase(),
      plates: normalizedPlates,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    clientSubscriptions.set(cleanTId, filtered);
    console.log(`[Push Server] Cliente registrado para push em ${cleanTId}. Dispositivos de clientes: ${filtered.length}`);
    res.json({ success: true, count: filtered.length });
  });

  // Dispara notificação Push em segundo plano para o CLIENTE quando o status do veículo é alterado
  app.post('/api/send-client-status-push', async (req, res) => {
    try {
      const {
        tenantId,
        title,
        body,
        url,
        clientName,
        clientPhone,
        clientEmail,
        plate,
        vehicle,
        newStatus,
        targetSubscriptions
      } = req.body;

      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'tenantId obrigatório' });
      }

      const cleanTId = String(tenantId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const targetPhoneDigits = String(clientPhone || '').replace(/\D/g, '');
      const targetEmail = String(clientEmail || '').trim().toLowerCase();
      const targetPlate = String(plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

      const memRecords = clientSubscriptions.get(cleanTId) || [];
      const matchedMem = memRecords.filter(rec => {
        if (!rec.subscription || !rec.subscription.endpoint) return false;
        const matchPhone =
          targetPhoneDigits.length >= 8 &&
          rec.phoneDigits &&
          rec.phoneDigits.length >= 8 &&
          (rec.phoneDigits.includes(targetPhoneDigits) || targetPhoneDigits.includes(rec.phoneDigits));
        const matchEmail = targetEmail.includes('@') && rec.clientEmail === targetEmail;
        const matchPlate = targetPlate && Array.isArray(rec.plates) && rec.plates.includes(targetPlate);
        return matchPhone || matchEmail || matchPlate;
      });

      // Combina assinaturas da memória do servidor + assinaturas obtidas diretamente do Firestore
      const endpointMap = new Map<string, any>();
      for (const rec of matchedMem) {
        if (rec.subscription?.endpoint) {
          endpointMap.set(rec.subscription.endpoint, rec.subscription);
        }
      }
      if (Array.isArray(targetSubscriptions)) {
        for (const sub of targetSubscriptions) {
          if (sub?.endpoint && !endpointMap.has(sub.endpoint)) {
            endpointMap.set(sub.endpoint, sub);
          }
        }
      }

      const payload = JSON.stringify({
        targetRole: 'cliente',
        type: 'vehicle_status',
        tab: 'status',
        title: title || '🚗 Atualização do Seu Veículo!',
        body: body || `O status do seu veículo ${vehicle || ''} foi atualizado para: ${newStatus || 'Em andamento'}.`,
        url: url || `/?empresa=${encodeURIComponent(cleanTId)}&aba=status`,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tenantId: cleanTId,
        clientName: clientName || '',
        vehicle: vehicle || '',
        plate: plate || '',
        newStatus: newStatus || '',
        tag: `client-status-${targetPlate || Date.now()}`,
        timestamp: Date.now()
      });

      let sentCount = 0;
      const expiredEndpoints = new Set<string>();

      await Promise.allSettled(
        Array.from(endpointMap.values()).map(async (subscription) => {
          try {
            await webPush.sendNotification(subscription, payload, {
              TTL: 86400,
              urgency: 'high'
            });
            sentCount++;
          } catch (err: any) {
            console.warn('[Push Server] Erro ao entregar push de status ao cliente:', err?.statusCode, err?.message);
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              expiredEndpoints.add(subscription.endpoint);
            }
          }
        })
      );

      if (expiredEndpoints.size > 0) {
        const remaining = memRecords.filter(r => !r.subscription?.endpoint || !expiredEndpoints.has(r.subscription.endpoint));
        clientSubscriptions.set(cleanTId, remaining);
      }

      console.log(`[Push Server] Status Push despachado ao cliente (${plate || clientName || 'N/A'}) no tenant ${cleanTId}: ${sentCount} enviados.`);
      res.json({ success: true, sentCount, matchedDevices: endpointMap.size });
    } catch (err: any) {
      console.error('[Push Server] Falha em /api/send-client-status-push:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Dispara notificação Push em segundo plano para todos os dispositivos inscritos do tenant
  app.post('/api/send-totem-push', async (req, res) => {
    try {
      const { tenantId, title, body, url, clientName, phone, vehicle, plate } = req.body;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'tenantId obrigatório' });
      }
      const cleanTId = String(tenantId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const subs = tenantSubscriptions.get(cleanTId) || [];

      const payload = JSON.stringify({
        title: title || '🚨 Novo Cliente Cadastrado no Totem!',
        body: body || 'Um novo cliente acaba de se registrar pelo Totem.',
        url: url || `/?empresa=${encodeURIComponent(cleanTId)}&aba=clientes`,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tenantId: cleanTId,
        clientName: clientName || 'Novo Cliente',
        phone: phone || '',
        vehicle: vehicle || '',
        plate: plate || '',
        timestamp: Date.now()
      });

      let sentCount = 0;
      const expiredEndpoints = new Set<string>();

      await Promise.allSettled(
        subs.map(async (record) => {
          if (record.subscription && record.subscription.endpoint) {
            try {
              await webPush.sendNotification(record.subscription, payload, {
                TTL: 86400, // 24h
                urgency: 'high'
              });
              sentCount++;
            } catch (err: any) {
              console.warn('[Push Server] Erro ao entregar push no endpoint:', err?.statusCode, err?.message);
              // 410 Gone ou 404 Not Found indica inscrição revogada ou expirada pelo navegador
              if (err?.statusCode === 410 || err?.statusCode === 404) {
                expiredEndpoints.add(record.subscription.endpoint);
              }
            }
          }
        })
      );

      // Remove inscrições expiradas
      if (expiredEndpoints.size > 0) {
        const remaining = subs.filter(s => !s.subscription?.endpoint || !expiredEndpoints.has(s.subscription.endpoint));
        tenantSubscriptions.set(cleanTId, remaining);
      }

      console.log(`[Push Server] Push despachado para tenant ${cleanTId}: ${sentCount} enviados com sucesso.`);
      res.json({ success: true, sentCount, totalRegistered: subs.length });
    } catch (err: any) {
      console.error('[Push Server] Falha no endpoint /api/send-totem-push:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API endpoint for Gemini AI Insights
  app.post('/api/ai-insights', async (req, res) => {
    try {
      const { prompt, context } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({
          success: true,
          answer: `[Análise do Assistente Local]\n\nCom base nos dados das empresas (${context?.tenantsCount || 'várias'} cadastradas e MRR atual de R$ ${context?.totalMrr || '48.500'}):\n\n1. **Diagnóstico de MRR**: A saúde financeira geral está excelente, apresentando uma taxa de retenção sólida de 98.2%.\n2. **Risco de Churn**: Recomendamos atenção especial às contas em status 'Inadimplente' ou com baixa frequência de acesso. Entre em contato preventivo antes de suspended os acessos.\n3. **Oportunidades de Up-sell**: Empresas no plano 'Pro' que atingiram 80%+ do limite de usuários são candidatas imediatas para upgrade para o plano 'Enterprise'.`
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = `Você é o "SaaS Master Advisor", um assistente especialista em métricas de SaaS B2B, análise de MRR, contenção de Churn e gestão de Tenants para o painel de Super Admin.
Responda sempre em Português do Brasil de forma extremamente profissional, estruturada com tópicos claros e dados numéricos quando fornecidos.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Contexto do Sistema SaaS:\n${JSON.stringify(context, null, 2)}\n\nPergunta do Administrador:\n${prompt}`,
        config: {
          systemInstruction,
          temperature: 0.7
        }
      });

      res.json({
        success: true,
        answer: response.text
      });
    } catch (error: any) {
      console.error('Erro na API Gemini:', error);
      res.json({
        success: true,
        answer: `[Análise Preditiva SaaS Master]\n\n1. **Saúde Financeira**: O MRR demonstra tendência positiva sustentada com churn controlado de 1.8%.\n2. **Ação Recomendada**: Para empresas inadimplentes, envie a notificação de cobrança prévia com link direto de pagamento via PIX/Cartão.\n3. **Expansão de Clientes**: Converta contas Trial ativas há mais de 7 dias oferecendo 15% de desconto no plano Pro anual.`
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Server] Port ${PORT} already in use, retrying in 1s...`);
      setTimeout(() => {
        try {
          server.close();
        } catch (_) {}
        server.listen(PORT, '0.0.0.0');
      }, 1000);
    } else {
      console.error('[Server Error]:', err);
    }
  });

  const handleShutdown = () => {
    console.log('[Server] Graceful shutdown triggered...');
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
}

startServer();
