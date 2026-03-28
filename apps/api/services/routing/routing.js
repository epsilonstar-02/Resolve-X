const express       = require('express');
const router        = express.Router();
const axios         = require('axios');
const pool          = require('../db/db');
const cron          = require('node-cron');
const { getConnection, publish, createConsumer, QUEUES } = require('../../rabbitmq');
const { broadcast } = require('../notifications/notifications');

const CLASSIFIER_URL = process.env.CLASSIFIER_URL || 'http://classifier:8000';
const ROUTING_RETRY_MS = Number(process.env.ROUTING_ENGINE_RETRY_MS || 5000);

const DEPT_CODE_ALIASES = {
  ROADS:      ['ROADS', 'ROADS_DEPT'],
  DRAINAGE:   ['DRAINAGE', 'DRN', 'DRAIN'],
  ELECTRICAL: ['ELECTRICAL', 'ELEC', 'STREETLIGHT'],
  SANITATION: ['SANITATION', 'WASTE', 'SWM'],
  WATER:      ['WATER'],
  GENERAL:    ['GENERAL'],
};

const CATEGORY_TO_DEPT_CODE = {
  CAT_01: 'ROADS',
  CAT_02: 'DRAINAGE',
  CAT_03: 'ELECTRICAL',
  CAT_04: 'SANITATION',
  CAT_05: 'WATER',
  CAT_06: 'GENERAL',
  CAT_07: 'GENERAL',
  CAT_08: 'GENERAL',
  CAT_09: 'GENERAL',
  CAT_10: 'GENERAL',
  ROADS_AND_FOOTPATHS: 'ROADS',
  DRAINAGE_AND_SEWAGE: 'DRAINAGE',
  STREETLIGHTING: 'ELECTRICAL',
  WASTE_AND_SANITATION: 'SANITATION',
  WATER_SUPPLY: 'WATER',
  PARKS_AND_PUBLIC_SPACES: 'GENERAL',
  ENCROACHMENT_AND_ILLEGAL: 'GENERAL',
  NOISE_AND_POLLUTION: 'GENERAL',
  STRAY_ANIMALS: 'GENERAL',
  OTHER_MISCELLANEOUS: 'GENERAL',
  OTHER: 'GENERAL',
};

let routingConsumerChannel = null;
let routingStartTimer = null;
let isRoutingStarting = false;

// ── SLA tier map (seconds) ────────────────────────────────────────────────────

const SLA_SECONDS = { 1: 86400, 2: 172800, 3: 259200, 4: 432000, 5: 864000 };

function slaDeadline(priority) {
  const seconds = SLA_SECONDS[priority] || SLA_SECONDS[3];
  return new Date(Date.now() + seconds * 1000);
}

