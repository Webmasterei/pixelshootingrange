#!/usr/bin/env node

/**
 * GA4 Session Simulator - CLI Entry Point
 * Orchestrates browser sessions via Playwright
 */

import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { runSession } from './session-runner.js';
import { UserPool } from './user-pool.js';
import { Logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG_PATH = join(__dirname, '..', 'config.json');

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const config = loadConfig(args.config);
    const logger = new Logger(args.debug);

    if (!config.gtmSnippet) {
        logger.warn('No GTM snippet configured - events will not be sent to GA4');
    }

    const userPool = new UserPool(config.users);
    logger.printStartup(config, userPool);

    let browser;
    try {
        browser = await chromium.launch({ headless: !args.headed });
        
        if (args.once) {
            await runBatchMode(browser, config, userPool, logger, args.sessions);
        } else {
            await runContinuousMode(browser, config, userPool, logger);
        }
    } catch (error) {
        logger.error(`Fatal error: ${error.message}`);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
        logger.printStats();
    }
}

async function runBatchMode(browser, config, userPool, logger, totalSessions) {
    logger.info(`Batch mode: Running ${totalSessions} sessions`);

    const concurrency = config.sessions.maxConcurrent;
    let completed = 0;
    let running = 0;
    const queue = [];

    return new Promise((resolve) => {
        const startNext = async () => {
            if (completed >= totalSessions) {
                if (running === 0) resolve();
                return;
            }

            while (running < concurrency && completed + running < totalSessions) {
                running++;
                const user = userPool.getUser();
                
                runSession(browser, config, user, userPool, logger)
                    .then(() => {
                        running--;
                        completed++;
                        startNext();
                    })
                    .catch(() => {
                        running--;
                        completed++;
                        startNext();
                    });
            }
        };

        startNext();
    });
}

async function runContinuousMode(browser, config, userPool, logger) {
    logger.info('Continuous mode: Press Ctrl+C to stop');

    const intervalMs = config.sessions.intervalSeconds * 1000;
    const concurrency = config.sessions.maxConcurrent;
    let running = 0;
    let shouldStop = false;

    process.on('SIGINT', () => {
        logger.info('Shutting down...');
        shouldStop = true;
    });

    process.on('SIGTERM', () => {
        logger.info('Shutting down...');
        shouldStop = true;
    });

    while (!shouldStop) {
        if (running < concurrency) {
            running++;
            const user = userPool.getUser();

            runSession(browser, config, user, userPool, logger)
                .finally(() => { running--; });
        }

        await sleep(intervalMs);
    }

    while (running > 0) {
        await sleep(500);
    }
}

function loadConfig(configPath) {
    const path = configPath || DEFAULT_CONFIG_PATH;

    if (!existsSync(path)) {
        throw new Error(`Config file not found: ${path}`);
    }

    try {
        const content = readFileSync(path, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        throw new Error(`Failed to parse config: ${error.message}`);
    }
}

function parseArgs(args) {
    const result = {
        config: null,
        sessions: 10,
        once: false,
        debug: false,
        headed: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--config' || arg === '-c') {
            result.config = args[++i];
        } else if (arg === '--sessions' || arg === '-n') {
            result.sessions = parseInt(args[++i], 10) || 10;
        } else if (arg === '--once') {
            result.once = true;
        } else if (arg === '--debug') {
            result.debug = true;
        } else if (arg === '--headed') {
            result.headed = true;
        } else if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        }
    }

    return result;
}

function printHelp() {
    console.log(`
GA4 Session Simulator

Usage: node src/index.js [options]

Options:
  --config, -c <path>    Path to config.json (default: ./config.json)
  --sessions, -n <num>   Number of sessions in batch mode (default: 10)
  --once                 Run in batch mode (exit after N sessions)
  --debug                Enable debug logging
  --headed               Run with visible browser (not headless)
  --help, -h             Show this help

Examples:
  node src/index.js                     # Continuous mode
  node src/index.js --once -n 50        # Run 50 sessions then exit
  node src/index.js --headed --debug    # Visible browser with debug logs
`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main();
