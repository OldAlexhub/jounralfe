import { NativeEventEmitter, NativeModules } from 'react-native';

export const Vosk = NativeModules.InnerfolioVosk as {
  prepareModel(): Promise<boolean>;
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
  cancel(): Promise<boolean>;
};
export const VoskEvents = new NativeEventEmitter(NativeModules.InnerfolioVosk);
export const Documents = NativeModules.InnerfolioDocuments as {
  saveText(filename: string, mime: string, content: string): Promise<string>;
  savePdf(filename: string, title: string, content: string): Promise<string>;
  exportBackup(
    filename: string,
    records: string,
    password: string,
  ): Promise<string>;
  importBackup(password: string): Promise<string>;
};
export const Reminders = NativeModules.InnerfolioReminders as {
  schedule(hour: number, minute: number): Promise<boolean>;
  cancel(): Promise<boolean>;
};
