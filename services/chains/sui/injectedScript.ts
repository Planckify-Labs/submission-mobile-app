/**
 * Sui — Wallet Standard announce + injected wallet shim.
 *
 * Emits a single IIFE per `docs/sui-dapp-bridge-spec.md` §5. Target:
 * ≤ 5 KB gzipped.
 *
 * Invariants (spec §5.7):
 *   - Both handshake halves fire (dispatch + listen). §5.3.
 *   - `accounts` starts empty pre-connect. §4.5.
 *   - `publicKey` is `Uint8Array(32)` post-connect. §1.3.
 *   - Feature-function identity stable across re-inject.
 *   - Legacy aliases `sui:signTransactionBlock` /
 *     `sui:signAndExecuteTransactionBlock` route to the same RPC handler.
 *   - Every outbound request stamps `__takumi_sui_nonce`. TWV-2026-015.
 *   - **No `window.sui` legacy global.** Wallet Standard discovery only.
 */

export interface SuiWalletAlias {
  /** Display name advertised to dApps (e.g. "Slush", "Suiet"). */
  name: string;
  /** Optional override icon — defaults to the TakumiPay logo. */
  icon?: string;
}

export interface SuiInjectedScriptParams {
  /** Active Sui wallet address, 0x-prefixed hex. `null` pre-connect. */
  activeAddress?: string | null;
  sessionNonce?: string;
  /**
   * `data:image/...;base64,...` data URL. Must be ≤ 100 KB. Passed as a
   * parameter so the script template stays small while the real Takumi
   * logo rides alongside.
   */
  iconDataUrl?: string;
  /**
   * Wallet-Standard aliases to announce in addition to TakumiPay.
   *
   * Curated mobile pickers (Cetus, Suilend, Navi) match auto-detected
   * wallets to their hardcoded list **by name** — an unknown name is
   * silently dropped. Announcing extra Wallet objects under known
   * names gets us into those slots; each alias shares the canonical
   * TakumiPay `connect` / `sign` functions (single signer, multiple
   * advertised identities). Same posture as the EVM `isMetaMask: true`
   * compatibility flag.
   *
   * Approval sheets remain TakumiPay-branded so the user sees what's
   * actually signing — the aliasing only changes what slot the dApp
   * routes the click through.
   */
  walletAliases?: SuiWalletAlias[];
}

/**
 * Default aliases that broaden coverage on the §13 task 19 smoke
 * targets (Cetus / Suilend / Navi) and similar curated mobile pickers.
 * The set is intentionally small and points at the well-known Sui
 * wallet brands those pickers list as install-ready slots.
 *
 * Override at the call site if a deployment wants a stricter posture
 * (e.g. ship without aliases on a regulated build).
 */
export const DEFAULT_SUI_WALLET_ALIASES: SuiWalletAlias[] = [
  { name: "Slush" },
  { name: "Sui Wallet" },
  { name: "Suiet" },
  { name: "Surf" },
];

const FALLBACK_ICON =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiMwMDAiLz48dGV4dCB4PSI1MCUiIHk9IjUyJSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iI2ZmZiIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiPlQ8L3RleHQ+PC9zdmc+";

