#!/usr/bin/env node

/**
 * Design Constraints Validator
 * 
 * Validates frontend code against design-constraints.md rules.
 * Fails CI if violations found without active waivers.
 * 
 * Usage:
 *   node scripts/verify-design-constraints.mjs
 *   node scripts/verify-design-constraints.mjs --fix  (auto-fix where possible)
 *   node scripts/verify-design-constraints.mjs --verbose
 * 
 * Exit codes:
 *   0 - All checks passed
 *   1 - Violations found (non-waived)
 *   2 - Configuration/runtime error
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Configuration
const config = {
  frontendDir: path.join(projectRoot, 'frontend', 'src'),
  waiversFile: path.join(projectRoot, '.design-constraints-waivers.json'),
  constraintsFile: path.join(projectRoot, 'docs', 'design-constraints.md'),
  verbose: process.argv.includes('--verbose'),
  fix: process.argv.includes('--fix'),
};

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

// Logging utilities
const log = {
  error: (msg) => console.error(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.warn(`${colors.yellow}⚠${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  verbose: (msg) => config.verbose && console.log(`${colors.gray}  ${msg}${colors.reset}`),
};

// Violation tracking
const violations = [];
const warnings = [];

/**
 * Load waivers from .design-constraints-waivers.json
 */
async function loadWaivers() {
  try {
    const content = await fs.readFile(config.waiversFile, 'utf-8');
    const data = JSON.parse(content);
    const now = new Date();
    
    // Filter expired waivers
    const activeWaivers = (data.waivers || []).filter(w => {
      if (!w.expires) return true;
      const expiry = new Date(w.expires);
      return expiry > now;
    });
    
    const expiredCount = (data.waivers || []).length - activeWaivers.length;
    if (expiredCount > 0) {
      log.warn(`Found ${expiredCount} expired waiver(s)`);
    }
    
    log.verbose(`Loaded ${activeWaivers.length} active waiver(s)`);
    return activeWaivers;
  } catch (error) {
    if (error.code === 'ENOENT') {
      log.verbose('No waivers file found (this is OK)');
      return [];
    }
    log.error(`Failed to load waivers: ${error.message}`);
    return [];
  }
}

/**
 * Check if a violation is waived
 */
