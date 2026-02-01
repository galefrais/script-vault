class ScriptVaultApp extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "script-vault",
      title: "Script Vault",
      template: "modules/script-vault/templates/script-vault.html",
      width: 900,
      height: 700,
      resizable: true,
      closeOnSubmit: false,
      submitOnClose: false,
      tabs: []
    });
  }

  getData() {
    const scripts = game.settings.get("script-vault", "scripts");
    return {
      scripts: Object.entries(scripts).map(([id, data]) => ({
        id,
        ...data
      })),
      currentScript: this.currentScript || null,
      isGM: game.user.isGM
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Add Script button
    html.find("#add-script").click(() => this._onAddScript());

    // Script list item clicks
    html.find(".script-item").click((ev) => this._onSelectScript(ev));

    // Delete script button
    html.find("#delete-script").click(() => this._onDeleteScript());

    // Save script button
    html.find("#save-script").click(() => this._onSaveScript(html));

    // Run script button
    html.find("#run-script").click(() => this._onRunScript());

    // Export button
    html.find("#export-scripts").click(() => this._onExportScripts());

    // Import button
    html.find("#import-scripts").click(() => this._onImportScripts());

    // Script name input change
    html.find("#script-name").on("input", () => {
      this.isModified = true;
    });

    // Script code textarea change
    html.find("#script-code").on("input", () => {
      this.isModified = true;
    });
  }

  _onAddScript() {
    const newId = foundry.utils.randomID();
    this.currentScript = {
      id: newId,
      name: "New Script",
      code: "// Your script code here\n// Access context with: ctx\n// Example: ctx.token, ctx.actor, ctx.user\n\nui.notifications.info('Script executed!');"
    };
    this.isModified = true;
    this.render();
  }

  _onSelectScript(ev) {
    const scriptId = $(ev.currentTarget).data("script-id");
    const scripts = game.settings.get("script-vault", "scripts");
    this.currentScript = { id: scriptId, ...scripts[scriptId] };
    this.isModified = false;
    this.render();
  }

  async _onDeleteScript() {
    if (!this.currentScript) {
      ui.notifications.warn("No script selected to delete.");
      return;
    }

    const confirm = await Dialog.confirm({
      title: "Delete Script",
      content: `<p>Are you sure you want to delete <strong>${this.currentScript.name}</strong>?</p>`,
      yes: () => true,
      no: () => false
    });

    if (!confirm) return;

    const scripts = game.settings.get("script-vault", "scripts");
    delete scripts[this.currentScript.id];
    await game.settings.set("script-vault", "scripts", scripts);

    this.currentScript = null;
    this.isModified = false;
    ui.notifications.info(`Script deleted successfully.`);
    this.render();
  }

  async _onSaveScript(html) {
    if (!this.currentScript) {
      ui.notifications.warn("No script to save.");
      return;
    }

    const name = html.find("#script-name").val().trim();
    const code = html.find("#script-code").val();

    if (!name) {
      ui.notifications.error("Script name cannot be empty.");
      return;
    }

    const scripts = game.settings.get("script-vault", "scripts");
    scripts[this.currentScript.id] = { name, code };
    await game.settings.set("script-vault", "scripts", scripts);

    this.currentScript.name = name;
    this.currentScript.code = code;
    this.isModified = false;
    ui.notifications.info(`Script "${name}" saved successfully.`);
    this.render();
  }

  async _onRunScript() {
    if (!this.currentScript || !this.currentScript.code) {
      ui.notifications.warn("No script selected to run.");
      return;
    }

    try {
      // Create context object
      const ctx = {
        token: canvas.tokens.controlled[0] || null,
        actor: canvas.tokens.controlled[0]?.actor || game.user.character || null,
        user: game.user,
        scene: game.scenes.current,
        game: game,
        ui: ui,
        canvas: canvas
      };

      // Execute the script
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction("ctx", this.currentScript.code);
      await fn(ctx);

      ui.notifications.info(`Script "${this.currentScript.name}" executed successfully.`);
    } catch (err) {
      ui.notifications.error(`Script execution failed: ${err.message}`);
      console.error("Script Vault execution error:", err);
    }
  }

  async _onExportScripts() {
    const scripts = game.settings.get("script-vault", "scripts");
    const dataStr = JSON.stringify(scripts, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `script-vault-export-${Date.now()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    ui.notifications.info("Scripts exported successfully.");
  }

  async _onImportScripts() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    
    input.onchange = async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const importedScripts = JSON.parse(e.target.result);
          
          const confirm = await Dialog.confirm({
            title: "Import Scripts",
            content: `<p>Import ${Object.keys(importedScripts).length} script(s)?</p><p><strong>Warning:</strong> This will merge with existing scripts. Duplicate IDs will be overwritten.</p>`,
            yes: () => true,
            no: () => false
          });

          if (!confirm) return;

          const currentScripts = game.settings.get("script-vault", "scripts");
          const mergedScripts = foundry.utils.mergeObject(currentScripts, importedScripts);
          await game.settings.set("script-vault", "scripts", mergedScripts);

          ui.notifications.info("Scripts imported successfully.");
          this.render();
        } catch (err) {
          ui.notifications.error("Failed to import scripts. Invalid file format.");
          console.error("Import error:", err);
        }
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  }
}

// Global API for running scripts from macros
class ScriptVault {
  static async run(scriptName, context = {}) {
    const scripts = game.settings.get("script-vault", "scripts");
    const script = Object.values(scripts).find(s => s.name === scriptName);

    if (!script) {
      ui.notifications.error(`Script "${scriptName}" not found in Script Vault.`);
      return false;
    }

    try {
      // Merge provided context with default context
      const ctx = foundry.utils.mergeObject({
        token: canvas.tokens.controlled[0] || null,
        actor: canvas.tokens.controlled[0]?.actor || game.user.character || null,
        user: game.user,
        scene: game.scenes.current,
        game: game,
        ui: ui,
        canvas: canvas
      }, context);

      // Execute the script
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction("ctx", script.code);
      await fn(ctx);

      return true;
    } catch (err) {
      ui.notifications.error(`Script "${scriptName}" execution failed: ${err.message}`);
      console.error("Script Vault execution error:", err);
      return false;
    }
  }

  static open() {
    if (!game.user.isGM) {
      ui.notifications.warn("Only GMs can access the Script Vault.");
      return;
    }
    new ScriptVaultApp().render(true);
  }
}

// Initialize the module
Hooks.once("init", () => {
  console.log("Script Vault | Initializing");

  // Register settings
  game.settings.register("script-vault", "scripts", {
    name: "Stored Scripts",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  // Make ScriptVault globally available
  window.ScriptVault = ScriptVault;
});

// Add button to settings sidebar
Hooks.on("renderSettings", (app, html) => {
  if (!game.user.isGM) return;

  const button = $(`
    <button id="script-vault-button">
      <i class="fas fa-vault"></i> Script Vault
    </button>
  `);

  button.click(() => ScriptVault.open());

  html.find("#settings-game").append(button);
});
