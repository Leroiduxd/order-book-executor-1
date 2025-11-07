// config.js
export const WS_URL = 'wss://prod-kline-ws.supra.com';
export const DEFAULT_SUPRA_API_KEY = '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2';
export const RESOLUTION = 5;

export const API_BASE = 'https://api.brokex.trade';
export const VERIFY_BASE = API_BASE;

export const EXECUTOR_PATH = 'executor.js'; // garde tel quel
export const EXECUTOR_ADDR = '0xb449FD01FA7937d146e867b995C261E33C619292';
export const EXECUTOR_RPC = 'https://atlantic.dplabs-internal.com';

export const RANGE_RATE = 0.0002; // ±0.02%
export const MAX_IDS = 200;
export const CALL_DELAY_MS = 1000;
export const DELAY_BETWEEN_REQUESTS_MS = 100;
export const RETRY_DELAY_MS = 200;
export const MAX_RETRIES = 2;
export const CLEAN_SKIP_LIMIT = 3;

export const META = {
  aapl_usd:{id:6004,name:"APPLE INC."}, amzn_usd:{id:6005,name:"AMAZON"},
  coin_usd:{id:6010,name:"COINBASE"}, goog_usd:{id:6003,name:"ALPHABET INC."},
  gme_usd:{id:6011,name:"GAMESTOP CORP."}, intc_usd:{id:6009,name:"INTEL CORPORATION"},
  ko_usd:{id:6059,name:"COCA-COLA CO"}, mcd_usd:{id:6068,name:"MCDONALD'S CORP"},
  msft_usd:{id:6001,name:"MICROSOFT CORP"}, ibm_usd:{id:6066,name:"IBM"},
  meta_usd:{id:6006,name:"META PLATFORMS INC."}, nvda_usd:{id:6002,name:"NVIDIA CORP"},
  tsla_usd:{id:6000,name:"TESLA INC"}, aud_usd:{id:5010,name:"AUSTRALIAN DOLLAR"},
  eur_usd:{id:5000,name:"EURO"}, gbp_usd:{id:5002,name:"GREAT BRITAIN POUND"},
  nzd_usd:{id:5013,name:"NEW ZEALAND DOLLAR"}, usd_cad:{id:5011,name:"CANADIAN DOLLAR"},
  usd_chf:{id:5012,name:"SWISS FRANC"}, usd_jpy:{id:5001,name:"JAPANESE YEN"},
  xag_usd:{id:5501,name:"SILVER"}, xau_usd:{id:5500,name:"GOLD"}, wti_usd:{id:5503,name:"WTI CRUDE"},
  btc_usdt:{id:0,name:"BITCOIN"}, eth_usdt:{id:1,name:"ETHEREUM"}, sol_usdt:{id:10,name:"SOLANA"},
  xrp_usdt:{id:14,name:"RIPPLE"}, avax_usdt:{id:5,name:"AVALANCHE"}, doge_usdt:{id:3,name:"DOGECOIN"},
  trx_usdt:{id:15,name:"TRON"}, ada_usdt:{id:16,name:"CARDANO"}, sui_usdt:{id:90,name:"SUI"},
  link_usdt:{id:2,name:"CHAINLINK"}, orcl_usd:{id:6038,name:"ORACLE CORPORATION"},
  dia_usd:{id:6113,name:"SPDR DOW JONES (DIA)"}, qqqm_usd:{id:6114,name:"NASDAQ-100 ETF (QQQM)"},
  iwm_usd:{id:6115,name:"ISHARES RUSSELL 2000 ETF (IWM)"}, nke_usd:{id:6034,name:"NIKE INC"}
};
export const TRADING_PAIRS = Object.keys(META);

