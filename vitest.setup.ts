/**
 * EnvVars is evaluated when notification modules import config.ts.
 * Empty strings pass isDefined, but REDIS_URL '' would still open a socket
 * if a later test imports redis.ts — keep a local dummy URL here.
 */
process.env.MOONPAY_SECRET_KEY ??= 'test';
process.env.KOLO_API_PUBLIC_KEY ??= 'test';
process.env.KOLO_API_PRIVATE_KEY ??= 'test';
process.env.KOLO_BASE_URL ??= 'https://kolo.test';
process.env.ALICE_BOB_PRIVATE_KEY ??= 'test';
process.env.ALICE_BOB_PUBLIC_KEY ??= 'test';
process.env.THREE_ROUTE_API_URL ??= 'https://3route.test';
process.env.THREE_ROUTE_API_AUTH_TOKEN ??= 'test';
process.env.REDIS_URL ??= 'redis://127.0.0.1:16379';
process.env.ADMIN_USERNAME ??= 'test';
process.env.ADMIN_PASSWORD ??= 'test';
process.env.TEMPLE_TAP_API_URL ??= 'https://tap.test';
process.env.EVM_API_URL ??= 'https://evm.test';
process.env.WERT_API_KEY ??= 'test';
process.env.GOOGLE_DRIVE_API_KEY ??= 'test';
process.env.TEMPLE_ADS_API_URL ??= 'https://ads.test';
process.env.PINATA_GATEWAY_URL ??= 'https://pinata.test';
process.env.PINATA_GATEWAY_KEY ??= 'test';
process.env.SHOULD_APP_CHECK_BLOCK_THE_APP ??= 'false';
