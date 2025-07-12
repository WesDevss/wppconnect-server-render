import { Router } from 'express';
// @ts-ignore
const wppconnect = require('@wppconnect/server');

const router = Router();

let client: any | null = null;
let bearerToken: string | null = process.env.WPP_TOKEN ? process.env.WPP_TOKEN.split(':')[1] : null;

// Inicia a sessão e devolve o QR Code em texto (base64)
router.get('/start', async (_req, res) => {
  if (client && (client as any).status === 'CONNECTED') {
    return res.json({ status: 'already_connected' });
  }

  // se já existe client mas não está conectado, tenta gerar novo QR
  if (client && (client as any).status !== 'CONNECTED') {
    try {
      const response = await axios.get(
        `http://localhost:21466/api/${process.env.SESSION_NAME}/qrcode-session`,
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
    client = await wppconnect.initServer({
      // evita iniciar sessões automaticamente e marcar como already_connected
      startAllSession: false,
      port: 21466,
      secretKey: process.env.WPP_SECRET || 'THISISMYSECURETOKEN',
      session: process.env.SESSION_NAME,
      catchQR: async (qr: string) => {
        if (!qr) {
          console.warn('catchQR foi chamado, mas qr está vazio');
        }
        // devolve QR como string para o front renderizar se resposta ainda não foi enviada
        if (!res.headersSent) {
          res.json({ qr });
        }

        // gera token automaticamente (e inicia sessão oficialmente em seguida)
        try {
          const tokenResp = await axios.post(`http://localhost:21466/api/${process.env.SESSION_NAME}/${secretKey}/generate-token`);
          if (tokenResp.data?.token) {
            bearerToken = tokenResp.data.token;
            console.log('Generated bearer token:', bearerToken);

            // inicia sessão explicitamente (waitQrCode true faz o servidor devolver qr no body também)
            try {
              await axios.post(
                `http://localhost:21466/api/${process.env.SESSION_NAME}/start-session`,
                { waitQrCode: true },
                { headers: { Authorization: `Bearer ${bearerToken}` } }
              );
            } catch (e) {
              console.error('Erro ao start-session', (e as any).response?.data || (e as any).message);
            }
          }
        } catch (e) {
          console.error('Não foi possível gerar token automaticamente', e);
        }
      }
    });

    // fetch QR from internal API if catchQR didn't send
    const intervalId = setInterval(async () => {
      if (res.headersSent) {
        clearInterval(intervalId);
        return;
      }

      try {
        const response = await axios.get(
          `http://localhost:21466/api/${process.env.SESSION_NAME}/qrcode-session`,
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
      const tokenResp = await axios.post(`http://localhost:21466/api/${sess}/${secretKey}/generate-token`);
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
      `http://localhost:21466/api/${sess}/send-message`,
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
