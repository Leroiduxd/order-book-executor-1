// sender.js
import "dotenv/config";
import { JsonRpcProvider, Wallet, parseEther, formatEther, isAddress } from "ethers";
import { ASSET_PKS, EXECUTOR_RPC } from "./config.js";

const FUNDING_PRIVATE_KEY = process.env.FUNDING_PRIVATE_KEY;
const SEND_AMOUNT = parseEther("2.0"); // on envoie 2 ETH aux comptes vides

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  if (!FUNDING_PRIVATE_KEY) {
    console.error("❌ FUNDING_PRIVATE_KEY manquante dans l'environnement (.env)");
    process.exit(1);
  }

  console.log("🚀 Brokex Sender – auto-funding (comptes vides uniquement)");
  console.log("RPC:", EXECUTOR_RPC);

  const provider = new JsonRpcProvider(EXECUTOR_RPC);

  let fundingWallet;
  try {
    fundingWallet = new Wallet(FUNDING_PRIVATE_KEY, provider);
  } catch (e) {
    console.error("❌ Impossible de créer le wallet source:", e.message || e);
    process.exit(1);
  }

  const fundingBalance = await provider.getBalance(fundingWallet.address);
  console.log(
    "🏦 Adresse source:",
    fundingWallet.address,
    "| Solde:",
    formatEther(fundingBalance),
    "ETH"
  );

  // Construire la liste des adresses à partir d'ASSET_PKS
  // On évite les doublons (si plusieurs assets partagent la même PK)
  const addressMap = new Map(); // address -> { pk, assets: [] }

  for (const [assetId, pk] of Object.entries(ASSET_PKS)) {
    const trimmedPk = (pk || "").trim();

    if (!/^0x[0-9a-fA-F]{64}$/.test(trimmedPk)) {
      console.warn(`⚠️ PK invalide pour asset ${assetId}, ignorée: ${trimmedPk}`);
      continue;
    }

    try {
      const w = new Wallet(trimmedPk); // offline (pas besoin de provider ici)
      const addr = w.address;

      if (!addressMap.has(addr.toLowerCase())) {
        addressMap.set(addr.toLowerCase(), {
          address: addr,
          pk: trimmedPk,
          assets: [assetId],
        });
      } else {
        addressMap.get(addr.toLowerCase()).assets.push(assetId);
      }
    } catch (e) {
      console.warn(
        `⚠️ Impossible de dériver l'adresse pour asset ${assetId}:`,
        e.message || e
      );
    }
  }

  const entries = Array.from(addressMap.values());
  console.log("📄 Adresses dérivées à partir de ASSET_PKS:", entries.length);

  if (entries.length === 0) {
    console.log("Aucune adresse valide, arrêt.");
    return;
  }

  const toFund = [];

  console.log("\n🔍 Phase 1 – Vérification des soldes (on ne finance que les comptes avec solde = 0)…");

  for (const entry of entries) {
    const { address, assets } = entry;

    if (!isAddress(address)) {
      console.warn("⚠️ Adresse invalide ignorée:", address);
      continue;
    }

    try {
      const bal = await provider.getBalance(address);
      const balEth = formatEther(bal);
      const assetInfo = `assets: [${assets.join(", ")}]`;

      if (bal === 0n) {
        console.log(`  - ${address} | ${balEth} ETH | ${assetInfo} → solde 0 → à financer`);
        toFund.push(entry);
      } else {
        console.log(`  - ${address} | ${balEth} ETH | ${assetInfo} ✔ déjà financé`);
      }
    } catch (e) {
      console.warn(
        `  - ${address} | erreur getBalance:`,
        e.message || e
      );
    }
  }

  if (toFund.length === 0) {
    console.log("\n✅ Aucun compte avec solde 0. Rien à faire.");
    return;
  }

  console.log(`\n💸 Phase 2 – Envoi de ${formatEther(SEND_AMOUNT)} ETH à ${toFund.length} compte(s) vides…`);

  for (const entry of toFund) {
    const { address, assets } = entry;
    const assetInfo = `assets: [${assets.join(", ")}]`;

    try {
      console.log(`→ Envoi vers ${address} (${assetInfo})…`);
      const tx = await fundingWallet.sendTransaction({
        to: address,
        value: SEND_AMOUNT,
      });
      console.log(`   Tx envoyée: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`   ✅ Confirmée – block ${receipt.blockNumber}`);

      const newBal = await provider.getBalance(address);
      console.log(`   Nouveau solde: ${formatEther(newBal)} ETH\n`);
    } catch (e) {
      console.error(`   ❌ Erreur envoi vers ${address}:`, e.message || e);
    }

    // Espacement entre les envois
    await sleep(500);
  }

  console.log("🏁 Terminé.");
}

// Execution directe: `node sender.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("❌ Erreur fatale:", e);
    process.exit(1);
  });
}
