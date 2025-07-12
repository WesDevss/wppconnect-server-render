"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Carrega .env da raiz do projeto (uma pasta acima de dist quando compilado)
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '..', '.env') });
const express_1 = __importDefault(require("express"));
const routes_1 = __importDefault(require("./routes"));
const config_1 = __importDefault(require("./config"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use('/', routes_1.default);
app.listen(config_1.default.port, () => {
    console.log(`Server running on port ${config_1.default.port}`);
});
