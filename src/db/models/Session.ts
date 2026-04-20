import {
  Column,
  DataType,
  Default,
  HasMany,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { v4 as uuidv4 } from "uuid";

import { Extraction } from "./Extraction.js";
import { Job } from "./Job.js";
import { Validation } from "./Validation.js";

@Table({
  tableName: "sessions",
  timestamps: false
})
export class Session extends Model<Session> {
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.STRING)
  declare id: string;

  @Default(DataType.NOW)
  @Column(DataType.DATE)
  declare createdAt: Date;

  @HasMany(() => Extraction)
  declare extractions?: Extraction[];

  @HasMany(() => Job)
  declare jobs?: Job[];

  @HasMany(() => Validation)
  declare validations?: Validation[];
}
