// =============================================================================
// SCRIPT VAULT v2.0 - Enhanced with Startup Scripts
// =============================================================================

class ScriptVault {
    static ID = 'script-vault';
    static FLAGS = {
        SCRIPTS: 'scripts',
        STARTUP: 'startup'
    };

    // =========================================================================
    // INITIALIZATION
    // =========================================================================
    
    static initialize() {
        console.log("Script Vault | Initializing...");
        
        // Register settings
        game.settings.register(this.ID, 'scripts', {
            name: 'Scripts Storage',
            scope: 'world',
            config: false,
            type: Object,
            default: {}
        });

        game.settings.register(this.ID, 'startupScripts', {
            name: 'Startup Scripts',
            hint: 'Scripts that run automatically when the world loads',
            scope: 'world',
            config: false,
            type: Array,
            default: []
        });

        game.settings.register(this.ID, 'startupEnabled', {
            name: 'Enable Startup Scripts',
            hint: 'Allow scripts to run automatically on world load',
            scope: 'world',
            config: true,
            type: Boolean,
            default: true
        });

        // Ensure default scripts exist
        this._ensureDefaultScripts();
        
        console.log("Script Vault | Initialized");
    }

    static _ensureDefaultScripts() {
        const scripts = this.getScripts();
        
        // Add String Trap System if it doesn't exist
        if (!scripts['String Trap System']) {
            scripts['String Trap System'] = {
                name: 'String Trap System',
                code: this._getStringTrapSystemCode(),
                description: 'Automatic trap triggering system - triggers traps when tokens move onto them',
                isStartup: true,
                createdAt: Date.now()
            };
            game.settings.set(this.ID, 'scripts', scripts);
            
            // Enable it as startup by default
            const startupScripts = this.getStartupScripts();
            if (!startupScripts.includes('String Trap System')) {
                startupScripts.push('String Trap System');
                game.settings.set(this.ID, 'startupScripts', startupScripts);
            }
            
            console.log("Script Vault | Added default String Trap System script");
        }
    }

    // =========================================================================
    // SCRIPT MANAGEMENT
    // =========================================================================

    static getScripts() {
        return game.settings.get(this.ID, 'scripts') || {};
    }

    static getScript(name) {
        const scripts = this.getScripts();
        return scripts[name];
    }

    static async saveScript(name, code, description = '', isStartup = false) {
        const scripts = this.getScripts();
        const existingScript = scripts[name];
        
        scripts[name] = {
            name,
            code,
            description,
            isStartup,
            createdAt: existingScript?.createdAt || Date.now(),
            updatedAt: Date.now()
        };
        
        await game.settings.set(this.ID, 'scripts', scripts);
        
        // Update startup list
        if (isStartup) {
            await this.enableStartup(name);
        } else {
            await this.disableStartup(name);
        }
        
        console.log(`Script Vault | Saved script: ${name}`);
        return scripts[name];
    }

    static async deleteScript(name) {
        const scripts = this.getScripts();
        delete scripts[name];
        await game.settings.set(this.ID, 'scripts', scripts);
        await this.disableStartup(name);
        console.log(`Script Vault | Deleted script: ${name}`);
    }

    static async renameScript(oldName, newName) {
        const scripts = this.getScripts();
        if (scripts[oldName]) {
            scripts[newName] = { ...scripts[oldName], name: newName };
            delete scripts[oldName];
            await game.settings.set(this.ID, 'scripts', scripts);
            
            // Update startup list if needed
            const startupScripts = this.getStartupScripts();
            const idx = startupScripts.indexOf(oldName);
            if (idx !== -1) {
                startupScripts[idx] = newName;
                await game.settings.set(this.ID, 'startupScripts', startupScripts);
            }
        }
    }

    // =========================================================================
    // SCRIPT EXECUTION
    // =========================================================================

    static async run(name) {
        const script = this.getScript(name);
        if (!script) {
            ui.notifications.error(`Script "${name}" not found!`);
            console.error(`Script Vault | Script not found: ${name}`);
            return false;
        }
        
        console.log(`Script Vault | Executing: ${name}`);
        
        try {
            // Create async function and execute
            const asyncFunc = new Function('return (async () => {' + script.code + '\n})()');
            await asyncFunc();
            console.log(`Script Vault | Completed: ${name}`);
            return true;
        } catch (error) {
            console.error(`Script Vault | Error in "${name}":`, error);
            ui.notifications.error(`Error in script "${name}": ${error.message}`);
            return false;
        }
    }

    // =========================================================================
    // STARTUP SCRIPTS
    // =========================================================================

