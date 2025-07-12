import { Router } from 'express';
import axios from 'axios';
import { wppReady, INTERNAL_API_BASE } from '../wppClient';

const router = Router();

let bearerToken: string | null = process.env.WPP_TOKEN?.split(':')[1] ?? null;
const secretKey = process.env.WPP_SECRET || 'THISISMYSECURETOKEN';
const internalApi = (p: string) => `${INTERNAL_API_BASE}${p}`;

async function ensureToken() {
  if (bearerToken) return bearerToken;
  const { data } = await axios.post(internalApi(`/${secretKey}/generate-token`));
  bearerToken = data.token;
  return bearerToken;
}

/* GET /wpp/start */
router.get('/start', async (_req, res) => {
  await wppReady;
  try {
    const token = await ensureToken();
    const { data } = await axios.post(
      internalApi('/start-session'),
      { waitQrCode: true },
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    );

    if (data.qrcode) return res.json({ qr: `data:image/png;base64,${data.qrcode}` });
    if (data.status === 'already_connected') return res.json({ status: 'already_connected' });

    /* fallback */ 
    const { data: qr } = await axios.get(
      internalApi('/qrcode-session'),
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    );
    if (qr.qrcode) return res.json({ qr: `data:image/png;base64,${qr.qrcode}` });

    return res.status(500).json({ error: 'qr_not_available' });
  } catch (err: any) {
    console.error('Erro em /wpp/start:', err.response?.data || err.message);
    return res.status(500).json({ error: 'cannot_start_session' });
  }
});

/* GET /wpp/send?phone=55...&text=Olá */
router.get('/send', async (req, res) => {
  const { phone, text } = req.query as { phone?: string; text?: string };
  if (!phone || !text) return res.status(400).json({ error: 'missing_params' });

  await wppReady;
  const token = await ensureToken();

  try {
    const { data } = await axios.post(
      internalApi('/send-message'),
      { phone: [phone], message: text },
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    );
    return res.json(data);
  } catch (err: any) {
    console.error('Erro em /wpp/send:', err.response?.data || err.message);
    return res.status(500).json({ error: 'send_fail' });
  }
});

export default router;