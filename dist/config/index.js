"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    port: process.env.PORT || 21465,
    sessionName: process.env.SESSION_NAME || 'NERDWHATS_AMERICA',
    enableMultiDevice: process.env.ENABLE_MULTI_DEVICE === 'true'
};
