import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('🔍 Checking Supabase Schema...\n');

  // Expected tables
  const expectedTables = {
    // Core tables
    'users': 'Core',
    'organizations': 'Core',
    'organization_members': 'Core',
    'fundraisers': 'Core',
    'donations': 'Core',
    'events': 'Core',
    'event_registrations': 'Core',
    'volunteer_profiles': 'Core',
    'volunteer_hours': 'Core',

    // Interest system
    'interest_categories': 'Interest System',
    'interest_tags': 'Interest System',
    'user_interests': 'Interest System',
    'entity_tags': 'Interest System',

    // Permissions system
    'permissions': 'Permissions',
    'role_permissions': 'Permissions',
    'user_permissions': 'Permissions',
    'permission_audit_log': 'Permissions',

    // Candidate system (NEW)
    'fec_candidates': 'Candidate System',
    'candidates': 'Candidate System',
    'candidate_fundraisers': 'Candidate System',
    'fec_sync_log': 'Candidate System',
    'fec_committees': 'Candidate System',
    'candidate_committees': 'Candidate System',
  };

  // Check each table
  const results = {};
  for (const [table, category] of Object.entries(expectedTables)) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        results[category] = results[category] || [];
        results[category].push({ table, status: '❌', count: 0, error: error.message });
      } else {
        results[category] = results[category] || [];
        results[category].push({ table, status: '✅', count: count || 0 });
      }
    } catch (err) {
      results[category] = results[category] || [];
      results[category].push({ table, status: '❌', count: 0, error: err.message });
    }
  }

  // Print results by category
  for (const [category, tables] of Object.entries(results)) {
    console.log(`\n📦 ${category}:`);
    tables.forEach(({ table, status, count, error }) => {
      if (error) {
        console.log(`  ${status} ${table.padEnd(30)} - ERROR: ${error}`);
      } else {
        console.log(`  ${status} ${table.padEnd(30)} - ${count} records`);
      }
    });
  }

  // Check for key functions
  console.log('\n\n🔧 Checking Database Functions:');

  const functions = [
    'check_user_permission',
    'get_user_permissions',
  ];

  for (const func of functions) {
    try {
      const { data, error } = await supabase.rpc(func, {
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_permission_name: 'test.test',
        p_organization_id: null
      });

      if (error && !error.message.includes('does not exist')) {
        console.log(`  ✅ ${func.padEnd(30)} - exists`);
      } else if (error && error.message.includes('does not exist')) {
        console.log(`  ❌ ${func.padEnd(30)} - MISSING`);
      } else {
        console.log(`  ✅ ${func.padEnd(30)} - exists`);
      }
    } catch (err) {
      console.log(`  ❓ ${func.padEnd(30)} - ${err.message}`);
    }
  }

  // Check for views
  console.log('\n\n👁️  Checking Views:');
  const views = [
    'v_candidate_fundraising_totals',
    'v_fec_verified_candidates',
  ];

  for (const view of views) {
    try {
      const { error } = await supabase
        .from(view)
        .select('*', { head: true });

      if (error) {
        console.log(`  ❌ ${view.padEnd(40)} - MISSING`);
      } else {
        console.log(`  ✅ ${view.padEnd(40)} - exists`);
      }
    } catch (err) {
      console.log(`  ❌ ${view.padEnd(40)} - ERROR`);
    }
  }

  // Summary
  const allTables = Object.values(results).flat();
  const existingTables = allTables.filter(t => t.status === '✅').length;
  const missingTables = allTables.filter(t => t.status === '❌').length;

  console.log('\n\n📊 Summary:');
  console.log(`  Total expected tables: ${allTables.length}`);
  console.log(`  ✅ Existing: ${existingTables}`);
  console.log(`  ❌ Missing: ${missingTables}`);

  if (missingTables > 0) {
    console.log('\n⚠️  MISSING TABLES DETECTED!');
    console.log('\n📋 To deploy missing schemas:');
    console.log('  1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/wbyxrtpzusysxdwtmzfa/sql');
    console.log('  2. Run: db/complete_supabase_schema.sql (if core tables missing)');
    console.log('  3. Run: db/PERMISSIONS_ADDENDUM.sql (if permissions tables missing)');
    console.log('  4. Run: db/candidate_system_schema.sql (if candidate tables missing)');
  } else {
    console.log('\n✅ Schema is up to date!');
  }
}

checkSchema().catch(console.error);
