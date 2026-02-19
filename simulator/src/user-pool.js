/**
 * Virtual User Pool Management
 * Handles new vs returning users with Playwright storage state persistence
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const USERS_DIR = join(__dirname, '..', 'data', 'users');
const INDEX_FILE = join(USERS_DIR, '_index.json');

/**
 * User Pool Manager
 */
export class UserPool {
    constructor(config) {
        this.returningUserRate = config.returningUserRate || 0.35;
        this.maxPoolSize = config.maxPoolSize || 200;
        this.index = this.loadIndex();
    }

    loadIndex() {
        if (existsSync(INDEX_FILE)) {
            try {
                return JSON.parse(readFileSync(INDEX_FILE, 'utf-8'));
            } catch {
                return { users: [] };
            }
        }
        return { users: [] };
    }

    saveIndex() {
        writeFileSync(INDEX_FILE, JSON.stringify(this.index, null, 2));
    }

    /**
     * Get a user for the next session (new or returning)
     */
    getUser() {
        const shouldReturn = Math.random() < this.returningUserRate;
        const hasExistingUsers = this.index.users.length > 0;

        if (shouldReturn && hasExistingUsers) {
            return this.getReturningUser();
        }

        return this.createNewUser();
    }

    createNewUser() {
        const userId = this.generateUserId();
        const user = {
            id: userId,
            createdAt: new Date().toISOString(),
            sessionCount: 0,
            lastVisit: null,
            isNew: true,
            storageStatePath: null
        };

        return user;
    }

    getReturningUser() {
        const weightedUsers = this.index.users.map(user => ({
            user,
            weight: this.calculateReturnWeight(user)
        }));

        const totalWeight = weightedUsers.reduce((sum, u) => sum + u.weight, 0);
        let random = Math.random() * totalWeight;

        for (const { user, weight } of weightedUsers) {
            random -= weight;
            if (random <= 0) {
                return {
                    ...user,
                    isNew: false,
                    storageStatePath: this.getStorageStatePath(user.id)
                };
            }
        }

        return {
            ...this.index.users[0],
            isNew: false,
            storageStatePath: this.getStorageStatePath(this.index.users[0].id)
        };
    }

    calculateReturnWeight(user) {
        const daysSinceVisit = user.lastVisit
            ? (Date.now() - new Date(user.lastVisit).getTime()) / (1000 * 60 * 60 * 24)
            : 30;

        if (daysSinceVisit < 1) return 0.5;
        if (daysSinceVisit < 7) return 2.0;
        if (daysSinceVisit < 30) return 1.5;
        return 1.0;
    }

    /**
     * Save user state after session completes
     */
    saveUserState(user, storageState) {
        const storagePath = this.getStorageStatePath(user.id);
        writeFileSync(storagePath, JSON.stringify(storageState));

        const existingIndex = this.index.users.findIndex(u => u.id === user.id);
        const updatedUser = {
            id: user.id,
            createdAt: user.createdAt,
            sessionCount: (user.sessionCount || 0) + 1,
            lastVisit: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            this.index.users[existingIndex] = updatedUser;
        } else {
            this.index.users.push(updatedUser);
        }

        this.enforcePoolLimit();
        this.saveIndex();
    }

    enforcePoolLimit() {
        if (this.index.users.length <= this.maxPoolSize) return;

        this.index.users.sort((a, b) => 
            new Date(a.lastVisit || 0) - new Date(b.lastVisit || 0)
        );

        while (this.index.users.length > this.maxPoolSize) {
            const oldUser = this.index.users.shift();
            this.deleteUserStorage(oldUser.id);
        }
    }

    deleteUserStorage(userId) {
        const storagePath = this.getStorageStatePath(userId);
        if (existsSync(storagePath)) {
            try {
                unlinkSync(storagePath);
            } catch {
                // Ignore deletion errors
            }
        }
    }

    getStorageStatePath(userId) {
        return join(USERS_DIR, `${userId}.json`);
    }

    loadStorageState(path) {
        if (existsSync(path)) {
            try {
                return JSON.parse(readFileSync(path, 'utf-8'));
            } catch {
                return null;
            }
        }
        return null;
    }

    generateUserId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `user_${timestamp}_${random}`;
    }

    getStats() {
        return {
            totalUsers: this.index.users.length,
            maxPoolSize: this.maxPoolSize,
            returningUserRate: this.returningUserRate
        };
    }
}
