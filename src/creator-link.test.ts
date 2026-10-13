import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendCreatorLink } from './worker';

function fakeEnv() {
  const insertedHashes: string[] = [];
  const deletedHashes: string[] = [];
  const env = {
    RESEND_API_KEY: 'synthetic-test-key',
    CREATOR_EMAIL_FROM: 'aporia@example.test',
    APORIA_APP_ORIGIN: 'https://aporia.example.test',
    DB: {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            return {
              async run() {
                if (sql.startsWith('INSERT INTO creator_auth_tokens')) insertedHashes.push(String(values[0]));
                if (sql.startsWith('DELETE FROM creator_auth_tokens')) deletedHashes.push(String(values[0]));
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };
  return { env: env as unknown as Parameters<typeof sendCreatorLink>[0], insertedHashes, deletedHashes };
}

afterEach(() => vi.unstubAllGlobals());

describe('sendCreatorLink', () => {
  it('removes a one-time token when the provider explicitly rejects the email', async () => {
    const { env, insertedHashes, deletedHashes } = fakeEnv();
    const fetchMock = vi.fn().mockResolvedValue(new Response('rejected', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendCreatorLink(env, 'owner@example.test', 'room-r9', 'recover', env.APORIA_APP_ORIGIN!))
      .rejects.toThrow('could not send creator email');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(insertedHashes).toHaveLength(1);
    expect(deletedHashes).toEqual(insertedHashes);
  });

  it('does not create a token when the configured link origin is invalid', async () => {
    const { env, insertedHashes } = fakeEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendCreatorLink(env, 'owner@example.test', 'room-r9', 'login', 'http://aporia.example.test'))
      .rejects.toThrow('creator app origin must use HTTPS');

    expect(insertedHashes).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the token after the provider accepts the email', async () => {
    const { env, insertedHashes, deletedHashes } = fakeEnv();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('accepted', { status: 200 })));

    await sendCreatorLink(env, 'owner@example.test', 'room-r9', 'login', env.APORIA_APP_ORIGIN!);

    expect(insertedHashes).toHaveLength(1);
    expect(deletedHashes).toHaveLength(0);
  });
});
