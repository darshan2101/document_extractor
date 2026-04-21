import {
  AllowNull,
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { v4 as uuidv4 } from "uuid";

import { Extraction } from "./Extraction.js";
import { Session } from "./Session.js";

@Table({
  tableName: "jobs",
  timestamps: false,
  indexes: [
    {
      name: "idx_jobs_status",
      fields: ["status"]
    },
    {
      name: "idx_jobs_session_id",
      fields: ["sessionId"]
    }
  ]
})
export class Job extends Model<Job> {
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.STRING)
  declare id: string;

  @ForeignKey(() => Session)
  @AllowNull(true)
  @Column(DataType.STRING)
  declare sessionId: string | null;

  @ForeignKey(() => Extraction)
  @AllowNull(true)
  @Column(DataType.STRING)
  declare extractionId: string | null;

  @Default("QUEUED")
  @Column(DataType.STRING)
  declare status: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare errorCode: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare errorMessage: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare rawLlmResponse: string | null;

  @AllowNull(true)
  @Column(DataType.BOOLEAN)
  declare retryable: boolean | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare webhookUrl: string | null;

  @Default(DataType.NOW)
  @Column(DataType.DATE)
  declare queuedAt: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare startedAt: Date | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare completedAt: Date | null;

}