    static getStartupScripts() {
        return game.settings.get(this.ID, 'startupScripts') || [];
    }

    static isStartupEnabled(name) {
        return this.getStartupScripts().includes(name);
    }

    static async enableStartup(name) {
        const startupScripts = this.getStartupScripts();
        if (!startupScripts.includes(name)) {
            startupScripts.push(name);
            await game.settings.set(this.ID, 'startupScripts', startupScripts);
            console.log(`Script Vault | Startup enabled for: ${name}`);
        }
    }

    static async disableStartup(name) {
        let startupScripts = this.getStartupScripts();
        const index = startupScripts.indexOf(name);
        if (index !== -1) {
            startupScripts.splice(index, 1);
            await game.settings.set(this.ID, 'startupScripts', startupScripts);
            console.log(`Script Vault | Startup disabled for: ${name}`);
        }
    }

    static async toggleStartup(name) {
        if (this.isStartupEnabled(name)) {
            await this.disableStartup(name);
            return false;
        } else {
            await this.enableStartup(name);
            return true;
        }
    }

    static async runStartupScripts() {
        // Only GM runs startup scripts
        if (!game.user.isGM) return;
        
        // Check if startup is enabled globally
        if (!game.settings.get(this.ID, 'startupEnabled')) {
            console.log("Script Vault | Startup scripts disabled in settings");
            return;
        }
        
        const startupScripts = this.getStartupScripts();
        if (startupScripts.length === 0) {
            console.log("Script Vault | No startup scripts configured");
            return;
        }
        
        console.log(`Script Vault | Running ${startupScripts.length} startup script(s)...`);
        
        let successCount = 0;
        let failCount = 0;
        
        for (const name of startupScripts) {
            const script = this.getScript(name);
            if (script) {
                const success = await this.run(name);
                if (success) successCount++;
                else failCount++;
            } else {
                console.warn(`Script Vault | Startup script not found: ${name}`);
                failCount++;
            }
        }
        
        if (successCount > 0) {
            ui.notifications.info(`Script Vault: ${successCount} startup script(s) loaded`);
        }
        if (failCount > 0) {
            ui.notifications.warn(`Script Vault: ${failCount} startup script(s) failed`);
        }
    }

    // =========================================================================
    // IMPORT/EXPORT
    // =========================================================================

    static exportScripts() {
        const data = {
            scripts: this.getScripts(),
            startupScripts: this.getStartupScripts(),
            exportedAt: Date.now(),
            version: '2.0.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `script-vault-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        ui.notifications.info('Scripts exported!');
    }

    static async importScripts(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (data.scripts) {
                const currentScripts = this.getScripts();
                const merged = { ...currentScripts, ...data.scripts };
                await game.settings.set(this.ID, 'scripts', merged);
            }
            
            if (data.startupScripts) {
                const currentStartup = this.getStartupScripts();
                const merged = [...new Set([...currentStartup, ...data.startupScripts])];
                await game.settings.set(this.ID, 'startupScripts', merged);
            }
            
            ui.notifications.info('Scripts imported successfully!');
            return true;
        } catch (error) {
            console.error('Script Vault | Import error:', error);
            ui.notifications.error('Failed to import scripts: ' + error.message);
            return false;
        }
    }

    // =========================================================================
    // DEFAULT SCRIPTS
    // =========================================================================

