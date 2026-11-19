import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Note } from '../types/note';
import {
  buildBackupFilename,
  parseAndReindexBackup,
  serializeBackupPayload,
} from './backup';

export async function exportNotesToJsonFile(
  notes: Note[]
): Promise<{ filename: string; count: number }> {
  const filename = buildBackupFilename();
  const jsonContent = serializeBackupPayload(notes);

  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  await file.write(jsonContent);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export Risalah Backup',
    UTI: 'public.json',
  });

  return { filename, count: notes.length };
}

export async function importNotesFromJsonFile(
  existingNotes: Note[]
): Promise<{ canceled: boolean; importedNotes: Note[] }> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return { canceled: true, importedNotes: [] };
  }

  const asset = result.assets[0];
  const file = new File(asset.uri);
  const rawText = await file.text();
  const importedNotes = parseAndReindexBackup(rawText, existingNotes);

  return { canceled: false, importedNotes };
}
