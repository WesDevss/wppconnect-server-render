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
router.get('/start', async (req, res) => {
  const force = (req.query.force as string) === 'true';
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

    // As último recurso: tente fechar e reiniciar uma vez
    try {
      await axios.delete(
        internalApi('/close-session'),
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );
      const { data: retry } = await axios.post(
        internalApi('/start-session'),
        { waitQrCode: true },
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );
      if (retry.qrcode)
        return res.json({ qr: `data:image/png;base64,${retry.qrcode}` });
    } catch (_) {
      /* swallow */
    }

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

/* Simple HTML page to display QR code visually */
router.get('/scan', (req, res) => {
  // Optional force refresh
  const forceFlag = (req.query.force as string) === 'true' ? '?force=true' : '';

  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>QR Code – WPPConnect</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#f7f7f7;color:#333}
        #qr{width:300px;height:300px;border:1px solid #ddd;margin-top:16px}
        #msg{margin-top:8px}
        button{margin-top:12px;padding:6px 12px;font-size:14px}
      </style>
    </head>
    <body>
      <h2>Escaneie o QR no WhatsApp</h2>
      <div id="msg">Carregando...</div>
      <img id="qr" src="" alt="QR Code"/>
      <button onclick="getQr(true)">Forçar novo QR</button>
      <script>
        async function getQr(force){
          document.getElementById('msg').innerText='Carregando...';
          document.getElementById('qr').src='';
          try{
            const r=await fetch('/wpp/start'+(force?'?force=true':''));
            const data=await r.json();
            if(data.qr){
              document.getElementById('qr').src=data.qr;
              document.getElementById('msg').innerText='Aponte a câmera do WhatsApp';
            }else if(data.status==='already_connected'){
              document.getElementById('msg').innerText='Sessão já está conectada';
            }else{
              document.getElementById('msg').innerText='QR não disponível, tente novamente';
            }
          }catch(e){
            document.getElementById('msg').innerText='Erro ao obter QR';
          }
        }
        getQr(false);
      </script>
    </body>
  </html>`);
});

/* POST /wpp/register-webhook { webhook: "https://..." } */
router.post('/register-webhook', async (req, res) => {
  const { webhook } = req.body as { webhook?: string };
  if (!webhook) return res.status(400).json({ error: 'missing_webhook' });
  await wppReady;
  const token = await ensureToken();
  try {
    await axios.post(
      internalApi('/register-webhook'),
      { webhook },
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    );
    return res.json({ status: 'registered' });
  } catch (err: any) {
    console.error('Erro em /wpp/register-webhook:', err.response?.data || err.message);
    return res.status(500).json({ error: 'register_fail' });
  }
});

/* Simple HTML page to register n8n webhook */
router.get('/webhook', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Registrar Webhook – WPPConnect</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0f2f5;color:#333}
        form{display:flex;flex-direction:column;width:320px}
        input{padding:8px;border:1px solid #ccc;border-radius:4px}
        button{margin-top:10px;padding:8px;border:none;background:#0a7cff;color:#fff;border-radius:4px;font-size:15px;cursor:pointer}
        #msg{margin-top:12px;height:20px;text-align:center}
      </style>
    </head>
    <body>
      <h2>Registrar Webhook no n8n</h2>
      <form id="f">
        <input id="url" type="url" placeholder="https://n8n.example/webhook/..." required />
        <button type="submit">Registrar</button>
      </form>
      <div id="msg"></div>
      <script>
        document.getElementById('f').addEventListener('submit',async e=>{
          e.preventDefault();
          const url=document.getElementById('url').value.trim();
          if(!url)return;
          document.getElementById('msg').innerText='Enviando...';
          try{
            const r=await fetch('/wpp/register-webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({webhook:url})});
            const d=await r.json();
            if(d.status==='registered'){
              document.getElementById('msg').innerText='Webhook registrado com sucesso!';
            }else{
              document.getElementById('msg').innerText=d.error||'Falha ao registrar';
            }
          }catch(err){
            document.getElementById('msg').innerText='Erro ao registrar';
          }
        });
      </script>
    </body>
  </html>`);
});

export default router;