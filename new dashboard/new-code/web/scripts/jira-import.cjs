const fs = require('fs');
const path = require('path');

const EMAIL = 'hemalb@amplior.com';
const TOKEN = process.env.JIRA_API_TOKEN || 'YOUR_API_TOKEN_HERE';
const DOMAIN = 'amplior.atlassian.net';
const PROJECT_KEY = 'ALTL';

const AUTH = Buffer.from(EMAIL + ':' + TOKEN).toString('base64');

// User mappings
const OWNER_MAP = {
  'Ankit': '712020:69e087b5-2cc2-48ee-878b-4fa49dd81f77',
  'Claude': '712020:69e087b5-2cc2-48ee-878b-4fa49dd81f77',
  'Sub-agent': '712020:69e087b5-2cc2-48ee-878b-4fa49dd81f77'
};

// Priority mappings
const PRIORITY_MAP = {
  'P0': 'Highest',
  'P1': 'High',
  'P2': 'Medium',
  'P3': 'Low'
};

// Robust CSV Parser (State Machine)
function parseCSV(content) {
  const result = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          cell += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(cell);
        cell = '';
      } else if (char === '\n' || char === '\r') {
        row.push(cell);
        if (row.some(c => c.trim().length > 0)) {
          result.push(row);
        }
        row = [];
        cell = '';
        if (char === '\r' && nextChar === '\n') {
          i++; // skip \n
        }
      } else {
        cell += char;
      }
    }
  }
  if (cell || row.length > 0) {
    row.push(cell);
    result.push(row);
  }
  return result;
}

// ADF Description Helper with Info and Note Panels
function makeADFDescription(title, originalStatus, waveEpic, module, notes) {
  const content = [];

  // 1. Metadata Info Panel (Blue Panel)
  const metadataItems = [];
  if (module) {
    metadataItems.push({
      type: 'listItem',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Module: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: module }
        ]
      }]
    });
  }
  if (waveEpic) {
    metadataItems.push({
      type: 'listItem',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Wave/Epic: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: waveEpic }
        ]
      }]
    });
  }
  if (originalStatus) {
    metadataItems.push({
      type: 'listItem',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Original Status: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: originalStatus }
        ]
      }]
    });
  }
  
  content.push({
    type: 'panel',
    attrs: { panelType: 'info' },
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'METADATA', marks: [{ type: 'strong' }] }]
      },
      {
        type: 'bulletList',
        content: metadataItems
      }
    ]
  });

  // 2. Main Description Section
  if (title) {
    content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Main Description:', marks: [{ type: 'strong' }] }]
    });
    content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: title }]
    });
  }

  // 3. Historical Notes Panel (Gray Panel)
  if (notes) {
    content.push({
      type: 'panel',
      attrs: { panelType: 'note' },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'HISTORICAL NOTES', marks: [{ type: 'strong' }] }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: notes }]
        }
      ]
    });
  }

  return {
    type: 'doc',
    version: 1,
    content: content
  };
}

// Call API helper with retry-after support
async function callJiraAPI(endpoint, options = {}) {
  const url = `https://${DOMAIN}${endpoint}`;
  const defaultHeaders = {
    'Authorization': 'Basic ' + AUTH,
    'Accept': 'application/json'
  };
  if (options.body) {
    defaultHeaders['Content-Type'] = 'application/json';
  }
  const headers = { ...defaultHeaders, ...options.headers };

  while (true) {
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '10', 10);
      console.log(`[Rate Limit] HTTP 429. Waiting for ${retryAfter} seconds...`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      continue;
    }
    
    return response;
  }
}

