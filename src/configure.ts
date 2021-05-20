import dotenv from "dotenv";
import path from "path";

if (!process.env.NETWORK_RPC) {
  console.log("Applying .env configuration");
  dotenv.config({ path: path.join(__dirname, "../.env") });
}
