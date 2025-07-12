import { Router } from 'express';
// Define an internal port for the WPPConnect server to avoid clashing with the public PORT injected by Render
const WPP_PORT = process.env.WPP_INTERNAL_PORT || '21466';
// @ts-ignore
const wppconnect = require('@wppconnect/server');

const router = Router();

// Helper to compose internal API URLs
const internalApi = (path: string) => `http://localhost:${WPP_PORT}/api/${process.env.SESSION_NAME}${path}`;

let client: any | null = null;
let initializing = false;
let bearerToken: string | null = process.env.WPP_TOKEN ? process.env.WPP_TOKEN.split(':')[1] : null;

// Inicia a sessão e devolve o QR Code em texto (base64)
router.get('/start', async (_req, res) => {
  if (initializing) {
    return res.json({ status: 'initializing' });
  }
  if (client && (client as any).status === 'CONNECTED') {
    return res.json({ status: 'already_connected' });
  }

  // se já existe client mas não está conectado, tenta gerar novo QR
  if (client && (client as any).status !== 'CONNECTED') {
    try {
      const response = await axios.get(
        `http://localhost:${WPP_PORT}/api/${process.env.SESSION_NAME}/qrcode-session`,
        bearerToken ? { headers: { Authorization: `Bearer ${bearerToken}` } } : undefined
      );
      if (response.data?.qrcode) {
        return res.json({ qr: 'data:image/png;base64,' + response.data.qrcode });
      }
    } catch (e) {
      console.error('Falha ao obter QR de sessão existente', (e as any).response?.data || (e as any).message);
    }
  }

  try {
    const secretKey = process.env.WPP_SECRET || 'THISISMYSECURETOKEN';
    // Remove public PORT so wppconnect doesn't try to reuse it
    const renderPort = process.env.PORT;
    delete process.env.PORT;

    client = await wppconnect.initServer({
      // evita iniciar sessões automaticamente e marcar como already_connected
      startAllSession: false,
      port: Number(WPP_PORT),
      secretKey: process.env.WPP_SECRET || 'THISISMYSECURETOKEN',
      session: process.env.SESSION_NAME,
      catchQR: async (qr: string) => {
        if (!qr) {
          console.warn('catchQR foi chamado, mas qr está vazio');
        }
        // devolve QR como string para o front renderizar se resposta ainda não foi enviada
        if (!res.headersSent) {
          res.json({ qr: 'data:image/png;base64,' + qr });
        }
      }
    });

    // Após o servidor interno estar de pé, gera token e inicia a sessão
    try {
      const tokenResp = await axios.post(`${internalApi(`/${secretKey}/generate-token`)}`);
      if (tokenResp.data?.token) {
        bearerToken = tokenResp.data.token;
        console.log('Generated bearer token:', bearerToken);
        await axios.post(
          `${internalApi('/start-session')}`,
          { waitQrCode: true },
          { headers: { Authorization: `Bearer ${bearerToken}` } }
        );
      }
    } catch (e) {
      console.error('Falha pós-init para gerar token ou start-session', (e as any).response?.data || (e as any).message);
    }

    // Restore public PORT for Express after WPPConnect has started
    if (renderPort) process.env.PORT = renderPort;

    initializing = false;

    // fetch QR from internal API if catchQR didn't send
    const intervalId = setInterval(async () => {
      if (res.headersSent) {
        clearInterval(intervalId);
        return;
      }

      try {
        const response = await axios.get(
          `${internalApi('/qrcode-session')}`,
          bearerToken ? { headers: { Authorization: `Bearer ${bearerToken}` } } : undefined
        );
        if (response.data?.qrcode) {
          res.json({ qr: 'data:image/png;base64,' + response.data.qrcode });
        }
      } catch (e) {
        console.error('Erro ao buscar QR:', e);
      }
    }, 1000);

  } catch (err) {
    console.error('Erro ao iniciar sessão:', err);
    res.status(500).json({ error: 'cannot_start_session' });
  } finally {
    initializing = false;
  }
});

import axios from 'axios';

// Envia mensagem via querystring: /send?phone=5511999999999&text=Oi
router.get('/send', async (req, res) => {
  const { phone, text } = req.query as { phone?: string; text?: string };
  if (!phone || !text) return res.status(400).json({ error: 'missing_params' });

  const sess = process.env.SESSION_NAME || 'session';

  // se não houver token, tente gerar on the fly
  if (!bearerToken) {
    try {
      const secretKey = process.env.WPP_SECRET || 'THISISMYSECURETOKEN';
      const tokenResp = await axios.post(`${internalApi(`/${secretKey}/generate-token`)}`);
      if (tokenResp.data?.token) {
        bearerToken = tokenResp.data.token;
      }
    } catch (e) {
      console.error('Falha ao gerar token automaticamente', e);
    }
  }

  try {
    // session name already in sess constant
    const token = bearerToken;
    console.log('Bearer token to send:', token);
    const response = await axios.post(
      `${internalApi('/send-message')}`,
      { phone: [phone], message: text },
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    );
    return res.json(response.data);
  } catch (err: any) {
    console.error('Erro ao enviar:', (err as any)?.response?.data ?? (err as any).message);
    return res.status(500).json({ error: 'send_fail' });
  }
});

export default router;