async function main() {
  // 0. Project Setup (Reset/Re-create ALTL)
  console.log(`Checking if project ${PROJECT_KEY} exists...`);
  try {
    const delRes = await callJiraAPI(`/rest/api/3/project/${PROJECT_KEY}?enableUndo=false`, {
      method: 'DELETE'
    });
    if (delRes.status === 204) {
      console.log(`Deleted existing project ${PROJECT_KEY}.`);
      await new Promise(r => setTimeout(r, 2000));
    } else {
      console.log(`No existing project ${PROJECT_KEY} found to delete (status ${delRes.status}).`);
    }
  } catch (e) {
    console.log(`No existing project ${PROJECT_KEY} found to delete.`);
  }

  console.log(`Creating fresh project ${PROJECT_KEY}...`);
  const createRes = await callJiraAPI('/rest/api/3/project', {
    method: 'POST',
    body: JSON.stringify({
      key: PROJECT_KEY,
      name: 'AltLeads CRM',
      projectTypeKey: 'software',
      projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-simplified-agility-kanban',
      leadAccountId: '712020:69e087b5-2cc2-48ee-878b-4fa49dd81f77'
    })
  });
  
  if (createRes.status === 201) {
    const data = await createRes.json();
    console.log(`Created project ${PROJECT_KEY} (ID: ${data.id})`);
    
    // Set default assignee to UNASSIGNED to prevent notification emails
    console.log(`Setting project default assignee to UNASSIGNED...`);
    const updateRes = await callJiraAPI(`/rest/api/3/project/${PROJECT_KEY}`, {
      method: 'PUT',
      body: JSON.stringify({
        assigneeType: 'UNASSIGNED'
      })
    });
    console.log(`Update assigneeType status: ${updateRes.status}`);

    // Wait for 3 seconds to let Jira finalize provisioning
    await new Promise(r => setTimeout(r, 3000));
  } else {
    const errText = await createRes.text();
    console.error(`Failed to create project ${PROJECT_KEY}: ${errText}`);
    process.exit(1);
  }

  const csvPath = path.join(__dirname, '..', '..', '..', 'AltLeads-Backlog-Tracker(Backlog).csv');
  console.log(`Reading CSV from ${csvPath}...`);
  const content = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(content);

  // Filter out header
  const header = rows[0];
  const dataRows = rows.slice(1);

  const issuesMap = {};
  let maxId = 0;

  for (const row of dataRows) {
    if (row.length < 2) continue;
    const idStr = row[0].trim();
    const match = idStr.match(/^ALT-(\d+)$/);
    if (!match) continue;
    
    const idNum = parseInt(match[1], 10);
    issuesMap[idNum] = {
      id: idStr,
      title: row[1]?.trim() || '',
      type: row[2]?.trim() || 'Task',
      module: row[3]?.trim() || '',
      waveEpic: row[4]?.trim() || '',
      priority: row[5]?.trim() || 'P2',
      status: row[6]?.trim() || 'Backlog',
      created: row[7]?.trim() || '',
      updated: row[8]?.trim() || '',
      finished: row[9]?.trim() || '',
      owner: row[10]?.trim() || '',
      notes: row[11]?.trim() || ''
    };
    if (idNum > maxId) maxId = idNum;
  }

  console.log(`Found ${Object.keys(issuesMap).length} issues in CSV. Max ID: ${maxId}`);

  // 1. Setup Jira Components for Modules
  const uniqueModules = [...new Set(dataRows.map(row => row[3]?.trim()).filter(Boolean))];
  console.log(`\n--- Components Setup ---`);
  console.log(`Found ${uniqueModules.length} unique Modules/Components in CSV.`);
  
  const componentMapping = {};
  for (const moduleName of uniqueModules) {
    console.log(`Creating Jira Component "${moduleName}"...`);
    const compRes = await callJiraAPI('/rest/api/3/component', {
      method: 'POST',
      body: JSON.stringify({
        name: moduleName,
        project: PROJECT_KEY
      })
    });
    
    if (compRes.status === 201) {
      const compData = await compRes.json();
      componentMapping[moduleName] = compData.id;
      console.log(`Created Component: ${moduleName} (ID: ${compData.id})`);
    } else {
      // If it already exists, fetch components list to find it
      console.log(`Component creation status ${compRes.status}. Checking existing components...`);
      const listRes = await callJiraAPI(`/rest/api/3/project/${PROJECT_KEY}/components`);
      const comps = await listRes.json();
      const existing = comps.find(c => c.name === moduleName);
      if (existing) {
        componentMapping[moduleName] = existing.id;
        console.log(`Mapped to existing Component: ${moduleName} (ID: ${existing.id})`);
      } else {
        console.error(`Failed to map or create component "${moduleName}":`, await compRes.text());
      }
    }
    await new Promise(r => setTimeout(r, 100));
  }

  const placeholdersToDelete = [];
  const epicMapping = {}; // Wave/Epic Name -> Jira Epic Key

  // Create issues sequentially
  for (let id = 1; id <= maxId; id++) {
    const csvIssue = issuesMap[id];
    
    if (csvIssue) {
      console.log(`\n[${id}/${maxId}] Creating issue ${PROJECT_KEY}-${id}: "${csvIssue.title}"`);
      
      // Determine issue type (Kanban default project supports Task and Epic)
      let jiraType = 'Task';
      if (csvIssue.type === 'Epic') jiraType = 'Epic';

      // Map Priority
      const jiraPriority = PRIORITY_MAP[csvIssue.priority] || 'Medium';

      // Assignee
      const assigneeAccountId = OWNER_MAP[csvIssue.owner] || null;

      // Description (ADF)
      const description = makeADFDescription(
        csvIssue.title,
        csvIssue.status,
        csvIssue.waveEpic,
        csvIssue.module,
        csvIssue.notes
      );

      // Determine labels based on status and original type
      const labels = [];
      if (csvIssue.status === 'Blocked') labels.push('Blocked');
      if (csvIssue.status === 'On Hold') labels.push('On-Hold');
      if (csvIssue.status === 'Planned') labels.push('Planned');
      if (csvIssue.status === 'Backlog') labels.push('Backlog');
      if (csvIssue.type) labels.push(csvIssue.type.replace(/\s+/g, '-'));

      const payload = {
        fields: {
          project: { key: PROJECT_KEY },
          summary: csvIssue.title,
          issuetype: { name: jiraType },
          priority: { name: jiraPriority },
          description: description,
          labels: labels
        }
      };

      // Add component association if it matches a module
      if (csvIssue.module && componentMapping[csvIssue.module]) {
        payload.fields.components = [{ id: componentMapping[csvIssue.module] }];
      }

      // Commented out assignee to prevent triggering notification emails. 
      // All tasks will be imported as Unassigned, but the original owner is documented in the ticket description panel.
      // if (assigneeAccountId) {
      //   payload.fields.assignee = { accountId: assigneeAccountId };
      // }

      const res = await callJiraAPI('/rest/api/3/issue', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.status !== 201) {
        console.error(`Failed to create issue ${PROJECT_KEY}-${id}:`, await res.text());
        process.exit(1);
      }

      const createdIssue = await res.json();
      const createdKey = createdIssue.key;
      console.log(`Created: ${createdKey} (ID: ${createdIssue.id})`);

      if (createdKey !== `${PROJECT_KEY}-${id}`) {
        console.error(`ERROR: Key mismatch! Expected ${PROJECT_KEY}-${id} but got ${createdKey}`);
        process.exit(1);
      }

      // Handle Transitions
      const targetStatus = csvIssue.status;
      if (targetStatus === 'In Progress' || targetStatus === 'Done') {
        let transData = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const transRes = await callJiraAPI(`/rest/api/3/issue/${createdKey}/transitions`);
          if (transRes.status === 200) {
            transData = await transRes.json();
            break;
          }
          console.warn(`[Attempt ${attempt}/3] Transitions API returned status ${transRes.status} for ${createdKey}. Retrying in 1s...`);
          await new Promise(r => setTimeout(r, 1000));
        }

        if (transData && transData.transitions) {
          const transition = transData.transitions.find(t => 
            t.name.toLowerCase() === targetStatus.toLowerCase() || 
            t.to.name.toLowerCase() === targetStatus.toLowerCase()
          );
          if (transition) {
            const transPostRes = await callJiraAPI(`/rest/api/3/issue/${createdKey}/transitions`, {
              method: 'POST',
              body: JSON.stringify({ transition: { id: transition.id } })
            });
            if (transPostRes.status === 204) {
              console.log(`Transitioned ${createdKey} to ${targetStatus}`);
            } else {
              console.error(`Failed transitioning ${createdKey} to ${targetStatus}:`, await transPostRes.text());
            }
          } else {
            console.warn(`Transition to ${targetStatus} not found for ${createdKey}`);
          }
        } else {
          console.warn(`Could not fetch transitions for ${createdKey} (status was not 200 or transitions list missing)`);
        }
      }

    } else {
      // Gap: Create placeholder to keep sequence
      console.log(`\n[${id}/${maxId}] Creating gap placeholder for ${PROJECT_KEY}-${id}`);
      const payload = {
        fields: {
          project: { key: PROJECT_KEY },
          summary: `${PROJECT_KEY}-${id} Gap Placeholder`,
          issuetype: { name: 'Task' }
        }
      };
      
      const res = await callJiraAPI('/rest/api/3/issue', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.status !== 201) {
        console.error(`Failed to create placeholder for ${PROJECT_KEY}-${id}:`, await res.text());
        process.exit(1);
      }

      const createdIssue = await res.json();
      placeholdersToDelete.push(createdIssue.key);
      console.log(`Created placeholder: ${createdIssue.key}`);
    }

    // Small delay to prevent hitting rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  // Collect all unique Wave/Epic values that are non-empty
  const uniqueEpics = [...new Set(dataRows.map(row => row[4]?.trim()).filter(Boolean))];
  console.log(`\n--- Epics Setup ---`);
  console.log(`Found ${uniqueEpics.length} unique Epic names in CSV.`);

  // Create Jira Epics (will get keys ALT-(maxId+1) onwards)
  for (const epicName of uniqueEpics) {
    console.log(`Creating Epic "${epicName}"...`);
    const payload = {
      fields: {
        project: { key: PROJECT_KEY },
        summary: epicName,
        issuetype: { name: 'Epic' }
      }
    };
    const res = await callJiraAPI('/rest/api/3/issue', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.status === 201) {
      const epicIssue = await res.json();
      epicMapping[epicName] = epicIssue.key;
      console.log(`Created Epic: ${epicIssue.key} for "${epicName}"`);
    } else {
      console.error(`Failed to create Epic "${epicName}":`, await res.text());
    }
    await new Promise(r => setTimeout(r, 100));
  }

  // Link children to Epics
  console.log(`\n--- Linking Issues to Epics ---`);
  for (let id = 1; id <= maxId; id++) {
    const csvIssue = issuesMap[id];
    if (csvIssue && csvIssue.waveEpic && epicMapping[csvIssue.waveEpic]) {
      const epicKey = epicMapping[csvIssue.waveEpic];
      const issueKey = `${PROJECT_KEY}-${id}`;
      console.log(`Linking ${issueKey} to Epic ${epicKey} ("${csvIssue.waveEpic}")...`);
      const linkRes = await callJiraAPI(`/rest/api/3/issue/${issueKey}`, {
        method: 'PUT',
        body: JSON.stringify({
          fields: {
            parent: { key: epicKey }
          }
        })
      });
      if (linkRes.status === 204) {
        console.log(`Successfully linked ${issueKey}`);
      } else {
        console.error(`Failed to link ${issueKey}:`, await linkRes.text());
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // Clean up placeholders
  console.log(`\n--- Cleaning Up Gaps (Deleting Placeholders) ---`);
  for (const key of placeholdersToDelete) {
    console.log(`Deleting placeholder ${key}...`);
    const delRes = await callJiraAPI(`/rest/api/3/issue/${key}`, {
      method: 'DELETE'
    });
    if (delRes.status === 204) {
      console.log(`Deleted ${key}`);
    } else {
      console.error(`Failed to delete ${key}:`, await delRes.text());
    }
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n=== Migration Complete! ===`);
}

main().catch(console.error);