function normalizeCategoryKey(category) {
  return String(category || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getDepartmentCodeCandidates(category) {
  const key = normalizeCategoryKey(category);
  const mappedDeptCode = CATEGORY_TO_DEPT_CODE[key] || 'GENERAL';
  const aliases = DEPT_CODE_ALIASES[mappedDeptCode] || DEPT_CODE_ALIASES.GENERAL;
  return aliases.map((code) => String(code).toUpperCase());
}

async function findDepartmentForCategory(category) {
  const candidates = getDepartmentCodeCandidates(category);

  const { rows } = await pool.query(
    `SELECT id, code
     FROM departments
     WHERE UPPER(code) = ANY($1::text[])
     ORDER BY array_position($1::text[], UPPER(code))
     LIMIT 1`,
    [candidates]
  );

  if (rows.length) {
    return {
      deptId: rows[0].id,
      deptCode: rows[0].code,
      requestedCodes: candidates,
    };
  }

  const { rows: generalRows } = await pool.query(
    "SELECT id, code FROM departments WHERE UPPER(code) = 'GENERAL' LIMIT 1"
  );

  return {
    deptId: generalRows[0]?.id || null,
    deptCode: generalRows[0]?.code || null,
    requestedCodes: candidates,
  };
}

async function findLeastLoadedOfficer(deptId, wardId) {
  const baseSelect =
    `SELECT u.id, COUNT(t.id) AS open_tasks
     FROM users u
     LEFT JOIN tasks t
       ON t.assigned_to = u.id
       AND t.status NOT IN ('resolved', 'closed')
     WHERE u.dept_id = $1
       AND u.role IN ('officer', 'dept_head')
       AND u.is_active = true`;

  if (wardId) {
    const { rows } = await pool.query(
      `${baseSelect}
       AND u.ward_id = $2
       GROUP BY u.id
       ORDER BY open_tasks ASC
       LIMIT 1`,
      [deptId, wardId]
    );

    if (rows.length) return rows[0].id;
  }

  const { rows } = await pool.query(
    `${baseSelect}
     GROUP BY u.id
     ORDER BY open_tasks ASC
     LIMIT 1`,
    [deptId]
  );

  return rows[0]?.id || null;
}

// ── Integration 1: Call classifier:8000 instead of local classify() ──────────
// Sends complaint text + location to the ML service.
// Returns { category, priority } — falls back to passed-in category + priority 3
// if the classifier is unavailable so routing never blocks.

async function classifyViaML({ description, category, latitude, longitude }) {
  const safeDescription = (description || '').trim().length >= 10
    ? description
    : `Citizen reported ${category || 'civic issue'} at this location. Needs review.`;

  try {
    const { data } = await axios.post(
      `${CLASSIFIER_URL}/api/v1/analyze`,
      {
        text_description:       safeDescription,
        latitude:               latitude   || 0,
        longitude:              longitude  || 0,
        user_selected_category: category,
      },
      { timeout: 8000 }
    );

    const analysis = data?.analysis;
    if (!analysis) return { category, priority: 3 };

    return {
      category: analysis.primary_issue?.category  || category,
      priority: analysis.primary_issue?.priority_score || 3,
    };
  } catch (err) {
    console.error('Classifier unavailable, using defaults:', err.message);
    return { category, priority: 3 };
  }
}

// ── Routing engine ────────────────────────────────────────────────────────────

async function startRoutingEngine() {
  if (routingConsumerChannel || isRoutingStarting) return;
  if (!getConnection()) {
    throw new Error('RabbitMQ not connected yet');
  }

  isRoutingStarting = true;

  try {
    // Complaints are published to complaint.submitted by complaints.js.
    const channel = await createConsumer(QUEUES.SUBMITTED, async (event) => {
      const { complaint_id, citizen_id, category, description, location, ward_id } = event;
      const latitude  = location?.latitude  || 0;
      const longitude = location?.longitude || 0;

      // Idempotency guard: re-delivered messages should not create duplicate tasks.
      const { rows: [currentComplaint] } = await pool.query(
        `SELECT status, dept_id, assigned_to, sla_deadline
         FROM complaints
         WHERE id = $1
         LIMIT 1`,
        [complaint_id]
      );

      if (!currentComplaint) {
        console.warn(`Complaint ${complaint_id} not found. Skipping routing event.`);
        return;
      }

      const { rows: [existingPrimaryTask] } = await pool.query(
        `SELECT id, dept_id, assigned_to, sla_deadline
         FROM tasks
         WHERE complaint_id = $1
           AND is_primary = true
         ORDER BY created_at ASC
         LIMIT 1`,
        [complaint_id]
      );

      if (existingPrimaryTask) {
        if (currentComplaint.status === 'pending') {
          await pool.query(
            `UPDATE complaints
             SET dept_id      = COALESCE(dept_id, $1),
                 assigned_to  = COALESCE(assigned_to, $2),
                 sla_deadline = COALESCE(sla_deadline, $3),
                 status       = 'assigned',
                 updated_at   = now()
             WHERE id = $4`,
            [
              existingPrimaryTask.dept_id,
              existingPrimaryTask.assigned_to,
              existingPrimaryTask.sla_deadline,
              complaint_id,
            ]
          );
        }

        console.log(`Complaint ${complaint_id} already has primary task ${existingPrimaryTask.id}. Skipping duplicate routing.`);
        return;
      }

      if (currentComplaint.status !== 'pending') {
        console.log(`Complaint ${complaint_id} already in status ${currentComplaint.status}. Skipping routing.`);
        return;
      }

      // ── Step 1: ML classification (Integration 1) ─────────────────────────
      const { category: mlCategory, priority } = await classifyViaML({
        description, category, latitude, longitude,
      });

      // ── Step 2: Look up department by ML-returned category ────────────────
      const { deptId, deptCode, requestedCodes } = await findDepartmentForCategory(mlCategory);

      if (!deptId) {
        console.error(
          `No department found for category ${mlCategory} (tried ${requestedCodes.join(', ')}), complaint ${complaint_id}`
        );
        return;
      }

      // ── Step 3: Find least-loaded officer ────────────────────────────────
      const assignedTo = await findLeastLoadedOfficer(deptId, ward_id);
      const deadline   = slaDeadline(priority);

      // ── Step 4: Insert Task ───────────────────────────────────────────────
      const { rows: [task] } = await pool.query(
        `INSERT INTO tasks
           (id, complaint_id, dept_id, assigned_to, is_primary,
            status, sla_deadline, created_at, updated_at)
         VALUES
           (gen_random_uuid(), $1, $2, $3, true,
            'open', $4, now(), now())
         RETURNING id`,
        [complaint_id, deptId, assignedTo, deadline]
      );

      // ── Step 5: Update complaint ──────────────────────────────────────────
      await pool.query(
        `UPDATE complaints
         SET dept_id = $1, assigned_to = $2, status = 'assigned',
             sla_deadline = $3, priority = $4, updated_at = now()
         WHERE id = $5`,
        [deptId, assignedTo, deadline, priority, complaint_id]
      );

      // ── Step 6: Audit trail ───────────────────────────────────────────────
      await pool.query(
        `INSERT INTO complaint_history
           (id, complaint_id, actor_id, action, old_status, new_status, note, created_at)
         VALUES
           (gen_random_uuid(), $1, $2, 'assigned', 'pending', 'assigned', $3, now())`,
        [complaint_id, assignedTo, `ML routed to dept ${deptCode || deptId} (category: ${mlCategory}, priority: ${priority})`]
      );

      // ── Step 7: Publish task.created ──────────────────────────────────────
      await publish(QUEUES.TASK_CREATED, {
        task_id:      task.id,
        complaint_id,
        officer_id:   assignedTo,
        dept_id:      deptId,
        sla_deadline: deadline,
      });

      broadcast({
        type:         'task.assigned',
        task_id:      task.id,
        complaint_id,
        officer_id:   assignedTo,
        dept_id:      deptId,
      });

      // ── Step 8: WebSocket broadcast ───────────────────────────────────────
      broadcast({
        type:         'complaint.status_updated',
        complaint_id,
        citizen_id,
        new_status:   'assigned',
        dept_id:      deptId,
      });

      console.log(`Routed complaint ${complaint_id} → dept ${deptCode || deptId} (ML category: ${mlCategory}, priority: ${priority}), officer ${assignedTo}`);
    });

    routingConsumerChannel = channel;
    routingConsumerChannel.on('close', () => {
      routingConsumerChannel = null;
      console.warn(`Routing consumer channel closed. Retrying in ${ROUTING_RETRY_MS}ms.`);
      scheduleRoutingEngineStart(ROUTING_RETRY_MS);
    });
    routingConsumerChannel.on('error', (err) => {
      console.error('Routing consumer channel error:', err.message);
    });

    console.log('Routing engine started');
  } finally {
    isRoutingStarting = false;
  }
}

function scheduleRoutingEngineStart(delayMs = 0) {
  if (routingConsumerChannel || isRoutingStarting || routingStartTimer) return;

  routingStartTimer = setTimeout(async () => {
    routingStartTimer = null;

    try {
      await startRoutingEngine();
    } catch (err) {
      isRoutingStarting = false;
      console.error(`Failed to start routing engine: ${err.message}`);
      scheduleRoutingEngineStart(ROUTING_RETRY_MS);
    }
  }, delayMs);
}

// ── SLA escalation cron ───────────────────────────────────────────────────────

cron.schedule('*/15 * * * *', async () => {
  try {
    const { rows: warningTasks } = await pool.query(
      `SELECT t.id, t.dept_id, t.assigned_to, t.complaint_id
       FROM tasks t
       WHERE t.status NOT IN ('resolved', 'closed', 'escalated')
         AND t.escalation_notified = false
         AND now() > t.created_at + (t.sla_deadline - t.created_at) * 0.8`,
    );

    await Promise.all(warningTasks.map(async (task) => {
      await publish(QUEUES.SLA_ESCALATION, {
        type:         'sla.escalation',
        task_id:      task.id,
        complaint_id: task.complaint_id,
        dept_id:      task.dept_id,
        officer_id:   task.assigned_to,
        pct_consumed: 80,
      });

      broadcast({
        type:    'sla.escalation',
        task_id: task.id,
        complaint_id: task.complaint_id,
        dept_id: task.dept_id,
      });

      await pool.query(
        'UPDATE tasks SET escalation_notified = true WHERE id = $1',
        [task.id]
      );
    }));

    const { rows: overdueTasks } = await pool.query(
      `UPDATE tasks
       SET status = 'escalated', updated_at = now()
       WHERE status IN ('open', 'in_progress')
         AND now() > sla_deadline
       RETURNING id, dept_id, complaint_id`,
    );

    await Promise.all(overdueTasks.map(async (task) => {
      const { rows: [complaintRow] } = await pool.query(
        'SELECT citizen_id FROM complaints WHERE id = $1',
        [task.complaint_id]
      );

      await pool.query(
        `UPDATE complaints SET status = 'escalated', updated_at = now()
         WHERE id = $1`,
        [task.complaint_id]
      );

      await pool.query(
        `INSERT INTO complaint_history
           (id, complaint_id, actor_id, action, old_status, new_status, note, created_at)
         VALUES
           (gen_random_uuid(), $1, NULL, 'auto_escalated', 'in_progress', 'escalated',
            'SLA deadline exceeded', now())`,
        [task.complaint_id]
      );

      broadcast({
        type:         'complaint.status_updated',
        complaint_id: task.complaint_id,
        citizen_id:   complaintRow?.citizen_id,
        new_status:   'escalated',
        dept_id:      task.dept_id,
      });
    }));

    if (warningTasks.length || overdueTasks.length) {
      console.log(`SLA cron: ${warningTasks.length} warnings, ${overdueTasks.length} escalated`);
    }

  } catch (err) {
    console.error('SLA cron error:', err.message);
  }
});

scheduleRoutingEngineStart();

module.exports = router;