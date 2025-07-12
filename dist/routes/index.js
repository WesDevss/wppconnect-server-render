"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const health_1 = __importDefault(require("./health"));
const wpp_1 = __importDefault(require("./wpp"));
const router = (0, express_1.Router)();
router.use('/health', health_1.default);
router.use('/wpp', wpp_1.default);
router.get('/', (_req, res) => res.send('WPPConnect Server Running!'));
exports.default = router;
