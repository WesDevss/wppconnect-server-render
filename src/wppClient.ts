import wppconnect from '@wppconnect/server';

/**
 * Singleton responsible for starting the internal WPPConnect HTTP server **once** when the
 * container starts. All route handlers can import `wppReady` to await the initialized client
 * without risking multiple `initServer` calls that would clash on the same port.
 */

export const WPP_PORT = process.env.WPP_INTERNAL_PORT || '21466';

// Remove the public PORT temporarily so the internal server doesn't attempt to use it.
const savedPort = process.env.PORT;
if (savedPort) {
  delete process.env.PORT;
}

const clientPromise = wppconnect
  .initServer({
    port: Number(WPP_PORT),
    secretKey: process.env.WPP_SECRET || 'THISISMYSECURETOKEN',
    session: process.env.SESSION_NAME,
    startAllSession: false,
  })
  .then((client: any) => {
    // Restore the original Express port after the internal server is up.
    if (savedPort) {
      process.env.PORT = savedPort;
    }
    return client;
  })
  .catch((err: any) => {
    // If the server is already running (cold-start race) just continue.
    if (err?.code === 'EADDRINUSE') {
      console.warn('WPPConnect internal server already running on', WPP_PORT);
      return null;
    }
    throw err;
  });

export const wppReady = clientPromise;

export const INTERNAL_API_BASE = `http://localhost:${WPP_PORT}/api/${process.env.SESSION_NAME}`;
