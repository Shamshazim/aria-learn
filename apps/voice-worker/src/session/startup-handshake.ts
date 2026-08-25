export async function prepareVoiceStartup(input: {
  authorize(): Promise<void>;
  announceReady(): Promise<void>;
  acknowledgement: Promise<boolean>;
}): Promise<Readonly<{ acknowledged: boolean }>> {
  await input.authorize();
  await input.announceReady();
  return { acknowledged: await input.acknowledgement };
}