function isWaived(filePath, rule, waivers) {
  const relativePath = path.relative(projectRoot, filePath);
  return waivers.some(w => {
    const waiverPath = w.file.replace(/\//g, path.sep);
    return waiverPath === relativePath && w.rule === rule;
  });
}

/**
 * Rule: Detect WebSocket usage (prohibited)
 */
async function checkNoWebSockets(filePath, content, waivers) {
  const wsPatterns = [
    /new\s+WebSocket\(/gi,
    /import.*['"]ws['"]/gi,
    /import.*['"]websocket['"]/gi,
    /useWebSocket\(/gi,
  ];
  
  for (const pattern of wsPatterns) {
    if (pattern.test(content)) {
      if (!isWaived(filePath, 'no_websockets', waivers)) {
        violations.push({
          file: filePath,
          rule: 'no_websockets',
          message: 'WebSocket usage detected. Use Wails events instead.',
          section: 'Realtime Semantics',
          severity: 'error',
        });
      }
      return;
    }
  }
}

/**
 * Rule: Detect Server-Sent Events usage (prohibited)
 */
async function checkNoSSE(filePath, content, waivers) {
  const ssePatterns = [
    /new\s+EventSource\(/gi,
    /import.*['"]eventsource['"]/gi,
  ];
  
  for (const pattern of ssePatterns) {
    if (pattern.test(content)) {
      if (!isWaived(filePath, 'no_sse', waivers)) {
        violations.push({
          file: filePath,
          rule: 'no_sse',
          message: 'Server-Sent Events detected. Use Wails events + polling instead.',
          section: 'Realtime Semantics',
          severity: 'error',
        });
      }
      return;
    }
  }
}

/**
 * Rule: Scan mutations should not be optimistic
 */
async function checkNoOptimisticScanMutations(filePath, content, waivers) {
  // Look for useMutation with StartScan that updates cache in onMutate
  const scanMutationPattern = /useMutation\s*\(\s*StartScan.*?onMutate.*?setQueryData/gs;
  
  if (scanMutationPattern.test(content)) {
    if (!isWaived(filePath, 'no_optimistic_scan', waivers)) {
      violations.push({
        file: filePath,
        rule: 'no_optimistic_scan',
        message: 'StartScan mutation appears to use optimistic updates (setQueryData in onMutate). Use onSuccess instead.',
        section: 'Optimistic UI Eligibility',
        severity: 'error',
      });
    }
  }
}

/**
 * Rule: Delete mutations should not be optimistic
 */
async function checkNoOptimisticDeletes(filePath, content, waivers) {
  const deleteMutationPattern = /useMutation\s*\(\s*Delete(?:Stream|Run).*?onMutate.*?setQueryData/gs;
  
  if (deleteMutationPattern.test(content)) {
    if (!isWaived(filePath, 'no_optimistic_delete', waivers)) {
      violations.push({
        file: filePath,
        rule: 'no_optimistic_delete',
        message: 'Delete mutation uses optimistic updates. Wait for server confirmation (use onSuccess).',
        section: 'Optimistic UI Eligibility',
        severity: 'error',
      });
    }
  }
}

/**
 * Rule: Detect missing loading states for async operations
 */
async function checkLoadingStates(filePath, content, waivers) {
  // Look for useQuery or useMutation without isLoading check
  const queryPattern = /const\s+{\s*data[^}]*}\s*=\s*useQuery/g;
  const mutationPattern = /const\s+[a-zA-Z_]+\s*=\s*useMutation/g;
  
  const hasLoadingCheck = /isLoading|isPending|isLoadingError|isFetching/.test(content);
  const hasSkeletonOrSpinner = /Skeleton|Spinner|Loading|Progress/.test(content);
  
  if ((queryPattern.test(content) || mutationPattern.test(content)) && 
      !hasLoadingCheck && !hasSkeletonOrSpinner) {
    warnings.push({
      file: filePath,
      rule: 'loading_states_recommended',
      message: 'Async operation detected without apparent loading state. Consider adding isLoading check.',
      section: 'Loading & Skeleton Policy',
      severity: 'warning',
    });
  }
}

/**
 * Rule: Check for infinite scroll without pagination controls
 */
async function checkPaginationRequired(filePath, content, waivers) {
  // Detect infinite scroll libraries or patterns
  const infiniteScrollPatterns = [
    /react-infinite-scroll/gi,
    /useInfiniteScroll/gi,
    /InfiniteScroll/g,
    /onScroll.*fetchMore/gs,
  ];
  
  const hasPaginationControls = /Pagination|PaginationPrevious|PaginationNext|page.*button/gi.test(content);
  
  for (const pattern of infiniteScrollPatterns) {
    if (pattern.test(content) && !hasPaginationControls) {
      if (!isWaived(filePath, 'pagination_controls_required', waivers)) {
        violations.push({
          file: filePath,
          rule: 'pagination_controls_required',
          message: 'Infinite scroll detected without explicit pagination controls. Backend has hard page limits.',
          section: 'Pagination Rules',
          severity: 'error',
        });
      }
      return;
    }
  }
}

/**
 * Rule: Detect auto-prepend of new data without user action
 */
async function checkBufferPattern(filePath, content, waivers) {
  // Look for prepend/unshift in useEffect without user interaction
  const autoPrependPattern = /useEffect\s*\([^)]*\)\s*\{[^}]*(?:prepend|unshift|setData\s*\(.*?\[.*?data.*?\])/gs;
  const hasFlushButton = /flushPending|flushBuffer|onClick.*flush/gi.test(content);
  
  if (autoPrependPattern.test(content) && !hasFlushButton) {
    warnings.push({
      file: filePath,
      rule: 'buffer_pattern_recommended',
      message: 'Auto-prepend detected in useEffect. Consider buffer + notification pattern for realtime updates.',
      section: 'Realtime Semantics',
      severity: 'warning',
    });
  }
}

/**
 * Rule: Long operations should have cancel buttons
 */
async function checkCancellationUI(filePath, content, waivers) {
  // Detect StartScan usage
  const hasStartScan = /StartScan|useMutation.*scan/gi.test(content);
  const hasCancelButton = /CancelRun|cancel.*button|onClick.*cancel/gi.test(content);
  
  if (hasStartScan && !hasCancelButton) {
    warnings.push({
      file: filePath,
      rule: 'cancel_button_recommended',
      message: 'StartScan detected without apparent cancel button. Long operations should be cancellable.',
      section: 'Loading & Skeleton Policy',
      severity: 'warning',
    });
  }
}

/**
 * Rule: Check for client-side validation of hard limits
 */
async function checkHardLimitValidation(filePath, content, waivers) {
  // Look for nonce range input without validation
  const hasNonceInput = /nonceStart|nonceEnd|nonce.*input/gi.test(content);
  const hasRangeValidation = /10[_,]?000[_,]?000|MAX_NONCE_RANGE/gi.test(content);
  
  if (hasNonceInput && !hasRangeValidation) {
    warnings.push({
      file: filePath,
      rule: 'hard_limit_validation_recommended',
      message: 'Nonce range input detected without client-side validation. Check against max 10M range.',
      section: 'Hard Limits',
      severity: 'warning',
    });
  }
}

/**
 * Rule: Check for missing error boundaries
 */
async function checkErrorBoundaries(filePath, content, waivers) {
  // Pages should have error boundaries
  const isPage = /pages\//i.test(filePath) || /Page\.tsx$/i.test(filePath);
  const hasErrorBoundary = /ErrorBoundary|errorBoundary/gi.test(content);
  const hasAsyncOp = /useQuery|useMutation|async\s+function/gi.test(content);
  
  if (isPage && hasAsyncOp && !hasErrorBoundary) {
    warnings.push({
      file: filePath,
      rule: 'error_boundary_recommended',
      message: 'Page component with async operations should have an ErrorBoundary.',
      section: 'Error Taxonomy',
      severity: 'warning',
    });
  }
}

/**
 * Rule: Check polling respects tab visibility
 */
async function checkPollingPausesOnBlur(filePath, content, waivers) {
  // Look for refetchInterval without refetchIntervalInBackground: false
  const hasPolling = /refetchInterval\s*:/gi.test(content);
  const pausesOnBlur = /refetchIntervalInBackground\s*:\s*false/gi.test(content);
  
  if (hasPolling && !pausesOnBlur) {
    warnings.push({
      file: filePath,
      rule: 'polling_pause_recommended',
      message: 'Polling detected without refetchIntervalInBackground: false. Should pause when tab inactive.',
      section: 'Realtime Semantics',
      severity: 'warning',
    });
  }
}

/**
 * Rule: Detect retry without exponential backoff
 */
async function checkRetryBackoff(filePath, content, waivers) {
  const hasRetry = /\.retry\(|retryCount|onError.*retry/gi.test(content);
  const hasBackoff = /exponential|backoff|Math\.pow|delay\s*\*/gi.test(content);
  
  if (hasRetry && !hasBackoff) {
    warnings.push({
      file: filePath,
      rule: 'exponential_backoff_recommended',
      message: 'Retry logic detected without exponential backoff. Consider adding delay increase.',
      section: 'Error Taxonomy',
      severity: 'warning',
    });
  }
}

/**
 * Run all checks on a file
 */
async function checkFile(filePath, waivers) {
  const content = await fs.readFile(filePath, 'utf-8');
  
  log.verbose(`Checking ${path.relative(projectRoot, filePath)}`);
  
  // Run all rule checks
  await checkNoWebSockets(filePath, content, waivers);
  await checkNoSSE(filePath, content, waivers);
  await checkNoOptimisticScanMutations(filePath, content, waivers);
  await checkNoOptimisticDeletes(filePath, content, waivers);
  await checkLoadingStates(filePath, content, waivers);
  await checkPaginationRequired(filePath, content, waivers);
  await checkBufferPattern(filePath, content, waivers);
  await checkCancellationUI(filePath, content, waivers);
  await checkHardLimitValidation(filePath, content, waivers);
  await checkErrorBoundaries(filePath, content, waivers);
  await checkPollingPausesOnBlur(filePath, content, waivers);
  await checkRetryBackoff(filePath, content, waivers);
}

/**
 * Print summary report
 */
function printReport() {
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.blue}Design Constraints Validation Report${colors.reset}`);
  console.log('='.repeat(80) + '\n');
  
  if (violations.length === 0 && warnings.length === 0) {
    log.success('All checks passed! No violations found.');
    return true;
  }
  
  // Print violations
  if (violations.length > 0) {
    console.log(`${colors.red}VIOLATIONS (${violations.length})${colors.reset}\n`);
    violations.forEach((v, i) => {
      console.log(`${i + 1}. ${colors.red}${v.rule}${colors.reset}`);
      console.log(`   File: ${path.relative(projectRoot, v.file)}`);
      console.log(`   Message: ${v.message}`);
      console.log(`   Constraint: ${v.section}`);
      console.log('');
    });
  }
  
  // Print warnings
  if (warnings.length > 0) {
    console.log(`${colors.yellow}WARNINGS (${warnings.length})${colors.reset}\n`);
    warnings.forEach((w, i) => {
      console.log(`${i + 1}. ${colors.yellow}${w.rule}${colors.reset}`);
      console.log(`   File: ${path.relative(projectRoot, w.file)}`);
      console.log(`   Message: ${w.message}`);
      console.log(`   Constraint: ${w.section}`);
      console.log('');
    });
  }
  
  // Print summary
  console.log('='.repeat(80));
  console.log(`Summary: ${violations.length} violation(s), ${warnings.length} warning(s)`);
  console.log('='.repeat(80) + '\n');
  
  if (violations.length > 0) {
    console.log(`${colors.red}❌ FAILED${colors.reset} - Fix violations or add waivers to proceed.\n`);
    console.log('To add a waiver, create .design-constraints-waivers.json:');
    console.log(JSON.stringify({
      version: '1.0.0',
      waivers: [{
        id: 'w-001',
        file: 'path/to/file.tsx',
        rule: 'rule_name',
        justification: 'Reason for exception',
        approved_by: 'tech-lead',
        approved_date: new Date().toISOString().split('T')[0],
        expires: '2025-12-31',
      }]
    }, null, 2));
    console.log('');
    return false;
  }
  
  if (warnings.length > 0) {
    console.log(`${colors.yellow}⚠ PASSED WITH WARNINGS${colors.reset} - Consider addressing warnings.\n`);
  }
  
  return true;
}

/**
 * Main execution
 */
async function main() {
  try {
    log.info('Design Constraints Validator v1.0.0');
    log.info(`Project: ${projectRoot}`);
    log.info(`Mode: ${config.fix ? 'fix' : 'check'}`);
    console.log('');
    
    // Load waivers
    const waivers = await loadWaivers();
    
    // Check if constraints file exists
    try {
      await fs.access(config.constraintsFile);
      log.verbose(`Constraints file found: ${path.relative(projectRoot, config.constraintsFile)}`);
    } catch {
      log.error(`Constraints file not found: ${config.constraintsFile}`);
      process.exit(2);
    }
    
    // Find all frontend files
    const files = await glob(`${config.frontendDir}/**/*.{ts,tsx}`, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    });
    
    log.info(`Scanning ${files.length} file(s)...`);
    console.log('');
    
    // Check each file
    for (const file of files) {
      await checkFile(file, waivers);
    }
    
    // Print report
    const passed = printReport();
    
    // Exit with appropriate code
    process.exit(passed ? 0 : 1);
    
  } catch (error) {
    log.error(`Fatal error: ${error.message}`);
    if (config.verbose) {
      console.error(error.stack);
    }
    process.exit(2);
  }
}

// Run if called directly
main();

export { checkFile, loadWaivers, isWaived };
