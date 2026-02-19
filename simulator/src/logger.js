/**
 * Logger for GA4 Session Simulator
 * Provides formatted console output for session progress
 */

import { formatTrafficSourceLog } from './traffic-sources.js';

const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    red: '\x1b[31m',
    gray: '\x1b[90m'
};

export class Logger {
    constructor(debug = false) {
        this.debug = debug;
        this.sessionCount = 0;
        this.successCount = 0;
        this.errorCount = 0;
    }

    info(message) {
        console.log(`${COLORS.blue}[INFO]${COLORS.reset} ${message}`);
    }

    success(message) {
        console.log(`${COLORS.green}[OK]${COLORS.reset} ${message}`);
    }

    warn(message) {
        console.log(`${COLORS.yellow}[WARN]${COLORS.reset} ${message}`);
    }

    error(message) {
        console.log(`${COLORS.red}[ERROR]${COLORS.reset} ${message}`);
    }

    debugLog(message) {
        if (this.debug) {
            console.log(`${COLORS.gray}[DEBUG]${COLORS.reset} ${message}`);
        }
    }

    sessionStart(sessionId, user, scenarioType, trafficSource, eventCount) {
        this.sessionCount++;
        const userType = user.isNew ? 'NEW' : `RETURNING (${user.sessionCount} prev)`;
        const traffic = formatTrafficSourceLog(trafficSource);

        console.log('');
        console.log(`${COLORS.cyan}━━━ Session #${this.sessionCount} ━━━${COLORS.reset}`);
        console.log(`${COLORS.dim}ID:${COLORS.reset} ${sessionId}`);
        console.log(`${COLORS.dim}User:${COLORS.reset} ${user.id} (${userType})`);
        console.log(`${COLORS.dim}Scenario:${COLORS.reset} ${scenarioType} (${eventCount} events)`);
        console.log(`${COLORS.dim}Traffic:${COLORS.reset} ${traffic}`);
    }

    eventTriggered(sessionId, eventName, current, total) {
        const progress = `[${current}/${total}]`;
        console.log(`  ${COLORS.magenta}►${COLORS.reset} ${progress} ${eventName}`);
    }

    sessionComplete(sessionId, eventCount, durationMs) {
        this.successCount++;
        const duration = (durationMs / 1000).toFixed(1);
        console.log(`${COLORS.green}✓ Session complete${COLORS.reset} - ${eventCount} events in ${duration}s`);
    }

    sessionError(sessionId, error, durationMs) {
        this.errorCount++;
        const duration = (durationMs / 1000).toFixed(1);
        console.log(`${COLORS.red}✗ Session failed${COLORS.reset} after ${duration}s: ${error.message}`);
    }

    printStats() {
        console.log('');
        console.log(`${COLORS.cyan}━━━ Statistics ━━━${COLORS.reset}`);
        console.log(`Total sessions: ${this.sessionCount}`);
        console.log(`${COLORS.green}Successful: ${this.successCount}${COLORS.reset}`);
        console.log(`${COLORS.red}Failed: ${this.errorCount}${COLORS.reset}`);
    }

    printStartup(config, userPool) {
        console.log('');
        console.log(`${COLORS.bright}${COLORS.cyan}╔════════════════════════════════════════╗${COLORS.reset}`);
        console.log(`${COLORS.bright}${COLORS.cyan}║   GA4 Session Simulator                ║${COLORS.reset}`);
        console.log(`${COLORS.bright}${COLORS.cyan}╚════════════════════════════════════════╝${COLORS.reset}`);
        console.log('');
        console.log(`${COLORS.dim}Target:${COLORS.reset} ${config.targetUrl}`);
        console.log(`${COLORS.dim}GTM:${COLORS.reset} ${config.gtmSnippet ? 'Configured' : 'Not configured'}`);
        console.log(`${COLORS.dim}Interval:${COLORS.reset} ${config.sessions.intervalSeconds}s`);
        console.log(`${COLORS.dim}Concurrency:${COLORS.reset} ${config.sessions.maxConcurrent}`);
        
        const stats = userPool.getStats();
        console.log(`${COLORS.dim}User Pool:${COLORS.reset} ${stats.totalUsers}/${stats.maxPoolSize} users`);
        console.log('');
    }
}
