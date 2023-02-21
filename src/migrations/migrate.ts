import { log } from "src/logger/logManager";
import QuickAdd from "src/main";
import { Migrations } from "./Migrations";
import migrateToMacroIDFromEmbeddedMacro from "./migrateToMacroIDFromEmbeddedMacro";
import useQuickAddTemplateFolder from "./useQuickAddTemplateFolder";
import incrementFileNameSettingMoveToDefaultBehavior from "./incrementFileNameSettingMoveToDefaultBehavior";
import { moment } from "obsidian";
import mutualExclusionInsertAfterAndWriteToBottomOfFile from "./mutualExclusionInsertAfterAndWriteToBottomOfFile";

const migrations: Migrations = {
	migrateToMacroIDFromEmbeddedMacro,
	useQuickAddTemplateFolder,
	incrementFileNameSettingMoveToDefaultBehavior,
	mutualExclusionInsertAfterAndWriteToBottomOfFile,
};

const backupFolderPath = ".obsidian/plugins/quickadd/backup";

const getBackupPath = (backupName: string): string =>
	`${backupFolderPath}/${moment().format(
		"DD-MM-YY_HH-mm-ss"
	)}_${backupName}.json`;

// Unfortunately, we cannot use 'app.vault.getAbstractFileByPath' here, because it doesn't seem to index files in the .obsidian folder.
async function makeBackupFolderIfNotExists() {
	try {
		await app.vault.createFolder(backupFolderPath);
	} catch (error) {
		if (!error.message?.includes("Folder already exists")) {
			throw error;
		}
	}
}

async function migrate(plugin: QuickAdd): Promise<void> {
	const migrationsToRun = Object.keys(migrations).filter(
		(migration: keyof Migrations) => !plugin.settings.migrations[migration]
	);

	if (migrationsToRun.length === 0) {
		log.logMessage("No migrations to run.");

		return;
	}

	try {
		await makeBackupFolderIfNotExists();

		const backup = structuredClone(plugin.settings);

		await app.vault.create(
			getBackupPath("preMigrationBackup"),
			JSON.stringify(backup)
		);
	} catch (error) {
		log.logError(
			`Unable to create backup before migrating to new version. Please create an issue with the following error message: \n\n${error}\n\nYour data is still safe! QuickAdd won't proceed without backup.`
		);

		return;
	}

	// Could batch-run with Promise.all, but we want to log each migration as it runs.
	for (const migration of migrationsToRun as (keyof Migrations)[]) {
		log.logMessage(
			`Running migration ${migration}: ${migrations[migration].description}`
		);

		const backup = structuredClone(plugin.settings);

		try {
			await migrations[migration].migrate(plugin);

			plugin.settings.migrations[migration] = true;

			log.logMessage(`Migration ${migration} successful.`);
		} catch (error) {
			log.logError(
				`Migration '${migration}' was unsuccessful. Please create an issue with the following error message: \n\n${error}\n\nQuickAdd will now revert to backup. You can also find a backup in the QuickAdd backup folder: "${backupFolderPath}"`
			);

			plugin.settings = backup;
		}
	}

	plugin.saveSettings();
}

export default migrate;