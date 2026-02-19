'use strict';

/**
 * src/models/requirementStore.js — Singleton In-Memory State Machine Store
 *
 * The sole data-layer module for the Staging-Approval Workflow. Provides a
 * singleton in-memory store backed by a Map for O(1) lookups by requirement ID.
 * Manages the full lifecycle of requirements through the strict state machine:
 *   submitted → staged → approved → production
 * with `rejected` as a terminal branch from `staged`.
 *
 * State Machine (AAP §0.4.2):
 *   [*] → submitted    (POST /api/requirements)
 *   submitted → staged  (System generates prototype)
 *   staged → approved   (POST /api/approve/:id)
 *   staged → rejected   (POST /api/reject/:id)
 *   approved → production (POST /api/promote/:id)
 *   rejected → [*]      (Terminal)
 *   production → [*]    (Terminal)
 *
 * Design decisions:
 * - CommonJS module pattern (require/module.exports) per AAP §0.7.1
 * - Zero external dependencies — only Node.js built-in crypto and events
 * - Extends EventEmitter for decoupled 'created' and 'transitioned' events
 * - Returns defensive copies (spread operator) to prevent external mutation
 * - Idempotent same-state transitions per AAP §0.7.1
 * - Terminal states (rejected, production) are final — no further transitions
 * - Single active production prototype enforced per AAP §0.7.1
 * - Prototype non-empty guard on submitted → staged per AAP §0.4.2
 * - All user-submitted prompt text treated as untrusted input (AAP §0.7.3)
 *
 * @module requirementStore
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');
const config = require('../config');

/**
 * RequirementStore — In-memory data store with state machine enforcement.
 *
 * Extends EventEmitter to emit lifecycle events:
 *   - 'created': Emitted when a new requirement is created
 *   - 'transitioned': Emitted when a requirement changes state
 *
 * All controller modules share the same singleton instance via require() caching.
 *
 * @class RequirementStore
 * @extends EventEmitter
 */
class RequirementStore extends EventEmitter {
  /**
   * Initializes the store with an empty Map and no active production prototype.
   */
  constructor() {
    super();

    /**
     * Map of requirement ID → requirement object for O(1) lookups.
     * @type {Map<string, Object>}
     */
    this.requirements = new Map();

    /**
     * Tracks the ID of the single currently active production prototype.
     * null indicates no prototype has been promoted (default Hello, World!).
     * @type {string|null}
     */
    this.currentProductionId = null;
  }

