import { Sequelize } from "sequelize-typescript";

import { env } from "../config/env.js";

export const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: env.DATABASE_URL,
  models: []
});
