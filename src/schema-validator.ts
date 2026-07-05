import { TetherError } from "./errors.js";
import type { JsonSchema } from "./schemas.js";

export function assertValidSchemaInput(schemaName: string, schema: JsonSchema, value: unknown): void {
  const details: string[] = [];
  validate(schema, value, "$", details);
  if (details.length > 0) {
    throw new TetherError("VALIDATION_FAILED", `${schemaName} failed JSON Schema validation.`, details);
  }
}

function validate(schema: JsonSchema, value: unknown, path: string, details: string[]): void {
  if (schema.oneOf !== undefined) {
    const matches = schema.oneOf.filter((candidate) => {
      const nestedDetails: string[] = [];
      validate(candidate, value, path, nestedDetails);
      return nestedDetails.length === 0;
    });
    if (matches.length !== 1) {
      details.push(`${path} must match exactly one schema`);
    }
    return;
  }

  if (schema.type !== undefined && !matchesType(schema.type, value)) {
    details.push(`${path} must be ${schema.type}`);
    return;
  }

  if (schema.enum !== undefined && !schema.enum.some((candidate) => Object.is(candidate, value))) {
    details.push(`${path} must be one of ${schema.enum.map(String).join(", ")}`);
  }

  if (schema.type === "number" && typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) {
    details.push(`${path} must be >= ${schema.minimum}`);
  }

  if (schema.type === "array" && Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      details.push(`${path} must contain at least ${schema.minItems} item(s)`);
    }
    if (schema.items !== undefined) {
      value.forEach((item, index) => validate(schema.items as JsonSchema, item, `${path}[${index}]`, details));
    }
  }

  if (schema.type === "object" && isRecord(value)) {
    const required = schema.required ?? [];
    for (const key of required) {
      if (!(key in value)) {
        details.push(`${path}.${key} is required`);
      }
    }
    const properties = schema.properties ?? {};
    for (const [key, propertyValue] of Object.entries(value)) {
      const propertySchema = properties[key];
      if (propertySchema !== undefined) {
        validate(propertySchema, propertyValue, `${path}.${key}`, details);
      } else if (schema.additionalProperties === false) {
        details.push(`${path}.${key} is not allowed`);
      } else if (typeof schema.additionalProperties === "object") {
        validate(schema.additionalProperties, propertyValue, `${path}.${key}`, details);
      }
    }
  }
}

function matchesType(type: NonNullable<JsonSchema["type"]>, value: unknown): boolean {
  if (type === "array") {
    return Array.isArray(value);
  }
  if (type === "object") {
    return isRecord(value);
  }
  if (type === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }
  if (type === "null") {
    return value === null;
  }
  return typeof value === type;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
