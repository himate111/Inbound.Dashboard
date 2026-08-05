import app from "./app.js";
import { env } from "./config/env.js";
import { checkDatabaseConnection } from "./config/db.js";

async function bootstrap() {
  try {
    await checkDatabaseConnection();
    app.listen(env.port, () => {
      console.log(`API server listening on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error("Unable to start API server.");
    console.error(error.message);
    process.exit(1);
  }
}

bootstrap();
