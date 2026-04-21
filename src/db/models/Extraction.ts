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
  tableName: "extractions",
  timestamps: false,
  indexes: [
    {
      name: "idx_extractions_session_id",
      fields: ["sessionId"]
    },
    {
      name: "uq_extractions_file_hash_session_id",
      unique: true,
      fields: ["fileHash", "sessionId"]
    },
    {
      name: "idx_extractions_expiry_date",
      fields: ["expiryDate"]
    },
    {
      name: "idx_extractions_status",
      fields: ["status"]
    }
  ]
})
export class Extraction extends Model<Extraction> {
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.STRING)
  declare id: string;

  @ForeignKey(() => Session)
  @AllowNull(false)
  @Column(DataType.STRING)
  declare sessionId: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare fileName: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare fileHash: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare documentType: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare documentName: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare category: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare applicableRole: string | null;

  @AllowNull(true)
  @Column(DataType.BOOLEAN)
  declare isRequired: boolean | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare detectionReason: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare confidence: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare holderName: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare dateOfBirth: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare sirbNumber: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare passportNumber: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare rank: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare nationality: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare holderPhoto: "PRESENT" | "ABSENT" | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare fieldsJson: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare validityJson: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare complianceJson: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare medicalDataJson: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare flagsJson: string | null;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isExpired: boolean;

  @AllowNull(true)
  @Column(DataType.DATEONLY)
  declare expiryDate: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare summary: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare rawLlmResponse: string | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare processingTimeMs: number | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare promptVersion: string | null;

  @Default("COMPLETE")
  @Column(DataType.STRING)
  declare status: string;

  @Default(DataType.NOW)
  @Column(DataType.DATE)
  declare createdAt: Date;

  @BelongsTo(() => Session)
  declare session?: Session;
}
