import { createDatabase } from "../lib/db/index";
import { listPredictions } from "../lib/db/repositories";
import { metricsFor } from "../lib/services/predictions";

/**
 * Backtest del benchmark DEMO.
 * Non è una validazione su dati reali: misura solo il funzionamento delle metriche
 * sulle previsioni sintetiche create dal seed.
 */
function main() {
  createDatabase();
  const predictions = listPredictions("demo-seed", true).filter(
    (prediction) => prediction.sessionId === "demo-seed",
  );
  if (predictions.length === 0) {
    console.error("Nessuna previsione DEMO trovata. Esegui prima `npm run db:seed`.");
    process.exitCode = 1;
    return;
  }

  const summary = metricsFor(predictions);
  const evaluation = summary.evaluation;

  console.log(`Benchmark DEMO: ${predictions.length} previsioni sintetiche`);
  console.log(`  Leg risolte:            ${evaluation.legs}`);
  console.log(`  Brier (binario):        ${evaluation.brierBinary.toFixed(4)}`);
  console.log(`  Log loss (binario):     ${evaluation.logLossBinary.toFixed(4)}`);
  console.log(`  Brier 1X2:              ${evaluation.brier1x2?.toFixed(4) ?? "n/d"}`);
  console.log(`  Log loss 1X2:           ${evaluation.logLoss1x2?.toFixed(4) ?? "n/d"}`);
  console.log(`  Errore calibrazione:    ${evaluation.calibrationError.toFixed(4)}`);
  console.log(`  Previsioni escluse:     ${summary.exclusions.open} aperte, ${summary.exclusions.voided} VOID`);
  console.log("");
  console.log("Questi numeri riguardano dati sintetici e non dimostrano capacità predittiva reale.");
}

main();
