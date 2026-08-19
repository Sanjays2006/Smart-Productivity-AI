/* ────────────────────────────────────────────
   DATABASE ONBOARDING SETUP WIZARD
──────────────────────────────────────────── */
/* ────────────────────────────────────────────
   DATABASE ONBOARDING SETUP WIZARD
──────────────────────────────────────────── */
async function initDbSetup() {
    try {
        const config = await Api.getDatabaseStatus();
        if (config.configured) {
            bootstrapApp();
            return true;
        }

        const dbSetupOverlay = document.getElementById('dbSetupOverlay');
        if (dbSetupOverlay) {
            dbSetupOverlay.style.display = 'flex';
            gsap.fromTo(dbSetupOverlay, { opacity: 0 }, { opacity: 1, duration: 0.5 });
        }

        if (config.configFileExists) {
            const errorBox = document.getElementById('dbSetupError');
            const errorMsg = document.getElementById('dbSetupErrorMsg');
            if (errorBox && errorMsg) {
                errorMsg.textContent = config.error || "Failed to connect to PostgreSQL with saved configuration. Please repair credentials below.";
                errorBox.style.display = 'flex';
            }
        }

        const setupBtn = document.getElementById('dbSetupBtn');
        if (setupBtn) {
            const newSetupBtn = setupBtn.cloneNode(true);
            setupBtn.parentNode.replaceChild(newSetupBtn, setupBtn);
            
            newSetupBtn.addEventListener('click', async () => {
                const host = document.getElementById('dbHost').value.trim();
                const port = document.getElementById('dbPort').value.trim();
                const dbName = document.getElementById('dbName').value.trim();
                const username = document.getElementById('dbUsername').value.trim();
                const password = document.getElementById('dbPassword').value;

                const errorBox = document.getElementById('dbSetupError');
                const errorMsg = document.getElementById('dbSetupErrorMsg');
                const statusBox = document.getElementById('dbSetupStatus');
                const statusMsg = document.getElementById('dbSetupStatusMsg');

                if (errorBox) errorBox.style.display = 'none';
                if (!host || !port || !dbName || !username) {
                    if (errorBox && errorMsg) {
                        errorMsg.textContent = "All fields except password are required.";
                        errorBox.style.display = 'flex';
                    }
                    return;
                }

                if (statusBox && statusMsg) {
                    statusMsg.textContent = "VALIDATING CONNECTION & PROVISIONING DATABASE...";
                    statusBox.style.display = 'flex';
                }
                newSetupBtn.disabled = true;

                const inputs = document.querySelectorAll('.db-setup-form .styled-input');
                inputs.forEach(inp => inp.disabled = true);

                try {
                    const res = await Api.setupDatabase(host, port, dbName, username, password);
                    if (res.success) {
                        if (statusMsg) {
                            statusMsg.textContent = "REBOOTING NEURAL SERVER CONTEXT... PLEASE WAIT.";
                        }
                        
                        let pollAttempts = 0;
                        const pollInterval = setInterval(async () => {
                            pollAttempts++;
                            try {
                                const pollStatus = await Api.getDatabaseStatus();
                                if (pollStatus.configured) {
                                    clearInterval(pollInterval);
                                    if (statusMsg) {
                                        statusMsg.textContent = "CORE SYNC SUCCESSFUL! LAUNCHING WORKSPACE...";
                                    }
                                    setTimeout(() => {
                                        if (dbSetupOverlay) {
                                            gsap.to(dbSetupOverlay, { opacity: 0, duration: 0.5, onComplete: () => {
                                                dbSetupOverlay.style.display = 'none';
                                            }});
                                        }
                                        bootstrapApp();
                                    }, 1500);
                                }
                            } catch (e) {
                                console.warn("Waiting for context reboot...", e);
                            }
                            
                            if (pollAttempts > 30) {
                                clearInterval(pollInterval);
                                if (statusBox) statusBox.style.display = 'none';
                                inputs.forEach(inp => inp.disabled = false);
                                newSetupBtn.disabled = false;
                                if (errorBox && errorMsg) {
                                    errorMsg.textContent = "Reboot timeout. Please check your console/logs or try again.";
                                    errorBox.style.display = 'flex';
                                }
                            }
                        }, 1500);

                    } else {
                        throw new Error(res.error || "Setup failed");
                    }
                } catch (err) {
                    console.error("Setup failed:", err);
                    if (statusBox) statusBox.style.display = 'none';
                    inputs.forEach(inp => inp.disabled = false);
                    newSetupBtn.disabled = false;
                    if (errorBox && errorMsg) {
                        errorMsg.textContent = err.message || "Failed to initialize database. Verify host and port link.";
                        errorBox.style.display = 'flex';
                    }
                }
            });
        }

        return false;
    } catch (e) {
        console.error("Database status check failed:", e);
        return true;
    }
}