  /**
   * Creates a new requirement from user input and persists it in the store.
   *
   * The requirement is created in the 'submitted' state. The controller is
   * responsible for calling stageRequirement() to generate a prototype and
   * transition to 'staged'. This separation keeps the store focused on pure
   * data operations and state transitions.
   *
   * @param {string} prompt - The user's submitted prompt text (required, treated as untrusted input)
   * @param {string} [description=''] - Optional description of the requirement
   * @returns {Object} A defensive copy of the created requirement object
   * @throws {Error} If prompt is missing, not a string, or empty
   * @fires RequirementStore#created
   */
  create(prompt, description) {
    /* Validate prompt — required non-empty string (AAP §0.7.3: untrusted input) */
    if (prompt === undefined || prompt === null || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Prompt is required and must be a non-empty string');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    /**
     * Requirement object shape:
     * @typedef {Object} Requirement
     * @property {string} id              - Unique UUID identifier
     * @property {string} prompt          - User's submitted prompt text
     * @property {string} description     - Optional description
     * @property {string} status          - Current lifecycle state
     * @property {string|null} prototype  - Generated prototype content (set when staged)
     * @property {string|null} rejectionReason - Reason for rejection (set when rejected)
     * @property {string} createdAt       - ISO 8601 creation timestamp
     * @property {string} updatedAt       - ISO 8601 last-update timestamp
     */
    const requirement = {
      id: id,
      prompt: String(prompt).trim(),
      description: (description !== undefined && description !== null && typeof description === 'string')
        ? String(description).trim()
        : '',
      status: config.states.SUBMITTED,
      prototype: null,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now
    };

    this.requirements.set(id, requirement);

    /**
     * Created event — emitted when a new requirement is persisted.
     * @event RequirementStore#created
     * @type {Object} Defensive copy of the created requirement
     */
    this.emit('created', { ...requirement });

    return { ...requirement };
  }

  /**
   * Retrieves a single requirement by its UUID.
   *
   * Returns a defensive copy to prevent external mutation of the Map entry.
   *
   * @param {string} id - The UUID of the requirement to retrieve
   * @returns {Object|null} A copy of the requirement object, or null if not found
   */
  getById(id) {
    const requirement = this.requirements.get(id);
    return requirement ? { ...requirement } : null;
  }

  /**
   * Lists all requirements in the store.
   *
   * Returns defensive copies sorted by createdAt descending (newest first).
   *
   * @returns {Object[]} Array of requirement object copies
   */
  getAll() {
    return Array.from(this.requirements.values())
      .map(function (r) { return { ...r }; })
      .sort(function (a, b) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }

  /**
   * Lists all requirements currently in the 'staged' state.
   *
   * Used by the staging controller to display prototypes available for review.
   *
   * @returns {Object[]} Array of staged requirement copies
   */
  getStaged() {
    return this.getAll().filter(function (r) {
      return r.status === config.states.STAGED;
    });
  }

  /**
   * Gets the currently active production requirement.
   *
   * Returns the requirement whose prototype is served at GET /.
   * Returns null when no prototype has been promoted (default Hello, World!).
   *
   * @returns {Object|null} The active production requirement copy, or null
   */
  getProduction() {
    if (this.currentProductionId === null) {
      return null;
    }
    return this.getById(this.currentProductionId);
  }

  /**
   * Sets prototype content on a requirement and transitions it from submitted to staged.
   *
   * This is the convenience method that combines prototype assignment with the
   * submitted → staged state transition. It enforces the non-empty prototype
   * guard required by AAP §0.4.2.
   *
   * @param {string} id - The UUID of the requirement to stage
   * @param {string} prototypeContent - The generated prototype content (must be non-empty)
   * @returns {Object} A defensive copy of the updated requirement
   * @throws {Error} If requirement not found
   * @throws {Error} If prototypeContent is empty or not a string
   * @throws {Error} If state transition is invalid
   */
  stageRequirement(id, prototypeContent) {
    const requirement = this.requirements.get(id);
    if (!requirement) {
      throw new Error('Requirement not found: ' + id);
    }

    /* Validate prototype content — must be non-empty (AAP §0.4.2 guard) */
    if (
      prototypeContent === undefined ||
      prototypeContent === null ||
      typeof prototypeContent !== 'string' ||
      prototypeContent.trim().length === 0
    ) {
      throw new Error('Cannot stage requirement without prototype content');
    }

    /* Set prototype on the requirement before transition so the guard passes */
    requirement.prototype = String(prototypeContent);
    this.requirements.set(id, requirement);

    /* Transition from submitted to staged — the transition method enforces guards */
    return this.transition(id, config.states.STAGED);
  }

  /**
   * Enforces the strict state machine transitions per AAP §0.4.2.
   *
   * Transition rules:
   *   submitted → staged       (requires non-empty prototype)
   *   staged → approved        (reviewer approval)
   *   staged → rejected        (reviewer rejection)
   *   approved → production    (promotion, auto-archives previous production)
   *   rejected → (none)        (terminal state)
   *   production → (none)      (terminal state)
   *
   * Special behaviors:
   *   - Idempotent: transitioning to current state returns current state (AAP §0.7.1)
   *   - Terminal states cannot transition to any other state (AAP §0.7.1)
   *   - No backward transitions allowed
   *   - Single active production: promoting a new requirement updates currentProductionId
   *
   * @param {string} id - The UUID of the requirement to transition
   * @param {string} toState - The target state to transition to
   * @returns {Object} A defensive copy of the updated requirement
   * @throws {Error} If requirement not found
   * @throws {Error} If transition is invalid (terminal state, disallowed transition, missing prototype)
   * @fires RequirementStore#transitioned
   */
  transition(id, toState) {
    /* Access the requirement directly from Map to allow in-place mutation */
    const requirement = this.requirements.get(id);
    if (!requirement) {
      throw new Error('Requirement not found: ' + id);
    }

    const currentState = requirement.status;

    /*
     * Idempotent check (AAP §0.7.1):
     * "Attempting to transition a requirement to its current state should
     * return the current state without error, not cause a failure."
     */
    if (currentState === toState) {
      return { ...requirement };
    }

    /*
     * Terminal state check (AAP §0.7.1):
     * "Terminal States are Final — Requirements in the rejected or production
     * state must not be transitioned to any other state."
     */
    if (currentState === config.states.REJECTED) {
      throw new Error('Cannot transition from terminal state: ' + currentState);
    }
    if (currentState === config.states.PRODUCTION) {
      throw new Error('Cannot transition from terminal state: ' + currentState);
    }

    /*
     * Valid transition check:
     * Look up allowed transitions from config.validTransitions. If toState
     * is not in the allowed list, reject the transition.
     */
    var allowedTransitions = config.validTransitions[currentState];
    if (!allowedTransitions || !Array.isArray(allowedTransitions) || allowedTransitions.indexOf(toState) === -1) {
      throw new Error('Invalid transition from ' + currentState + ' to ' + toState);
    }

    /*
     * Special guard: submitted → staged (AAP §0.4.2):
     * "Prototype content must be non-empty" — the prototype field on the
     * requirement must be set before this transition can proceed.
     */
    if (currentState === config.states.SUBMITTED && toState === config.states.STAGED) {
      if (
        !requirement.prototype ||
        typeof requirement.prototype !== 'string' ||
        requirement.prototype.trim().length === 0
      ) {
        throw new Error('Cannot stage requirement without prototype content');
      }
    }

    /*
     * Special handling: approved → production (AAP §0.7.1):
     * "Only one requirement may be in the production state at any given time.
     * Promoting a new requirement to production must automatically archive
     * the previously active production requirement."
     *
     * The old production requirement retains its terminal 'production' status
     * (since production IS a terminal state), but currentProductionId updates
     * to point to the newly promoted requirement. getProduction() always
     * returns the latest promoted requirement.
     *
     * Guard: only requirements in APPROVED state may reach PRODUCTION
     * (enforced by validTransitions above, made explicit here for clarity).
     */
    if (currentState === config.states.APPROVED && toState === config.states.PRODUCTION) {
      this.currentProductionId = id;
    }

    /* Perform the transition: update status and timestamp */
    var previousState = currentState;
    requirement.status = toState;
    requirement.updatedAt = new Date().toISOString();
    this.requirements.set(id, requirement);

    /**
     * Transitioned event — emitted after a successful state transition.
     * @event RequirementStore#transitioned
     * @type {Object}
     * @property {string} id   - Requirement UUID
     * @property {string} from - Previous state
     * @property {string} to   - New state
     * @property {Object} requirement - Defensive copy of the updated requirement
     */
    this.emit('transitioned', {
      id: id,
      from: previousState,
      to: toState,
      requirement: { ...requirement }
    });

    return { ...requirement };
  }

  /**
   * Clears all data in the store. Useful for test cleanup.
   *
   * Resets the requirements Map and the currentProductionId pointer.
   */
  reset() {
    this.requirements.clear();
    this.currentProductionId = null;
  }

  /**
   * Returns the total number of requirements in the store.
   *
   * @returns {number} The count of requirements
   */
  count() {
    return this.requirements.size;
  }
}

/* ---------------------------------------------------------------------------
 * Singleton Instance Export
 *
 * All controller modules share the same store instance via Node.js require()
 * caching. When any module does:
 *   const store = require('../models/requirementStore');
 * they all receive the SAME instance.
 * --------------------------------------------------------------------------- */
var store = new RequirementStore();

/* Default export: the singleton instance */
module.exports = store;

/* Named export: the class for testing purposes */
module.exports.RequirementStore = RequirementStore;
