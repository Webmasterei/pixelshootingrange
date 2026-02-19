/**
 * Simulator Panel - UI for controlling the traffic simulator
 * Includes Proof of Work computation and status polling
 */

const SimulatorPanel = {
    elements: {},
    currentJobId: null,
    pollInterval: null,
    isRunning: false,

    init() {
        this.cacheElements();
        this.bindEvents();
    },

    cacheElements() {
        this.elements = {
            simBtn: document.getElementById('simulatorBtn'),
            modalOverlay: document.getElementById('simModalOverlay'),
            sessionsInput: document.getElementById('simSessions'),
            startBtn: document.getElementById('simStartBtn'),
            stopBtn: document.getElementById('simStopBtn'),
            closeBtn: document.getElementById('simCloseBtn'),
            progressContainer: document.getElementById('simProgressContainer'),
            progressBar: document.getElementById('simProgressBar'),
            progressText: document.getElementById('simProgressText'),
            statusText: document.getElementById('simStatusText')
        };
    },

    bindEvents() {
        if (this.elements.simBtn) {
            this.elements.simBtn.addEventListener('click', () => this.openModal());
        }

        if (this.elements.modalOverlay) {
            this.elements.modalOverlay.addEventListener('click', (e) => {
                if (e.target === this.elements.modalOverlay && !this.isRunning) {
                    this.closeModal();
                }
            });
        }

        if (this.elements.startBtn) {
            this.elements.startBtn.addEventListener('click', () => this.startSimulator());
        }

        if (this.elements.stopBtn) {
            this.elements.stopBtn.addEventListener('click', () => this.stopSimulator());
        }

        if (this.elements.closeBtn) {
            this.elements.closeBtn.addEventListener('click', () => this.closeModal());
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.isRunning) {
                const overlay = this.elements.modalOverlay;
                if (overlay && overlay.classList.contains('visible')) {
                    this.closeModal();
                }
            }
        });
    },

    openModal() {
        if (!this.elements.modalOverlay) return;
        this.resetUI();
        this.elements.modalOverlay.classList.add('visible');
    },

    closeModal() {
        if (this.isRunning) return;
        if (!this.elements.modalOverlay) return;
        this.elements.modalOverlay.classList.remove('visible');
    },

    resetUI() {
        this.elements.sessionsInput.disabled = false;
        this.elements.startBtn.disabled = false;
        this.elements.stopBtn.disabled = true;
        this.elements.closeBtn.disabled = false;
        this.elements.progressContainer.style.display = 'none';
        this.elements.progressBar.style.width = '0%';
        this.elements.progressText.textContent = '';
        this.elements.statusText.textContent = '';
    },

    async startSimulator() {
        const sessions = parseInt(this.elements.sessionsInput.value, 10) || 10;
        if (sessions < 1 || sessions > 50) {
            this.showStatus('Anzahl muss zwischen 1 und 50 liegen', 'error');
            return;
        }

        this.isRunning = true;
        this.elements.sessionsInput.disabled = true;
        this.elements.startBtn.disabled = true;
        this.elements.closeBtn.disabled = true;
        this.elements.progressContainer.style.display = 'block';
        this.showStatus('Hole Challenge...', 'info');

        try {
            const challenge = await this.fetchChallenge();
            if (!challenge) {
                throw new Error('Challenge konnte nicht geladen werden');
            }

            this.showStatus('Berechne Proof of Work...', 'info');
            const solution = await this.solveProofOfWork(
                challenge.nonce,
                challenge.difficulty
            );

            this.showStatus('Starte Simulator...', 'info');
            const job = await this.submitStart(sessions, solution, challenge.csrf_token);

            if (!job || !job.job_id) {
                throw new Error('Job konnte nicht gestartet werden');
            }

            this.currentJobId = job.job_id;
            this.elements.stopBtn.disabled = false;
            this.showStatus('Simulator läuft...', 'info');
            this.startPolling();

        } catch (error) {
            console.error('[SimulatorPanel] Error:', error);
            this.showStatus(error.message || 'Fehler beim Starten', 'error');
            this.finishJob(false);
        }
    },

    async fetchChallenge() {
        const response = await fetch('/api/simulator/challenge');
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'Challenge-Fehler');
        }
        return response.json();
    },

    solveProofOfWork(nonce, difficulty) {
        return new Promise((resolve, reject) => {
            if (window.Worker) {
                const workerCode = this.getWorkerCode();
                const blob = new Blob([workerCode], { type: 'application/javascript' });
                const worker = new Worker(URL.createObjectURL(blob));

                worker.onmessage = (e) => {
                    worker.terminate();
                    if (e.data.error) {
                        reject(new Error(e.data.error));
                    } else {
                        resolve(e.data.solution);
                    }
                };

                worker.onerror = (e) => {
                    worker.terminate();
                    reject(new Error('Worker-Fehler'));
                };

                worker.postMessage({ nonce, difficulty });
            } else {
                const solution = this.solvePoWSync(nonce, difficulty);
                resolve(solution);
            }
        });
    },

    getWorkerCode() {
        return `
            async function sha256(message) {
                const msgBuffer = new TextEncoder().encode(message);
                const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            }

            self.onmessage = async function(e) {
                const { nonce, difficulty } = e.data;
                const prefix = '0'.repeat(difficulty);
                let counter = 0;

                while (true) {
                    const solution = counter.toString();
                    const hash = await sha256(nonce + solution);

                    if (hash.startsWith(prefix)) {
                        self.postMessage({ solution });
                        return;
                    }

                    counter++;

                    if (counter > 10000000) {
                        self.postMessage({ error: 'Timeout bei PoW-Berechnung' });
                        return;
                    }
                }
            };
        `;
    },

    async solvePoWSync(nonce, difficulty) {
        const prefix = '0'.repeat(difficulty);
        let counter = 0;

        while (counter < 10000000) {
            const solution = counter.toString();
            const hash = await this.sha256(nonce + solution);

            if (hash.startsWith(prefix)) {
                return solution;
            }
            counter++;
        }

        throw new Error('Timeout bei PoW-Berechnung');
    },

    async sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async submitStart(sessions, powSolution, csrfToken) {
        const config = await this._getSessionConfig();
        
        const response = await fetch('/api/simulator/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                sessions: sessions,
                pow_solution: powSolution,
                csrf_token: csrfToken,
                config: config
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Start-Fehler');
        }

        return data;
    },

    async _getSessionConfig() {
        let gtmSnippet = '';
        let cmpSnippet = '';
        
        try {
            const response = await fetch('/api/snippets');
            if (response.ok) {
                const data = await response.json();
                gtmSnippet = data.gtm_snippet || '';
                cmpSnippet = data.cmp_snippet || '';
            }
        } catch (err) {
            console.warn('[SimulatorPanel] Could not fetch snippets:', err);
        }
        
        return {
            gtm_snippet: gtmSnippet,
            cmp_snippet: cmpSnippet,
            ecommerce_before_consent: sessionStorage.getItem(STORAGE_KEYS.ECOMMERCE_BEFORE_CONSENT) !== 'false',
            spa_mode: sessionStorage.getItem(STORAGE_KEYS.SPA_MODE) === 'true'
        };
    },

    startPolling() {
        this.pollInterval = setInterval(() => this.pollStatus(), 2000);
        this.pollStatus();
    },

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    },

    async pollStatus() {
        if (!this.currentJobId) return;

        try {
            const response = await fetch(`/api/simulator/status/${this.currentJobId}`);
            const job = await response.json();

            if (!response.ok) {
                throw new Error(job.error || 'Status-Fehler');
            }

            this.updateProgress(job);

            if (['completed', 'failed', 'stopped'].includes(job.status)) {
                this.stopPolling();
                this.finishJob(job.status === 'completed', job);
            }

        } catch (error) {
            console.error('[SimulatorPanel] Poll error:', error);
        }
    },

    updateProgress(job) {
        const percent = job.total > 0 ? (job.completed / job.total) * 100 : 0;
        this.elements.progressBar.style.width = `${percent}%`;
        this.elements.progressText.textContent =
            `${job.completed}/${job.total} Sessions (${job.successful} erfolgreich, ${job.failed} fehlgeschlagen)`;
    },

    async stopSimulator() {
        if (!this.currentJobId) return;

        this.elements.stopBtn.disabled = true;
        this.showStatus('Stoppe Simulator...', 'info');

        try {
            const response = await fetch(`/api/simulator/stop/${this.currentJobId}`, {
                method: 'POST'
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Stop-Fehler');
            }

        } catch (error) {
            console.error('[SimulatorPanel] Stop error:', error);
            this.showStatus('Fehler beim Stoppen', 'error');
        }
    },

    finishJob(success, job = null) {
        this.isRunning = false;
        this.stopPolling();

        this.elements.sessionsInput.disabled = false;
        this.elements.startBtn.disabled = false;
        this.elements.stopBtn.disabled = true;
        this.elements.closeBtn.disabled = false;

        if (success && job) {
            this.showStatus(
                `Fertig! ${job.successful}/${job.total} Sessions erfolgreich`,
                'success'
            );
            this.showToast(`Simulator fertig: ${job.successful} Sessions`);
        } else if (job && job.status === 'stopped') {
            this.showStatus('Simulator gestoppt', 'info');
            this.showToast('Simulator gestoppt');
        } else {
            this.showStatus('Simulator fehlgeschlagen', 'error');
            this.showToast('Simulator fehlgeschlagen');
        }

        this.currentJobId = null;
    },

    showStatus(message, type = 'info') {
        this.elements.statusText.textContent = message;
        this.elements.statusText.className = `sim-status sim-status-${type}`;
    },

    showToast(message) {
        if (typeof App !== 'undefined' && App.showToast) {
            App.showToast(message);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    SimulatorPanel.init();
});
