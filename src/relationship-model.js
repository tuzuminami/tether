import { TetherError } from "./errors.js";

export function parseRelationshipModel(input) {
  if (!isRecord(input)) {
    throw validation(["model must be an object"]);
  }

  const details = [];
  const id = readString(input, "id", details);
  const version = readString(input, "version", details);
  const axes = readAxes(input.axes, details);
  const eventTypes = readEventTypes(input.events, details);
  const transitionRules = readTransitionRules(input.transitionRules, axes, eventTypes, details);
  const boundaryRules = readBoundaryRules(input.boundaryRules ?? [], axes, eventTypes, details);
  const decayRules = input.decayRules === undefined ? [] : readDecayRules(input.decayRules, axes, details);

  const blockedPositive = new Set(
    boundaryRules
      .filter((rule) => rule.blocksPositiveDelta)
      .map((rule) => `${rule.eventType}:${rule.axis}`)
  );
  for (const rule of transitionRules) {
    if (rule.delta > 0 && blockedPositive.has(`${rule.eventType}:${rule.axis}`)) {
      details.push(`transitionRule ${rule.id} grants positive state for a boundary-blocked event`);
    }
  }

  if (details.length > 0) {
    throw validation(details);
  }

  return { id, version, axes, events: [...eventTypes].map((type) => ({ type })), transitionRules, boundaryRules, decayRules };
}

function readAxes(value, details) {
  if (!Array.isArray(value) || value.length === 0) {
    details.push("axes must contain at least one axis");
    return [];
  }
  const axes = value.map((axis, index) => {
    if (!isRecord(axis)) {
      details.push(`axes[${index}] must be an object`);
      return { id: "", min: 0, max: 0, initial: 0 };
    }
    const id = readString(axis, "id", details, `axes[${index}].id`);
    const min = readNumber(axis, "min", details, `axes[${index}].min`);
    const max = readNumber(axis, "max", details, `axes[${index}].max`);
    const initial = readNumber(axis, "initial", details, `axes[${index}].initial`);
    if (min >= max) {
      details.push(`axes[${index}] min must be lower than max`);
    }
    if (initial < min || initial > max) {
      details.push(`axes[${index}] initial must be inside range`);
    }
    return { id, min, max, initial };
  });
  if (new Set(axes.map((axis) => axis.id)).size !== axes.length) {
    details.push("axes must have unique ids");
  }
  return axes;
}

function readEventTypes(value, details) {
  if (!Array.isArray(value) || value.length === 0) {
    details.push("events must contain at least one event");
    return new Set();
  }
  const eventTypes = new Set();
  for (const [index, event] of value.entries()) {
    if (!isRecord(event)) {
      details.push(`events[${index}] must be an object`);
      continue;
    }
    eventTypes.add(readString(event, "type", details, `events[${index}].type`));
  }
  return eventTypes;
}

function readTransitionRules(value, axes, eventTypes, details) {
  if (!Array.isArray(value) || value.length === 0) {
    details.push("transitionRules must contain at least one rule");
    return [];
  }
  const axisIds = new Set(axes.map((axis) => axis.id));
  const rules = value.map((rule, index) => {
    if (!isRecord(rule)) {
      details.push(`transitionRules[${index}] must be an object`);
      return { id: "", eventType: "", axis: "", delta: 0, reasonCode: "" };
    }
    const id = readString(rule, "id", details, `transitionRules[${index}].id`);
    const eventType = readString(rule, "eventType", details, `transitionRules[${index}].eventType`);
    const axis = readString(rule, "axis", details, `transitionRules[${index}].axis`);
    const delta = readNumber(rule, "delta", details, `transitionRules[${index}].delta`);
    const reasonCode = readString(rule, "reasonCode", details, `transitionRules[${index}].reasonCode`);
    if (!eventTypes.has(eventType)) {
      details.push(`transitionRules[${index}] references undefined event`);
    }
    if (!axisIds.has(axis)) {
      details.push(`transitionRules[${index}] references undefined axis`);
    }
    return { id, eventType, axis, delta, reasonCode };
  });
  if (new Set(rules.map((rule) => rule.id)).size !== rules.length) {
    details.push("transitionRules must have unique ids");
  }
  return rules;
}

function readBoundaryRules(value, axes, eventTypes, details) {
  if (!Array.isArray(value)) {
    details.push("boundaryRules must be an array");
    return [];
  }
  const axisIds = new Set(axes.map((axis) => axis.id));
  return value.map((rule, index) => {
    if (!isRecord(rule)) {
      details.push(`boundaryRules[${index}] must be an object`);
      return { id: "", eventType: "", axis: "", blocksPositiveDelta: true, policyRef: "" };
    }
    const id = readString(rule, "id", details, `boundaryRules[${index}].id`);
    const eventType = readString(rule, "eventType", details, `boundaryRules[${index}].eventType`);
    const axis = readString(rule, "axis", details, `boundaryRules[${index}].axis`);
    const policyRef = readString(rule, "policyRef", details, `boundaryRules[${index}].policyRef`);
    const blocksPositiveDelta = rule.blocksPositiveDelta === undefined ? true : rule.blocksPositiveDelta === true;
    if (!eventTypes.has(eventType)) {
      details.push(`boundaryRules[${index}] references undefined event`);
    }
    if (!axisIds.has(axis)) {
      details.push(`boundaryRules[${index}] references undefined axis`);
    }
    return { id, eventType, axis, blocksPositiveDelta, policyRef };
  });
}

function readDecayRules(value, axes, details) {
  if (!Array.isArray(value)) {
    details.push("decayRules must be an array");
    return [];
  }
  const axisIds = new Set(axes.map((axis) => axis.id));
  return value.map((rule, index) => {
    if (!isRecord(rule)) {
      details.push(`decayRules[${index}] must be an object`);
      return { axis: "", perDay: 0 };
    }
    const axis = readString(rule, "axis", details, `decayRules[${index}].axis`);
    const perDay = readNumber(rule, "perDay", details, `decayRules[${index}].perDay`);
    if (!axisIds.has(axis)) {
      details.push(`decayRules[${index}] references undefined axis`);
    }
    if (perDay < 0) {
      details.push(`decayRules[${index}].perDay must not be negative`);
    }
    return { axis, perDay };
  });
}

function readString(record, key, details, path = key) {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    details.push(`${path} must be a non-empty string`);
    return "";
  }
  return value;
}

function readNumber(record, key, details, path = key) {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    details.push(`${path} must be a finite number`);
    return 0;
  }
  return value;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validation(details) {
  return new TetherError("VALIDATION_FAILED", "Relationship model validation failed.", details);
}
