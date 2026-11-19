export type ThemeMode = 'light' | 'paper' | 'cobalt' | 'dark' | 'midnight';

export type ViewMode = 'active' | 'archive' | 'trash';

export type PinModalMode = 'verify-archive' | 'setup' | 'change' | 'remove';

export type NoteFontFamily = 'sans' | 'serif' | 'mono';

export type NoteFontSize = 'S' | 'M' | 'L' | 'XL';

export type NoteTextAlign = 'left' | 'center' | 'right';

export interface NoteAttachment {
  id: string;
  type: 'image' | 'sketch';
  uri: string;
  createdAt: number;
  width?: number;
  height?: number;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  attachments?: NoteAttachment[];
}

export interface Settings {
  theme: ThemeMode;
  archivePin: string;
  syncBaseUrl: string;
}

export interface MathLineResult {
  lineIndex: number;
  expression: string;
  result: number | string;
  isVariableAssignment: boolean;
  variableName?: string;
}

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastState {
  id: number;
  message: string;
  variant: ToastVariant;
}
