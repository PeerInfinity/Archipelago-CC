#!/usr/bin/env node

/**
 * Test Results Analyzer
 * Generates concise, human-readable reports from verbose Playwright output
 */

import fs from 'fs';
import path from 'path';

function analyzePlaywrightReport(reportPath = 'playwright-report.json') {
  if (!fs.existsSync(reportPath)) {
    console.error(`Report file not found: ${reportPath}`);
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  
  console.log('🧪 Archipelago Test Results Summary');
  console.log('=====================================\n');
  
  // Overall stats
  const stats = report.stats;
  console.log('📊 Overall Statistics:');
  console.log(`   Duration: ${(stats.duration / 1000).toFixed(2)}s`);
  console.log(`   Tests Expected: ${stats.expected}`);
  console.log(`   Passed: ${stats.expected - stats.unexpected}`);
  console.log(`   Failed: ${stats.unexpected}`);
  console.log(`   Skipped: ${stats.skipped}`);
  console.log(`   Flaky: ${stats.flaky}\n`);

  // Extract in-app test results from browser logs
  const tests = extractInAppTestResults(report);
  if (tests) {
    console.log('🎯 In-App Test Details:');
    console.log(`   Total Run: ${tests.summary.totalRun}`);
    console.log(`   Passed: ${tests.summary.passedCount}`);
    console.log(`   Failed: ${tests.summary.failedCount}\n`);
    
    // Show test details
    tests.testDetails.forEach(test => {
      const icon = test.status === 'passed' ? '✅' : 
                  test.status === 'failed' ? '❌' : 
                  test.status === 'disabled' ? '⏸️' : '❓';
      console.log(`   ${icon} ${test.name} (${test.category})`);
      
      if (test.status === 'failed' && test.conditions) {
        const failedConditions = test.conditions.filter(c => c.status === 'failed');
        failedConditions.forEach(condition => {
          console.log(`      ❌ ${condition.description}`);
        });
      }
    });
    console.log('');
  }

  // Performance insights
  analyzePerformance(report);
  
  // Error analysis
  analyzeErrors(report);
}

function extractInAppTestResults(report) {
  // Look for the __playwrightTestResults__ in stdout
  const stdout = report.suites?.[0]?.suites?.[0]?.specs?.[0]?.tests?.[0]?.results?.[0]?.stdout;
  if (!stdout) return null;
  
  for (const log of stdout) {
    if (log.text.includes('Full in-app test results:')) {
      try {
        // Extract the JSON part after "Full in-app test results: "
        const jsonStart = log.text.indexOf('Full in-app test results: ') + 'Full in-app test results: '.length;
        const jsonStr = log.text.substring(jsonStart).trim();
        return JSON.parse(jsonStr);
      } catch (e) {
        // Continue searching or try a different approach
        try {
          const match = log.text.match(/Full in-app test results: ({.*})/s);
          if (match) {
            return JSON.parse(match[1]);
          }
        } catch (e2) {
          // Continue searching
        }
      }
    }
  }
  return null;
}

function analyzePerformance(report) {
  console.log('⚡ Performance Analysis:');
  
  const testResult = report.suites?.[0]?.suites?.[0]?.specs?.[0]?.tests?.[0]?.results?.[0];
  if (testResult) {
    console.log(`   Test Execution: ${(testResult.duration / 1000).toFixed(2)}s`);
    
    // Analyze timing from logs if available
    const stdout = testResult.stdout || [];
    const timingEvents = stdout
      .filter(log => log.text.includes('Polling for condition') || log.text.includes('Condition met'))
      .map(log => ({
        timestamp: extractTimestamp(log.text),
        message: log.text.trim()
      }));
    
    if (timingEvents.length > 0) {
      console.log('   Key Timing Events:');
      timingEvents.slice(0, 5).forEach(event => {
        const time = event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : 'N/A';
        console.log(`      ${time}: ${event.message.substring(0, 80)}...`);
      });
    }
  }
  console.log('');
}

function analyzeErrors(report) {
  const errors = [];
  
  // Check for test-level errors
  const testResult = report.suites?.[0]?.suites?.[0]?.specs?.[0]?.tests?.[0]?.results?.[0];
  if (testResult?.errors?.length > 0) {
    errors.push(...testResult.errors);
  }
  
  // Check for browser errors in logs
  const stdout = testResult?.stdout || [];
  const browserErrors = stdout
    .filter(log => log.text.includes('BROWSER LOG (error)') || log.text.includes('ERROR'))
    .map(log => log.text.trim());
  
  if (errors.length > 0 || browserErrors.length > 0) {
    console.log('❌ Error Analysis:');
    
    if (errors.length > 0) {
      console.log('   Test Errors:');
      errors.forEach(error => {
        console.log(`      ${error.message || error}`);
      });
    }
    
    if (browserErrors.length > 0) {
      console.log('   Browser Errors:');
      browserErrors.slice(0, 3).forEach(error => {
        console.log(`      ${error.substring(0, 100)}...`);
      });
    }
  } else {
    console.log('✅ No errors detected\n');
  }
}

function extractTimestamp(logText) {
  const match = logText.match(/\[(\d{2}:\d{2}:\d{2}\.\d{3})\]/);
  return match ? match[1] : null;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzePlaywrightReport(process.argv[2]);
}

export { analyzePlaywrightReport };