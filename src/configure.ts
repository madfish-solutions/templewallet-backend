import dotenv from "dotenv";
import path from "path";
import logger from "./utils/logger";

if (!process.env.NETWORK_RPC) {
  logger.info("Applying .env configuration");
  dotenv.config({ path: path.join(__dirname, "../.env") });
}