export function getSuiInjectedScript(p: SuiInjectedScriptParams = {}): string {
  const A = JSON.stringify(p.activeAddress ?? null);
  const N = JSON.stringify(p.sessionNonce ?? "");
  const I = JSON.stringify(p.iconDataUrl ?? FALLBACK_ICON);
  const aliases = p.walletAliases ?? DEFAULT_SUI_WALLET_ALIASES;
  // Serialise as `[{name, icon}]` JSON literals — embedding strings
  // inside the IIFE template. Each alias's icon falls back to the
  // canonical TakumiPay icon (`I`) at runtime.
  const ALIAS_LITERAL = JSON.stringify(
    aliases.map((a) => ({ name: a.name, icon: a.icon ?? null })),
  );
  return `(function(){
try{
  window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({
    type:"takumi_diagnostic",
    tag:"sui_inject",
    at:Date.now(),
    alreadyInstalled:!!window.__takumi_sui_installed,
    hasActive:${A === "null" ? "false" : "true"},
    location:location.href
  }));
}catch(e){}
window.__takumi_sui_nonce=${N};
if(window.__takumi_sui_installed){
  var EW=window.__takumi_sui_wallet;
  var EA=window.__takumi_sui_aliases||[];
  if(EW){
    try{var re=new Event("wallet-standard:register-wallet");re.detail=function(api){try{api.register(EW);}catch(e){}};window.dispatchEvent(re);}catch(e){}
  }
  EA.forEach(function(aliasW){
    try{var rea=new Event("wallet-standard:register-wallet");rea.detail=function(api){try{api.register(aliasW);}catch(e){}};window.dispatchEvent(rea);}catch(e){}
  });
  return;
}
window.__takumi_sui_installed=1;
var A=${A};
var C=["sui:mainnet","sui:testnet","sui:devnet"];
var F=["standard:connect","standard:disconnect","standard:events","sui:signTransaction","sui:signTransactionBlock","sui:signAndExecuteTransaction","sui:signAndExecuteTransactionBlock","sui:signPersonalMessage","sui:reportTransactionEffects"];
function hexToBytes(h){if(typeof h!=="string")return new Uint8Array(32);var s=h.indexOf("0x")===0?h.slice(2):h;var n=s.length>>1,u=new Uint8Array(n),i;for(i=0;i<n;i++)u[i]=parseInt(s.substr(i*2,2),16);return u;}
function b64e(u){var s="",i;for(i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s);}
function b64d(s){var n=atob(s),u=new Uint8Array(n.length),i;for(i=0;i<n.length;i++)u[i]=n.charCodeAt(i);return u;}
function U(x){if(x instanceof Uint8Array)return x;if(x&&x.buffer&&typeof x.byteLength==="number")return new Uint8Array(x.buffer,x.byteOffset||0,x.byteLength);if(x instanceof ArrayBuffer)return new Uint8Array(x);if(typeof x==="string")return new TextEncoder().encode(x);throw 0;}
async function normaliseTx(t){
  if(t&&typeof t.toJSON==="function"){return await t.toJSON();}
  if(t instanceof Uint8Array)return b64e(t);
  if(t&&t.buffer&&typeof t.byteLength==="number")return b64e(new Uint8Array(t.buffer,t.byteOffset||0,t.byteLength));
  if(t instanceof ArrayBuffer)return b64e(new Uint8Array(t));
  if(typeof t==="string")return t;
  throw new Error("invalid transaction");
}
var P=window._takumiSuiPending=window._takumiSuiPending||new Map();
function R(){return Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10);}
function S(m,p){return new Promise(function(ok,ng){var id=R();P.set(id,{r:ok,j:ng});try{
  var nc=window.__takumi_sui_nonce||"";
  try{window.ReactNativeWebView.postMessage(JSON.stringify({type:"takumi_diagnostic",tag:"sui_request",at:Date.now(),method:m,id:id,hasNonce:!!nc,location:location.href}));}catch(d){}
  window.ReactNativeWebView.postMessage(JSON.stringify({type:"bridge_request",namespace:"sui",id:id,method:m,params:p,__takumi_nonce:nc,__takumi_origin:(function(){try{return window.top.location.origin;}catch(e){return location.origin;}})()}));
}catch(e){P.delete(id);ng(new Error("bridge transport failed"));}});}
var H=window._handleEthereumResponse;
window._handleEthereumResponse=function(x){try{if(x&&x.type==="bridge_response"&&P.has(x.id)){var p=P.get(x.id);P.delete(x.id);if(x.error){var e=new Error(x.error.message||"rejected");e.code=x.error.code;p.j(e);}else p.r(x.result);return;}}catch(e){}if(H)try{H(x);}catch(e){}};
// For Sui, address = BLAKE2b(0x00 || pubkey) — NOT pubkey itself. The
// account.publicKey field is the 32-byte ed25519 public key (hex,
// supplied by the bridge from wallet.sui.pubkeyHex). Falling back to
// the address bytes when no pubkey is threaded keeps backwards
// compatibility, but real dApps that derive an expected address from
// account.publicKey require the actual pubkey or they reject with
// "wrong wallet".
function MA(a){
  var addr=typeof a==="string"?a:(a&&a.address);
  var pkHex=(a&&typeof a==="object"&&a.publicKey)?a.publicKey:addr;
  return{
    address:addr,
    publicKey:hexToBytes(pkHex),
    chains:C,
    features:F,
    label:"TakumiPay"
  };
}
function NA(r){var a=(r&&r.accounts)||[],o=[],i;for(i=0;i<a.length;i++)o.push(MA(a[i]));return o;}
var lsn={change:new Set()};
function EV(e,cb){var s=lsn[e]||(lsn[e]=new Set());s.add(cb);return function(){s.delete(cb);};}
function setAccounts(next,chain){
  W.accounts=next;
  if(chain&&typeof chain==="string")W.chains=[chain].concat(C.filter(function(c){return c!==chain;}));
  lsn.change.forEach(function(cb){try{cb({accounts:next,chains:W.chains});}catch(e){}});
}
async function C1(x){
  var r=await S("standard:connect",[{silent:!!(x&&(x.silent||x.onlyIfTrusted))}]);
  var accs=NA(r);
  setAccounts(accs,r&&r.chain);
  return{accounts:accs};
}
async function D1(){
  await S("standard:disconnect",[]);
  setAccounts([]);
}
// Sui Wallet Standard v2 methods are SINGLE-input / SINGLE-output.
// Unlike Solana's variadic-input / array-output pattern, Sui dApp Kit
// invokes each sign method with one argument and expects one return
// value. Returning an array breaks dApp consumers that read
// \`result.bytes\` directly.
async function SPM(inp){
  var addr=inp&&inp.account&&inp.account.address;
  var msg=inp&&inp.message;
  var b64=b64e(U(msg));
  var r=await S("sui:signPersonalMessage",[{account:{address:addr},message:b64}]);
  return{bytes:b64d(r.bytes||b64),signature:r.signature};
}
async function ST(inp){
  var addr=inp&&inp.account&&inp.account.address;
  var ch=inp&&inp.chain;
  var bcs=await normaliseTx(inp&&inp.transaction);
  var r=await S("sui:signTransaction",[{account:{address:addr},chain:ch,transaction:bcs}]);
  return{bytes:bcs,signature:r.signature,digest:r.digest};
}
async function SAE(inp){
  var addr=inp&&inp.account&&inp.account.address;
  var ch=inp&&inp.chain;
  var bcs=await normaliseTx(inp&&inp.transaction);
  var opts=inp&&inp.options;
  var r=await S("sui:signAndExecuteTransaction",[{account:{address:addr},chain:ch,transaction:bcs,options:opts}]);
  return r;
}
async function ST_LEGACY(inp){
  var addr=inp&&inp.account&&inp.account.address;
  var ch=inp&&inp.chain;
  var bcs=await normaliseTx(inp&&(inp.transactionBlock||inp.transaction));
  var r=await S("sui:signTransactionBlock",[{account:{address:addr},chain:ch,transaction:bcs}]);
  return{transactionBlockBytes:bcs,signature:r.signature};
}
async function SAE_LEGACY(inp){
  var addr=inp&&inp.account&&inp.account.address;
  var ch=inp&&inp.chain;
  var bcs=await normaliseTx(inp&&(inp.transactionBlock||inp.transaction));
  var opts=inp&&inp.options;
  var r=await S("sui:signAndExecuteTransactionBlock",[{account:{address:addr},chain:ch,transaction:bcs,options:opts}]);
  return r;
}
async function RTE(inp){
  await S("sui:reportTransactionEffects",[{account:inp&&inp.account,chain:inp&&inp.chain,effects:inp&&inp.effects}]);
  return null;
}
async function SN(t){await S("takumi:switchNetwork",[{to:t}]);}
// Feature versions per @mysten/wallet-standard v0.13+:
//   sui:signTransaction / signAndExecuteTransaction → "2.0.0" (single I/O)
//   sui:signPersonalMessage / reportTransactionEffects → "1.0.0"
//   Legacy *Block aliases → "1.0.0"
// dApps using @mysten/dapp-kit may strict-validate version strings; the
// wrong version silently filters the wallet out of the picker.
var feats={
"standard:connect":{version:"1.0.0",connect:C1},
"standard:disconnect":{version:"1.0.0",disconnect:D1},
"standard:events":{version:"1.0.0",on:EV},
"sui:signPersonalMessage":{version:"1.0.0",signPersonalMessage:SPM},
"sui:signTransaction":{version:"2.0.0",signTransaction:ST},
"sui:signAndExecuteTransaction":{version:"2.0.0",signAndExecuteTransaction:SAE},
"sui:signTransactionBlock":{version:"1.0.0",signTransactionBlock:ST_LEGACY},
"sui:signAndExecuteTransactionBlock":{version:"1.0.0",signAndExecuteTransactionBlock:SAE_LEGACY},
"sui:reportTransactionEffects":{version:"1.0.0",reportTransactionEffects:RTE},
"takumi:switchNetwork":{version:"1.0.0",switchNetwork:SN}
};
// accounts MUST be [] pre-connect — Sui dApp Kit infers "already
// connected" otherwise and skips the connect approval flow entirely.
var W={version:"1.0.0",name:"TakumiPay",icon:${I},chains:C,features:feats,accounts:[]};
window.__takumi_sui_wallet=W;
window._updateSuiWallet=function(st){
  try{
    var n=st&&st.accounts?st.accounts.map(function(a){return MA(a);}):[];
    setAccounts(n,st&&st.chain);
  }catch(e){}
};
// Build the alias wallet objects. Each alias announces a different
// name + icon to the dApp picker but shares the canonical TakumiPay
// state (chains, features, accounts) via getters so a single
// underlying signer drives every entry. When the dApp invokes any
// alias's connect/sign feature, it reaches the same C1/ST etc.
// closures the canonical wallet uses.
var ALIAS_DEFS=${ALIAS_LITERAL};
var ALIAS_WALLETS=[];
ALIAS_DEFS.forEach(function(def){
  var aliasW={};
  Object.defineProperty(aliasW,"name",{value:def.name,enumerable:true});
  Object.defineProperty(aliasW,"icon",{value:def.icon||W.icon,enumerable:true});
  Object.defineProperty(aliasW,"version",{get:function(){return W.version;},enumerable:true});
  Object.defineProperty(aliasW,"chains",{get:function(){return W.chains;},enumerable:true});
  Object.defineProperty(aliasW,"features",{get:function(){return W.features;},enumerable:true});
  Object.defineProperty(aliasW,"accounts",{get:function(){return W.accounts;},enumerable:true});
  ALIAS_WALLETS.push(aliasW);
});
window.__takumi_sui_aliases=ALIAS_WALLETS;

// Dispatch register-wallet for the canonical wallet first, then each
// alias. dApps that use @mysten/dapp-kit keep registration order
// stable in the picker — TakumiPay shows up first for users who know
// to look for it, aliases below for matching curated entries.
try{var ev=new Event("wallet-standard:register-wallet");ev.detail=function(api){try{api.register(W);}catch(e){}};window.dispatchEvent(ev);}catch(e){}
ALIAS_WALLETS.forEach(function(aliasW){
  try{var ea=new Event("wallet-standard:register-wallet");ea.detail=function(api){try{api.register(aliasW);}catch(e){}};window.dispatchEvent(ea);}catch(e){}
});

window.addEventListener("wallet-standard:app-ready",function(e){
  var hits=0;
  try{e.detail.register(W);hits++;}catch(err){}
  ALIAS_WALLETS.forEach(function(aliasW){
    try{e.detail.register(aliasW);hits++;}catch(err){}
  });
  try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:"takumi_diagnostic",tag:"sui_app_ready",at:Date.now(),location:location.href,registered:hits}));}catch(d){}
});
// t+5s diagnostic — definitive Wallet Standard discovery probe:
//   1. Re-dispatch \`register-wallet\` and count how many listeners caught
//      it. If \`listenerHits === 0\` the dApp never set up a Wallet
//      Standard listener at all — it's a curated picker, not auto-detect.
//   2. Scan globalThis for both string-keyed and Symbol-keyed registries
//      (\`@wallet-standard/app\` has used multiple conventions across
//      versions: \`Symbol.for("__wallet-standard:wallets")\`, the
//      \`"__wallet-standard:wallets"\` string property, and recently a
//      module-scoped registry with no globalThis entry).
//   3. Dump our own wallet shape so version mismatches are obvious.
if(typeof setTimeout==="function")setTimeout(function(){
  try{
    // ── 1. Re-dispatch and count listeners ────────────────────────────
    var listenerHits=0;
    try{
      var probe=new Event("wallet-standard:register-wallet");
      probe.detail=function(api){listenerHits++;try{api.register(W);}catch(e){}};
      window.dispatchEvent(probe);
    }catch(e){}

    // ── 2. Scan globalThis registries (string + Symbol) ───────────────
    var registries=[];
    try{
      // String-keyed scan — match anything with "wallet-standard" in the name.
      Object.keys(globalThis).forEach(function(k){
        if(k.indexOf("wallet-standard")>=0||k.indexOf("walletStandard")>=0){
          var v=globalThis[k];
          registries.push({key:String(k),hasGet:!!(v&&typeof v.get==="function")});
        }
      });
      // Symbol-keyed scan — registered + unique symbols.
      Object.getOwnPropertySymbols(globalThis).forEach(function(s){
        var key=String(s);
        if(key.indexOf("wallet-standard")>=0||key.indexOf("walletStandard")>=0){
          var v=globalThis[s];
          registries.push({key:key,hasGet:!!(v&&typeof v.get==="function")});
        }
      });
      // Some bundlers stash the registry under Symbol.for.
      try{
        var fk=Symbol.for("__wallet-standard:wallets");
        var fv=globalThis[fk];
        if(fv&&typeof fv.get==="function")registries.push({key:"Symbol.for(__wallet-standard:wallets)",hasGet:true});
      }catch(e){}
    }catch(e){}

    // ── 3. Pull wallets from any registry that exposes get() ──────────
    var allWallets=[];
    try{
      Object.keys(globalThis).forEach(function(k){
        if(k.indexOf("wallet-standard")<0)return;
        var v=globalThis[k];
        if(v&&typeof v.get==="function"){
          var list=v.get();
          if(list&&list.length){
            list.forEach(function(w){
              try{allWallets.push({name:w.name,featureKeys:Object.keys(w.features||{})});}catch(e){}
            });
          }
        }
      });
    }catch(e){}

    window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({
      type:"takumi_diagnostic",
      tag:"sui_registry_t5s",
      at:Date.now(),
      location:location.href,
      listenerHits:listenerHits,
      registries:registries,
      walletCount:allWallets.length,
      wallets:allWallets,
      ourSelfShape:{
        name:W.name,
        version:W.version,
        chains:W.chains,
        featureKeys:Object.keys(W.features),
        signTransactionVersion:W.features["sui:signTransaction"]&&W.features["sui:signTransaction"].version,
        signAndExecuteVersion:W.features["sui:signAndExecuteTransaction"]&&W.features["sui:signAndExecuteTransaction"].version,
      }
    }));
  }catch(err){}
},5000);
})();`;
}