    static _getStringTrapSystemCode() {
        return `// STRING TRAP SYSTEM v4 - Auto-loaded by Script Vault
// Handles automatic trap triggering when tokens move onto trap tiles

if (!window.stringTrapSystemLoaded) {
    window.stringTrapSystemLoaded = true;
    
    const stringTrapTokensInTraps = new Map();
    
    Hooks.on("updateToken", async function(tokenDoc, updateData, options, userId) {
        if (updateData.x === undefined && updateData.y === undefined) return;
        if (!game.user.isGM) return;
        
        const gs = canvas.grid.size;
        const newX = updateData.x ?? tokenDoc.x;
        const newY = updateData.y ?? tokenDoc.y;
        const tokenW = (tokenDoc.width || 1) * gs;
        const tokenH = (tokenDoc.height || 1) * gs;
        
        const traps = canvas.tiles.placeables.filter(t => t.document?.flags?.["string-trap"]?.isActive);
        if (traps.length === 0) return;
        
        for (const tile of traps) {
            const flags = tile.document.flags["string-trap"];
            const key = tile.id + "-" + tokenDoc.id;
            const wasIn = stringTrapTokensInTraps.get(key) || false;
            
            const tileX = tile.document.x;
            const tileY = tile.document.y;
            const tileW = tile.document.width;
            const tileH = tile.document.height;
            
            const isIn = !(newX + tokenW <= tileX || newX >= tileX + tileW || newY + tokenH <= tileY || newY >= tileY + tileH);
            
            stringTrapTokensInTraps.set(key, isIn);
            
            // ENTRY - Token just entered the trap
            if (!wasIn && isIn) {
                ui.notifications.warn(tokenDoc.name + " triggered " + flags.type + "!");
                
                // Handle damage
                if (flags.damage) {
                    const token = canvas.tokens.get(tokenDoc.id);
                    const roll = await new Roll(flags.damage).evaluate();
                    if (game.dice3d) await game.dice3d.showForRoll(roll);
                    
                    await roll.toMessage({
                        speaker: ChatMessage.getSpeaker({token: tokenDoc}),
                        flavor: "🕸️ " + flags.type + " - " + flags.damageType + " damage"
                    });
                    
                    // Landmine - AoE explosion
                    if (flags.type === "Landmine Trap" && flags.explosionSize) {
                        const cx = tile.document.x + tile.document.width / 2;
                        const cy = tile.document.y + tile.document.height / 2;
                        const radius = (flags.explosionSize * gs) / 2 * 1.5;
                        
                        const hitTokens = canvas.tokens.placeables.filter(t => {
                            const tcx = t.x + (t.document.width * gs) / 2;
                            const tcy = t.y + (t.document.height * gs) / 2;
                            return Math.sqrt(Math.pow(tcx - cx, 2) + Math.pow(tcy - cy, 2)) <= radius;
                        });
                        
                        for (const ht of hitTokens) {
                            if (ht.actor) {
                                try { await ht.actor.applyDamage(roll.total, 1); }
                                catch(e) { await ht.actor.update({"system.attributes.hp.value": Math.max(0, ht.actor.system.attributes.hp.value - roll.total)}); }
                            }
                        }
                        ChatMessage.create({content: '<div style="text-align:center;padding:10px;background:rgba(255,100,0,0.3);border:2px solid #ff4400;"><strong>💥 LANDMINE EXPLODES!</strong><br/>' + hitTokens.length + ' hit for ' + roll.total + ' ' + flags.damageType + '!</div>'});
                    } else if (token?.actor) {
                        // Single target damage
                        try { await token.actor.applyDamage(roll.total, 1); }
                        catch(e) { await token.actor.update({"system.attributes.hp.value": Math.max(0, token.actor.system.attributes.hp.value - roll.total)}); }
                        ChatMessage.create({content: '<div style="text-align:center;padding:10px;background:rgba(255,100,0,0.2);border:2px solid #ff6600;"><strong>🕸️ ' + flags.type + '!</strong><br/>' + tokenDoc.name + ' takes ' + roll.total + ' ' + flags.damageType + '!</div>'});
                    }
                }
                
                // Handle Paralyze
                if (flags.condition === "paralyzed") {
                    const token = canvas.tokens.get(tokenDoc.id);
                    if (token?.actor) {
                        const dc = flags.saveDC || 15;
                        let saveResult;
                        try { saveResult = await token.actor.rollAbilitySave(flags.saveAbility || "dex", {chatMessage: true}); }
                        catch(e) { 
                            const mod = token.actor.system.abilities?.[flags.saveAbility || "dex"]?.mod || 0;
                            saveResult = await new Roll("1d20 + " + mod).evaluate();
                            await saveResult.toMessage({speaker: ChatMessage.getSpeaker({token: tokenDoc}), flavor: tokenDoc.name + " DEX Save vs DC " + dc});
                        }
                        
                        if (saveResult.total < dc) {
                            await token.actor.createEmbeddedDocuments("ActiveEffect", [{name: "Paralyzed (String Trap)", icon: "icons/svg/paralysis.svg", statuses: ["paralyzed"], changes: []}]);
                            ui.notifications.error(tokenDoc.name + " is PARALYZED!");
                            ChatMessage.create({content: '<div style="text-align:center;padding:10px;background:rgba(0,255,136,0.2);border:2px solid #00ff88;"><strong>⚡ PARALYZED!</strong><br/>' + tokenDoc.name + ' failed DC ' + dc + ' (rolled ' + saveResult.total + ')</div>'});
                        } else {
                            ui.notifications.info(tokenDoc.name + " resisted! (rolled " + saveResult.total + ")");
                            ChatMessage.create({content: '<div style="text-align:center;padding:10px;background:rgba(0,200,0,0.1);border:2px solid #00cc00;"><strong>✅ RESISTED!</strong><br/>' + tokenDoc.name + ' passed DC ' + dc + ' (rolled ' + saveResult.total + ')</div>'});
                        }
                    }
                }
                
                // Handle DoT trap
                if (flags.isDot) {
                    const token = canvas.tokens.get(tokenDoc.id);
                    if (token?.actor && !token.actor.effects.find(e => e.flags?.["string-trap"]?.dotTileId === tile.id)) {
                        await token.actor.createEmbeddedDocuments("ActiveEffect", [{
                            name: "🕸️ String Trap DoT",
                            icon: "icons/magic/unholy/projectile-helix-blood-purple.webp",
                            duration: {rounds: 999},
                            flags: {"string-trap": {dotTileId: tile.id, damage: flags.damage, damageType: flags.damageType}}
                        }]);
                        ChatMessage.create({content: '<div style="text-align:center;padding:10px;background:rgba(153,0,255,0.2);border:2px solid #9900ff;"><strong>🕸️ DoT Trap!</strong><br/>' + tokenDoc.name + ' takes ' + flags.damage + ' ' + flags.damageType + ' each turn</div>'});
                    }
                }
                
                // Deactivate non-DoT traps
                if (!flags.isDot) {
                    await tile.document.update({"flags.string-trap.isActive": false, "alpha": 0.3});
                }
            }
            
            // EXIT - Token left a DoT trap
            if (wasIn && !isIn && flags.isDot) {
                const token = canvas.tokens.get(tokenDoc.id);
                const effect = token?.actor?.effects.find(e => e.flags?.["string-trap"]?.dotTileId === tile.id);
                if (effect) {
                    await effect.delete();
                    ui.notifications.info(tokenDoc.name + " escaped the DoT trap!");
                    ChatMessage.create({content: '<div style="text-align:center;padding:10px;background:rgba(0,200,0,0.1);border:2px solid #00cc00;"><strong>✅ Escaped!</strong><br/>' + tokenDoc.name + ' left the DoT trap</div>'});
                }
            }
        }
    });
    
    // DoT damage on combat turn
    Hooks.on("combatTurn", async function(combat, updateData, updateOptions) {
        if (!combat.started || !game.user.isGM) return;
        const combatant = combat.combatant;
        if (!combatant?.token) return;
        const token = canvas.tokens.get(combatant.tokenId);
        if (!token?.actor) return;
        
        const dots = token.actor.effects.filter(e => e.flags?.["string-trap"]?.dotTileId);
        for (const effect of dots) {
            const dmg = effect.flags["string-trap"].damage;
            const dtype = effect.flags["string-trap"].damageType;
            const roll = await new Roll(dmg).evaluate();
            if (game.dice3d) await game.dice3d.showForRoll(roll);
            await roll.toMessage({speaker: ChatMessage.getSpeaker({token: combatant.token}), flavor: "🕸️ DoT Trap - " + dtype + " damage"});
            try { await token.actor.applyDamage(roll.total, 1); }
            catch(e) { await token.actor.update({"system.attributes.hp.value": Math.max(0, token.actor.system.attributes.hp.value - roll.total)}); }
            ui.notifications.warn(token.actor.name + " takes " + roll.total + " " + dtype + " DoT damage!");
        }
    });
    
    console.log("String Trap System | Loaded and ready!");
}`;
    }
}

