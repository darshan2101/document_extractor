import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { v4 as uuidv4 } from "uuid";

import { Session } from "./Session.js";

@Table({
  tableName: "validations",
  timestamps: false
})
export class Validation extends Model<Validation> {
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.STRING)
  declare id: string;

  @ForeignKey(() => Session)
  @AllowNull(false)
  @Column(DataType.STRING)
  declare sessionId: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare resultJson: string;

  @Default(DataType.NOW)
  @Column(DataType.DATE)
  declare createdAt: Date;

  @BelongsTo(() => Session)
  declare session?: Session;
}
