// sender.js
import "dotenv/config";
import { JsonRpcProvider, Wallet, parseEther, formatEther, isAddress } from "ethers";
import { ASSET_PKS, EXECUTOR_RPC } from "./config.js";

const FUNDING_PRIVATE_KEY = process.env.FUNDING_PRIVATE_KEY;

// Send 2 ETH when balance is below 1 ETH
const MIN_BALANCE = parseEther("1.0");   // threshold: 1 ETH
const SEND_AMOUNT = parseEther("2.0");   // amount to send if under threshold

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  if (!FUNDING_PRIVATE_KEY) {
    console.error("FUNDING_PRIVATE_KEY is missing in environment (.env).");
    process.exit(1);
  }

  console.log("=== Brokex Sender – Auto-funding for low-balance accounts ===");
  console.log("RPC URL:", EXECUTOR_RPC);

  const provider = new JsonRpcProvider(EXECUTOR_RPC);

  let fundingWallet;
  try {
    fundingWallet = new Wallet(FUNDING_PRIVATE_KEY, provider);
  } catch (e) {
    console.error("Failed to create funding wallet:", e.message || e);
    process.exit(1);
  }

  const fundingBalance = await provider.getBalance(fundingWallet.address);
  console.log(
    "Funding address:",
    fundingWallet.address,
    "| Balance:",
    formatEther(fundingBalance),
    "ETH"
  );

  // Build unique address list from ASSET_PKS
  const addressMap = new Map(); // address -> { pk, assets: [] }

  for (const [assetId, pk] of Object.entries(ASSET_PKS)) {
    const trimmedPk = (pk || "").trim();

    if (!/^0x[0-9a-fA-F]{64}$/.test(trimmedPk)) {
      console.warn(`Invalid private key for asset ${assetId}, ignored: ${trimmedPk}`);
      continue;
    }

    try {
      const w = new Wallet(trimmedPk); // offline, no provider needed here
      const addr = w.address;

      const key = addr.toLowerCase();
      if (!addressMap.has(key)) {
        addressMap.set(key, {
          address: addr,
          pk: trimmedPk,
          assets: [assetId],
        });
      } else {
        addressMap.get(key).assets.push(assetId);
      }
    } catch (e) {
      console.warn(
        `Failed to derive address for asset ${assetId}:`,
        e.message || e
      );
    }
  }

  const entries = Array.from(addressMap.values());
  console.log("Derived addresses from ASSET_PKS:", entries.length);

  if (entries.length === 0) {
    console.log("No valid addresses found. Exiting.");
    return;
  }

  const toFund = [];

  console.log("\nPhase 1 – Checking balances (fund accounts with balance < 1 ETH)...");

  for (const entry of entries) {
    const { address, assets } = entry;

    if (!isAddress(address)) {
      console.warn("Invalid address, ignored:", address);
      continue;
    }

    try {
      const bal = await provider.getBalance(address);
      const balEth = formatEther(bal);
      const assetInfo = `assets: [${assets.join(", ")}]`;

      if (bal < MIN_BALANCE) {
        console.log(
          `  - ${address} | ${balEth} ETH | ${assetInfo} -> balance < 1 ETH, will be funded`
        );
        toFund.push(entry);
      } else {
        console.log(
          `  - ${address} | ${balEth} ETH | ${assetInfo} -> already funded (>= 1 ETH)`
        );
      }
    } catch (e) {
      console.warn(
        `  - ${address} | error while fetching balance:`,
        e.message || e
      );
    }
  }

  if (toFund.length === 0) {
    console.log("\nAll accounts have at least 1 ETH. Nothing to do.");
    return;
  }

  console.log(
    `\nPhase 2 – Sending ${formatEther(SEND_AMOUNT)} ETH to ${toFund.length} account(s) below threshold...`
  );

  for (const entry of toFund) {
    const { address, assets } = entry;
    const assetInfo = `assets: [${assets.join(", ")}]`;

    try {
      console.log(`Sending to ${address} (${assetInfo})...`);
      const tx = await fundingWallet.sendTransaction({
        to: address,
        value: SEND_AMOUNT,
      });
      console.log(`  Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`  Confirmed in block ${receipt.blockNumber}`);

      const newBal = await provider.getBalance(address);
      console.log(
        `  New balance for ${address}: ${formatEther(newBal)} ETH\n`
      );
    } catch (e) {
      console.error(
        `  Error while sending to ${address}:`,
        e.message || e
      );
    }

    // Space out transactions
    await sleep(500);
  }

  console.log("Done.");
}

// Direct execution: `node sender.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  });
}
