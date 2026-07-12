/** Argon2id cost parameters. `m` is memory in KiB, matching the argon2 spec. */
export interface Argon2Params {
  /** Memory cost in KiB. */
  m: number;
  /** Time cost (passes). */
  t: number;
  /** Parallelism (lanes). */
  p: number;
  /** Derived key length in bytes. */
  dkLen: number;
}

/**
 * On-disk shape of the backup blob stored in the user's Drive appDataFolder.
 *
 * The `kdf` block is *inside* the AAD (see `seedBackupCrypto.ts`), so an
 * attacker cannot rewrite `m`/`t`/`p` down to something cheap and have a
 * client honour it — GCM's tag check fails first.
 */
export interface SeedBackupBlobV1 {
  v: 1;
  kdf: {
    alg: "argon2id";
    m: number;
    t: number;
    p: number;
    salt: string;
  };
  cipher: {
    alg: "aes-256-gcm";
    iv: string;
    ct: string;
    tag: string;
  };
  createdAt: number;
}
