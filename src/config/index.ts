export default {
  port: process.env.PORT || 21465,
  sessionName: process.env.SESSION_NAME || 'NERDWHATS_AMERICA',
  enableMultiDevice: process.env.ENABLE_MULTI_DEVICE === 'true'
};