// =============================================================================
// SCRIPT VAULT UI APPLICATION
// =============================================================================

class ScriptVaultUI extends Application {
    constructor(options = {}) {
        super(options);
        this._currentScript = null;
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: 'script-vault-ui',
            title: 'Script Vault',
            template: 'modules/script-vault/templates/vault.html',
            width: 800,
            height: 650,
            resizable: true,
            classes: ['script-vault']
        });
    }

    getData() {
        const scripts = ScriptVault.getScripts();
        const startupScripts = ScriptVault.getStartupScripts();
        
        const scriptList = Object.values(scripts)
            .map(s => ({
                ...s,
                isStartup: startupScripts.includes(s.name)
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
        
        return {
            scripts: scriptList,
            currentScript: this._currentScript,
            selectedScript: this._currentScript ? ScriptVault.getScript(this._currentScript) : null,
            isStartupEnabled: this._currentScript ? ScriptVault.isStartupEnabled(this._currentScript) : false
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        
        // Script list selection
        html.find('.script-item').on('click', (ev) => {
            const name = ev.currentTarget.dataset.name;
            this._selectScript(name);
        });
        
        // Toolbar buttons
        html.find('.btn-add').on('click', () => this._addScript());
        html.find('.btn-export').on('click', () => ScriptVault.exportScripts());
        html.find('.btn-import').on('click', () => this._importScripts());
        
        // Editor buttons
        html.find('.btn-save').on('click', () => this._saveCurrentScript(html));
        html.find('.btn-run').on('click', () => this._runCurrentScript());
        html.find('.btn-startup').on('click', () => this._toggleStartup());
        html.find('.btn-delete').on('click', () => this._deleteCurrentScript());
        
        // Load first script if available and none selected
        if (!this._currentScript) {
            const firstScript = html.find('.script-item').first();
            if (firstScript.length) {
                this._selectScript(firstScript.data('name'));
            }
        }
    }

    _selectScript(name) {
        this._currentScript = name;
        this.render(false);
    }

    async _addScript() {
        const name = await Dialog.prompt({
            title: 'New Script',
            content: `
                <form>
                    <div class="form-group">
                        <label>Script Name</label>
                        <input type="text" name="name" placeholder="My New Script" autofocus>
                    </div>
                </form>
            `,
            callback: html => html.find('input[name="name"]').val(),
            rejectClose: false
        });
        
        if (name && name.trim()) {
            await ScriptVault.saveScript(name.trim(), '// Your code here\n', '', false);
            this._currentScript = name.trim();
            this.render(true);
            ui.notifications.info(`Created script: ${name.trim()}`);
        }
    }

    async _saveCurrentScript(html) {
        if (!this._currentScript) {
            ui.notifications.warn('No script selected');
            return;
        }
        
        const name = html.find('.editor-name').val()?.trim();
        const code = html.find('.editor-code').val();
        const description = html.find('.editor-description').val()?.trim() || '';
        const isStartup = ScriptVault.isStartupEnabled(this._currentScript);
        
        if (!name) {
            ui.notifications.warn('Please enter a script name');
            return;
        }
        
        // Handle rename
        if (name !== this._currentScript) {
            await ScriptVault.renameScript(this._currentScript, name);
            this._currentScript = name;
        }
        
        await ScriptVault.saveScript(name, code, description, isStartup);
        ui.notifications.info(`Saved: ${name}`);
        this.render(false);
    }

    async _runCurrentScript() {
        if (!this._currentScript) {
            ui.notifications.warn('No script selected');
            return;
        }
        await ScriptVault.run(this._currentScript);
    }

    async _toggleStartup() {
        if (!this._currentScript) return;
        
        const isNowStartup = await ScriptVault.toggleStartup(this._currentScript);
        ui.notifications.info(`${this._currentScript}: Startup ${isNowStartup ? 'enabled' : 'disabled'}`);
        this.render(false);
    }

    async _deleteCurrentScript() {
        if (!this._currentScript) return;
        
        const confirm = await Dialog.confirm({
            title: 'Delete Script',
            content: `<p>Are you sure you want to delete "<strong>${this._currentScript}</strong>"?</p><p>This cannot be undone.</p>`
        });
        
        if (confirm) {
            await ScriptVault.deleteScript(this._currentScript);
            this._currentScript = null;
            ui.notifications.info('Script deleted');
            this.render(true);
        }
    }

    _importScripts() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (file) {
                const success = await ScriptVault.importScripts(file);
                if (success) this.render(true);
            }
        };
        
        input.click();
    }
}

// =============================================================================
// HOOKS - Module Initialization
// =============================================================================

Hooks.once('init', () => {
    console.log("Script Vault | Module init");
    ScriptVault.initialize();
});

Hooks.once('ready', () => {
    // Make globally available
    window.ScriptVault = ScriptVault;
    game.ScriptVault = ScriptVault;
    
    console.log("Script Vault | Ready");
    
    // Run startup scripts with a small delay to ensure everything is loaded
    setTimeout(() => {
        ScriptVault.runStartupScripts();
    }, 1500);
});

// Add button to token controls
Hooks.on('getSceneControlButtons', (controls) => {
    const tokenControls = controls.find(c => c.name === 'token');
    if (tokenControls && game.user.isGM) {
        tokenControls.tools.push({
            name: 'script-vault',
            title: 'Script Vault',
            icon: 'fas fa-scroll',
            button: true,
            onClick: () => new ScriptVaultUI().render(true)
        });
    }
});

// Also add to notes/journal controls as fallback
Hooks.on('getSceneControlButtons', (controls) => {
    const notesControls = controls.find(c => c.name === 'notes');
    if (notesControls && game.user.isGM) {
        notesControls.tools.push({
            name: 'script-vault',
            title: 'Script Vault',
            icon: 'fas fa-scroll',
            button: true,
            onClick: () => new ScriptVaultUI().render(true)
        });
    }
});

console.log("Script Vault | Module loaded");
