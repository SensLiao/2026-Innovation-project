/**
 * SessionManager Tests
 * Tests TTL cleanup, LRU eviction, and memory management
 */

import { SessionManager } from '../utils/sessionManager.js';

// Test utilities
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

async function runTest(name, fn) {
  try {
    await fn();
    log(`  ✓ ${name}`, 'green');
    return true;
  } catch (err) {
    log(`  ✗ ${name}: ${err.message}`, 'red');
    return false;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Mock orchestrator for testing
function createMockOrchestrator(id) {
  return { id, sessionId: `session-${id}`, state: 'idle' };
}

async function runAllTests() {
  log('\n========================================');
  log('  SessionManager Tests');
  log('========================================\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Basic set/get operations
  log('Basic Operations:', 'yellow');

  if (await runTest('should set and get session', () => {
    const manager = new SessionManager({ ttl: 60000 });
    const orch = createMockOrchestrator(1);
    manager.set('sess-1', orch);
    const retrieved = manager.get('sess-1');
    assert(retrieved === orch, 'Retrieved orchestrator should match');
    manager.shutdown();
  })) passed++; else failed++;

  if (await runTest('should return null for non-existent session', () => {
    const manager = new SessionManager({ ttl: 60000 });
    const result = manager.get('non-existent');
    assert(result === null, 'Should return null');
    manager.shutdown();
  })) passed++; else failed++;

  if (await runTest('should check session existence with has()', () => {
    const manager = new SessionManager({ ttl: 60000 });
    manager.set('sess-1', createMockOrchestrator(1));
    assert(manager.has('sess-1') === true, 'Should return true for existing');
    assert(manager.has('sess-2') === false, 'Should return false for non-existing');
    manager.shutdown();
  })) passed++; else failed++;

  if (await runTest('should delete session', () => {
    const manager = new SessionManager({ ttl: 60000 });
    manager.set('sess-1', createMockOrchestrator(1));
    manager.delete('sess-1');
    assert(manager.has('sess-1') === false, 'Session should be deleted');
    manager.shutdown();
  })) passed++; else failed++;

  if (await runTest('should track session count with size', () => {
    const manager = new SessionManager({ ttl: 60000 });
    assert(manager.size === 0, 'Initial size should be 0');
    manager.set('sess-1', createMockOrchestrator(1));
    manager.set('sess-2', createMockOrchestrator(2));
    assert(manager.size === 2, 'Size should be 2');
    manager.shutdown();
  })) passed++; else failed++;

  // Test 2: TTL expiration
  log('\nTTL Expiration:', 'yellow');

  if (await runTest('should expire sessions after TTL', async () => {
    const manager = new SessionManager({
      ttl: 100, // 100ms TTL
      cleanupInterval: 50 // 50ms cleanup
    });
    manager.set('sess-1', createMockOrchestrator(1));
    assert(manager.has('sess-1') === true, 'Session should exist initially');

    await sleep(150); // Wait for TTL + cleanup
    manager.cleanup(); // Manual cleanup to ensure

    assert(manager.has('sess-1') === false, 'Session should be expired');
    manager.shutdown();
  })) passed++; else failed++;

  if (await runTest('should update lastAccessedAt on get()', async () => {
    const manager = new SessionManager({ ttl: 100 });
    manager.set('sess-1', createMockOrchestrator(1));

    await sleep(60);
    manager.get('sess-1'); // Access refreshes TTL

    await sleep(60);
    manager.cleanup();

    assert(manager.has('sess-1') === true, 'Session should still exist after access refresh');
    manager.shutdown();
  })) passed++; else failed++;

  // Test 3: Max sessions and LRU eviction
  log('\nMax Sessions & LRU Eviction:', 'yellow');

  if (await runTest('should evict oldest session when max reached', async () => {
    const manager = new SessionManager({
      ttl: 60000,
      maxSessions: 3
    });

    manager.set('sess-1', createMockOrchestrator(1));
    await sleep(10);
    manager.set('sess-2', createMockOrchestrator(2));
    await sleep(10);
    manager.set('sess-3', createMockOrchestrator(3));
    await sleep(10);
    manager.set('sess-4', createMockOrchestrator(4)); // Should evict sess-1

    assert(manager.has('sess-1') === false, 'Oldest session should be evicted');
    assert(manager.has('sess-4') === true, 'New session should exist');
    assert(manager.size === 3, 'Size should not exceed max');
    manager.shutdown();
  })) passed++; else failed++;

  if (await runTest('should evict least recently used', async () => {
    const manager = new SessionManager({
      ttl: 60000,
      maxSessions: 3
    });

    manager.set('sess-1', createMockOrchestrator(1));
    await sleep(10);
    manager.set('sess-2', createMockOrchestrator(2));
    await sleep(10);
    manager.set('sess-3', createMockOrchestrator(3));
    await sleep(10);

    // Access sess-1 to make it most recently used
    manager.get('sess-1');
    await sleep(10);

    manager.set('sess-4', createMockOrchestrator(4)); // Should evict sess-2 (LRU)

    assert(manager.has('sess-1') === true, 'Recently accessed should survive');
    assert(manager.has('sess-2') === false, 'LRU session should be evicted');
    manager.shutdown();
  })) passed++; else failed++;

  // Test 4: Statistics
  log('\nStatistics:', 'yellow');

  if (await runTest('should return correct stats', () => {
    const manager = new SessionManager({
      ttl: 30 * 60 * 1000,
      maxSessions: 500
    });

    manager.set('sess-1', createMockOrchestrator(1));
    manager.set('sess-2', createMockOrchestrator(2));

    const stats = manager.getStats();
    assert(stats.activeSessions === 2, 'Should report 2 active sessions');
    assert(stats.maxSessions === 500, 'Should report max sessions');
    assert(stats.ttlMinutes === 30, 'Should report TTL in minutes');
    assert(typeof stats.oldestSessionAge === 'number', 'Should have oldestSessionAge');
    assert(typeof stats.averageAge === 'number', 'Should have averageAge');
    manager.shutdown();
  })) passed++; else failed++;

  // Test 5: Cleanup and shutdown
  log('\nCleanup & Shutdown:', 'yellow');

  if (await runTest('should clear all sessions', () => {
    const manager = new SessionManager({ ttl: 60000 });
    manager.set('sess-1', createMockOrchestrator(1));
    manager.set('sess-2', createMockOrchestrator(2));
    manager.clear();
    assert(manager.size === 0, 'All sessions should be cleared');
    manager.shutdown();
  })) passed++; else failed++;

  if (await runTest('should shutdown gracefully', () => {
    const manager = new SessionManager({ ttl: 60000 });
    manager.set('sess-1', createMockOrchestrator(1));
    manager.shutdown();
    assert(manager.size === 0, 'Sessions should be cleared on shutdown');
    assert(manager.cleanupTimer === null, 'Timer should be cleared');
  })) passed++; else failed++;

  // Summary
  log('\n========================================');
  log(`  Results: ${passed} passed, ${failed} failed`);
  log('========================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests();