// default per-asset PKs (can be overridden by env PK_<id>)
// EDIT HERE to add/remove keys — this file is the single source of truth
export const ASSET_PKS = {
  0:'0x30e6b5a4b85aa2546c14126ae90ccd111d9a2a0ebea2d1054927fbcfc0bae679',
  1:'0x1fbf77e7f80bbc62a6d9e5f48c53a9b0fdf5a3d319bc4f82ebd6c1900a39b8cf',
  10:'0x73764c6c4db59b05a7c047be299fc3d0a7e946f7d0924ee8e79bc813f03a8390',
  14:'0x858d92c9f08a6173296a8530119a2c2717e57deef766b1d37ed7cdec843b5a34',
  5:'0x6f5a670511d2b0df838429b9a55b9187e0dfcc7dbddd1413c7addf3e6eb890e1',
  3:'0xefd4833a9223aeadb4a0920626b1decfeba0eea6dcc2fce2b822aebeba5ce38a',
  15:'0xf0224de9accb50482163861bd6494ca926e1fd12a0315070bd5baf986e888280',
  16:'0x13b8780805c50c8f6c0e88020aa8bae32444b0844e886160dde3f64f2a25d33a',
  90:'0x2f3095bbe2e0e2b4d4821f668b4edd16f93057c1673df65d762410096344b2b9',
  2:'0x4f963ab7fa45ff630cb6bcedf1b46e996a158214161fd982e40f987a5718a2c2',
  5010:'0x9b2869e965d495b437ac39b80b880ee4ccd937c90003136cffd2d4daaa3ed2a3',
  5000:'0xa0ba7957bf03c1bf540c3c054136dd757e10653132290e18a80f5155d2015923',
  5002:'0x1cc1b15a63c39e705dcbe33e8d5e537ab3c98162928dd0b90409e542fff7ffe7',
  5013:'0xbcdf2289d1cc95cce21a612bacfc6f3f421b8932260bac291d06de89e411fbf7',
  5011:'0x377e9dc62a6cac94dbe2bf8ee42e1b67ec87af433aed9dd35dbb6812ce2cb8ef',
  5012:'0x9688709ad6a5e5d479420522e2d98b143f3016a907bc12e837b597c3c7e30936',
  5001:'0x07230cdac2d9527fe0dba37b65cfba502787a61b0537954136b4e10377a0424e',
  5501:'0x5f5c813fc653025604377fbc4a9607d36e0b24b9c8bee9e1f20a8dc867b93063',
  5500:'0x47c6a29d549627dbe2a08d117663db865f8cb832a2b7bafea5e58328c49763ce',
  5503:'0x31bdd848d64e471ff0c3f1045c71bdf07aaff3c6abe33ec8129e3bd0536ec0b0',
  6113:'0xd874c3b4ada4d76389a4ba6209fe713fe98a1199e7ceb6addbf543866cca379e',
  6114:'0x1e11e53e46013dd394862f88b35d9ae7832c89eb8c2e8183734f61163e785b20',
  6115:'0x1844472ac350150243541a2adf0c5685d8320336a73e66aba4301b94ec405b04',
  6004:'0xa24112c51b5d4e45fc68722912b3e07202ee6355abd9f2011b5d68522fc597b4',
  6005:'0x2d2c6e4d5f6e4981b8f20bbbd7e842c75046086c24ed15b3ae8f52eca79a5689',
  6010:'0xd74e3b4e10e90a5b47c837def4df6dfdbe1ba04d388261a53bc7f43ae781b7f1',
  6003:'0x093478581c2234729881d7c55c6eba32611c1cdb805ff471af7e586a9bef4069',
  6011:'0x8d47ba8bc3005d83e0f458ae8437aff9d0a3c0b1fcf54065a27a7636680efc6c',
  6009:'0xf847ca3728d61dc07364f1a8b168375dee8af75153954f691b6fb54c58116efc',
  6059:'0xcd9c28caa26d3cb44ed263cc662483f2435919c71914d0d366117a552952a95e',
  6068:'0xbbe097328882cfd1ba30e7fea0f7554856fd8898d4d00e52a03db17f41ff87ca',
  6001:'0x526ad8260f1772b8e337557246d95d04c25df80da4cd16713d739264a2488c6d',
  6066:'0x1707c9060a0bf84b9261768bd441ea7abf52f383100b1d04e383c5ccd28a3215',
  6006:'0xf74276de3dfe1f111738b996f2b4adee74f1be17c0e1edf5dd4f0b2ddefd505b',
  6002:'0xc6bad8c4d6d2dc1372cef68a23e9e00cac28456af94c49c91c6757452f733639',
  6000:'0xd46075b5bca9cf2feb1e461a18a56390f6d31bcbfec6f01e0d41d80d2444211f',
  6038:'0x25bcf46e8326e83709c955290a1f4db09840e2ee59c1936142375c1f4057f289'
};
